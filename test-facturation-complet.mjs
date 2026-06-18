/**
 * TEST COMPLET FACTURATION — Entreprise / Collaborateur / Particulier
 * Crée des comptes et courses factices, génère une facture réelle (Stripe TEST),
 * vérifie l'affichage admin + les 3 vues client, puis nettoie tout.
 */
import puppeteer from 'puppeteer-core'
import { readFileSync, writeFileSync } from 'fs'

const KEEP = process.argv.includes('--keep')

const env = readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
for (const l of env.split('\n')) { const m = l.match(/^([^#=]+)=(.*)$/); if (m) process.env[m[1].trim()] = m[2].trim() }

const { createClient } = await import('@supabase/supabase-js')
const Stripe = (await import('stripe')).default

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const BASE   = 'https://owise.fr'
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
const ADMIN_EMAIL = 'owise.entreprise@gmail.com'
const ADMIN_PASS  = 'Taoubataouba6791?'
const TEST_PASSWORD = 'TestOwise2026!'
const rand = Math.random().toString(36).slice(2, 8)

let passed = 0, failed = 0
const issues = []
function ok(s)   { console.log(`  \x1b[32m✓\x1b[0m ${s}`); passed++ }
function fail(s) { console.log(`  \x1b[31m✗\x1b[0m ${s}`); failed++; issues.push(s) }
function section(s) { console.log(`\n\x1b[1m\x1b[36m====  ${s}  ====\x1b[0m`) }

const created = { authUsers: [], collaborateurs: [], courses: [], factures: [], stripePaymentLinkId: null }

async function cleanup(state) {
  section('NETTOYAGE — suppression des données factices')
  if (state.factures.length)        { await sb.from('factures').delete().in('id', state.factures); ok(`${state.factures.length} facture(s) supprimée(s)`) }
  if (state.courses.length)         { await sb.from('courses').delete().in('id', state.courses); ok(`${state.courses.length} course(s) supprimée(s)`) }
  if (state.collaborateurs.length)  { await sb.from('collaborateurs').delete().in('id', state.collaborateurs); ok(`${state.collaborateurs.length} collaborateur(s) supprimé(s)`) }
  for (const id of state.authUsers) {
    await sb.from('clients').delete().eq('id', id)
    await sb.from('profiles').delete().eq('id', id)
    await sb.auth.admin.deleteUser(id).catch(() => {})
  }
  if (state.authUsers.length) ok(`${state.authUsers.length} compte(s) auth + profil + client supprimé(s)`)
  if (state.stripePaymentLinkId) {
    await stripe.paymentLinks.update(state.stripePaymentLinkId, { active: false }).catch(() => {})
    ok('Lien de paiement Stripe TEST désactivé')
  }
}

if (process.argv.includes('--cleanup-only')) {
  const state = JSON.parse(readFileSync(new URL('./test-facturation-state.json', import.meta.url), 'utf8'))
  await cleanup(state)
  console.log('\nNettoyage terminé.\n')
  process.exit(0)
}

const info = {}

try {
  // ════════════════════════════════════════════════════════
  section('SETUP — comptes factices')
  // ════════════════════════════════════════════════════════

  const entrepriseEmail = `test-entreprise-${rand}@owise-test.local`
  info.entrepriseEmail = entrepriseEmail
  const { data: entAuth, error: entAuthErr } = await sb.auth.admin.createUser({
    email: entrepriseEmail, password: TEST_PASSWORD, email_confirm: true,
    app_metadata: { role: 'client' }, user_metadata: { prenom: 'Test', nom: 'Entreprise' },
  })
  if (entAuthErr) throw new Error('Auth entreprise: ' + entAuthErr.message)
  const entId = entAuth.user.id
  created.authUsers.push(entId)
  await sb.from('profiles').insert({ id: entId, role: 'client', nom: 'Entreprise', prenom: 'Test', telephone: '0600000001' })
  await sb.from('clients').insert({ id: entId, type_compte: 'entreprise', entreprise_nom: 'TEST SARL Fictive', adresse_facturation: '1 rue du Test, 75000 Paris' })
  ok(`Entreprise : ${entrepriseEmail} (${entId.slice(-6)})`)

  const particulierEmail = `test-particulier-${rand}@owise-test.local`
  info.particulierEmail = particulierEmail
  const { data: partAuth, error: partAuthErr } = await sb.auth.admin.createUser({
    email: particulierEmail, password: TEST_PASSWORD, email_confirm: true,
    app_metadata: { role: 'client' }, user_metadata: { prenom: 'Jean', nom: 'Particulier' },
  })
  if (partAuthErr) throw new Error('Auth particulier: ' + partAuthErr.message)
  const partId = partAuth.user.id
  created.authUsers.push(partId)
  await sb.from('profiles').insert({ id: partId, role: 'client', nom: 'Particulier', prenom: 'Jean', telephone: '0600000002' })
  await sb.from('clients').insert({ id: partId, type_compte: 'particulier' })
  ok(`Particulier : ${particulierEmail} (${partId.slice(-6)})`)

  const collabEmail = `test-collab-${rand}@owise-test.local`
  info.collabEmail = collabEmail
  const { data: collabAuth, error: collabAuthErr } = await sb.auth.admin.createUser({
    email: collabEmail, password: TEST_PASSWORD, email_confirm: true,
    app_metadata: { role: 'collaborateur', client_id: entId }, user_metadata: { prenom: 'Marie', nom: 'Collab' },
  })
  if (collabAuthErr) throw new Error('Auth collaborateur: ' + collabAuthErr.message)
  const collabId = collabAuth.user.id
  created.authUsers.push(collabId)
  await sb.from('profiles').insert({ id: collabId, role: 'client', nom: 'Collab', prenom: 'Marie', telephone: '0600000003' })
  await sb.from('collaborateurs').insert({ id: collabId, client_id: entId, nom: 'Collab', prenom: 'Marie', tel: '0600000003', poste: 'Assistante' })
  created.collaborateurs.push(collabId)
  ok(`Collaborateur (avec accès portail) : ${collabEmail} (${collabId.slice(-6)})`)

  const { data: collabNoAuth, error: collabNoAuthErr } = await sb.from('collaborateurs').insert({
    client_id: entId, nom: 'Sansauth', prenom: 'Pierre', tel: '0600000004', poste: 'Stagiaire',
  }).select('id').single()
  if (collabNoAuthErr) throw new Error('Collaborateur sans auth: ' + collabNoAuthErr.message)
  created.collaborateurs.push(collabNoAuth.id)
  ok(`Collaborateur (sans accès, type "Zanetti") : Pierre Sansauth (${collabNoAuth.id.slice(-6)})`)

  // ════════════════════════════════════════════════════════
  section('COURSES — courses terminées prêtes à facturer')
  // ════════════════════════════════════════════════════════

  const baseDate = new Date(Date.now() - 3 * 86400000).toISOString()
  const plan = [
    { label: 'Entreprise (direct)',               client_id: entId,  collaborateur_id: null,           prix_final: 120 },
    { label: 'Collaborateur Marie (avec accès)',   client_id: entId,  collaborateur_id: collabId,       prix_final: 85  },
    { label: 'Collaborateur Pierre (sans accès)',  client_id: entId,  collaborateur_id: collabNoAuth.id, prix_final: 95 },
    { label: 'Particulier Jean',                   client_id: partId, collaborateur_id: null,           prix_final: 45  },
  ]
  const courseIds = {}
  for (const c of plan) {
    const { data: course, error } = await sb.from('courses').insert({
      client_id: c.client_id, collaborateur_id: c.collaborateur_id,
      statut: 'terminee',
      adresse_depart: 'Test Départ, 75001 Paris', adresse_arrivee: 'Test Arrivée, 75008 Paris',
      date_prevue: baseDate, type_vehicule: 'berline', nb_passagers: 1,
      prix_estime: c.prix_final, prix_final: c.prix_final,
    }).select('id').single()
    if (error) { fail(`Course "${c.label}": ${error.message}`); continue }
    created.courses.push(course.id)
    courseIds[c.label] = course.id
    ok(`Course "${c.label}" — ${c.prix_final}€ (${course.id.slice(-6)})`)
  }

  // ════════════════════════════════════════════════════════
  section('FACTURATION — génération facture entreprise (replique creerFacture)')
  // ════════════════════════════════════════════════════════

  const factureCourseIds = [
    courseIds['Entreprise (direct)'],
    courseIds['Collaborateur Marie (avec accès)'],
    courseIds['Collaborateur Pierre (sans accès)'],
  ].filter(Boolean)
  const montantTtc = 120 + 85 + 95
  const montantHt  = Math.round((montantTtc / 1.20) * 100) / 100

  const { data: paramData } = await sb.from('parametres').select('facture_prefixe').eq('id', true).single()
  const prefixe = paramData?.facture_prefixe ?? 'OW-'
  const { count } = await sb.from('factures').select('id', { count: 'exact', head: true })
  const now = new Date()
  const numero = `${prefixe}${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${String((count ?? 0) + 1).padStart(3, '0')}`
  const echeance = new Date(); echeance.setDate(echeance.getDate() + 30)

  const { data: facture, error: factErr } = await sb.from('factures').insert({
    client_id: entId, numero, statut: 'en_attente',
    montant_ht: montantHt, tva: Math.round((montantTtc - montantHt) * 100) / 100, montant_ttc: montantTtc,
    date_emission: new Date().toISOString().slice(0, 10), date_echeance: echeance.toISOString(),
  }).select('id').single()
  if (factErr || !facture) throw new Error('Création facture: ' + factErr?.message)
  created.factures.push(facture.id)
  info.factureId = facture.id
  info.numero = numero
  ok(`Facture ${numero} créée — ${montantTtc}€ TTC (HT ${montantHt}€)`)

  try {
    const price = await stripe.prices.create({ currency: 'eur', unit_amount: Math.round(montantTtc * 100), product_data: { name: `Facture ${numero} – OWISE VTC (TEST)` } })
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { facture_id: facture.id },
      after_completion: { type: 'redirect', redirect: { url: 'https://owise.fr/paiement/merci' } },
    })
    created.stripePaymentLinkId = link.id
    await sb.from('factures').update({ stripe_payment_link: link.url }).eq('id', facture.id)
    ok(`Lien de paiement Stripe TEST créé : ${link.url}`)
  } catch (e) { fail('Stripe payment link: ' + e.message) }

  await sb.from('courses').update({ facture_id: facture.id }).in('id', factureCourseIds)
  ok(`${factureCourseIds.length} courses liées à la facture`)

  // ════════════════════════════════════════════════════════
  section('VÉRIFICATION DB — intégrité')
  // ════════════════════════════════════════════════════════

  const { data: factureCheck } = await sb.from('factures').select('*').eq('id', facture.id).single()
  factureCheck.montant_ttc === montantTtc ? ok(`Montant TTC correct : ${factureCheck.montant_ttc}€`) : fail(`Montant TTC incorrect : ${factureCheck.montant_ttc} != ${montantTtc}`)

  const { data: coursesLinked } = await sb.from('courses').select('id, facture_id, collaborateurs(prenom,nom)').in('id', factureCourseIds)
  coursesLinked.every(c => c.facture_id === facture.id) ? ok('Toutes les courses ont le bon facture_id') : fail('facture_id incorrect sur certaines courses')

  const collabNames = coursesLinked.map(c => c.collaborateurs ? `${c.collaborateurs.prenom} ${c.collaborateurs.nom}` : null).filter(Boolean);
  (collabNames.includes('Marie Collab') && collabNames.includes('Pierre Sansauth'))
    ? ok(`Noms collaborateurs résolus en DB : ${collabNames.join(', ')}`)
    : fail(`Noms collaborateurs manquants en DB — trouvé : ${collabNames.join(', ') || 'aucun'}`)

  // ════════════════════════════════════════════════════════
  section('BROWSER — admin')
  // ════════════════════════════════════════════════════════

  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
    defaultViewport: { width: 1440, height: 900 },
  })

  const adminCtx = await browser.createBrowserContext()
  const adminPage = await adminCtx.newPage()
  await adminPage.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 20000 })
  await adminPage.locator('input[type="email"]').fill(ADMIN_EMAIL)
  await adminPage.locator('input[type="password"]').fill(ADMIN_PASS)
  await adminPage.locator('button[type="submit"]').click()
  await adminPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  adminPage.url().includes('/login') ? fail('Login admin échoué') : ok('Login admin OK')

  await adminPage.goto(`${BASE}/admin/facturation`, { waitUntil: 'networkidle0', timeout: 20000 })
  let text = await adminPage.evaluate(() => document.body.innerText)
  text.includes('TEST SARL Fictive') ? ok('Liste factures : nom entreprise affiché') : fail('Liste factures : nom entreprise absent')
  const montantTtcFr = montantTtc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
  text.includes(montantTtcFr) ? ok('Liste factures : montant TTC affiché') : fail('Liste factures : montant TTC absent')

  await adminPage.goto(`${BASE}/admin/facturation/${facture.id}`, { waitUntil: 'networkidle0', timeout: 20000 })
  text = await adminPage.evaluate(() => document.body.innerText)
  text.includes('TEST SARL Fictive') ? ok('Détail facture : nom entreprise OK') : fail('Détail facture : nom entreprise manquant')
  text.includes('Marie Collab')      ? ok('Détail facture : "Marie Collab" affiché sur la ligne course (fix confirmé)') : fail('RÉGRESSION : nom "Marie Collab" absent du détail facture')
  text.includes('Pierre Sansauth')   ? ok('Détail facture : "Pierre Sansauth" affiché (collab sans auth, fix confirmé)') : fail('RÉGRESSION : nom "Pierre Sansauth" absent du détail facture')
  text.includes(montantTtcFr) ? ok('Détail facture : total TTC correct') : fail('Détail facture : total TTC incorrect ou absent')
  !text.includes('undefined') ? ok('Détail facture : aucun "undefined"') : fail('Détail facture : "undefined" visible')

  // Régression Zanetti : dropdown collaborateur dans nouvelle course
  await adminPage.goto(`${BASE}/admin/courses/nouvelle`, { waitUntil: 'networkidle0', timeout: 20000 })
  await adminPage.select('select[name="client_id"]', entId).catch(() => null)
  await new Promise(r => setTimeout(r, 600))
  const collabOptions = await adminPage.$$eval('select[name="collaborateur_id"] option', els => els.map(e => e.textContent))
  const hasMarie  = collabOptions.some(o => o.includes('Marie'))
  const hasPierre = collabOptions.some(o => o.includes('Pierre'));
  (hasMarie && hasPierre)
    ? ok(`Dropdown "nouvelle course" : les 2 collaborateurs apparaissent (${collabOptions.filter(o=>o&&!o.includes('—')).join(' | ')})`)
    : fail(`RÉGRESSION Zanetti : dropdown collaborateur incomplet — options: ${JSON.stringify(collabOptions)}`)

  await adminPage.close()
  await adminCtx.close()

  // ════════════════════════════════════════════════════════
  section('BROWSER — client entreprise')
  // ════════════════════════════════════════════════════════

  const entCtx = await browser.createBrowserContext()
  const entPage = await entCtx.newPage()
  await entPage.goto(`${BASE}/client-login`, { waitUntil: 'networkidle0', timeout: 20000 })
  await entPage.locator('input[type="email"]').fill(entrepriseEmail)
  await entPage.locator('input[type="password"]').fill(TEST_PASSWORD)
  await entPage.locator('button[type="submit"]').click()
  await entPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  entPage.url().includes('/espace-client') ? ok('Login entreprise OK → /espace-client') : fail(`Login entreprise échoué — url=${entPage.url()}`)

  text = await entPage.evaluate(() => document.body.innerText)
  text.includes('Marie') && text.includes('Sansauth') ? ok('Espace-client entreprise : "Mon équipe" liste les 2 collaborateurs') : fail('Espace-client entreprise : collaborateurs manquants dans "Mon équipe"')
  text.includes(numero) ? ok(`Espace-client entreprise : facture ${numero} visible dans "Mes factures"`) : fail('Espace-client entreprise : facture absente de "Mes factures"')
  text.includes('Test Départ') ? ok('Espace-client entreprise : voit ses courses (directe + collaborateurs)') : fail('Espace-client entreprise : courses absentes')
  !text.includes('undefined') ? ok('Espace-client entreprise : aucun "undefined"') : fail('Espace-client entreprise : "undefined" visible')

  await entPage.close()
  await entCtx.close()

  // ════════════════════════════════════════════════════════
  section('BROWSER — collaborateur (avec accès)')
  // ════════════════════════════════════════════════════════

  const collabCtx = await browser.createBrowserContext()
  const collabPage = await collabCtx.newPage()
  await collabPage.goto(`${BASE}/client-login`, { waitUntil: 'networkidle0', timeout: 20000 })
  await collabPage.locator('input[type="email"]').fill(collabEmail)
  await collabPage.locator('input[type="password"]').fill(TEST_PASSWORD)
  await collabPage.locator('button[type="submit"]').click()
  await collabPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  collabPage.url().includes('/espace-client') ? ok('Login collaborateur OK → /espace-client') : fail(`Login collaborateur échoué — url=${collabPage.url()}`)

  text = await collabPage.evaluate(() => document.body.innerText)
  text.includes('Test Départ') ? ok('Espace-client collaborateur : voit sa propre course') : fail('Espace-client collaborateur : course absente')
  !text.includes('Mes factures') ? ok('Espace-client collaborateur : pas de section "Mes factures" (attendu)') : fail('FUITE : collaborateur voit "Mes factures" — ne devrait pas')
  !text.includes('Mon équipe') ? ok('Espace-client collaborateur : pas de section "Mon équipe" (attendu)') : fail('FUITE : collaborateur voit "Mon équipe" — ne devrait pas')
  !text.includes(numero) ? ok('Espace-client collaborateur : ne voit pas le numéro de facture entreprise (attendu)') : fail('FUITE : collaborateur voit le numéro de facture entreprise')

  await collabPage.close()
  await collabCtx.close()

  // ════════════════════════════════════════════════════════
  section('BROWSER — particulier')
  // ════════════════════════════════════════════════════════

  const partCtx = await browser.createBrowserContext()
  const partPage = await partCtx.newPage()
  await partPage.goto(`${BASE}/client-login`, { waitUntil: 'networkidle0', timeout: 20000 })
  await partPage.locator('input[type="email"]').fill(particulierEmail)
  await partPage.locator('input[type="password"]').fill(TEST_PASSWORD)
  await partPage.locator('button[type="submit"]').click()
  await partPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  partPage.url().includes('/espace-client') ? ok('Login particulier OK → /espace-client') : fail(`Login particulier échoué — url=${partPage.url()}`)

  text = await partPage.evaluate(() => document.body.innerText)
  text.includes('Test Départ') ? ok('Espace-client particulier : voit sa propre course') : fail('Espace-client particulier : course absente')
  !text.includes('Mes factures') ? ok('Espace-client particulier : pas de section "Mes factures" (attendu)') : fail('FUITE : particulier voit "Mes factures"')
  !text.includes('Mon équipe') ? ok('Espace-client particulier : pas de section "Mon équipe" (attendu)') : fail('FUITE : particulier voit "Mon équipe"')
  !text.includes('TEST SARL Fictive') ? ok('Espace-client particulier : ne voit pas les données entreprise (attendu)') : fail('FUITE : particulier voit des données entreprise')

  await partPage.close()
  await partCtx.close()
  await browser.close()

} catch (e) {
  fail(`ERREUR FATALE : ${e.message}`)
  console.error(e)
} finally {
  if (KEEP) {
    writeFileSync(new URL('./test-facturation-state.json', import.meta.url), JSON.stringify(created, null, 2))
    section('DONNÉES CONSERVÉES (--keep) — à vérifier dans l\'admin et l\'espace-client')
    console.log(`  Admin facturation     : https://owise.fr/admin/facturation/${info.factureId ?? ''}`)
    console.log(`  Numéro facture        : ${info.numero ?? '?'}`)
    console.log(`  Login client-login    : https://owise.fr/client-login`)
    console.log(`  Entreprise            : ${info.entrepriseEmail ?? '?'}  /  ${TEST_PASSWORD}`)
    console.log(`  Collaborateur (auth)  : ${info.collabEmail ?? '?'}  /  ${TEST_PASSWORD}`)
    console.log(`  Particulier           : ${info.particulierEmail ?? '?'}  /  ${TEST_PASSWORD}`)
    console.log('  État sauvegardé dans test-facturation-state.json')
    console.log('  Pour nettoyer plus tard : node test-facturation-complet.mjs --cleanup-only')
  } else {
    await cleanup(created)
  }
}

console.log('\n' + '='.repeat(62))
console.log(`\x1b[1mRÉSULTAT FINAL :  ${passed} \x1b[32m✓\x1b[0m\x1b[1m passe  |  ${failed} \x1b[31m✗\x1b[0m\x1b[1m échecs\x1b[0m`)
if (issues.length > 0) {
  console.log('\n\x1b[31mProblèmes détectés :\x1b[0m')
  issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`))
}
console.log('='.repeat(62) + '\n')
process.exit(failed > 0 ? 1 : 0)
