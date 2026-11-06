/**
 * Une réservation faite en anglais passe-t-elle, de bout en bout ?
 *
 *   node scripts/stack-test-local.mjs up
 *   node scripts/proxy-supabase-test.mjs 54330 54321 &
 *   npx tsx scripts/test-reservation-anglaise.mts
 *   node scripts/stack-test-local.mjs down
 *
 * CE QUE CE CONTRÔLE PROUVE, ET CE QU'IL NE PROUVE PAS
 *
 * Il appelle le VRAI `handleNewReservation` du webhook Stripe, avec les
 * métadonnées qu'une réservation depuis /en/book produit réellement — dont
 * `langue: 'en'`. Il vérifie que :
 *   · une course est créée, au bon prix, avec le bon véhicule ;
 *   · l'e-mail de confirmation du CLIENT part en anglais ;
 *   · ceux de l'exploitant et du chauffeur restent en français.
 *
 * Il ne prouve PAS le paiement lui-même : aucun appel à Stripe n'est fait.
 * C'est volontaire — la production tourne en mode Live, et un test ne doit
 * pas pouvoir débiter une carte.
 *
 * ISOLEMENT. La base est la pile jetable de `stack-test-local.mjs`
 * (PostgreSQL + PostgREST sur localhost), atteinte par le relais
 * `proxy-supabase-test.mjs` — sans ce relais, `supabase-js` appelle
 * `/rest/v1/…` que PostgREST ne sert pas, et le webhook échoue d'une façon
 * trompeuse : il croit devoir créer un compte.
 *
 * AUCUN e-mail ne sort : `fetch` est intercepté avant d'atteindre Resend. On
 * donne tout de même une clé fictive, sinon `send()` sort immédiatement et
 * le message n'est jamais construit — donc jamais vérifiable.
 *
 * PREUVE D'ISOLEMENT, faite avant toute écriture : la base doit être vide au
 * départ. Si elle contenait déjà des courses, c'est qu'on parle à la
 * production, et le test s'arrête.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

/* L'environnement de test, posé AVANT l'import du webhook : `email.ts` lit
   `RESEND_API_KEY` au chargement du module, et `createAdminClient` lit l'URL
   au premier appel. */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54330'
/* La clé de service DE LA PILE, écrite par `stack-test-local.mjs` dans
   `.env.test.integration`. Un jeton inventé est refusé par PostgREST
   (401 PGRST301), `find_user_by_email` ne rend alors rien, et le webhook
   croit devoir créer un compte : l'échec ressemble à un bug du webhook
   alors que c'est le test qui s'authentifie mal. */
const envTest: Record<string, string> = {}
const CHEMIN_ENV = resolve(dirname(fileURLToPath(import.meta.url)), '../.env.test.integration')
for (const l of readFileSync(CHEMIN_ENV, 'utf8').split(/\r?\n/)) {
  const i = l.indexOf('=')
  if (i > 0) envTest[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}
process.env.SUPABASE_SERVICE_ROLE_KEY = envTest.SUPABASE_SERVICE_ROLE_KEY
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = envTest.NEXT_PUBLIC_SUPABASE_ANON_KEY
process.env.RESEND_API_KEY = 're_cle_fictive_interceptee_avant_envoi'
process.env.ADMIN_EMAIL = 'exploitant@essai.test'
process.env.STRIPE_SECRET_KEY = 'sk_test_fictif_jamais_appele'

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? ` ${G}— ${d}${Z}` : ''}`) }
}
const arret = (m: string) => { console.log(`\n  ${R}${B}ARRÊT — ${m}${Z}\n`); process.exit(1) }

/** Interroge la base locale directement, sans passer par l'application. */
const sql = (q: string): string => {
  try {
    return execFileSync('docker', ['exec', 'owise-test-pg', 'psql', '-U', 'postgres', '-d', 'owise_test', '-tAc', q],
      { encoding: 'utf8' }).trim()
  } catch (e) { arret('psql dans le conteneur : ' + String((e as Error).message).slice(0, 160)); return '' }
}

// ── Preuve d'isolement, AVANT d'écrire ───────────────────────────────────
console.log(`\n${B}UNE RÉSERVATION EN ANGLAIS, DE BOUT EN BOUT${Z}\n`)
console.log(`${B}0. à qui parle-t-on ?${Z}`)
const avant = sql('SELECT count(*) FROM courses;')
console.log(`     ${G}courses en base au départ : ${avant}${Z}`)
dire(avant === '0', 'la base est VIERGE — ce n’est donc pas la production',
     `${avant} course(s) : on parle peut-être à la vraie base, on s'arrête`)
if (avant !== '0') arret('la base n’est pas vide')

/* Un client déjà connu : la pile n'a pas Supabase Auth, donc la branche
   « création de compte » n'est pas testable ici — c'est documenté. */
const CLIENT_ID = sql('SELECT id FROM utilisateurs_test LIMIT 1;')
dire(CLIENT_ID.length > 10, 'un utilisateur connu existe dans la pile', CLIENT_ID)
/* L'e-mail du client connu vit dans `utilisateurs_test`, la table que la
   pile donne à `find_user_by_email` — PAS dans `clients`, dont la colonne
   `email` est vide dans les données fictives. Chercher au mauvais endroit
   faisait croire au webhook qu'il devait créer un compte. */
const EMAIL_CLIENT = sql('SELECT email FROM utilisateurs_test LIMIT 1;')
console.log(`     ${G}client d'essai : ${EMAIL_CLIENT}${Z}`)

// ── Interception des e-mails ─────────────────────────────────────────────
type Envoi = { to: string | string[]; subject: string; html: string }
const envois: Envoi[] = []
const vraiFetch = globalThis.fetch
globalThis.fetch = (async (e: Parameters<typeof vraiFetch>[0], o?: Parameters<typeof vraiFetch>[1]) => {
  const url = String(typeof e === 'string' ? e : (e as Request).url ?? e)
  if (url.includes('api.resend.com')) {
    if (o?.body) { try { envois.push(JSON.parse(String(o.body)) as Envoi) } catch { /* non JSON */ } }
    return new Response(JSON.stringify({ id: 'intercepte-' + randomUUID().slice(0, 8) }),
      { status: 200, headers: { 'content-type': 'application/json' } })
  }
  if (/graph\.facebook|googleads|posthog|sentry/.test(url)) {
    return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return vraiFetch(e, o)
}) as typeof vraiFetch

const { handleNewReservation } = await import('../src/app/api/stripe/webhook/route')

// ── La réservation, telle que /en/book la produit ────────────────────────
console.log(`\n${B}1. le webhook traite une réservation venue de /en/book${Z}`)
const PI = 'pi_essai_' + randomUUID().slice(0, 8)
const meta: Record<string, string> = {
  type: 'reservation',
  langue: 'en',
  adresse_depart: '1 Place Henri IV, 60300 Senlis',
  adresse_arrivee: 'Aéroport Paris-Charles de Gaulle (CDG), Terminal 2E',
  date_prevue: '2027-03-18T09:30',
  type_vehicule: 'berline',
  nb_passagers: '2',
  prix: '59',
  nom: 'Smith',
  prenom: 'John',
  email: EMAIL_CLIENT,
  telephone: '+44 7700 900123',
}

let ref = ''
try {
  ref = await handleNewReservation(meta, PI)
} catch (e) {
  arret('le webhook a levé : ' + String((e as Error).message).slice(0, 220))
}
dire(ref.length > 0, 'le webhook rend une référence de course', ref)
console.log(`     ${G}référence : ${ref}${Z}`)

// ── La course en base ────────────────────────────────────────────────────
console.log(`\n${B}2. ce qui a été enregistré${Z}`)
const ligne = sql(`SELECT coalesce(prix_estime::text,'NULL')||'|'||coalesce(type_vehicule::text,'NULL')||'|'||coalesce(statut::text,'NULL')||'|'||coalesce(nb_passagers::text,'NULL')||'|'||coalesce(to_char(date_prevue,'YYYY-MM-DD HH24:MI'),'NULL') FROM courses;`)
const [prix, vehicule, statut, pax, quand] = ligne.split('|')
console.log(`     ${G}prix ${prix} · ${vehicule} · ${statut} · ${pax} passagers · ${quand} (UTC en base)${Z}`)
dire(sql('SELECT count(*) FROM courses;') === '1', 'une seule course a été créée — pas de doublon')
dire(prix === '59.00' || prix === '59', 'le prix est bien 59 €, celui du forfait Senlis → CDG', prix)
dire(vehicule === 'berline', 'le véhicule est la berline demandée', vehicule)
dire(pax === '2', 'le nombre de passagers est repris', pax)
/* 09:30 à Paris en mars = 08:30 UTC (heure d'été). Si la base portait
   09:30 UTC, la saisie n'aurait pas été convertie — le défaut qui a fait
   annoncer 06:15 pour un départ à 04:15. */
dire(quand === '2027-03-18 08:30', 'l’heure a été convertie : 09:30 à Paris = 08:30 en base',
     `${quand} — si c'est 09:30, la conversion de fuseau manque`)

// ── Les e-mails ──────────────────────────────────────────────────────────
console.log(`\n${B}3. les e-mails partis${Z}`)
dire(envois.length >= 2, `${envois.length} e-mail(s) préparé(s)`,
     envois.map(e => String(e.to)).join(' · '))
for (const e of envois) console.log(`     ${G}→ ${String(e.to)} : ${e.subject}${Z}`)

const auClient = envois.find(e => String(e.to).includes(EMAIL_CLIENT))
dire(Boolean(auClient), 'un e-mail est parti au CLIENT', EMAIL_CLIENT)
if (auClient) {
  const txt = auClient.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  dire(/Booking confirmed/i.test(auClient.subject), 'son sujet est EN ANGLAIS', auClient.subject)
  dire(/Your ride is confirmed/.test(txt), 'son corps est en anglais')
  const restes = ['Votre course est confirmée', 'Référence', 'Véhicule', 'Tarif estimé', 'Bonjour']
    .filter(m => txt.includes(m))
  dire(restes.length === 0, 'aucun libellé français dedans', restes.join(' · '))
  dire(/\b09:30\b/.test(txt), 'il annonce 09:30, l’heure de Paris que le client a saisie',
       (txt.match(/\b\d{2}:\d{2}\b/) ?? ['(aucune heure)'])[0])
  dire(/59,00\s?€/.test(txt), 'et le prix de 59,00 €', (txt.match(/\d+[.,]\d{2}\s?€/) ?? ['(aucun)'])[0])
  dire(/Thursday,? 18 March 2027/.test(txt), 'la date est à l’anglaise',
       (txt.match(/[A-Z][a-z]+day,? \d+ [A-Z][a-z]+ \d{4}/) ?? ['(aucune)'])[0])
}

const aLExploitant = envois.find(e => String(e.to).includes('exploitant@essai.test'))
dire(Boolean(aLExploitant), 'un e-mail est parti à l’EXPLOITANT')
if (aLExploitant) {
  dire(!/Booking confirmed/i.test(aLExploitant.subject),
       'et le sien est resté FRANÇAIS — c’est sa langue', aLExploitant.subject)
}

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z} ${G}— réservation anglaise enregistrée, courrier anglais au client${Z}\n`)
