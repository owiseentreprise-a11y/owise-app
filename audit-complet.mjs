/**
 * AUDIT COMPLET OWISE — Production
 * Couvre : pages publiques, DB integrity, flows critiques
 */
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

// ── Config ─────────────────────────────────────────────────────────────────
const BASE   = 'https://owise.fr'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const env    = readFileSync('.env.local', 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim() }

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

let passed = 0, failed = 0, warns = 0
const issues = []

function ok(s)      { console.log(`  \x1b[32m✓\x1b[0m ${s}`); passed++ }
function fail(s)    { console.log(`  \x1b[31m✗\x1b[0m ${s}`); failed++; issues.push(s) }
function warn(s)    { console.log(`  \x1b[33m⚠\x1b[0m ${s}`); warns++ }
function section(s) { console.log(`\n\x1b[1m\x1b[36m====  ${s}  ====\x1b[0m`) }

// ════════════════════════════════════════════════════════
// 1. DB INTEGRITY
// ════════════════════════════════════════════════════════
section('DB INTEGRITY')

const [
  { data: courses, error: eCourses },
  { data: chauffeurs },
  { data: clients },
  { data: collabs },
  { data: sousTraitants },
  { data: tarifs },
  { data: zones },
  { data: parametres },
] = await Promise.all([
  sb.from('courses').select('id, statut, chauffeur_id, sous_traitant_id, prix_estime, prix_final, client_id, date_prevue, type_vehicule, nb_passagers, prix_sous_traitant'),
  sb.from('chauffeurs').select('id, statut, sous_traitant_id, vehicule_marque, vehicule_modele'),
  sb.from('clients').select('id, type_compte, entreprise_nom'),
  sb.from('collaborateurs').select('id, client_id, nom, prenom, poste, tel'),
  sb.from('sous_traitants').select('id, nom, actif, mode_paiement, email'),
  sb.from('tarifs').select('vehicule, prise_en_charge, prix_km'),
  sb.from('zones').select('id, nom, code, type, prefixes_postaux'),
  sb.from('parametres').select('*').eq('id', true).single(),
])

if (eCourses) { fail('Impossible de lire la table courses : ' + eCourses.message) }

// --- Courses ---
const total    = courses?.length ?? 0
const actives  = courses?.filter(c => !['annulee','terminee'].includes(c.statut)) ?? []
const attente  = courses?.filter(c => c.statut === 'en_attente') ?? []
ok(`Courses totales : ${total} | actives : ${actives.length} | en attente : ${attente.length}`)

// Cohérence chauffeur + ST simultanés
const doublon = courses?.filter(c => c.chauffeur_id && c.sous_traitant_id && !['annulee','terminee'].includes(c.statut)) ?? []
doublon.length === 0
  ? ok('Cohérence chauffeur/ST : pas de doublon sur les courses actives')
  : warn(`${doublon.length} courses actives avec chauffeur ET sous-traitant simultanément`)

// Prix ST sans ST
const stSansST = courses?.filter(c => c.prix_sous_traitant !== null && !c.sous_traitant_id) ?? []
stSansST.length === 0
  ? ok('Cohérence prix_ST : aucun prix_sous_traitant orphelin')
  : warn(`${stSansST.length} courses ont prix_sous_traitant sans sous_traitant_id : ${stSansST.map(c => c.id.slice(-6)).join(', ')}`)

// FK pendantes — détecte les traces laissées par une suppression non sécurisée
// (cf. bug aa1c44eb : sous_traitant_id mis à null pour contourner une contrainte
// FK avant un DELETE, sans nettoyer les colonnes dénormalisées associées)
const stIds = new Set((sousTraitants ?? []).map(s => s.id))
const chIds = new Set((chauffeurs ?? []).map(c => c.id))
const stPendantes = courses?.filter(c => c.sous_traitant_id && !stIds.has(c.sous_traitant_id)) ?? []
const chPendantes = courses?.filter(c => c.chauffeur_id && !chIds.has(c.chauffeur_id)) ?? []
stPendantes.length === 0
  ? ok('Aucune course ne référence un sous_traitant_id inexistant')
  : fail(`${stPendantes.length} courses référencent un sous_traitant_id qui n'existe plus : ${stPendantes.map(c => c.id.slice(-6)).join(', ')}`)
chPendantes.length === 0
  ? ok('Aucune course ne référence un chauffeur_id inexistant')
  : fail(`${chPendantes.length} courses référencent un chauffeur_id qui n'existe plus : ${chPendantes.map(c => c.id.slice(-6)).join(', ')}`)

// --- Chauffeurs ---
ok(`Chauffeurs : ${chauffeurs?.length ?? 0} (${chauffeurs?.filter(c => c.statut === 'disponible').length ?? 0} disponibles)`)
for (const ch of (chauffeurs?.filter(c => c.statut === 'en_course') ?? [])) {
  const courseActive = courses?.find(c => c.chauffeur_id === ch.id && ['acceptee','en_route','prise_en_charge'].includes(c.statut))
  if (!courseActive) warn(`Chauffeur ${ch.id.slice(-6)} marqué "en_course" sans course active correspondante`)
}

// --- Collaborateurs ---
const collabsSansFK = collabs?.filter(c => {
  if (!c.client_id) return true
  return !clients?.find(cl => cl.id === c.client_id)
}) ?? []
collabsSansFK.length === 0
  ? ok(`Collaborateurs : ${collabs?.length ?? 0} — tous ont un client_id valide`)
  : fail(`${collabsSansFK.length} collaborateurs avec client_id invalide ou absent`)

const collabsSansNom = collabs?.filter(c => !c.nom && !c.prenom) ?? []
collabsSansNom.length === 0
  ? ok('Collaborateurs : tous ont nom et/ou prenom')
  : warn(`${collabsSansNom.length} collaborateurs sans nom ni prenom`)

// Zanetti / Relko
const zanetti = collabs?.find(c => c.nom === 'Zanetti')
const relko   = clients?.find(c => c.entreprise_nom?.toLowerCase().includes('rehlko'))
if (zanetti && relko) {
  zanetti.client_id === relko.id
    ? ok(`Zanetti (${zanetti.prenom} ${zanetti.nom}) correctement lié a ${relko.entreprise_nom}`)
    : fail(`Zanetti client_id (${zanetti.client_id?.slice(-6)}) != Relko id (${relko.id.slice(-6)})`)
  zanetti.nom && zanetti.prenom
    ? ok('Zanetti : nom+prenom directs en DB (pas besoin du join profiles)')
    : warn('Zanetti : nom ou prenom null — affichage degradé')
} else {
  warn('Zanetti ou Relko introuvable — vérifier si effacé')
}

// --- Tarifs ---
for (const v of ['berline', 'berline_premium', 'van']) {
  const t = tarifs?.find(t => t.vehicule === v)
  t
    ? ok(`Tarif "${v}" : prise_en_charge=${t.prise_en_charge}€  prix_km=${t.prix_km}€`)
    : fail(`Tarif manquant pour "${v}"`)
}

// --- Zones ---
const zonesReq = ['CDG', 'ORY', 'BVA', 'Z1']
for (const code of zonesReq) {
  const z = zones?.find(z => z.code === code)
  z ? ok(`Zone ${code} : "${z.nom}" (${z.type})`) : fail(`Zone ${code} manquante`)
}

// --- Sous-traitants ---
const stActifs = sousTraitants?.filter(s => s.actif)
ok(`Sous-traitants actifs : ${stActifs?.length ?? 0}`)
for (const st of stActifs ?? []) {
  if (!st.email) warn(`ST "${st.nom}" : pas d email — notifications impossible`)
}

// --- Paramètres ---
if (parametres?.data) {
  ok('Table parametres : accessible')
} else {
  warn('Table parametres vide ou inaccessible')
}

// ════════════════════════════════════════════════════════
// 2. BROWSER — PAGES PUBLIQUES
// ════════════════════════════════════════════════════════
section('PAGES PUBLIQUES (browser)')

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})

async function testPage(url, label, checks) {
  const page = await browser.newPage()
  const jsErrors = []
  page.on('pageerror', e => jsErrors.push(e.message.slice(0, 100)))
  try {
    const res = await page.goto(url, { waitUntil: 'networkidle0', timeout: 25000 })
    const status = res?.status() ?? 0
    const text = await page.evaluate(() => document.body?.innerText ?? '')
    const html = await page.evaluate(() => document.body?.innerHTML ?? '')

    if (status >= 400)                                           fail(`${label} — HTTP ${status}`)
    else if (text.includes('Application error'))                 fail(`${label} — "Application error" visible`)
    else if (text.match(/Internal Server Error/i))               fail(`${label} — Internal Server Error`)
    else                                                         ok(`${label} — HTTP ${status} OK`)

    if (jsErrors.length > 0) warn(`${label} — ${jsErrors.length} erreur(s) JS : ${jsErrors[0]}`)

    if (checks) await checks(page, text, html)
  } catch(e) {
    fail(`${label} — ${e.message.slice(0, 100)}`)
  } finally {
    await page.close()
  }
}

await testPage(BASE, 'GET /', async (p, t) => {
  t.includes('Owise') || t.includes('VTC') ? ok('Vitrine : contenu brand OK') : fail('Vitrine : contenu brand absent')
  t.includes('Réserver') || t.includes('reserver') ? ok('Vitrine : CTA réserver présent') : warn('Vitrine : CTA réserver introuvable')
  !t.includes('Majoration nuit') ? ok('Vitrine : "Majoration nuit" retirée') : fail('Vitrine : "Majoration nuit" encore présente')
  const nbUndefined = (t.match(/\bundefined\b/g) || []).length
  nbUndefined === 0 ? ok('Vitrine : aucun "undefined" visible') : fail(`Vitrine : ${nbUndefined} occurrence(s) "undefined"`)
  ;['CDG','Orly','Beauvais'].some(a => t.includes(a)) ? ok('Vitrine : aéroports dans le tableau tarifaire') : fail('Vitrine : aéroports absents du tableau')
})

await testPage(`${BASE}/reserver`, 'GET /reserver', async (p, t) => {
  t.includes('Berline') ? ok('/reserver : véhicule "Berline" présent') : fail('/reserver : choix véhicule absent')
  const max = await p.$eval('input[type=date]', el => el.getAttribute('max')).catch(() => null)
  max ? ok('/reserver : input date a attribut max') : warn('/reserver : pas d attribut max sur input date')
  const nbUndefined = (t.match(/\bundefined\b/g) || []).length
  nbUndefined === 0 ? ok('/reserver : aucun "undefined"') : warn(`/reserver : ${nbUndefined} "undefined"`)
})

await testPage(`${BASE}/login`, 'GET /login', async (p, t) => {
  const hasEmail = await p.$('input[type=email]')
  const hasPass  = await p.$('input[type=password]')
  hasEmail && hasPass ? ok('/login : formulaire email+password OK') : fail('/login : formulaire incomplet')
  t.includes('Owise') ? ok('/login : branding présent') : warn('/login : pas de branding visible')
})

await testPage(`${BASE}/client-login`, 'GET /client-login', async (p, t) => {
  const hasEmail = await p.$('input[type=email]')
  hasEmail ? ok('/client-login : formulaire présent') : fail('/client-login : formulaire absent')
})

await testPage(`${BASE}/mentions-legales`, 'GET /mentions-legales', async (p, t) => {
  t.match(/mention|légal|cgu|politique/i) ? ok('/mentions-legales : contenu légal OK') : fail('/mentions-legales : contenu légal absent')
})

// ════════════════════════════════════════════════════════
// 3. REDIRECTIONS AUTH
// ════════════════════════════════════════════════════════
section('PROTECTION AUTH (redirections)')

async function checkAuthRedirect(url, label) {
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 15000 })
    const final = page.url()
    const protected_ = final.includes('login') || final !== url
    protected_
      ? ok(`${label} — protégé (redirige vers ${final.replace(BASE, '') || '/'})`)
      : fail(`${label} — accessible sans authentification`)
  } catch(e) {
    warn(`${label} — ${e.message.slice(0, 60)}`)
  } finally {
    await page.close()
  }
}

await checkAuthRedirect(`${BASE}/admin`, 'GET /admin')
await checkAuthRedirect(`${BASE}/admin/courses`, 'GET /admin/courses')
await checkAuthRedirect(`${BASE}/admin/courses/nouvelle`, 'GET /admin/courses/nouvelle')
await checkAuthRedirect(`${BASE}/espace-client`, 'GET /espace-client')
await checkAuthRedirect(`${BASE}/chauffeur`, 'GET /chauffeur')
await checkAuthRedirect(`${BASE}/sous-traitant`, 'GET /sous-traitant')

// ════════════════════════════════════════════════════════
// 4. FLOW DEVIS/RESERVATION
// ════════════════════════════════════════════════════════
section('FLOW /reserver (avec params)')

async function testReserver(params, label, checks) {
  const url = `${BASE}/reserver?${params}`
  const page = await browser.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 20000 })
    await new Promise(r => setTimeout(r, 2000))
    const t = await page.evaluate(() => document.body.innerText)
    ok(`${label} — page chargée`)
    if (checks) checks(t)
  } catch(e) {
    fail(`${label} — ${e.message.slice(0,80)}`)
  } finally {
    await page.close()
  }
}

await testReserver(
  'depart=Paris+1er&arrivee=Aeroport+Charles+de+Gaulle&date=2026-08-01&time=08:00&vehicule=berline&pax=1',
  '/reserver Paris→CDG',
  (t) => {
    !t.includes('undefined') ? ok('Paris→CDG : pas undefined') : fail('Paris→CDG : undefined visible')
    t.includes('€') ? ok('Paris→CDG : prix affiché') : warn('Paris→CDG : prix non visible')
  }
)

await testReserver(
  'depart=Compiegne+60200&arrivee=Aeroport+Charles+de+Gaulle&date=2026-08-01&time=08:00&vehicule=berline&pax=1',
  '/reserver Compiegne→CDG',
  (t) => {
    !t.includes('Gares parisiennes') ? ok('Compiegne→CDG : non classé gare parisienne') : fail('Compiegne : classé comme gare parisienne (bug zone)')
  }
)

// ════════════════════════════════════════════════════════
// 5. PERF VITRINE
// ════════════════════════════════════════════════════════
section('PERFORMANCE')
const pp = await browser.newPage()
await pp.goto(BASE, { waitUntil: 'networkidle0', timeout: 30000 })
const perf = await pp.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0]
  return {
    ttfb: Math.round(nav.responseStart - nav.startTime),
    dom:  Math.round(nav.domContentLoadedEventEnd - nav.startTime),
    load: Math.round(nav.loadEventEnd - nav.startTime),
  }
})
await pp.close()
perf.ttfb < 800  ? ok(`TTFB : ${perf.ttfb}ms`) : perf.ttfb < 2000 ? warn(`TTFB moyen : ${perf.ttfb}ms`) : fail(`TTFB trop élevé : ${perf.ttfb}ms`)
perf.dom  < 2000 ? ok(`DOMContentLoaded : ${perf.dom}ms`) : warn(`DOM lent : ${perf.dom}ms`)
perf.load < 4000 ? ok(`Load event : ${perf.load}ms`) : warn(`Load lent : ${perf.load}ms`)

await browser.close()

// ════════════════════════════════════════════════════════
// RÉSUMÉ
// ════════════════════════════════════════════════════════
console.log('\n' + '='.repeat(62))
console.log(`\x1b[1mAUDIT FINAL :  ${passed} \x1b[32m✓\x1b[0m\x1b[1m passe  |  ${warns} \x1b[33m⚠\x1b[0m\x1b[1m avertissements  |  ${failed} \x1b[31m✗\x1b[0m\x1b[1m echecs\x1b[0m`)
if (issues.length > 0) {
  console.log('\n\x1b[31mProblemes a corriger :\x1b[0m')
  issues.forEach((issue, i) => console.log(`  ${i+1}. ${issue}`))
}
console.log('='.repeat(62) + '\n')
process.exit(failed > 0 ? 1 : 0)
