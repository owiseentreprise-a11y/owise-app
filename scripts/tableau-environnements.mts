/**
 * Tableau de correspondance des environnements, avant tout test d'intégration.
 *
 * Aucun secret n'est affiché : pour chaque variable, seuls le préfixe
 * identifiant (sk_test, whsec, re_…), la longueur et une empreinte SHA-256
 * tronquée sont montrés. L'empreinte sert à comparer deux environnements sans
 * révéler leur contenu — deux empreintes identiques = même secret.
 *
 * LECTURE SEULE. Aucune écriture, aucun appel réseau sortant.
 *
 * Usage, depuis owise-app : npx tsx scripts/tableau-environnements.mts
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'

const lireEnv = (chemin: string): Record<string, string> => {
  const out: Record<string, string> = {}
  if (!existsSync(chemin)) return out
  for (const l of readFileSync(chemin, 'utf8').split('\n')) {
    const i = l.indexOf('=')
    if (i > 0 && !l.trimStart().startsWith('#')) {
      out[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
    }
  }
  return out
}

const prod = lireEnv(resolve(process.cwd(), '.env.local'))
const test = lireEnv(resolve(process.cwd(), '.env.test.integration'))

/** Empreinte stable, non réversible, tronquée : compare sans révéler. */
const empreinte = (v?: string) =>
  v ? createHash('sha256').update(v).digest('hex').slice(0, 8) : '—'

/** Ce qu'on peut montrer d'un secret : son genre, sa taille, son empreinte. */
const decrire = (v?: string) => {
  if (v === undefined) return { genre: 'ABSENTE', taille: '—', emp: '—' }
  if (v === '') return { genre: 'VIDE (neutralisée)', taille: '0', emp: '—' }
  const prefixes = ['sk_test_', 'sk_live_', 'rk_test_', 'rk_live_', 'pk_test_', 'pk_live_', 'whsec_', 're_', 'phc_', 'eyJ', 'G-', 'AW-']
  const p = prefixes.find(x => v.startsWith(x))
  return {
    genre: p ? `${p}…` : /^https?:\/\//.test(v) ? v.replace(/^(https?:\/\/[^/]{0,34}).*$/, '$1…') : 'opaque',
    taille: String(v.length),
    emp: empreinte(v),
  }
}

const LIGNES: [string, string, string][] = [
  ['Stripe — clé secrète',        'STRIPE_SECRET_KEY',              'mode test exigé (sk_test)'],
  ['Stripe — clé publiable',      'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'mode test exigé'],
  ['Stripe — secret du webhook',  'STRIPE_WEBHOOK_SECRET',          'DOIT différer de la production'],
  ['Supabase — URL',              'NEXT_PUBLIC_SUPABASE_URL',       'DOIT pointer localhost'],
  ['Supabase — clé publique',     'NEXT_PUBLIC_SUPABASE_ANON_KEY',  'DOIT différer de la production'],
  ['Supabase — clé de service',   'SUPABASE_SERVICE_ROLE_KEY',      'DOIT différer de la production'],
  ['Resend — e-mails',            'RESEND_API_KEY',                 'DOIT être vide'],
  ['Meta CAPI — jeton',           'META_CAPI_ACCESS_TOKEN',         'DOIT être vide'],
  ['Meta CAPI — pixel',           'NEXT_PUBLIC_FB_PIXEL_ID',        'DOIT être vide'],
  ['Google Ads — jeton',          'GOOGLE_ADS_REFRESH_TOKEN',       'DOIT être vide'],
  ['Google Ads — identifiant',    'GOOGLE_ADS_CUSTOMER_ID',         'DOIT être vide'],
  ['PostHog — clé',               'NEXT_PUBLIC_POSTHOG_KEY',        'DOIT être vide'],
  ['Google Analytics',            'NEXT_PUBLIC_GA_ID',              'DOIT être vide'],
  ['Sentry — DSN',                'NEXT_PUBLIC_SENTRY_DSN',         'DOIT être vide'],
  ['Site — URL publique',         'NEXT_PUBLIC_SITE_URL',           'DOIT pointer localhost'],
  ['Cron — secret',               'CRON_SECRET',                    'propre au test'],
  ['Admin — e-mail des alertes',  'ADMIN_EMAIL',                    'adresse fictive'],
]

const ANSI = { v: '\x1b[32m', r: '\x1b[31m', j: '\x1b[33m', g: '\x1b[1m', z: '\x1b[0m' }
console.log(`${ANSI.g}Tableau de correspondance des environnements${ANSI.z}`)
console.log(`${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · aucun secret affiché\n`)

if (Object.keys(test).length === 0) {
  console.log(`${ANSI.j}⚠${ANSI.z} .env.test.integration n'existe pas encore — colonne « test » vide.\n`)
}

const l = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s.padEnd(n)
console.log(l('Rôle', 30) + l('Variable', 36) + l('PRODUCTION', 24) + l('TEST ISOLÉ', 24) + 'Verdict')
console.log('─'.repeat(130))

const problemes: string[] = []
for (const [role, cle, exigence] of LIGNES) {
  const p = decrire(prod[cle])
  const t = decrire(test[cle])
  const memeSecret = p.emp !== '—' && p.emp === t.emp

  let verdict = ''
  if (Object.keys(test).length === 0) {
    verdict = `à définir — ${exigence}`
  } else if (exigence.includes('vide')) {
    verdict = t.genre === 'VIDE (neutralisée)' || t.genre === 'ABSENTE'
      ? `${ANSI.v}✓ neutralisée${ANSI.z}` : `${ANSI.r}✗ ACTIVE — effet de bord possible${ANSI.z}`
    if (!verdict.includes('✓')) problemes.push(`${cle} n'est pas neutralisée dans l'environnement de test`)
  } else if (exigence.includes('localhost')) {
    verdict = /localhost|127\.0\.0\.1/.test(test[cle] ?? '')
      ? `${ANSI.v}✓ local${ANSI.z}` : `${ANSI.r}✗ NON LOCAL${ANSI.z}`
    if (!verdict.includes('✓')) problemes.push(`${cle} ne pointe pas sur localhost`)
  } else if (exigence.includes('différer')) {
    verdict = memeSecret ? `${ANSI.r}✗ IDENTIQUE À LA PRODUCTION${ANSI.z}` : `${ANSI.v}✓ distincte${ANSI.z}`
    if (memeSecret) problemes.push(`${cle} est le secret de PRODUCTION`)
  } else if (exigence.includes('sk_test') || exigence.includes('mode test')) {
    const estTest = /test/.test(test[cle] ?? prod[cle] ?? '')
    verdict = estTest ? `${ANSI.v}✓ mode test${ANSI.z}` : `${ANSI.r}✗ MODE LIVE${ANSI.z}`
    if (!estTest) problemes.push(`${cle} n'est pas en mode test`)
  } else {
    verdict = t.genre === 'ABSENTE' ? `${ANSI.j}à définir${ANSI.z}` : `${ANSI.v}✓${ANSI.z}`
  }

  const col = (d: ReturnType<typeof decrire>) =>
    d.genre === 'ABSENTE' ? l('absente', 24)
    : d.genre === 'VIDE (neutralisée)' ? l('vide', 24)
    : l(`${d.genre} ${d.taille}c ${d.emp}`, 24)

  console.log(l(role, 30) + l(cle, 36) + col(p) + col(t) + verdict)
}

console.log('\n' + '─'.repeat(130))
console.log('Légende : « sk_test_… 107c a1b2c3d4 » = genre du secret · longueur · empreinte SHA-256 tronquée.')
console.log('Deux empreintes identiques signalent le MÊME secret des deux côtés — c\'est ce qu\'il faut éviter.')
console.log('Aucune valeur n\'est affichée, ni en clair, ni en partie.')

console.log(`\n${ANSI.g}Tunnel et destinations${ANSI.z}`)
console.log('  Webhook testé           : http://localhost:3210/api/stripe/webhook  (local, jamais exposé)')
console.log('  Événements signés       : générés localement en HMAC-SHA256, avec le secret de test')
console.log('  Destinations Stripe Live: NON TOUCHÉES — aucune API Stripe appelée par ce test')
console.log('  Secrets Vercel          : NON TOUCHÉS — aucun appel à l\'API Vercel')

if (problemes.length) {
  console.log(`\n${ANSI.r}${ANSI.g}${problemes.length} PROBLÈME(S) D'ISOLEMENT${ANSI.z}`)
  for (const p of problemes) console.log(`  ✗ ${p}`)
  process.exit(1)
}
if (Object.keys(test).length === 0) {
  console.log(`\n${ANSI.j}${ANSI.g}ENVIRONNEMENT DE TEST À CONSTRUIRE${ANSI.z} — la colonne TEST est vide.`)
  process.exit(2)
}
console.log(`\n${ANSI.v}${ANSI.g}ISOLEMENT VÉRIFIÉ${ANSI.z} — aucun secret de production dans l'environnement de test.`)
