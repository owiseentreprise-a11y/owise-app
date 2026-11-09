/**
 * Contrôle du PDF de devis.
 *
 * Il ne vérifie pas que le fichier « existe » : il le RELIT et compare ce
 * qu'on y trouve à ce que dit la base, sur TOUS les devis. C'est la règle
 * tirée du 2026-09-23 — un contrôle qui ne cherche pas au bon endroit
 * rassure à tort.
 *
 *   npx tsx scripts/test-devis-pdf.mts [--ecrire <dossier>]
 *
 * LIMITE CONNUE — les contrôles de ligne cherchent dans TOUT le texte du
 * document, pas dans la ligne concernee. Sur un devis ou une arrivee figure
 * aussi comme depart d'un autre trajet (DEV-202611-0001 : Chasseloup-Laubat,
 * Chantilly), une arrivee fausse reste trouvee ailleurs et le controle passe.
 * Mesure du 2026-11-03 : en remplacant TOUTES les arrivees par « Gare du
 * Nord », un seul des neuf controles d'arrivee est passe au rouge.
 * Pour y remedier il faudrait decouper le texte par ligne de prestation.
 */
import { config } from 'dotenv'
import { resolve } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'

config({ path: resolve(process.cwd(), '.env.local') })

const { lireTextePdf } = await import('./lire-pdf.mjs')
const { createAdminClient } = await import('../src/lib/supabase/admin')
const { rendreDevisPdf } = await import('../src/lib/devis-pdf')
const { nettoyerPourPdf } = await import('../src/lib/pdf-feuille')
const { formaterMontant } = await import('../src/lib/montant')
const {
  chargerPrestataire, dateCourte, detailLigne, lignesTotaux,
  mentionsDevis, phraseAttente, LIBELLE_NET,
} = await import('../src/lib/devis-client')

const iEcrire = process.argv.indexOf('--ecrire')
const dossier = iEcrire >= 0 ? process.argv[iEcrire + 1] : null

let reussis = 0
const echecs: string[] = []

function verifier(nom: string, condition: boolean, detail = '') {
  if (condition) { reussis++; return }
  echecs.push(`${nom}${detail ? ` — ${detail}` : ''}`)
}

/**
 * Comparaison indulgente sur les accents, la casse et les retours a la ligne,
 * stricte sur le reste.
 *
 * Les espaces sont ramenes a un seul : un trajet long est coupe sur deux
 * lignes dans le PDF, et chercher la chaine telle quelle echouait sur un
 * document pourtant juste (releve le 2026-11-03 sur DEV-202611-0002). Les
 * mots doivent toujours s'y trouver, et dans l'ordre.
 */
function normaliser(s: string): string {
  /* Les espaces d'abord : `nettoyerPourPdf` SUPPRIME le saut de ligne au lieu
     de le remplacer — il n'est pas encodable en WinAnsi — et « Aeroport
Paris »
     devenait « AeroportParis ». Nettoyer ensuite arrivait trop tard. */
  return nettoyerPourPdf(s.replace(/\s+/g, ' '))
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function contient(texte: string, attendu: string): boolean {
  return normaliser(texte).includes(normaliser(attendu))
}

const supabase = createAdminClient()
const { data, error } = await supabase
  .from('devis_clients').select('*').order('numero', { ascending: true })

if (error) { console.error('Lecture impossible :', error.message); process.exit(1) }
const devis = (data ?? []).map(d => ({ ...d, lignes: Array.isArray(d.lignes) ? d.lignes : [] }))

if (devis.length === 0) {
  console.log('\nAucun devis en base — rien à contrôler.\n')
  process.exit(0)
}

const prestataire = await chargerPrestataire()
if (dossier) mkdirSync(dossier, { recursive: true })

console.log(`\nContrôle du PDF de devis — ${devis.length} devis\n`)

for (const d of devis) {
  const octets = await rendreDevisPdf(d as never, prestataire)
  const texte = lireTextePdf(octets)
  const ref = d.numero

  if (dossier) writeFileSync(resolve(dossier, `${d.numero}.pdf`), Buffer.from(octets))

  // Identité du document
  verifier(`${ref} · numéro`, contient(texte, d.numero))
  verifier(`${ref} · mot DEVIS`, contient(texte, 'DEVIS'))

  /* L'identité de l'émetteur — exploitant, adresse du siège, SIRET, code APE.
     Elle manquait : un commentaire du PDF annonçait qu'elle « descend en bas
     de page », mais `basDePage()` ne l'a jamais contenue, et aucun contrôle
     ne la cherchait. Un devis engage son émetteur et doit la porter, au même
     titre qu'une facture. Trouvé le 2026-11-09 en alignant le devis et la
     facture, et vérifié rouge en retirant la boucle qui l'écrit. */
  for (const [i, ligne] of prestataire.legal.entries()) {
    verifier(`${ref} · identité de l'émetteur (${i + 1}/${prestataire.legal.length})`,
      contient(texte, ligne.slice(0, 34)), ligne.slice(0, 34))
  }
  verifier(`${ref} · nom du client`,
    contient(texte, d.client_societe || d.client_nom || ''),
    `cherché « ${d.client_societe || d.client_nom} »`)

  // Chaque prestation, son heure, son trajet, son prix
  for (const [i, l] of (d.lignes as never[]).entries()) {
    const ligne = l as { heure: string; depart: string; arrivee: string; prix: number }
    const n = `${ref} · ligne ${i + 1}`
    if (ligne.depart)  verifier(`${n} départ`,  contient(texte, ligne.depart.slice(0, 28)))
    if (ligne.arrivee) verifier(`${n} arrivée`, contient(texte, ligne.arrivee.slice(0, 28)))
    if (ligne.heure)   verifier(`${n} heure`,   contient(texte, ligne.heure))
    verifier(`${n} prix`, contient(texte, formaterMontant(Number(ligne.prix))),
      `cherché « ${formaterMontant(Number(ligne.prix))} »`)
    const detail = detailLigne(l as never)
    if (detail) verifier(`${n} détail`, contient(texte, detail.slice(0, 30)))
  }

  // Les montants s'écrivent en français — jamais « 1234.00 »
  verifier(`${ref} · total en français`,
    contient(texte, formaterMontant(Number(d.total_ht))),
    `cherché « ${formaterMontant(Number(d.total_ht))} »`)
  verifier(`${ref} · aucun montant à l'anglaise`,
    !/\d\.\d{2}\s*(?:EUR|€|\\u20ac)/.test(texte),
    'un montant est écrit avec un point décimal')
  verifier(`${ref} · libellé du net`, contient(texte, LIBELLE_NET))

  // Les lignes de total annoncées par la source unique y sont toutes
  for (const t of lignesTotaux(d as never)) {
    verifier(`${ref} · total « ${t.libelle} »`, contient(texte, t.libelle))
  }

  // La clause d'attente : présente si et seulement si elle est due
  const attente = phraseAttente()
  verifier(`${ref} · clause d'attente`,
    attente ? contient(texte, attente.slice(0, 40)) : !contient(texte, "d'attente est facturee"),
    attente ? 'attendue, absente' : 'non due, pourtant présente')

  // Les mentions légales, et SURTOUT la bonne selon le type de client
  for (const m of mentionsDevis(d as never)) {
    verifier(`${ref} · mention`, contient(texte, m.slice(0, 50)), m.slice(0, 50))
  }
  verifier(`${ref} · pénalité L441-10 réservée aux pros`,
    Boolean(d.client_societe) === contient(texte, 'L441-10'),
    d.client_societe
      ? 'client professionnel : la pénalité devrait figurer'
      : 'client particulier : la pénalité ne doit PAS figurer')

  // Les dates
  if (d.date_validite) {
    verifier(`${ref} · date de validité`, contient(texte, dateCourte(d.date_validite) ?? ''))
  }
  if (d.date_prestation) {
    verifier(`${ref} · date de prestation`, contient(texte, dateCourte(d.date_prestation) ?? ''))
  }

  /* Le pied cherchait « owise.fr ». Cette adresse etait ecrite dans le pied
     du PDF seul : le document a l'ecran ne l'a jamais portee, et le devis
     etait donc le seul des trois a l'afficher. Le pied du PDF rend
     desormais les memes mentions que la page, et le moyen de joindre Owise
     est la ou la page le met — dans le cartouche « Prestataire ».
     On controle donc ce que le document declare, pas une chaine choisie
     ici : sans cela, le controle validerait sa propre idee du document. */
  if (prestataire.email) {
    verifier(`${ref} · moyen de joindre Owise`, contient(texte, prestataire.email))
  }
  if (prestataire.telephone) {
    verifier(`${ref} · telephone Owise`, contient(texte, prestataire.telephone))
  }

  const n = (d.lignes as unknown[]).length
  console.log(`  ${d.numero.padEnd(20)} ${String(octets.length).padStart(5)} o · ${n} ligne(s) · ${d.statut}`)
}

console.log()
if (echecs.length) {
  console.log(`${reussis} contrôle(s) réussi(s), ${echecs.length} échec(s) :\n`)
  for (const e of echecs) console.log(`  ✗ ${e}`)
  console.log()
  process.exit(1)
}
console.log(`${reussis} contrôle(s) réussi(s), 0 échec(s)\n`)
