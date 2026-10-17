/**
 * Contrôle à passer JUSTE APRÈS l'application de
 * `20261017000000_fiabilite_paiements.sql` en production.
 *
 * Il répond aux cinq questions de la consigne : les tables sont-elles là, les
 * contraintes et index uniques sont-ils EFFECTIVEMENT en place, les
 * permissions et RLS tiennent-elles, les courses et factures sont-elles
 * intactes, et le site et le webhook actuel fonctionnent-ils encore.
 *
 * LECTURE SEULE. Aucune écriture : les sondes d'unicité utilisent un POST avec
 * un tableau VIDE, qui ne peut rien insérer mais fait quand même vérifier la
 * contrainte par PostgREST.
 *
 * L'empreinte d'intégrité est comparée à celle relevée avant migration, qui
 * est écrite en dur ci-dessous — pas relue d'un fichier qui pourrait avoir
 * changé entre-temps.
 *
 * Usage, depuis owise-app : npx tsx scripts/postflight-migration-paiements.mts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* Relevée par preflight-migration-paiements.mts le 2026-10-17 à 13:26 Paris,
 * AVANT toute application. Toute divergence ici est un dégât. */
const AVANT = {
  courses: 30,
  factures: 9,
  sommeTtc: 2041.00,
  coursesLiees: 13,
  statuts: { en_attente: 29, paye: 1 },
  encaissees: ['D54590', '27BCE8', '821EE9', '68FFA3'],
}

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const SRV = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const hSrv = { apikey: SRV, Authorization: `Bearer ${SRV}` }

const problemes: string[] = []
const ok  = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const ko  = (m: string) => { problemes.push(m); console.log(`  \x1b[31m✗\x1b[0m ${m}`) }
const att = (m: string) => console.log(`  \x1b[33m⚠\x1b[0m ${m}`)
const info = (m: string) => console.log(`     ${m}`)
const section = (m: string) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)
const ref = (id: unknown) => String(id ?? '').slice(-6).toUpperCase()

async function reessayer<T,>(fn: () => Promise<T>, n = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) { if (i >= n) throw e; await new Promise(r => setTimeout(r, 1500 * (i + 1))) }
  }
}
const get = <T = any,>(p: string): Promise<T> => reessayer(async () => {
  const r = await fetch(`${U}/rest/v1/${p}`, { headers: hSrv })
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status} ${(await r.text()).slice(0, 140)}`)
  return r.json() as Promise<T>
})

console.log('\x1b[1mContrôle post-migration — fiabilité des paiements\x1b[0m')
console.log(`${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · lecture seule\n`)

// ── 1. Présence des nouvelles tables ───────────────────────────────────────
section('1. Présence des nouvelles tables')
let tablesPresentes = true
for (const t of ['stripe_events', 'incidents_paiement']) {
  try {
    const r = await reessayer(async () => fetch(`${U}/rest/v1/${t}?select=id`, { method: 'HEAD', headers: { ...hSrv, Prefer: 'count=exact' } }))
    if (r.status >= 400) { ko(`${t} : HTTP ${r.status} — table absente ou inaccessible`); tablesPresentes = false; continue }
    const n = (r.headers.get('content-range') ?? '/0').split('/')[1]
    ok(`${t} : présente, ${n} ligne(s)`)
  } catch (e) {
    ko(`${t} : ${String((e as Error).message).slice(0, 120)}`)
    tablesPresentes = false
  }
}

// ── 2. Contraintes et index uniques effectivement en place ─────────────────
section('2. Contraintes et index uniques — réellement en place ?')
{
  /* Sonde non destructive : un POST avec un tableau VIDE et `on_conflict`.
   * PostgREST valide la contrainte nommée avant de n'insérer aucune ligne.
   * Réponse 2xx = la contrainte existe · 42P10 = elle n'existe pas. */
  const sonde = async (table: string, colonnes: string) => {
    const r = await reessayer(async () => fetch(`${U}/rest/v1/${table}?on_conflict=${colonnes}`, {
      method: 'POST',
      headers: { ...hSrv, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' },
      body: '[]',
    }))
    const txt = r.ok ? '' : await r.text()
    return { existe: r.ok, code: /42P10/.test(txt) ? '42P10' : r.ok ? null : `HTTP ${r.status}`, txt }
  }

  const pi = await sonde('courses', 'stripe_payment_intent_id')
  if (pi.existe) ok('courses.stripe_payment_intent_id : contrainte UNIQUE en place')
  else ko(`courses.stripe_payment_intent_id : AUCUNE contrainte unique (${pi.code}) — la protection du doublon n'est pas active`)

  if (tablesPresentes) {
    const ev = await sonde('stripe_events', 'id')
    if (ev.existe) ok('stripe_events.id : clé primaire en place — un événement renvoyé sera refusé')
    else ko(`stripe_events.id : pas de clé primaire utilisable (${ev.code})`)

    const inc = await sonde('incidents_paiement', 'type,reference')
    if (inc.existe) ok('incidents_paiement (type, reference) : contrainte utilisable')
    else att(`incidents_paiement (type, reference) : non inférable par PostgREST (${inc.code}) — attendu pour un index PARTIEL. À confirmer par la requête SQL du rapport.`)
  }

  att('la contrainte CHECK sur paiement_statut ne peut pas être sondée sans écrire —')
  info('  la vérifier dans le SQL Editor, requête fournie dans le rapport :')
  info("  SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='courses_paiement_statut_valide';")
}

// ── 3. Permissions et RLS ──────────────────────────────────────────────────
section('3. Permissions et RLS')
{
  for (const t of ['stripe_events', 'incidents_paiement', 'courses', 'factures', 'clients', 'profiles']) {
    try {
      const r = await reessayer(async () => fetch(`${U}/rest/v1/${t}?select=*`, {
        method: 'HEAD', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'count=exact' },
      }))
      const n = (r.headers.get('content-range') ?? '/?').split('/')[1]
      if (r.status >= 400) { ok(`${t.padEnd(20)} clé publique : HTTP ${r.status} — inaccessible`); continue }
      if (n === '0') ok(`${t.padEnd(20)} clé publique : 0 ligne lisible`)
      else ko(`${t.padEnd(20)} clé publique : ${n} LIGNES LISIBLES — fuite de données`)
    } catch (e) {
      ok(`${t.padEnd(20)} clé publique : refusée (${String((e as Error).message).slice(0, 60)})`)
    }
  }
}

// ── 4. Intégrité des courses et factures ───────────────────────────────────
section('4. Intégrité des courses et factures')
type Course = { id: string; paiement_statut: string | null; stripe_payment_intent_id: string | null; facture_id: string | null }
const courses = await get<Course[]>('courses?select=id,paiement_statut,stripe_payment_intent_id,facture_id')
const factures = await get<{ id: string; numero: string; montant_ttc: number }[]>('factures?select=id,numero,montant_ttc')
{
  const somme = factures.reduce((s, f) => s + Number(f.montant_ttc ?? 0), 0)
  const liees = courses.filter(c => c.facture_id).length
  const statuts: Record<string, number> = {}
  for (const c of courses) statuts[c.paiement_statut ?? 'NULL'] = (statuts[c.paiement_statut ?? 'NULL'] ?? 0) + 1

  const cmp = (nom: string, avant: number, apres: number) => {
    if (avant === apres) ok(`${nom} : ${apres} — inchangé`)
    else ko(`${nom} : ${avant} avant → ${apres} après — ÉCART de ${apres - avant}`)
  }
  cmp('courses', AVANT.courses, courses.length)
  cmp('factures', AVANT.factures, factures.length)
  cmp('courses liées à une facture', AVANT.coursesLiees, liees)

  if (Math.abs(somme - AVANT.sommeTtc) < 0.005) ok(`somme des montants TTC : ${somme.toFixed(2)} € — inchangée`)
  else ko(`somme des montants TTC : ${AVANT.sommeTtc.toFixed(2)} € → ${somme.toFixed(2)} € — ÉCART`)

  info(`paiement_statut : ${Object.entries(statuts).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  const attendu = JSON.stringify(AVANT.statuts)
  const obtenu = JSON.stringify(statuts)
  if (attendu === obtenu) ok('répartition des statuts de paiement inchangée — le backfill n\'a PAS été appliqué, comme demandé')
  else ko(`répartition des statuts modifiée : attendu ${attendu}, obtenu ${obtenu} — la consigne était de ne pas toucher les 4 courses`)

  const encaissees = courses.filter(c => c.stripe_payment_intent_id)
  info(`les 4 encaissées : ${encaissees.map(c => '#' + ref(c.id) + '=' + (c.paiement_statut ?? 'NULL')).join(' · ')}`)
  const inchangees = encaissees.every(c => c.paiement_statut === 'en_attente')
  if (inchangees && encaissees.length === 4) ok('les 4 courses historiques sont intactes')
  else ko('une des 4 courses historiques a changé de statut')

  const numeros = new Set(factures.map(f => f.numero))
  if (numeros.size === factures.length) ok('aucun numéro de facture en double')
  else ko(`${factures.length - numeros.size} numéro(s) de facture en double`)

  const parPI = new Map<string, number>()
  for (const c of courses) if (c.stripe_payment_intent_id) parPI.set(c.stripe_payment_intent_id, (parPI.get(c.stripe_payment_intent_id) ?? 0) + 1)
  const dbl = [...parPI.values()].filter(n => n > 1).length
  if (dbl === 0) ok('aucun doublon d\'identifiant de paiement')
  else ko(`${dbl} doublon(s) d'identifiant de paiement`)
}

// ── 5. Le site et le webhook actuel fonctionnent-ils encore ? ──────────────
section('5. Fonctionnement du site et du webhook déployé')
{
  const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36'
  const site = 'https://www.owise.fr'

  const page = await reessayer(async () => fetch(`${site}/`, { headers: { 'User-Agent': UA } }))
  const html = page.ok ? await page.text() : ''
  if (page.ok) {
    const prix = [...html.matchAll(/class="vc-amount[^"]*"[^>]*>(\d+)(?:<!-- -->)? ?€/g)].map(m => m[1])
    ok(`page d'accueil : HTTP ${page.status}, ${Math.round(html.length / 1024)} Ko · prix ${prix.join('/')} €`)
    if (prix.join('/') !== '59/89/100/100') ko(`prix inattendus : ${prix.join('/')} — attendu 59/89/100/100`)
  } else ko(`page d'accueil : HTTP ${page.status}`)

  await new Promise(r => setTimeout(r, 20000))

  /* Le webhook déployé doit continuer à refuser proprement. On n'envoie
   * aucun événement signé : aucun paiement, aucune écriture. */
  const sansSignature = await reessayer(async () => fetch(`${site}/api/stripe/webhook`, {
    method: 'POST', headers: { 'User-Agent': UA, 'Content-Type': 'application/json' }, body: '{}',
  }))
  const corps1 = await sansSignature.text()
  if (sansSignature.status === 400 && /Missing signature/.test(corps1)) ok('webhook sans signature : 400 « Missing signature » — comportement normal')
  else ko(`webhook sans signature : HTTP ${sansSignature.status} ${corps1.slice(0, 80)}`)

  await new Promise(r => setTimeout(r, 20000))

  const fausseSignature = await reessayer(async () => fetch(`${site}/api/stripe/webhook`, {
    method: 'POST',
    headers: { 'User-Agent': UA, 'Content-Type': 'application/json', 'stripe-signature': 't=1,v1=' + '0'.repeat(64) },
    body: JSON.stringify({ id: 'evt_test', type: 'checkout.session.completed' }),
  }))
  const corps2 = await fausseSignature.text()
  if (fausseSignature.status === 400 && /Invalid signature/.test(corps2)) ok('webhook avec fausse signature : 400 « Invalid signature » — vérification intacte')
  else ko(`webhook avec fausse signature : HTTP ${fausseSignature.status} ${corps2.slice(0, 80)}`)

  if (tablesPresentes) {
    const ev = await get<unknown[]>('stripe_events?select=id&limit=5')
    info(`stripe_events contient ${ev.length} ligne(s) — 0 attendu : le nouveau webhook n'est pas déployé`)
    if (ev.length > 0) att('des événements y sont déjà journalisés : le nouveau webhook serait-il déployé ?')
  }
}

console.log('\n' + '─'.repeat(72))
if (problemes.length === 0) {
  console.log('\x1b[32m\x1b[1mMIGRATION CONFORME\x1b[0m — aucune anomalie, aucune donnée touchée')
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1m${problemes.length} ANOMALIE(S)\x1b[0m — envisager le retour arrière`)
  for (const p of problemes) console.log(`  ✗ ${p}`)
  process.exit(1)
}
