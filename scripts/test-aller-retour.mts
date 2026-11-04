/**
 * Un aller-retour encaissé une fois produit-il deux courses qui font la somme ?
 *
 * Le défaut, constaté le 2026-11-04 sur la course de M. Soter Ranguin — le
 * premier aller-retour jamais payé en ligne :
 *
 *     Stripe a encaissé        283 €
 *     course « aller »         283 €   (le webhook écrivait le TOTAL)
 *     course « retour »        142 €   (le formulaire écrivait la MOITIÉ)
 *     enregistré au total      425 €
 *
 * Personne ne décidait le partage : deux fichiers en décidaient chacun de leur
 * côté, et ne se parlaient pas. 142 € de chiffre d'affaires qui n'ont jamais
 * été encaissés.
 *
 * Quatre contrôles :
 *   1. l'arithmétique — partAller + partRetour vaut toujours le total ;
 *   2. rien ne s'écrit en base avant le paiement ;
 *   3. le webhook écrit bien la PART de l'aller, pas le total ;
 *   4. sur les vraies données : une facture vaut la somme de ses courses.
 *
 *   npx tsx scripts/test-aller-retour.mts
 */
import { readFileSync } from 'fs'
import { join, resolve } from 'path'

for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')
const { partAller, partRetour } = await import('../src/lib/calcPrix')
const { formaterMontant } = await import('../src/lib/montant')

let ok = 0
const echecs: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  \x1b[32m✓\x1b[0m ${t}`) }
  else { echecs.push(t); console.log(`  \x1b[31m✗\x1b[0m ${t}${d ? ` — ${d}` : ''}`) }
}
const lire = (f: string) => readFileSync(resolve(f), 'utf8')

console.log('\n\x1b[1mUN ALLER-RETOUR PAYÉ UNE FOIS FAIT-IL BIEN LA SOMME ?\x1b[0m')

// ── 1. L'arithmétique ──────────────────────────────────────────────────────
console.log('\n\x1b[1m1. La règle de partage\x1b[0m')
/* Le cas reel d'abord, puis une plage large : impairs, pairs, avec et sans
   surcout d'arrets. Un seul total qui ne tombe pas juste suffit a fausser une
   comptabilite. */
let ecarts = 0
for (let total = 1; total <= 2000; total++) {
  for (const surcout of [0, 15, 30]) {
    if (surcout >= total) continue
    if (partAller(total, surcout) + partRetour(total, surcout) !== Math.round(total)) ecarts++
  }
}
dire(ecarts === 0, 'aller + retour = total encaissé, sur 2000 montants × 3 surcoûts d\'étapes',
     `${ecarts} écart(s)`)
dire(partRetour(283) === 142 && partAller(283) === 141,
     'le cas réel : 283 € encaissés → 141 € aller + 142 € retour',
     `obtenu : ${partAller(283)} + ${partRetour(283)}`)
dire(partAller(100) === 50 && partRetour(100) === 50,
     'un total pair se partage en deux parts égales')
dire(partRetour(230, 30) === 100 && partAller(230, 30) === 130,
     'le surcoût des étapes reste sur l\'aller (230 € dont 30 € d\'étape → 130 + 100)',
     `obtenu : ${partAller(230, 30)} + ${partRetour(230, 30)}`)

// ── 2. Rien ne s'écrit avant le paiement ───────────────────────────────────
console.log('\n\x1b[1m2. Aucune écriture en base avant le paiement\x1b[0m')
const actions = lire('src/app/reserver/actions.ts')
/* `reserver/actions.ts` prepare la session Stripe. Il ne doit creer AUCUNE
   course : un client qui renonce a la page de paiement laisserait sinon une
   course fantome dans le planning. C'est ce que faisait la creation du retour
   jusqu'au 2026-11-04. */
const ecrituresAvantPaiement = [...actions.matchAll(/from\(\s*'courses'\s*\)\s*\.\s*(insert|upsert)/g)]
dire(ecrituresAvantPaiement.length === 0,
     'reserver/actions.ts ne crée aucune course avant le paiement',
     `${ecrituresAvantPaiement.length} écriture(s) trouvée(s)`)
dire(/metadata\[prix_retour\]/.test(actions),
     'la part du retour est transmise à Stripe, pour que le webhook la soustraie')
dire(/metadata\[adresse_arrivee_retour\]/.test(actions),
     'l\'adresse d\'arrivée du retour est transmise, sinon le webhook ne peut pas le créer')

// ── 3. Le webhook écrit la part, pas le total ──────────────────────────────
console.log('\n\x1b[1m3. Le webhook partage le montant encaissé\x1b[0m')
const webhook = lire('src/app/api/stripe/webhook/route.ts')
dire(/prix_estime:\s*prixAller/.test(webhook),
     'la course aller reçoit sa PART (prixAller), pas le montant encaissé entier')
dire(!/prix_estime:\s*prix,/.test(webhook),
     'plus aucune course ne reçoit `prix` — le total — comme prix estimé')
dire(/prix_estime:\s*prixRetour/.test(webhook),
     'le webhook crée le retour et lui donne sa part')
dire(/paiement_statut:\s*'paye'[\s\S]{0,400}?notes:\s*'Retour'|notes:\s*'Retour'[\s\S]{0,400}?paiement_statut:\s*'paye'/.test(webhook),
     'le retour naît payé — le client vient de le payer avec l\'aller')
dire(/\.in\('id',\s*idsCourses\)/.test(webhook),
     'les deux trajets sont rattachés à la même facture')

/* Les deux filets de transition. Une session de paiement Stripe reste
   ouverte 24 h : une session ouverte AVANT le 2026-11-04 n'a pas
   `prix_retour` dans ses metadonnees, et a deja cree son retour par
   l'ancien chemin. Sans ces deux filets, elle produirait un aller au
   montant total et un TROISIEME trajet a 0 EUR. */
dire(/partRetour\(prix\)/.test(webhook),
     'sans `prix_retour` dans les métadonnées, le webhook recalcule la même part')
dire(/\.is\('stripe_payment_intent_id',\s*null\)/.test(webhook),
     'un retour déjà créé avant paiement est repris, jamais dupliqué')

// ── 4. Les vraies données ──────────────────────────────────────────────────
console.log('\n\x1b[1m4. Sur les données réelles : une facture vaut la somme de ses courses\x1b[0m')
const sb = createAdminClient()
const [{ data: factures }, { data: courses }] = await Promise.all([
  sb.from('factures').select('id,numero,montant_ttc,statut'),
  sb.from('courses').select('id,facture_id,prix_estime,prix_final,date_prevue,notes'),
])
let controlees = 0
for (const f of factures ?? []) {
  const liees = (courses ?? []).filter(c => c.facture_id === f.id)
  if (liees.length === 0) continue
  controlees++
  const somme = liees.reduce((s, c) => s + Number(c.prix_final ?? c.prix_estime ?? 0), 0)
  const ttc = Number(f.montant_ttc)
  dire(Math.abs(somme - ttc) < 0.5,
       `${f.numero} : ${liees.length} course(s) pour ${formaterMontant(ttc)}`,
       `somme des courses : ${formaterMontant(somme)} — écart ${formaterMontant(somme - ttc)}`)
}
if (controlees === 0) dire(false, 'aucune facture rattachée à une course — le contrôle ne vérifie rien')

console.log()
console.log(echecs.length
  ? `\x1b[31m${ok} réussi(s), ${echecs.length} échec(s)\x1b[0m\n`
  : `\x1b[32m${ok} contrôle(s) au vert\x1b[0m\n`)
process.exit(echecs.length ? 1 : 0)
