/**
 * Envoie une facture par e-mail, à l'adresse qu'on lui indique.
 *
 * POURQUOI CE SCRIPT EXISTE
 *
 * L'écran d'administration sait déjà envoyer une facture — mais toujours au
 * client, à l'adresse de son compte (`envoyerFactureParEmail` appelle
 * `getUserEmail(facture.client_id)`). Il n'y a aucun moyen, depuis l'écran, de
 * se faire envoyer une facture à soi-même pour la relire avant de la
 * transmettre. C'est ce que fait ce script, et rien d'autre.
 *
 * CE QU'IL NE REFAIT PAS
 *
 * Le contenu de la facture est décrit une seule fois, dans
 * `src/lib/facture-document.ts` ; le PDF joint est produit par
 * `envoyerNouvelleFacture`, exactement comme pour un envoi depuis l'écran. Ce
 * script ne réécrit ni un libellé, ni un format de montant, ni une règle
 * d'IBAN : il lit le document et le passe à la fonction d'envoi du projet.
 *
 * Simulation par défaut. Rien ne part sans `--envoyer`.
 *
 *   npx tsx scripts/envoyer-facture.mts <numero> <adresse>
 *   npx tsx scripts/envoyer-facture.mts <numero> <adresse> --envoyer
 */
import { readFileSync } from 'fs'
import { join } from 'path'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = ligne.indexOf('=')
  if (i > 0) process.env[ligne.slice(0, i).trim()] ??= ligne.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}

const { createAdminClient }      = await import('../src/lib/supabase/admin')
const { chargerDocumentFacture } = await import('../src/lib/facture-document')
const { envoyerNouvelleFacture } = await import('../src/lib/email')

const args = process.argv.slice(2)
const [numero, adresse] = args.filter(a => !a.startsWith('--'))
const ENVOYER = args.includes('--envoyer')
const valeur = (nom: string) => {
  const i = args.indexOf(nom)
  return i >= 0 ? args[i + 1] : undefined
}
/* Facture établie hors du système : son PDF ne peut pas être produit à partir
 * de la base, puisque les prestations n'y sont pas des courses. On joint
 * alors le document réellement remis au client. */
const CHEMIN_PDF = valeur('--pdf')
/* Même raison : sans client rattaché, le document ne connaît pas son nom. */
const NOM = valeur('--nom')
/* Client sans compte sur le site : pas de lien vers l'espace client. */
const SANS_COMPTE = args.includes('--sans-compte')

if (!numero || !adresse) {
  console.log('usage : npx tsx scripts/envoyer-facture.mts <numero> <adresse> [--pdf <fichier>] [--nom "..."] [--envoyer]')
  process.exit(1)
}
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adresse)) {
  console.log(`ARRET — « ${adresse} » n'est pas une adresse e-mail.`)
  process.exit(1)
}

const admin = createAdminClient()
const { data: facture } = await admin
  .from('factures')
  .select('id, numero, mode_paiement, date_echeance, statut')
  .eq('numero', numero)
  .single()

if (!facture) { console.log(`ARRET — aucune facture « ${numero} ».`); process.exit(1) }

const doc = await chargerDocumentFacture(facture.id)
if (!doc) { console.log('ARRET — document de facture illisible.'); process.exit(1) }

const { data: params } = await admin.from('parametres').select('facture_taux_tva').eq('id', true).single()
const tauxTva = Number(params?.facture_taux_tva ?? 0)

/* Même description que l'envoi depuis l'écran : une facture peut regrouper
 * plusieurs courses, et n'en porter aucune. */
const refCourse = doc.lignes.length === 0
  ? doc.numero
  : doc.lignes.length === 1
    ? `${doc.lignes[0].date} — ${doc.lignes[0].depart} → ${doc.lignes[0].arrivee}`
    : `${doc.lignes.length} courses`

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'

/* Le PDF fourni, s'il y en a un. Lu AVANT l'affichage, pour que la
 * simulation annonce exactement ce qui partira. */
let pieceJointeFournie
if (CHEMIN_PDF) {
  const contenu = readFileSync(CHEMIN_PDF)
  if (contenu.subarray(0, 4).toString() !== '%PDF') {
    console.log(`ARRET — ${CHEMIN_PDF} ne commence pas par « %PDF ».`)
    process.exit(1)
  }
  pieceJointeFournie = { filename: CHEMIN_PDF.split(/[\\/]/).pop()!, content: contenu }
}

const nomClient = NOM ?? doc.client.nom

console.log(`facture      ${doc.numero}`)
console.log(`client       ${nomClient}${NOM ? '  (donné en argument : aucun compte rattaché)' : ''}`)
console.log(`montant      ${doc.montantHt} € HT · TVA ${doc.tva} € · ${doc.montantTtc} € TTC`)
console.log(`statut       ${doc.statutLabel}${doc.payee ? ' (aucune échéance annoncée)' : ''}`)
console.log(`courses      ${doc.lignes.length === 0 ? 'aucune rattachée' : refCourse}`)
console.log(`destinataire ${adresse}`)
console.log(`pièce jointe ${pieceJointeFournie
  ? pieceJointeFournie.filename + '  (' + Math.round(pieceJointeFournie.content.length / 1024) + ' Ko, fourni)'
  : 'PDF produit par le projet, identique à celui de l’écran'}`)

/* Garde-fou. Ce script peut écrire à n'importe qui : on refuse d'envoyer une
 * facture qui déclarerait une TVA, puisque Owise est en franchise en base
 * (art. 293 B). Une telle facture est un défaut à corriger, pas à expédier. */
if (doc.tva !== 0) {
  console.log(`\nARRET — cette facture déclare ${doc.tva} € de TVA.`)
  console.log('Owise est en franchise en base : aucune TVA ne doit être facturée.')
  console.log('Corriger la facture avant de l\'envoyer.')
  process.exit(1)
}

if (!ENVOYER) {
  console.log('\nSIMULATION — rien n\'est parti. Relancer avec « --envoyer ».\n')
  process.exit(0)
}

try {
  await envoyerNouvelleFacture({
    clientEmail:  adresse,
    clientNom:    nomClient,
    factureNumero: doc.numero,
    montantHt:    doc.montantHt,
    montantTtc:   doc.montantTtc,
    tauxTva,
    dateEcheance: facture.date_echeance ?? new Date().toISOString(),
    refCourse,
    lienFacture:  `${siteUrl}/espace-client/factures/${facture.id}`,
    dejaReglee:   doc.payee,
    modePaiement: facture.mode_paiement ?? null,
    factureId:    facture.id,
    pieceJointeFournie,
    /* Kim n'a pas de compte : ni espace client, ni bouton qui mènerait a un
     * ecran de connexion infranchissable. */
    sansEspaceClient: SANS_COMPTE,
  })
} catch (e) {
  console.log(`\nECHEC — ${(e as Error).message}`)
  process.exit(1)
}

console.log(`\nenvoyé à ${adresse}\n`)
