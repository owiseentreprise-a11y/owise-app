/**
 * indexnow-tout-le-site.mts — SIGNALER À BING TOUTES LES PAGES DU SITEMAP.
 *
 * À lancer une fois après un déploiement qui modifie beaucoup de pages (pages
 * villes, tarifs, conditions). Les nouveaux articles, eux, sont signalés seuls
 * par `/api/cron/blog-generation`.
 *
 * Avant tout envoi, le script VÉRIFIE que la clé est servie par le site :
 * sans elle, IndexNow refuse tout (403) et un envoi ne prouverait rien.
 *
 *   npx tsx scripts/indexnow-tout-le-site.mts [url]            vérification seule
 *   npx tsx scripts/indexnow-tout-le-site.mts [url] --envoyer  vérification + envoi
 */
import { INDEXNOW_CLE, signalerAIndexNow } from '../src/lib/indexnow'

const BASE = (process.argv.slice(2).find(a => a.startsWith('http')) ?? 'https://www.owise.fr').replace(/\/$/, '')
const ENVOYER = process.argv.includes('--envoyer')
const UA = 'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)'
const V = '\x1b[32m', R = '\x1b[31m', J = '\x1b[33m', B = '\x1b[1m', Z = '\x1b[0m'

let echecs = 0
const ok = (m: string) => console.log(`${V}✓${Z} ${m}`)
const ko = (m: string) => { echecs++; console.log(`${R}✗ ${m}${Z}`) }

// 1. La clé est-elle servie, telle quelle, à l'adresse annoncée ?
const rc = await fetch(`${BASE}/${INDEXNOW_CLE}.txt`, { headers: { 'user-agent': UA } })
const contenu = rc.ok ? (await rc.text()).trim() : ''
if (rc.status === 200 && contenu === INDEXNOW_CLE) ok(`clé servie à ${BASE}/${INDEXNOW_CLE}.txt`)
else ko(`clé NON servie correctement : HTTP ${rc.status}, contenu « ${contenu.slice(0, 40)} »`)

// 2. Les adresses à signaler : celles que le sitemap déclare.
const rs = await fetch(`${BASE}/sitemap.xml`, { headers: { 'user-agent': UA } })
const adresses = [...(await rs.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1].trim())
if (adresses.length > 0) ok(`${adresses.length} adresse(s) dans le sitemap`)
else ko(`sitemap vide ou illisible (HTTP ${rs.status})`)
const horsDomaine = adresses.filter(u => !u.startsWith('https://www.owise.fr/') && u !== 'https://www.owise.fr')
if (horsDomaine.length) ko(`${horsDomaine.length} adresse(s) hors de www.owise.fr — IndexNow les refuserait : ${horsDomaine.slice(0, 3).join(', ')}`)

if (echecs) { console.log(`\n${R}${B}${echecs} problème(s) : rien n'est envoyé.${Z}`); process.exit(1) }
if (!ENVOYER) { console.log(`\n${J}Vérification seule. Ajouter « --envoyer » pour signaler les ${adresses.length} adresses.${Z}`); process.exit(0) }

// 3. L'envoi, et la réponse d'IndexNow — pas notre interprétation.
const r = await signalerAIndexNow(adresses)
const sens: Record<number, string> = {
  200: 'reçu', 202: 'reçu — clé en cours de vérification par Bing', 400: 'requête mal formée',
  403: 'clé refusée (fichier introuvable ou contenu différent)', 422: 'adresses hors du domaine déclaré',
  429: 'trop de signaux — réessayer plus tard', [-1]: 'pas de réponse (réseau ou délai dépassé)',
}
console.log(`\n${r.ok ? V : R}${B}IndexNow : HTTP ${r.statut} — ${sens[r.statut] ?? 'réponse inattendue'} — ${r.envoyees} adresse(s)${Z}`)
process.exit(r.ok ? 0 : 1)
