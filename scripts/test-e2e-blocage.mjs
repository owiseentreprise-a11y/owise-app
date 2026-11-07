/**
 * Le webhook crée-t-il vraiment la course quand la carte est seulement BLOQUÉE ?
 *
 *   node scripts/test-e2e-blocage.mjs
 *
 * ENVIRONNEMENT ISOLÉ, monté par scripts/stack-test-local.mjs :
 * PostgreSQL et PostgREST jetables sur localhost, application lancée avec
 * .env.test.integration, aucun appel à Stripe (les événements sont signés
 * ici), clé Resend vide donc aucun e-mail ne peut partir.
 *
 * POURQUOI CE TEST EXISTE, ET POURQUOI IL EST LE DERNIER MAILLON
 *
 * Tout le reste du blocage de carte a été mesuré : la session Stripe, le
 * montant retenu, l'encaissement, la libération. UNE SEULE chose ne l'avait
 * pas été — le webhook lui-même. Stripe ne peut pas joindre un site local,
 * donc aucune réservation d'essai n'avait jamais créé de course.
 *
 * Or c'est le maillon qui compte le plus. Mesuré chez Stripe le 2026-11-07 :
 * une session bloquée arrive avec `payment_status: UNPAID`, et le webhook
 * écartait jusque-là tout ce qui n'était pas `paid`. S'il l'écarte encore,
 * la carte du client est retenue et AUCUNE course n'existe — l'incident du
 * 2026-10-07, à l'identique.
 *
 * Trois scénarios, et les trois comptent autant :
 *   1. bloqué + notre drapeau   → la course doit naître, en « autorise » ;
 *   2. bloqué SANS notre drapeau → rien ne doit être créé (sinon n'importe
 *      quelle session impayée fabriquerait des courses) ;
 *   3. payé normalement          → la course doit naître en « paye », comme
 *      avant. Le blocage ne doit RIEN changer aux autres véhicules.
 *
 * Prérequis : la pile et l'application tournent déjà.
 *   node scripts/stack-test-local.mjs up
 *   set -a && . ./.env.test.integration && set +a && npx next dev -p 3210
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
/* Le banc n'embarque pas le service de comptes de Supabase : creer un
   NOUVEAU client y echoue avec « Impossible de creer l'utilisateur ». On
   emploie donc l'adresse du client deja seme par la pile, ce qui exerce la
   branche « client deja connu » — la seule que cet environnement sait
   jouer, et c'est documente en tete de stack-test-local.mjs. */
const CLIENT_CONNU = 'client.fictif@exemple.test'

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
  else { echecs.push(nom); console.log(`  ${R}✗${Z} ${nom}${detail ? `\n       ${G}${String(detail).trim().slice(0, 260)}${Z}` : ''}`) }
}
const section = m => console.log(`\n${B}── ${m}${Z}`)

const sql = t => {
  try {
    return execFileSync('docker', ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-f', '-'],
      { encoding: 'utf8', input: t, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) { return 'ERREUR: ' + String(e.stderr ?? e.message).slice(0, 200) }
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

/** Une session de paiement, bloquée ou payée selon `aValider`. */
const evenement = ({ pi, aValider, prix = 120, vehicule = 'grand_van', email }) => ({
  id: 'evt_test_' + randomUUID().slice(0, 8),
  object: 'event',
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'cs_test_' + randomUUID().slice(0, 12),
      object: 'checkout.session',
      /* LE POINT DE TOUT : une carte bloquée arrive « unpaid ». */
      payment_status: aValider ? 'unpaid' : 'paid',
      amount_total: prix * 100,
      payment_intent: pi,
      metadata: {
        type: 'reservation',
        email,
        nom: 'Fictif',
        prenom: 'Client',
        telephone: '+33600000000',
        adresse_depart: '1 rue de Nulle Part, 60500 Lieu-Fictif',
        adresse_arrivee: 'Aeroport Fictif, 95700 Nulle-Part',
        date_prevue: '2027-06-12T09:00',
        type_vehicule: vehicule,
        nb_passagers: '1',
        prix: String(prix),
        ...(aValider ? { a_valider: '1' } : {}),
      },
    },
  },
})

console.log(`\n${B}LE WEBHOOK FACE À UNE CARTE BLOQUÉE${Z}`)
console.log(`${G}environnement isolé · ${env.NEXT_PUBLIC_SUPABASE_URL} · aucun e-mail ne peut partir${Z}`)

/* Preuve d'isolement AVANT toute écriture : la base doit être vierge de
   courses. Si elle ne l'est pas, on ne sait plus ce qu'on mesure. */
section('0. l\'environnement est bien isolé')
const coursesAvant = sql('SELECT count(*) FROM courses;')
dire(coursesAvant === '0', `la base de test ne contient aucune course (${coursesAvant})`,
     'ce n\'est pas une base vierge — refuser de mesurer dans ces conditions')
if (coursesAvant !== '0') { console.log(`\n${R}ARRÊT.${Z}\n`); process.exit(1) }

// ── 1. Bloqué + notre drapeau : la course doit naître « autorise » ───────
section('1. carte bloquée, avec notre drapeau — la course doit naître')
const pi1 = 'pi_test_bloque_' + randomUUID().slice(0, 8)
const r1 = await envoyer(evenement({ pi: pi1, aValider: true, email: CLIENT_CONNU }))
dire('le webhook répond 200', r1.statut === 200, `HTTP ${r1.statut} — ${r1.texte.slice(0, 120)}`)
await new Promise(s => setTimeout(s, 900))

/* `statut::text` : c'est un type ENUMERE, et Postgres refuse de le
   concatener sans conversion explicite. Sans le `::text`, la requete
   echoue et ce controle annoncait « rien en base » sur une course
   parfaitement creee. */
const ligne = sql(`SELECT paiement_statut || '|' || statut::text || '|' || coalesce(prix_estime::text,'-') || '|' || coalesce(type_vehicule::text,'-') || '|' || coalesce(source,'-') FROM courses WHERE stripe_payment_intent_id='${pi1}';`)
dire('une course a bien été créée', ligne.includes('|'), `rien en base pour ${pi1}`)
if (ligne.includes('|')) {
  const [paiement, statut, prix, vehicule, source] = ligne.split('|')
  console.log(`     ${G}paiement ${paiement} · statut ${statut} · ${prix} € · ${vehicule} · source ${source}${Z}`)
  dire('elle est marquée « autorise » et non « paye »', paiement === 'autorise',
       `elle vaut « ${paiement} » — l'argent n'est pas chez Owise, l'annoncer payé inventerait une recette`)
  dire('son montant est celui qui a été bloqué', prix === '120', `${prix} € au lieu de 120 €`)
  dire('le véhicule est bien le Grand Van', vehicule.includes('grand_van') || vehicule.includes('Grand'), vehicule)
  dire('l\'identifiant de paiement est conservé — sans lui, impossible d\'encaisser plus tard',
       sql(`SELECT stripe_payment_intent_id FROM courses WHERE stripe_payment_intent_id='${pi1}';`) === pi1)
}

// ── 2. Bloqué SANS notre drapeau : rien ne doit être créé ────────────────
section('2. carte bloquée SANS notre drapeau — rien ne doit être créé')
const pi2 = 'pi_test_sansdrapeau_' + randomUUID().slice(0, 8)
const faux = evenement({ pi: pi2, aValider: true, email: CLIENT_CONNU })
delete faux.data.object.metadata.a_valider
const r2 = await envoyer(faux)
dire('le webhook répond 200 sans se plaindre', r2.statut === 200, `HTTP ${r2.statut}`)
await new Promise(s => setTimeout(s, 900))
dire('AUCUNE course n\'est créée pour une session impayée sans notre drapeau',
     sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${pi2}';`) === '0',
     'une session impayée quelconque a fabriqué une course — le garde-fou ne tient plus')

// ── 3. Paiement normal : rien ne doit avoir changé ───────────────────────
section('3. un paiement normal reste un paiement normal')
const pi3 = 'pi_test_paye_' + randomUUID().slice(0, 8)
const r3 = await envoyer(evenement({ pi: pi3, aValider: false, prix: 100, vehicule: 'van', email: CLIENT_CONNU }))
dire('le webhook répond 200', r3.statut === 200, `HTTP ${r3.statut}`)
await new Promise(s => setTimeout(s, 900))
const ligne3 = sql(`SELECT paiement_statut FROM courses WHERE stripe_payment_intent_id='${pi3}';`)
dire('la course est créée', ligne3.length > 0, 'aucune course')
dire('elle est marquée « paye », comme avant le blocage', ligne3 === 'paye',
     `elle vaut « ${ligne3} » — le blocage a déteint sur les véhicules qui paient tout de suite`)

// ── 4. Le compte final ───────────────────────────────────────────────────
section('4. l\'état de la base après les trois envois')
const total = sql(`SELECT count(*) FROM courses;`)
console.log(`     ${G}${total} course(s) créée(s) — on en attend 2 (la bloquée et la payée)${Z}`)
dire('exactement deux courses existent', total === '2', `${total} au lieu de 2`)

console.log('\n' + '─'.repeat(72))
if (echecs.length) {
  console.log(`${R}${B}${passes} au vert, ${echecs.length} échec(s) :${Z}`)
  for (const e of echecs) console.log(`  · ${e}`)
  process.exit(1)
}
console.log(`${V}${B}${passes} contrôles au vert${Z}`)
console.log(`${G}Base isolée. Aucun e-mail n'a pu partir. La production n'a pas été touchée.${Z}\n`)
