/**
 * Les mesures ignorent-elles les automates, sans écarter les vrais visiteurs ?
 *
 *   npx tsx scripts/test-mesures-robots.mts
 *
 * N'OUVRE NI RÉSEAU NI BASE.
 *
 * Le 2026-11-09, les contrôles automatiques du projet ont écrit 99
 * estimations et 118 événements de tunnel dans la base de production — 31 %
 * des analytiques de l'exploitant. Le serveur refuse désormais d'enregistrer
 * une mesure venue d'un navigateur piloté ou d'un robot d'indexation.
 *
 * CE CONTRÔLE A DEUX DEVOIRS, ET LE SECOND EST LE PLUS IMPORTANT
 *
 *   1. Reconnaître les automates. Un faux négatif repollue les statistiques —
 *      c'est ennuyeux, et visible.
 *   2. NE PAS reconnaître les vrais navigateurs. Un faux positif fait perdre
 *      en silence la mesure d'un client réel — et personne ne s'en aperçoit,
 *      puisqu'il ne manque qu'une ligne qui n'a jamais existé. C'est le
 *      défaut qui coûterait le plus cher.
 *
 * Les en-têtes ci-dessous sont de VRAIES chaînes, pas des approximations.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { estUnRobot } from '../src/lib/robot'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p: string) => readFileSync(resolve(RACINE, p), 'utf8')

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ok = 0
const rates: string[] = []
const verifier = (quoi: string, condition: boolean) => {
  if (condition) ok++; else rates.push(quoi)
}

console.log(`\n${B}LES MESURES ÉCARTENT-ELLES LES AUTOMATES, ET EUX SEULS ?${Z}`)

/* ── 1. Les automates doivent être reconnus ─────────────────────────────── */
console.log(`\n${B}1. ce qui ne réservera jamais de course${Z}`)
const AUTOMATES: Array<[string, string]> = [
  ['Puppeteer sans fenêtre',
   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36'],
  ['Playwright sans fenêtre',
   'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/130.0.0.0 Safari/537.36'],
  ['Googlebot',
   'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'],
  ['GPTBot',
   'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot'],
  ['PerplexityBot',
   'Mozilla/5.0 (compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
  ['ClaudeBot',
   'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ClaudeBot/1.0; +claudebot@anthropic.com'],
  ['Bingbot',
   'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'],
  ['curl',             'curl/8.7.1'],
  ['wget',             'Wget/1.21.4'],
  ['node-fetch',       'node-fetch/1.0 (+https://github.com/bitinn/node-fetch)'],
  ['axios',            'axios/1.7.7'],
  ['Python requests',  'python-requests/2.32.3'],
  ['Lighthouse',       'Mozilla/5.0 Chrome-Lighthouse'],
  ['UptimeRobot',      'Mozilla/5.0+(compatible; UptimeRobot/2.0; http://www.uptimerobot.com/)'],
  ['AhrefsBot',        'Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)'],
  ['Selenium',         'Mozilla/5.0 selenium webdriver'],
  ['en-tête absent',   ''],
]
for (const [nom, ua] of AUTOMATES) {
  const vu = estUnRobot(ua)
  verifier(`${nom} est reconnu comme automate`, vu)
  if (!vu) console.log(`   ${R}✗${Z} ${nom} passe pour un visiteur : « ${ua.slice(0, 70)} »`)
}

/* ── 2. Les vrais navigateurs ne doivent PAS l'être ─────────────────────── */
console.log(`\n${B}2. ce qui pourrait réserver une course${Z}`)
const VISITEURS: Array<[string, string]> = [
  ['Chrome Windows',
   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'],
  ['Chrome Android',
   'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'],
  ['Safari iPhone',
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'],
  ['Safari macOS',
   'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4.1 Safari/605.1.15'],
  ['Firefox Windows',
   'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0'],
  ['Edge Windows',
   'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'],
  ['Samsung Internet',
   'Mozilla/5.0 (Linux; Android 13; SAMSUNG SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/23.0 Chrome/115.0.0.0 Mobile Safari/537.36'],
  ['Chrome iPad',
   'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1'],
  ['Firefox Android',
   'Mozilla/5.0 (Android 14; Mobile; rv:132.0) Gecko/132.0 Firefox/132.0'],
  ['navigateur intégré Facebook',
   'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBDV/iPhone15,2]'],
]
for (const [nom, ua] of VISITEURS) {
  const vu = estUnRobot(ua)
  verifier(`${nom} n'est PAS pris pour un automate`, !vu)
  if (vu) console.log(`   ${R}✗${Z} ${nom} serait écarté à tort — sa mesure serait perdue en silence`)
}

/* ── 3. Les deux chemins d'écriture appliquent le filtre ────────────────── */
console.log(`\n${B}3. les deux chemins d'écriture l'appliquent${Z}`)
const route = lire('src/app/api/estimations/route.ts')
verifier('la route des estimations filtre', route.includes('estUnRobot('))
verifier('elle lit bien l\'en-tête de la requête',
  /estUnRobot\(\s*req\.headers\.get\('user-agent'\)\s*\)/.test(route))
const action = lire('src/app/actions/funnel.ts')
verifier('l\'action du tunnel filtre', action.includes('estUnRobot('))
verifier('elle lit bien les en-têtes entrants', /headers\(\)\)\.get\('user-agent'\)/.test(action))

/* Le filtre ne doit toucher QUE la mesure : une réservation, un paiement ou
   un devis venus d'un en-tête inhabituel doivent passer normalement. */
console.log(`\n${B}4. rien d'autre que la mesure n'est filtré${Z}`)
const AILLEURS = [
  'src/app/reserver/actions.ts',
  'src/app/api/stripe/webhook/route.ts',
  'src/app/vitrine/actions.ts',
]
for (const f of AILLEURS) {
  let src = ''
  try { src = lire(f) } catch { continue }
  verifier(`${f.replace('src/app/', '')} ne filtre pas les robots`, !src.includes('estUnRobot'))
}

console.log(`\n${B}RÉSULTAT${Z}`)
console.log(`  ${ok} contrôles au vert · ${rates.length ? R : V}${rates.length} au rouge${Z}`)
if (rates.length) {
  console.log(`\n${B}Ce qui échoue${Z}`)
  for (const r of rates) console.log(`  ${R}✗${Z} ${r}`)
}
console.log(`\n${G}Aucun réseau, aucune base.${Z}\n`)
process.exit(rates.length ? 1 : 0)
