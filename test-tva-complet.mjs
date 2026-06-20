/**
 * TEST COMPLET TVA — valide les 4 chemins de création de facture (manuelle,
 * webhook Stripe, cron mensuel, devis->facture) aux 3 taux possibles (0/10/20%).
 * Utilise les vrais endpoints de production avec des données factices, nettoyées
 * après chaque test. Restaure le taux réel (0%) à la fin, même en cas d'erreur.
 */
import puppeteer from 'puppeteer-core'
import { readFileSync } from 'fs'

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
function near(a, b, eps = 0.02) { return Math.abs(a - b) < eps }

async function cleanupClient(clientId) {
  await sb.from('factures').delete().eq('client_id', clientId)
  await sb.from('courses').delete().eq('client_id', clientId)
  await sb.from('clients').delete().eq('id', clientId)
  await sb.from('profiles').delete().eq('id', clientId)
  await sb.auth.admin.deleteUser(clientId).catch(() => {})
}

// ── Sauvegarde du taux réel pour restauration finale ────────────────────────
const { data: paramOrig } = await sb.from('parametres').select('facture_taux_tva').eq('id', true).single()
const tauxOriginal = paramOrig?.facture_taux_tva ?? 0
console.log(`Taux TVA original en DB : ${tauxOriginal}% (sera restauré à la fin)`)

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--window-size=1440,900'],
  defaultViewport: { width: 1440, height: 900 },
})
const adminCtx = await browser.createBrowserContext()
const adminPage = await adminCtx.newPage()

try {
  section('LOGIN ADMIN')
  await adminPage.goto(`${BASE}/login`, { waitUntil: 'networkidle0', timeout: 20000 })
  await adminPage.locator('input[type="email"]').fill(ADMIN_EMAIL)
  await adminPage.locator('input[type="password"]').fill(ADMIN_PASS)
  await adminPage.locator('button[type="submit"]').click()
  await adminPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})
  adminPage.url().includes('/login') ? fail('Login admin échoué') : ok('Login admin OK')

  for (const taux of [0, 10, 20]) {
    section(`TAUX TVA = ${taux}%`)

    await sb.from('parametres').update({ facture_taux_tva: taux }).eq('id', true)
    ok(`parametres.facture_taux_tva mis à ${taux}%`)

    // ════════════════════════════════════════════════════════
    // TEST 1 — Facture manuelle via /admin/facturation/nouvelle
    // ════════════════════════════════════════════════════════
    {
      const email = `test-tva-manuel-${taux}-${rand}@owise-test.local`
      const { data: auth } = await sb.auth.admin.createUser({
        email, password: TEST_PASSWORD, email_confirm: true,
        app_metadata: { role: 'client' }, user_metadata: { prenom: 'TVA', nom: `Manuel${taux}` },
      })
      const clientId = auth.user.id
      await sb.from('profiles').insert({ id: clientId, role: 'client', nom: `Manuel${taux}`, prenom: 'TVA' })
      await sb.from('clients').insert({ id: clientId, type_compte: 'entreprise', entreprise_nom: `TVA Manuel ${taux}% SARL` })
      await sb.from('courses').insert({
        client_id: clientId, statut: 'terminee',
        adresse_depart: `Test TVA Manuel ${taux} Départ`, adresse_arrivee: `Test TVA Manuel ${taux} Arrivée`,
        date_prevue: new Date().toISOString(), type_vehicule: 'berline', nb_passagers: 1,
        prix_estime: 100, prix_final: 100,
      })

      await adminPage.goto(`${BASE}/admin/facturation/nouvelle`, { waitUntil: 'networkidle0', timeout: 20000 })
      await adminPage.select('select[name="client_id"]', clientId).catch(e => fail(`Sélection client manuel: ${e.message}`))
      await new Promise(r => setTimeout(r, 500))
      await adminPage.locator('input[type="checkbox"]').click().catch(e => fail(`Clic checkbox course: ${e.message}`))
      await new Promise(r => setTimeout(r, 300))

      const preview = await adminPage.evaluate(() => document.body.innerText)
      const expectedHt = 100 / (1 + taux / 100)
      const expectedTva = 100 - expectedHt
      const fmt = n => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      preview.includes(fmt(expectedHt)) ? ok(`Manuel ${taux}% — aperçu Total HT correct (${fmt(expectedHt)} €)`) : fail(`Manuel ${taux}% — aperçu Total HT incorrect, attendu ${fmt(expectedHt)} €`)
      preview.includes(fmt(100)) ? ok(`Manuel ${taux}% — aperçu Total TTC = prix course (100,00 €)`) : fail(`Manuel ${taux}% — aperçu Total TTC incorrect`)

      await adminPage.locator('button[type="submit"]').click()
      await adminPage.waitForNavigation({ waitUntil: 'networkidle0', timeout: 20000 }).catch(() => {})

      const { data: facture } = await sb.from('factures').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).single()
      if (facture) {
        near(facture.montant_ttc, 100) ? ok(`Manuel ${taux}% — montant_ttc en DB = 100€`) : fail(`Manuel ${taux}% — montant_ttc en DB = ${facture.montant_ttc} (attendu 100)`)
        near(facture.montant_ht, expectedHt) ? ok(`Manuel ${taux}% — montant_ht en DB = ${fmt(expectedHt)}€`) : fail(`Manuel ${taux}% — montant_ht en DB = ${facture.montant_ht} (attendu ${fmt(expectedHt)})`)
        near(facture.tva, expectedTva) ? ok(`Manuel ${taux}% — tva en DB = ${fmt(expectedTva)}€`) : fail(`Manuel ${taux}% — tva en DB = ${facture.tva} (attendu ${fmt(expectedTva)})`)
      } else {
        fail(`Manuel ${taux}% — aucune facture trouvée en DB`)
      }

      await cleanupClient(clientId)
    }

    // ════════════════════════════════════════════════════════
    // TEST 2 — Webhook Stripe (événement signé réel)
    // ════════════════════════════════════════════════════════
    {
      const marker = `Test TVA Webhook ${taux} ${rand}`
      const email = `test-tva-webhook-${taux}-${rand}@owise-test.local`
      const payload = JSON.stringify({
        id: `evt_test_${Date.now()}`, object: 'event', type: 'checkout.session.completed',
        data: { object: {
          id: `cs_test_${Date.now()}`, object: 'checkout.session', payment_status: 'paid',
          metadata: {
            type: 'reservation',
            adresse_depart: `${marker} Départ`, adresse_arrivee: `${marker} Arrivée`,
            date_prevue: new Date(Date.now() + 86400000).toISOString(),
            type_vehicule: 'berline', nb_passagers: '1', prix: '120',
            nom: `Webhook${taux}`, prenom: 'TVA', email, telephone: '',
            zone_depart_id: '', zone_arrivee_id: '',
          },
        } },
      })
      const sig = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET })
      const res = await fetch(`${BASE}/api/stripe/webhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'stripe-signature': sig },
        body: payload,
      })
      res.ok ? ok(`Webhook ${taux}% — réponse HTTP ${res.status}`) : fail(`Webhook ${taux}% — réponse HTTP ${res.status}`)

      await new Promise(r => setTimeout(r, 1500))
      const { data: course } = await sb.from('courses').select('id, client_id').eq('adresse_depart', `${marker} Départ`).single()
      if (course?.client_id) {
        const expectedHt = 120 / (1 + taux / 100)
        const expectedTva = 120 - expectedHt
        const { data: facture } = await sb.from('factures').select('*').eq('client_id', course.client_id).order('created_at', { ascending: false }).limit(1).single()
        if (facture) {
          near(facture.montant_ttc, 120) ? ok(`Webhook ${taux}% — montant_ttc en DB = 120€`) : fail(`Webhook ${taux}% — montant_ttc en DB = ${facture.montant_ttc} (attendu 120)`)
          near(facture.montant_ht, expectedHt) ? ok(`Webhook ${taux}% — montant_ht en DB = ${expectedHt.toFixed(2)}€`) : fail(`Webhook ${taux}% — montant_ht en DB = ${facture.montant_ht} (attendu ${expectedHt.toFixed(2)})`)
          near(facture.tva, expectedTva) ? ok(`Webhook ${taux}% — tva en DB = ${expectedTva.toFixed(2)}€`) : fail(`Webhook ${taux}% — tva en DB = ${facture.tva} (attendu ${expectedTva.toFixed(2)})`)
        } else {
          fail(`Webhook ${taux}% — aucune facture trouvée pour le client créé`)
        }
        await cleanupClient(course.client_id)
      } else {
        fail(`Webhook ${taux}% — aucune course créée par le webhook (marker introuvable)`)
      }
    }

    // ════════════════════════════════════════════════════════
    // TEST 3 — Cron facturation mensuelle
    // ════════════════════════════════════════════════════════
    {
      const email = `test-tva-cron-${taux}-${rand}@owise-test.local`
      const { data: auth } = await sb.auth.admin.createUser({
        email, password: TEST_PASSWORD, email_confirm: true,
        app_metadata: { role: 'client' }, user_metadata: { prenom: 'TVA', nom: `Cron${taux}` },
      })
      const clientId = auth.user.id
      await sb.from('profiles').insert({ id: clientId, role: 'client', nom: `Cron${taux}`, prenom: 'TVA' })
      await sb.from('clients').insert({ id: clientId, type_compte: 'entreprise', entreprise_nom: `TVA Cron ${taux}% SARL`, facturation_mode: 'mensuelle' })

      const now = new Date()
      const dateFin = new Date(now.getFullYear(), now.getMonth() - 1, 15)
      await sb.from('courses').insert({
        client_id: clientId, statut: 'terminee',
        adresse_depart: `Test TVA Cron ${taux} Départ`, adresse_arrivee: `Test TVA Cron ${taux} Arrivée`,
        date_prevue: dateFin.toISOString(), date_fin: dateFin.toISOString(),
        type_vehicule: 'berline', nb_passagers: 1, prix_estime: 150, prix_final: 150,
      })

      const res = await fetch(`${BASE}/api/cron/facturation-mensuelle`, {
        headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
      })
      const body = await res.json().catch(() => ({}))
      res.ok ? ok(`Cron ${taux}% — réponse HTTP ${res.status} (${JSON.stringify(body)})`) : fail(`Cron ${taux}% — réponse HTTP ${res.status}`)

      const expectedHt = 150 / (1 + taux / 100)
      const expectedTva = 150 - expectedHt
      const { data: facture } = await sb.from('factures').select('*').eq('client_id', clientId).order('created_at', { ascending: false }).limit(1).single()
      if (facture) {
        near(facture.montant_ttc, 150) ? ok(`Cron ${taux}% — montant_ttc en DB = 150€`) : fail(`Cron ${taux}% — montant_ttc en DB = ${facture.montant_ttc} (attendu 150)`)
        near(facture.montant_ht, expectedHt) ? ok(`Cron ${taux}% — montant_ht en DB = ${expectedHt.toFixed(2)}€`) : fail(`Cron ${taux}% — montant_ht en DB = ${facture.montant_ht} (attendu ${expectedHt.toFixed(2)})`)
        near(facture.tva, expectedTva) ? ok(`Cron ${taux}% — tva en DB = ${expectedTva.toFixed(2)}€`) : fail(`Cron ${taux}% — tva en DB = ${facture.tva} (attendu ${expectedTva.toFixed(2)})`)
      } else {
        fail(`Cron ${taux}% — aucune facture créée pour le client entreprise mensuel`)
      }

      await cleanupClient(clientId)
    }

    // ════════════════════════════════════════════════════════
    // TEST 4 — Devis → Facture via /admin/devis (UI réelle)
    // ════════════════════════════════════════════════════════
    {
      const tel = `06${String(taux).padStart(2, '0')}${rand.slice(0, 6)}`.slice(0, 10)
      const { data: devis } = await sb.from('devis').insert({
        nom: `TestDevis${taux}`, tel, email: `test-tva-devis-${taux}-${rand}@owise-test.local`,
        origin: `Test TVA Devis ${taux} Départ`, destination: `Test TVA Devis ${taux} Arrivée`,
        pax: 1, vehicle: 'Berline', price: 200,
      }).select('id').single()

      await adminPage.goto(`${BASE}/admin/devis`, { waitUntil: 'networkidle0', timeout: 20000 })
      const rowHandle = await adminPage.evaluateHandle((telMarker) => {
        const rows = Array.from(document.querySelectorAll('tr'))
        return rows.find(r => r.textContent?.includes(telMarker)) ?? null
      }, tel)
      const rowExists = await rowHandle.evaluate(el => !!el)
      if (!rowExists) {
        fail(`Devis ${taux}% — ligne introuvable dans /admin/devis (tel=${tel})`)
      } else {
        const factureBtn = await rowHandle.evaluateHandle(row => Array.from(row.querySelectorAll('button')).find(b => b.textContent?.includes('Facture')))
        await factureBtn.asElement()?.click()
        await new Promise(r => setTimeout(r, 300))
        const ouiBtn = await rowHandle.evaluateHandle(row => Array.from(row.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Oui'))
        await ouiBtn.asElement()?.click()
        await new Promise(r => setTimeout(r, 1200))

        const successText = await rowHandle.evaluate(row => row.textContent ?? '')
        const numeroMatch = successText.match(/F-\d{4}-[A-Z0-9]+/)
        if (numeroMatch) {
          ok(`Devis ${taux}% — facture créée via UI : ${numeroMatch[0]}`)
          const { data: facture } = await sb.from('factures').select('*').eq('numero', numeroMatch[0]).single()
          const expectedHt = 200 / (1 + taux / 100)
          const expectedTva = 200 - expectedHt
          if (facture) {
            near(facture.montant_ttc, 200) ? ok(`Devis ${taux}% — montant_ttc en DB = 200€`) : fail(`Devis ${taux}% — montant_ttc en DB = ${facture.montant_ttc} (attendu 200)`)
            near(facture.montant_ht, expectedHt) ? ok(`Devis ${taux}% — montant_ht en DB = ${expectedHt.toFixed(2)}€`) : fail(`Devis ${taux}% — montant_ht en DB = ${facture.montant_ht} (attendu ${expectedHt.toFixed(2)})`)
            near(facture.tva, expectedTva) ? ok(`Devis ${taux}% — tva en DB = ${expectedTva.toFixed(2)}€`) : fail(`Devis ${taux}% — tva en DB = ${facture.tva} (attendu ${expectedTva.toFixed(2)})`)
            await sb.from('factures').delete().eq('id', facture.id)
          } else {
            fail(`Devis ${taux}% — facture ${numeroMatch[0]} introuvable en DB`)
          }
        } else {
          fail(`Devis ${taux}% — pas de confirmation de création visible (texte: "${successText.slice(0, 120)}")`)
        }
      }
      await sb.from('devis').delete().eq('id', devis.id)
    }
  }

} catch (e) {
  fail(`ERREUR FATALE : ${e.message}`)
  console.error(e)
} finally {
  await adminPage.close()
  await adminCtx.close()
  await browser.close()

  section('RESTAURATION du taux TVA original')
  await sb.from('parametres').update({ facture_taux_tva: tauxOriginal }).eq('id', true)
  ok(`facture_taux_tva restauré à ${tauxOriginal}%`)
}

console.log('\n' + '='.repeat(62))
console.log(`\x1b[1mRÉSULTAT FINAL :  ${passed} \x1b[32m✓\x1b[0m\x1b[1m passe  |  ${failed} \x1b[31m✗\x1b[0m\x1b[1m échecs\x1b[0m`)
if (issues.length > 0) {
  console.log('\n\x1b[31mProblèmes détectés :\x1b[0m')
  issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`))
}
console.log('='.repeat(62) + '\n')
process.exit(failed > 0 ? 1 : 0)
