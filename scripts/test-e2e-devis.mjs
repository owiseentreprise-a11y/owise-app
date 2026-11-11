/**
 * Le webhook crée-t-il vraiment les courses quand le CLIENT accepte son devis ?
 *
 *   node scripts/test-e2e-devis.mjs
 *
 * ENVIRONNEMENT ISOLÉ, monté par scripts/stack-test-local.mjs : PostgreSQL et
 * PostgREST jetables sur localhost, application lancée avec
 * .env.test.integration, aucun appel à Stripe (les événements sont signés
 * ici), clé Resend vide donc aucun e-mail ne peut partir.
 *
 * POURQUOI CE TEST EXISTE
 *
 * Un devis accepté par le client déclenche la même mécanique que le Grand Van
 * — carte retenue, pas débitée — mais avec UNE différence qui change tout :
 * un devis porte PLUSIEURS prestations et une SEULE retenue. Tout ce qui
 * suit en dépend. L'identifiant du paiement doit être posé sur CHACUNE des
 * courses : sans lui, `validerReservationAction` refuse d'encaisser
 * (« Aucun paiement Stripe associé »), la carte du client reste bloquée sept
 * jours, Stripe libère la somme tout seul, et la course est faite sans que
 * rien n'ait été perçu.
 *
 * Stripe ne peut pas joindre un site local : sans ce banc, aucun devis
 * accepté n'aurait jamais créé une seule course avant un vrai client.
 *
 * Prérequis : la pile et l'application tournent déjà.
 *   node scripts/stack-test-local.mjs up
 *   node scripts/proxy-supabase-test.mjs 54320 54321
 *   set -a && . ./.env.test.integration && set +a \
 *     && export NEXT_PUBLIC_SUPABASE_URL=http://localhost:54320 \
 *     && npx next dev -p 3210
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHmac, randomUUID } from 'node:crypto'

const APP = process.env.OW_APP ?? 'http://localhost:3210'
const PG = 'owise-test-pg'
const DB = 'owise_test'
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

const env = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.test.integration'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.trimStart().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}

const WHSEC = env.STRIPE_WEBHOOK_SECRET
if (!WHSEC) { console.error('STRIPE_WEBHOOK_SECRET absent de .env.test.integration'); process.exit(2) }

/* Garde-fou : ce script ne doit JAMAIS parler à la production. */
if (!/localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  console.error(`ARRÊT — la base visée n'est pas locale : ${env.NEXT_PUBLIC_SUPABASE_URL}`)
  process.exit(2)
}

let passes = 0
const echecs = []
const dire = (nom, ok, detail = '') => {
  if (ok) { passes++; console.log(`  ${V}✓${Z} ${nom}`) }
  else { echecs.push(nom); console.log(`  ${R}✗${Z} ${nom}${detail ? `\n       ${G}${String(detail).trim().slice(0, 280)}${Z}` : ''}`) }
}
const section = m => console.log(`\n${B}── ${m}${Z}`)

const sql = t => {
  try {
    return execFileSync('docker', ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-f', '-'],
      { encoding: 'utf8', input: t, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) { return 'ERREUR: ' + String(e.stderr ?? e.message).slice(0, 300) }
}

const signer = charge => {
  const corps = JSON.stringify(charge)
  const ts = Math.floor(Date.now() / 1000)
  return { corps, entete: `t=${ts},v1=${createHmac('sha256', WHSEC).update(`${ts}.${corps}`).digest('hex')}` }
}

const envoyer = async (charge, essai = 0) => {
  const { corps, entete } = signer(charge)
  try {
    const r = await fetch(`${APP}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': entete, Connection: 'close' },
      body: corps,
    })
    return { statut: r.status, texte: await r.text() }
  } catch (e) {
    if (essai >= 3) throw e
    await new Promise(res => setTimeout(res, 600 * (essai + 1)))
    return envoyer(charge, essai + 1)
  }
}

/** La session Stripe telle qu'elle revient d'une acceptation de devis. */
const evenement = ({ devisId, numero, pi, prix }) => ({
  id: 'evt_test_' + randomUUID().slice(0, 8),
  object: 'event',
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'cs_test_' + randomUUID().slice(0, 12),
      object: 'checkout.session',
      /* Une carte RETENUE arrive « unpaid » : c'est tout l'enjeu. */
      payment_status: 'unpaid',
      amount_total: prix * 100,
      payment_intent: pi,
      customer_details: { name: 'Client Fictif', email: 'client.fictif@exemple.test' },
      metadata: { type: 'devis', a_valider: '1', devis_id: devisId, devis_numero: numero },
    },
  },
})

/** Sème un devis en base et rend son identifiant. */
const semerDevis = ({ numero, date, lignes, total }) => {
  const id = randomUUID()
  const json = JSON.stringify(lignes).replace(/'/g, "''")
  const r = sql(
    `INSERT INTO public.devis_clients
       (id, numero, client_nom, client_email, client_tel, date_prestation,
        statut, lignes, total_ht, carte_requise, jeton)
     VALUES ('${id}', '${numero}', 'Client Fictif', 'client.fictif@exemple.test',
             '+33600000000', '${date}', 'envoye',
             '${json}'::jsonb, ${total}, true, '${randomUUID()}');
     SELECT '${id}';`)
  if (r.startsWith('ERREUR')) { console.error(r); process.exit(2) }
  return id
}

console.log(`\n${B}LE WEBHOOK FACE À UN DEVIS ACCEPTÉ PAR LE CLIENT${Z}`)
console.log(`${G}environnement isolé · ${env.NEXT_PUBLIC_SUPABASE_URL} · aucun e-mail ne peut partir${Z}`)

// ── 0. Isolement ──────────────────────────────────────────────────────────
section("0. l'environnement est bien isolé")
const avant = sql('SELECT count(*) FROM courses;')
dire(`la base de test ne contient aucune course (${avant})`, avant === '0',
     "ce n'est pas une base vierge — refuser de mesurer dans ces conditions")
const colonnes = sql(
  `SELECT count(*) FROM information_schema.columns
   WHERE table_name='devis_clients'
     AND column_name IN ('jeton','accepte_le','carte_requise','stripe_session_id');`)
dire("la table des devis porte les colonnes de l'acceptation en ligne", colonnes === '4',
     `${colonnes}/4 — la migration n'a pas été rejouée par le banc`)
if (avant !== '0' || colonnes !== '4') { console.log(`\n${R}ARRÊT.${Z}\n`); process.exit(1) }

// ── 1. Acceptation normale ────────────────────────────────────────────────
section('1. le client accepte : une course par prestation')
const LIGNES = [
  { heure: '14h30', depart: '1 rue Fictive, 60740 Lieu-Test', arrivee: 'Aeroport Fictif, 95700 Nulle-Part', vehicule: '1 van', passagers: 6, prix: 120, observations: 'Aller' },
  { heure: '19h00', depart: 'Aeroport Fictif, 95700 Nulle-Part', arrivee: '1 rue Fictive, 60740 Lieu-Test', vehicule: '1 van', passagers: 6, prix: 120, observations: '' },
  { heure: '', depart: '  ', arrivee: '', vehicule: '', passagers: 0, prix: 0, observations: 'ligne vide, a ignorer' },
]
const devis1 = semerDevis({ numero: 'DEV-TEST-0001', date: '2027-06-12', lignes: LIGNES, total: 240 })
const pi1 = 'pi_test_devis_' + randomUUID().slice(0, 8)
const ev1 = evenement({ devisId: devis1, numero: 'DEV-TEST-0001', pi: pi1, prix: 240 })

const r1 = await envoyer(ev1)
dire('le webhook répond 200', r1.statut === 200, `HTTP ${r1.statut} — ${r1.texte.slice(0, 160)}`)
await new Promise(s => setTimeout(s, 1200))

const nb = sql(`SELECT count(*) FROM courses WHERE ref LIKE 'DEV-TEST-0001-%';`)
dire('deux courses sont créées — la ligne vide est ignorée, pas transformée en course', nb === '2',
     `${nb} course(s) au lieu de 2`)

/* `statut::text` et `type_vehicule::text` : ce sont des ENUM, et Postgres
   refuse de les concaténer sans conversion explicite. Sans le `::text`, la
   requête échoue et le contrôle annonce « rien en base » sur des courses
   parfaitement créées. */
const lignesBase = sql(
  `SELECT ref || '|' || paiement_statut || '|' || coalesce(stripe_payment_intent_id,'-')
       || '|' || coalesce(source,'-') || '|' || coalesce(prix_estime::text,'-')
       || '|' || coalesce(type_vehicule::text,'-') || '|' || statut::text
       || '|' || to_char(date_prevue AT TIME ZONE 'Europe/Paris', 'YYYY-MM-DD HH24:MI')
   FROM courses WHERE ref LIKE 'DEV-TEST-0001-%' ORDER BY ref;`)
for (const l of lignesBase.split('\n').filter(Boolean)) console.log(`     ${G}${l}${Z}`)

const c1 = (lignesBase.split('\n')[0] ?? '').split('|')
dire('la référence suit le numéro du devis', c1[0] === 'DEV-TEST-0001-01', c1[0])
dire("elle est marquée « autorise » — l'argent est retenu, pas encaissé", c1[1] === 'autorise',
     `elle vaut « ${c1[1] ?? '?'} » : l'annoncer perçu inventerait une recette`)
/* ELLE NE PORTE PAS LE PAIEMENT, et c'est voulu. Un index unique
   (`courses_stripe_pi_unique`) interdit qu'un même paiement Stripe
   appartienne à deux courses — c'est lui qui empêche un rejeu de Stripe de
   dédoubler le planning. Le recopier sur chaque ligne faisait échouer
   l'insertion dès la deuxième : carte bloquée, zéro course. La retenue vit
   donc sur le devis (section 3). */
dire("elle ne recopie PAS le paiement — l'index unique l'interdit, et il a raison",
     c1[2] === '-', `elle porte « ${c1[2]} » : la seconde ligne du devis ne pourra pas s'insérer`)
dire('son origine est « devis », pas « manuel »', c1[3] === 'devis', c1[3])
dire('son prix est celui de la ligne', c1[4] === '120', c1[4])
dire('le véhicule « 1 van » est bien un van', (c1[5] ?? '').includes('van'), c1[5])
dire("elle entre dans le planning en attente d'affectation", c1[6] === 'en_attente', c1[6])

// ── 2. L'heure, lue à Paris ───────────────────────────────────────────────
section('2. 14h30 saisie reste 14h30 à Paris, même sur un serveur en temps universel')
dire('la première course est à 14:30 heure de Paris', c1[7] === '2027-06-12 14:30',
     `${c1[7]} — le décalage de deux heures du 2026-09-22 est revenu`)
const c2 = (lignesBase.split('\n')[1] ?? '').split('|')
dire('la seconde est à 19:00 heure de Paris', c2[7] === '2027-06-12 19:00', c2[7])

// ── 3. La retenue vit sur le devis, et on peut la régler ──────────────────
section('3. une seule retenue, portée par le devis, et encaissable')
const pisCourses = sql(
  `SELECT count(*) FROM courses WHERE ref LIKE 'DEV-TEST-0001-%' AND stripe_payment_intent_id IS NOT NULL;`)
dire("aucune course ne porte de paiement : l'index unique ne peut pas se fâcher",
     pisCourses === '0', `${pisCourses} course(s) en portent un`)
const somme = sql(
  `SELECT coalesce(sum(prix_estime),0)::text FROM courses WHERE ref LIKE 'DEV-TEST-0001-%';`)
dire('la somme des courses vaut le total du devis', somme === '240', `${somme} € au lieu de 240 €`)

/* LA REQUÊTE QUE `encaisserDevisAction` LANCE, mot pour mot : elle doit
   atteindre les deux courses. Si elle n'en atteignait qu'une — un préfixe
   mal construit, une référence différente — l'exploitant encaisserait chez
   Stripe et la moitié du planning resterait « autorise » pour toujours. */
const numero = sql(`SELECT numero FROM devis_clients WHERE id='${devis1}';`)
const atteintes = sql(
  `SELECT count(*) FROM courses WHERE ref LIKE '${numero}-%' AND paiement_statut='autorise';`)
dire("l'encaissement du devis atteindrait bien ses DEUX courses", atteintes === '2',
     `${atteintes} au lieu de 2 — la moitié du planning resterait « autorise » après encaissement`)

/* Et la retenue doit être retrouvable : sans la session rangée sur le devis,
   Stripe garde l'argent sept jours puis le rend, course faite. */
const session = sql(`SELECT coalesce(stripe_session_id,'-') FROM devis_clients WHERE id='${devis1}';`)
dire('le devis garde la session Stripe, seule porte vers la retenue',
     session.startsWith('cs_test_'), session)

// ── 4. Le devis est daté comme accepté ────────────────────────────────────
section("4. le devis porte la trace de l'acceptation")
const etat = sql(
  `SELECT statut || '|' || coalesce(accepte_le::text,'-') || '|' || coalesce(stripe_session_id,'-')
   FROM devis_clients WHERE id='${devis1}';`)
const [statut, accepteLe, sessionId] = etat.split('|')
dire('son statut est « accepte »', statut === 'accepte', statut)
dire("la date d'acceptation est renseignée — c'est le clic du client qui la pose",
     accepteLe !== '-' && accepteLe.length > 4, accepteLe)
dire('la session Stripe est rangée', (sessionId ?? '').startsWith('cs_test_'), sessionId)

// ── 5. Rejeu : Stripe renvoie le même événement ───────────────────────────
section('5. le même événement rejoué ne doit RIEN créer en double')
const r2 = await envoyer(ev1)
dire('le webhook répond encore 200', r2.statut === 200, `HTTP ${r2.statut}`)
await new Promise(s => setTimeout(s, 1000))
dire('toujours deux courses, pas quatre',
     sql(`SELECT count(*) FROM courses WHERE ref LIKE 'DEV-TEST-0001-%';`) === '2',
     'un rejeu a doublé le planning — la cliente serait venue chercher deux vans')

/* Le vrai risque : un événement DIFFÉRENT sur le même devis. Le journal des
   événements ne protège que contre le même identifiant ; ici c'est le garde
   de `creerCoursesDepuisDevis` qui doit tenir. */
const r3 = await envoyer(evenement({ devisId: devis1, numero: 'DEV-TEST-0001', pi: pi1, prix: 240 }))
dire('un second événement DISTINCT sur le même devis répond 200', r3.statut === 200, `HTTP ${r3.statut}`)
await new Promise(s => setTimeout(s, 1000))
dire('et ne crée toujours rien de plus',
     sql(`SELECT count(*) FROM courses WHERE ref LIKE 'DEV-TEST-0001-%';`) === '2',
     'le garde d’idempotence ne tient pas sur un nouvel événement')

// ── 6. Devis inconnu : refus franc ────────────────────────────────────────
section('6. un devis inconnu ne doit pas passer pour un succès')
const fantome = randomUUID()
const r4 = await envoyer(evenement({ devisId: fantome, numero: 'DEV-TEST-FANTOME', pi: 'pi_test_fantome', prix: 99 }))
dire("le webhook refuse franchement (500) au lieu d'annoncer « reçu »", r4.statut === 500,
     `HTTP ${r4.statut} — un 200 ferait croire à Stripe que tout va bien, et la carte resterait bloquée sans course`)
await new Promise(s => setTimeout(s, 900))
dire('aucune course fantôme en base',
     sql(`SELECT count(*) FROM courses WHERE ref LIKE 'DEV-TEST-FANTOME%';`) === '0')
const incident = sql(`SELECT count(*) FROM incidents_paiement WHERE reference='${fantome}';`)
dire("l'incident est consigné pour que l'exploitant le voie", incident === '1',
     `${incident} incident(s) — sans trace, une carte bloquée sans course passe inaperçue`)

// ── 7. Le compte final ────────────────────────────────────────────────────
section("7. l'état de la base à la fin")
const total = sql('SELECT count(*) FROM courses;')
console.log(`     ${G}${total} course(s) en tout — on en attend 2${Z}`)
dire('exactement deux courses existent', total === '2', `${total} au lieu de 2`)

console.log('\n' + '─'.repeat(72))
if (echecs.length) {
  console.log(`${R}${B}${passes} au vert, ${echecs.length} échec(s) :${Z}`)
  for (const e of echecs) console.log(`  · ${e}`)
  process.exit(1)
}
if (passes < 20) {
  console.log(`${R}${B}Seulement ${passes} contrôles ont tourné — ce banc en compte une vingtaine.${Z}`)
  console.log(`${G}Un test qui ne mesure presque rien et annonce « tout est vert » est pire qu'aucun test.${Z}\n`)
  process.exit(1)
}
console.log(`${V}${B}${passes} contrôles au vert${Z}`)
console.log(`${G}Base isolée. Aucun e-mail n'a pu partir. La production n'a pas été touchée.${Z}\n`)
