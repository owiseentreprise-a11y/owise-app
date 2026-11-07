/**
 * Le blocage de carte du Grand Van tient-il de bout en bout ?
 *
 *   npx tsx scripts/test-blocage-grand-van.mts
 *
 * MODE TEST STRIPE UNIQUEMENT. Le script refuse de démarrer si la clé n'est
 * pas une `sk_test`. Aucune vraie carte, aucun vrai argent, aucune écriture
 * dans la base.
 *
 * CE QU'IL PROUVE, ET POURQUOI CHAQUE POINT COMPTE
 *
 * Une réservation 8 places bloque la carte du client sans la débiter :
 * l'exploitant vérifie la disponibilité d'un véhicule, puis encaisse ou
 * libère. Trois choses peuvent mal tourner, et deux d'entre elles sont
 * silencieuses :
 *
 *   1. Le webhook ignore la session. Mesuré chez Stripe le 2026-11-07 : une
 *      session bloquée rend `payment_status: UNPAID`, et le webhook écartait
 *      jusque-là tout ce qui n'était pas `paid`. La carte serait bloquée et
 *      AUCUNE course créée — mot pour mot l'incident du 2026-10-07.
 *   2. Le client reçoit « votre course est confirmée » alors qu'elle ne
 *      l'est pas. Il cesse de chercher une autre solution.
 *   3. La course naît marquée « payée » alors que l'argent n'est pas chez
 *      Owise : une recette qui n'existe pas.
 *
 * La partie Stripe est éprouvée en vrai, sur de vraies autorisations de
 * test : on bloque, on encaisse, on vérifie que l'argent est arrivé ; puis
 * on bloque à nouveau, on libère, on vérifie que rien n'a été pris.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

for (const l of readFileSync(resolve(RACINE, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !process.env[l.slice(0, i).trim()]) {
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
  }
}
const CLE = process.env.STRIPE_SECRET_KEY
if (!CLE?.startsWith('sk_test')) {
  console.log(`\n${R}ARRÊT — la clé Stripe n'est pas une clé de test. Rien n'a été fait.${Z}\n`)
  process.exit(2)
}

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? `\n      ${G}${d}${Z}` : ''}`) }
}

const stripe = async (chemin: string, corps?: URLSearchParams) => {
  const r = await fetch(`https://api.stripe.com/v1/${chemin}`, {
    method: corps ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${CLE}`, ...(corps ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(corps ? { body: corps.toString() } : {}),
  })
  const j = await r.json()
  if (j.error) throw new Error(`${chemin} : ${j.error.message}`)
  return j as Record<string, unknown>
}

console.log(`\n${B}LE BLOCAGE DE CARTE DU GRAND VAN${Z}`)
console.log(`${G}mode test Stripe · aucune écriture en base${Z}\n`)

// ── 1. La source : seul le Grand Van bloque ─────────────────────────────
console.log(`${B}1. qui bloque, et qui paie tout de suite${Z}`)
const resActions = readFileSync(resolve(RACINE, 'src/app/reserver/actions.ts'), 'utf8')
/* Le réglage s'écrit `payment_intent_data[capture_method]` — avec le
   crochet fermant AVANT l'apostrophe. Ma première reconnaissance l'oubliait
   et criait au loup sur un code parfaitement correct. */
dire(/capture_method\]'\s*,\s*'manual'/.test(resActions),
     'la réservation sait créer un blocage (capture_method manual)')
dire(/const aValider = data\.type_vehicule === 'grand_van'/.test(resActions),
     'SEUL le Grand Van bloque — les autres véhicules paient comme avant',
     'si la condition disparaît, toutes les courses deviennent des blocages à valider')
dire(/metadata\[a_valider\]'?\s*,\s*'1'/.test(resActions),
     'le blocage se signale au webhook par un drapeau à nous')

// ── 2. Le webhook ne doit plus écarter ces sessions ─────────────────────
console.log(`\n${B}2. le webhook accepte une session bloquée${Z}`)
const wh = readFileSync(resolve(RACINE, 'src/app/api/stripe/webhook/route.ts'), 'utf8')
dire(/estBlocageAValider/.test(wh), 'le webhook reconnaît le cas « bloqué, à valider »')
dire(/session\.metadata\?\.a_valider === '1'/.test(wh),
     'il n’accepte QUE les sessions portant notre drapeau',
     'sans cette condition, n’importe quelle session impayée créerait une course')
dire(/payment_status !== 'paid' && !estBlocageAValider/.test(wh),
     'la garde d’origine reste en place pour tout le reste')
dire(/paiement_statut: meta\.a_valider === '1' \? 'autorise' : 'paye'/.test(wh),
     'la course naît « autorise », pas « paye » — l’argent n’est pas encore chez Owise')
dire(/envoyerDemandeBloquee/.test(wh),
     'le client reçoit le message « carte bloquée », pas la confirmation habituelle')

// ── 3. Les deux décisions de l'exploitant ───────────────────────────────
console.log(`\n${B}3. valider et refuser${Z}`)
const act = readFileSync(resolve(RACINE, 'src/app/admin/courses/[id]/actions.ts'), 'utf8')
dire(/paymentIntents\.capture\(/.test(act), 'valider encaisse réellement la somme bloquée')
dire(/paymentIntents\.cancel\(/.test(act), 'refuser libère réellement la retenue')
dire(/paiement_statut !== 'autorise'/.test(act),
     'on ne peut valider QUE ce qui est effectivement bloqué',
     'sans ce garde-fou, un clic pourrait encaisser deux fois ou toucher une course déjà payée')
const bloc = act.slice(act.indexOf('export async function validerReservationAction'))
dire(bloc.indexOf('.update({ paiement_statut: \'paye\' })') > bloc.indexOf('paymentIntents.capture('),
     'la base n’est mise à jour qu’APRÈS un encaissement réussi',
     'l’inverse marquerait « payé » une course dont l’argent n’est jamais arrivé')

// ── 4. STRIPE EN VRAI : bloquer puis ENCAISSER ──────────────────────────
console.log(`\n${B}4. en vrai chez Stripe — bloquer, puis encaisser${Z}`)
const creerBlocage = async (montant: number) => {
  const p = new URLSearchParams()
  p.set('amount', String(montant * 100))
  p.set('currency', 'eur')
  p.set('payment_method', 'pm_card_visa')
  p.set('payment_method_types[]', 'card')
  p.set('capture_method', 'manual')
  p.set('confirm', 'true')
  p.set('description', 'Essai Owise — blocage Grand Van')
  return await stripe('payment_intents', p)
}

const pi1 = await creerBlocage(201)
console.log(`     ${G}autorisation : ${pi1.id} · statut ${pi1.status}${Z}`)
dire(pi1.status === 'requires_capture', 'la carte est bloquée, en attente d’encaissement', String(pi1.status))
dire(Number(pi1.amount_received) === 0, 'rien n’est encore débité', `${Number(pi1.amount_received) / 100} €`)

const ch1 = pi1.latest_charge ? await stripe(`charges/${pi1.latest_charge}`) : null
const terme = (ch1 as { payment_method_details?: { card?: { capture_before?: number } } } | null)
  ?.payment_method_details?.card?.capture_before
if (terme) {
  const jours = (terme * 1000 - Date.now()) / 86400000
  console.log(`     ${G}à encaisser avant ${new Date(terme * 1000).toISOString().slice(0, 16).replace('T', ' ')} — ${jours.toFixed(1)} jours${Z}`)
  dire(jours > 3, 'le délai laissé à l’exploitant dépasse largement ses 48 h annoncées', `${jours.toFixed(1)} jours`)
} else {
  dire(false, 'Stripe annonce un terme d’encaissement', 'aucun `capture_before` — l’admin ne pourra pas afficher de date limite')
}

const pi1b = await stripe(`payment_intents/${pi1.id}/capture`, new URLSearchParams())
dire(pi1b.status === 'succeeded', 'l’encaissement aboutit', String(pi1b.status))
dire(Number(pi1b.amount_received) === 20100, 'la somme encaissée est bien celle qui était bloquée',
     `${Number(pi1b.amount_received) / 100} € au lieu de 201 €`)

// ── 5. STRIPE EN VRAI : bloquer puis LIBÉRER ────────────────────────────
console.log(`\n${B}5. en vrai chez Stripe — bloquer, puis libérer${Z}`)
const pi2 = await creerBlocage(201)
dire(pi2.status === 'requires_capture', 'deuxième carte bloquée')
const pi2b = await stripe(`payment_intents/${pi2.id}/cancel`, new URLSearchParams({ cancellation_reason: 'abandoned' }))
dire(pi2b.status === 'canceled', 'la retenue est levée', String(pi2b.status))
dire(Number(pi2b.amount_received) === 0, 'le client n’a RIEN payé',
     `${Number(pi2b.amount_received) / 100} € ont été prélevés — c’est le pire défaut possible`)

// ── 6. On ne peut pas encaisser ce qui est libéré ───────────────────────
console.log(`\n${B}6. un refus est définitif${Z}`)
let refus = false
try { await stripe(`payment_intents/${pi2.id}/capture`, new URLSearchParams()) }
catch { refus = true }
dire(refus, 'une retenue libérée ne peut plus être encaissée par erreur')

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}`)
console.log(`${G}Tout s'est passé en mode test. Aucun argent réel n'a été engagé.${Z}\n`)
