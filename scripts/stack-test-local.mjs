/**
 * Monte et démonte une pile Supabase isolée pour le test d'intégration :
 * PostgreSQL + PostgREST, dans des conteneurs jetables, sur localhost.
 *
 * Ce que la pile contient :
 *   - le schéma de production, reconstitué par introspection
 *     (scripts/schema-local-test.sql, 22 tables, 8 enums réels) ;
 *   - la migration du Sprint 2 appliquée telle quelle, pour que la base locale
 *     soit dans le MÊME état que la production depuis aujourd'hui ;
 *   - des données fictives : un client de test, une ligne de paramètres.
 *
 * Ce que la pile NE contient PAS, et c'est documenté dans le rapport :
 *   - Supabase Auth (GoTrue). La branche « création d'un nouveau compte » du
 *     webhook n'est donc pas testable ici ;
 *   - les clés étrangères, les politiques RLS, les déclencheurs.
 *
 * Aucun secret de production n'est utilisé. Les jetons JWT sont fabriqués ici
 * avec un secret de test écrit en clair dans ce fichier — il ne protège rien,
 * la pile n'est jamais exposée hors de localhost.
 *
 * Usage, depuis owise-app :
 *   node scripts/stack-test-local.mjs up     → démarre et affiche l'env de test
 *   node scripts/stack-test-local.mjs down   → supprime tout
 *   node scripts/stack-test-local.mjs sql "SELECT ..."  → interroge la base
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHmac } from 'node:crypto'

const RESEAU = 'owise-test-net'
const PG = 'owise-test-pg'
const REST = 'owise-test-rest'
const DB = 'owise_test'
const PORT_REST = 54321
/* Secret de test, volontairement en clair : il ne protège aucune donnée
   réelle et la pile n'écoute que sur localhost. */
const JWT_SECRET = 'secret-de-test-owise-integration-32-caracteres-minimum'

const docker = (args, opts = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts })

const b64url = (buf) => Buffer.from(buf).toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Jeton HS256 avec un rôle, comme ceux que Supabase délivre. */
function jeton(role) {
  const tete = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const corps = b64url(JSON.stringify({
    role, iss: 'owise-test',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400,
  }))
  const sig = b64url(createHmac('sha256', JWT_SECRET).update(`${tete}.${corps}`).digest())
  return `${tete}.${corps}.${sig}`
}

export function sql(texte, { tolerant = true } = {}) {
  try {
    return { sortie: execFileSync('docker',
      ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-f', '-'],
      { encoding: 'utf8', input: texte, stdio: ['pipe', 'pipe', 'pipe'] }).trim(), erreur: null }
  } catch (e) {
    const erreur = String(e.stderr ?? e.message)
    if (!tolerant) throw new Error(erreur)
    return { sortie: String(e.stdout ?? '').trim(), erreur }
  }
}

export function down() {
  for (const c of [REST, PG]) { try { docker(['rm', '-f', '-v', c]) } catch { /* absent */ } }
  try { docker(['network', 'rm', RESEAU]) } catch { /* absent */ }
}

export async function up() {
  down()
  try { docker(['network', 'create', RESEAU]) } catch { /* existe */ }

  console.log('  démarrage de PostgreSQL…')
  docker(['run', '-d', '--name', PG, '--network', RESEAU,
    '-e', 'POSTGRES_PASSWORD=test', '-e', `POSTGRES_DB=${DB}`, 'postgres:16-alpine'])

  let pret = false
  for (let i = 0; i < 90; i++) {
    try { docker(['exec', PG, 'pg_isready', '-U', 'postgres', '-d', DB]); pret = true; break }
    catch { execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']) }
  }
  if (!pret) throw new Error('PostgreSQL n\'a pas démarré')
  console.log(`  PostgreSQL prêt — ${sql('SELECT version();').sortie.split(' ').slice(0, 2).join(' ')}`)

  console.log('  application du schéma de production reconstitué…')
  const schema = readFileSync(resolve(process.cwd(), 'scripts/schema-local-test.sql'), 'utf8')
  const rs = sql(schema)
  if (rs.erreur) throw new Error('schéma : ' + rs.erreur.slice(0, 500))
  console.log(`  ${sql(`SELECT count(*) FROM information_schema.tables WHERE table_schema='public';`).sortie} tables créées`)

  console.log('  application de la migration du Sprint 2, telle quelle…')
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000000_fiabilite_paiements.sql'), 'utf8')
  const rm = sql(migration)
  if (rm.erreur) throw new Error('migration : ' + rm.erreur.slice(0, 500))
  console.log('  migration appliquée')

  /* Données fictives. Aucun nom, aucune adresse, aucun e-mail réels. */
  console.log('  données fictives…')
  const seed = sql(`
    INSERT INTO public.utilisateurs_test (id, email)
      VALUES ('11111111-1111-1111-1111-111111111111', 'client.fictif@exemple.test');
    INSERT INTO public.profiles (id, nom, prenom, telephone)
      VALUES ('11111111-1111-1111-1111-111111111111', 'Fictif', 'Client', '+33600000000');
    INSERT INTO public.clients (id, type_compte)
      VALUES ('11111111-1111-1111-1111-111111111111', 'particulier');
    INSERT INTO public.parametres (id, facture_taux_tva, facture_prefixe)
      VALUES (true, 0, 'TEST-');
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
  `)
  if (seed.erreur) throw new Error('données fictives : ' + seed.erreur.slice(0, 400))

  console.log('  démarrage de PostgREST…')
  docker(['run', '-d', '--name', REST, '--network', RESEAU, '-p', `${PORT_REST}:3000`,
    '-e', `PGRST_DB_URI=postgres://authenticator:test@${PG}:5432/${DB}`,
    '-e', 'PGRST_DB_SCHEMAS=public',
    '-e', 'PGRST_DB_ANON_ROLE=anon',
    '-e', `PGRST_JWT_SECRET=${JWT_SECRET}`,
    '-e', 'PGRST_OPENAPI_MODE=ignore-privileges',
    'postgrest/postgrest:v12.2.3'])

  const anon = jeton('anon')
  const service = jeton('service_role')
  let restPret = false
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT_REST}/courses?select=id&limit=1`,
        { headers: { apikey: service, Authorization: `Bearer ${service}` } })
      if (r.ok) { restPret = true; break }
    } catch { /* pas encore */ }
    await new Promise(r => setTimeout(r, 1000))
  }
  if (!restPret) {
    console.error('  PostgREST n\'a pas répondu. Journal :')
    try { console.error(docker(['logs', '--tail', '25', REST])) } catch { /* rien */ }
    throw new Error('PostgREST indisponible')
  }
  console.log(`  PostgREST prêt sur http://localhost:${PORT_REST}`)

  return { url: `http://localhost:${PORT_REST}`, anon, service }
}

/* ── Exécution directe ──────────────────────────────────────────────────── */
const cmd = process.argv[2]

if (cmd === 'down') {
  down(); console.log('pile supprimée')
} else if (cmd === 'sql') {
  const r = sql(process.argv[3] ?? 'SELECT 1;')
  console.log(r.erreur ? r.erreur : r.sortie)
} else if (cmd === 'up') {
  console.log('\x1b[1mPile de test isolée\x1b[0m')
  const { url, anon, service } = await up()

  /* Le secret de webhook du test : fabriqué ici, sans rapport avec celui de
     production. Les événements seront signés localement avec lui. */
  const whsec = 'whsec_test_integration_' + createHmac('sha256', JWT_SECRET).update('whsec').digest('hex').slice(0, 32)

  const envTest = [
    '# Environnement du test d\'intégration — AUCUN secret de production.',
    '# Généré par scripts/stack-test-local.mjs. Jetable.',
    '',
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    '',
    '# Stripe : clés de test, et un secret de webhook propre au test.',
    `STRIPE_SECRET_KEY=sk_test_fictif_jamais_appele_par_ce_test`,
    `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_fictif`,
    `STRIPE_WEBHOOK_SECRET=${whsec}`,
    '',
    '# Effets de bord neutralisés : toutes vides.',
    'RESEND_API_KEY=',
    'META_CAPI_ACCESS_TOKEN=',
    'NEXT_PUBLIC_FB_PIXEL_ID=',
    'GOOGLE_ADS_REFRESH_TOKEN=',
    'GOOGLE_ADS_CUSTOMER_ID=',
    'GOOGLE_ADS_DEVELOPER_TOKEN=',
    'NEXT_PUBLIC_POSTHOG_KEY=',
    'NEXT_PUBLIC_GA_ID=',
    'NEXT_PUBLIC_SENTRY_DSN=',
    'SENTRY_AUTH_TOKEN=',
    '',
    'NEXT_PUBLIC_SITE_URL=http://localhost:3210',
    'CRON_SECRET=secret-cron-de-test',
    'ADMIN_EMAIL=admin.fictif@exemple.test',
    'GOOGLE_MAPS_API_KEY=',
    'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=',
  ].join('\n') + '\n'

  writeFileSync(resolve(process.cwd(), '.env.test.integration'), envTest, 'utf8')
  console.log('\n  .env.test.integration écrit — aucun secret de production dedans')
  console.log(`  ${sql(`SELECT count(*) FROM courses;`).sortie} course(s) · ${sql(`SELECT count(*) FROM factures;`).sortie} facture(s) · base vierge`)
  console.log('\n  Pour démonter : node scripts/stack-test-local.mjs down')
} else {
  console.log('usage : node scripts/stack-test-local.mjs up|down|sql "..."')
}
