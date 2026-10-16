/**
 * Saisit les cinq transferts du 7 octobre 2026 facturés à SKORP Production,
 * et met la fiche client au bon format : une entreprise, et Kim comme
 * représentante.
 *
 * POURQUOI
 *
 * La facture OW-202610-0006 a été établie à partir d'un relevé, hors du
 * système. Les cinq courses n'existaient donc nulle part : /admin/facturation
 * affichait « 1 090 € » sans une seule ligne, le PDF généré ne savait rien
 * dire du travail fourni, et les statistiques d'octobre ignoraient cinq
 * prestations réelles.
 *
 * L'HEURE, ET CE QU'ELLE N'EST PAS
 *
 * `courses.date_prevue` est obligatoire. Le relevé ne donne aucune heure —
 * seulement la date du 7 octobre. Plutôt que d'inventer cinq horaires
 * plausibles, les cinq courses portent 00h00 et chacune le dit dans ses
 * notes : « heure non communiquée ». Décision prise par l'exploitant le
 * 2026-10-16. Un horaire inventé est indiscernable d'un horaire vrai une fois
 * en base ; une note, non.
 *
 * L'instant est construit par `instantDepuisSaisieParis()` : une date-heure
 * sans fuseau n'est pas un instant, et le serveur Vercel tourne en temps
 * universel.
 *
 * LA STRUCTURE
 *
 * SKORP Production est le CLIENT (compte entreprise). Kim en est la
 * représentante : elle devient un `collaborateur`, pas un prénom collé sur la
 * fiche de l'entreprise. Les cinq courses lui sont rattachées.
 *
 *   npx tsx scripts/saisir-prestations-skorp.mts           montre
 *   npx tsx scripts/saisir-prestations-skorp.mts --ecrire  applique
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = ligne.indexOf('=')
  if (i > 0) process.env[ligne.slice(0, i).trim()] ??= ligne.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')
const { instantDepuisSaisieParis } = await import('../src/lib/heure')

const ECRIRE = process.argv.includes('--ecrire')
const admin = createAdminClient()

const QUAND = instantDepuisSaisieParis('2026-10-07T00:00').toISOString()
const DEPART = 'Athis-Mons, 91200, France'

/** Les cinq prestations, exactement comme la facture les décrit. */
const PRESTATIONS = [
  { arrivee: "Porte d'Orléans, 75014 Paris, France",      prix: 180, detail: 'Transfert 110 € · attente 70 €' },
  { arrivee: "Porte d'Orléans, 75014 Paris, France",      prix: 200, detail: 'Transfert 110 € · attente 70 € · 1 arrêt 20 €' },
  { arrivee: 'Paris 11e, 75011 Paris, France',            prix: 240, detail: 'Transfert 110 € · attente 70 € · 3 arrêts 60 €' },
  { arrivee: 'Nation, 75012 Paris, France',               prix: 220, detail: 'Transfert 110 € · attente 70 € · 2 arrêts 40 €' },
  { arrivee: 'Porte de Pantin, 75019 Paris, France',      prix: 250, detail: "Transfert 110 € · 2 h d'attente 140 €" },
]

const { data: facture } = await admin.from('factures')
  .select('id, numero, montant_ttc, client_id')
  .eq('numero', 'OW-202610-0006').single()
if (!facture?.client_id) { console.log('ARRÊT — facture introuvable ou sans client.'); process.exit(1) }

const { count: dejaLa } = await admin.from('courses')
  .select('id', { count: 'exact', head: true })
  .eq('facture_id', facture.id)
if (dejaLa) { console.log(`ARRÊT — ${dejaLa} course(s) sont déjà rattachées à cette facture.`); process.exit(1) }

const total = PRESTATIONS.reduce((s, p) => s + p.prix, 0)
if (total !== Number(facture.montant_ttc)) {
  console.log(`ARRÊT — les cinq lignes font ${total} €, la facture ${facture.montant_ttc} €. On ne saisit pas un détail qui ne fait pas le total.`)
  process.exit(1)
}

console.log(`facture ${facture.numero} — ${facture.montant_ttc} €\n`)
console.log(`date retenue : ${QUAND}  (7 octobre 2026, 00h00 heure de Paris)`)
console.log('heure réelle : non communiquée, notée sur chaque course\n')
for (const [i, p] of PRESTATIONS.entries()) {
  console.log(`  0${i + 1}  ${DEPART.split(',')[0]} → ${p.arrivee.split(',')[0].padEnd(20)} ${String(p.prix).padStart(4)} €   ${p.detail}`)
}
console.log(`\n  total ${total} €`)

console.log('\nFICHE CLIENT — mise au format entreprise')
console.log('   clients      SKORP Production (entreprise), prénom retiré de la fiche société')
console.log('   collaborateur Kim — représentante, +33634117251, Skorp.rc@gmail.com')

if (!ECRIRE) { console.log('\nSIMULATION — rien n’est écrit. Relancer avec « --ecrire ».\n'); process.exit(0) }

/* 1. Kim devient collaboratrice, si elle ne l'est pas déjà. */
const { data: dejaCollab } = await admin.from('collaborateurs')
  .select('id').eq('client_id', facture.client_id).ilike('email', 'Skorp.rc@gmail.com')
let collaborateurId = dejaCollab?.[0]?.id
if (!collaborateurId) {
  const { data: c, error } = await admin.from('collaborateurs').insert({
    client_id: facture.client_id,
    prenom: 'Kim', nom: 'SKORP Production',
    poste: 'Représentante', tel: '+33634117251', email: 'Skorp.rc@gmail.com',
  }).select('id').single()
  if (error) { console.log(`ÉCHEC collaborateur : ${error.message}`); process.exit(1) }
  collaborateurId = c.id
  console.log(`\n   collaboratrice créée   ${collaborateurId}`)
} else {
  console.log(`\n   collaboratrice déjà présente   ${collaborateurId}`)
}

/* 2. La fiche société ne porte plus le prénom de sa représentante. */
const { error: eClient } = await admin.from('clients')
  .update({ prenom: null, nom: null }).eq('id', facture.client_id)
if (eClient) console.log(`   ⚠ fiche société inchangée : ${eClient.message}`)
else console.log('   fiche société nettoyée (prénom et nom retirés, entreprise_nom conservé)')

/* 3. Les cinq courses. */
const lignes = PRESTATIONS.map(p => ({
  client_id: facture.client_id,
  collaborateur_id: collaborateurId,
  facture_id: facture.id,
  date_prevue: QUAND,
  adresse_depart: DEPART,
  adresse_arrivee: p.arrivee,
  prix_estime: p.prix,
  prix_final: p.prix,
  statut: 'terminee',
  paiement_a_bord: false,
  mode_paiement: 'virement',
  source: 'manuel',
  notes: `${p.detail} — prestation du 7 octobre 2026, heure non communiquée (facture ${facture.numero}, établie sur relevé).`,
}))

const { data: creees, error: eCourses } = await admin.from('courses').insert(lignes).select('id, prix_estime')
if (eCourses) { console.log(`ÉCHEC courses : ${eCourses.message}`); process.exit(1) }
console.log(`   ${creees?.length} course(s) créée(s)`)
writeFileSync(join(process.cwd(), '..', 'courses-skorp-creees.json'), JSON.stringify(creees, null, 2))

/* Relecture depuis la base. */
const { data: relues } = await admin.from('courses')
  .select('adresse_arrivee, prix_estime, statut').eq('facture_id', facture.id).order('prix_estime')
const somme = (relues ?? []).reduce((s, c) => s + Number(c.prix_estime ?? 0), 0)
console.log(`\nRELU EN BASE : ${relues?.length} course(s), total ${somme} €`)
const bon = relues?.length === 5 && somme === Number(facture.montant_ttc)
console.log(bon ? 'fait — le détail de la facture est désormais dans le système.' : 'ÉCHEC — le détail ne se relit pas correctement.')
process.exitCode = bon ? 0 : 1
