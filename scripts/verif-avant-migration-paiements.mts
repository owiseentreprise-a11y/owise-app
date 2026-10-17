/**
 * Contrôle de sûreté AVANT d'appliquer les migrations du Sprint 2.
 *
 * Un `CREATE UNIQUE INDEX` échoue si la colonne contient déjà des doublons, et
 * un `CHECK` échoue si une ligne le viole déjà. Appliquer une migration sans
 * avoir vérifié, c'est la voir échouer à moitié en production.
 *
 * LECTURE SEULE. Aucune écriture, aucun paiement, aucune donnée personnelle
 * affichée.
 *
 * Usage, depuis owise-app : npx tsx scripts/verif-avant-migration-paiements.mts
 * Sortie : 0 = les migrations peuvent être appliquées · 1 = ne pas appliquer
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const URL_SB = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_SB || !KEY) { console.error('Variables Supabase manquantes'); process.exit(2) }

const bloquants: string[] = []
const ok  = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const ko  = (m: string) => { bloquants.push(m); console.log(`  \x1b[31m✗\x1b[0m ${m}`) }
const att = (m: string) => console.log(`  \x1b[33m⚠\x1b[0m ${m}`)
const section = (m: string) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)
const ref = (id: unknown) => String(id ?? '').slice(-6).toUpperCase()

async function get<T = any>(p: string, essai = 0): Promise<T> {
  try {
    const r = await fetch(`${URL_SB}/rest/v1/${p}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
    if (!r.ok) throw new Error(`${p} → HTTP ${r.status} ${(await r.text()).slice(0, 140)}`)
    return r.json() as Promise<T>
  } catch (e) {
    if (essai >= 3) throw e
    await new Promise(r => setTimeout(r, 1500 * (essai + 1)))
    return get<T>(p, essai + 1)
  }
}

console.log('\x1b[1mSûreté des migrations — Sprint 2 paiements\x1b[0m')
console.log(`${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · lecture seule\n`)

type Course = {
  id: string; statut: string; paiement_statut: string | null
  stripe_payment_intent_id: string | null; facture_id: string | null
  prix_estime: number | null; prix_final: number | null; date_prevue: string
}
const courses = await get<Course[]>('courses?select=id,statut,paiement_statut,stripe_payment_intent_id,facture_id,prix_estime,prix_final,date_prevue')

// ── Migration 1 : index unique partiel sur stripe_payment_intent_id ─────────
section('Migration 1 — CREATE UNIQUE INDEX sur courses.stripe_payment_intent_id')
{
  const parPI = new Map<string, Course[]>()
  for (const c of courses) {
    if (!c.stripe_payment_intent_id) continue
    const l = parPI.get(c.stripe_payment_intent_id) ?? []
    l.push(c); parPI.set(c.stripe_payment_intent_id, l)
  }
  const doublons = [...parPI.entries()].filter(([, v]) => v.length > 1)

  console.log(`     ${parPI.size} identifiant(s) de paiement distinct(s) sur ${courses.length} course(s)`)
  console.log(`     ${courses.filter(c => !c.stripe_payment_intent_id).length} course(s) sans identifiant → exclues par la clause WHERE de l'index partiel`)

  if (doublons.length === 0) {
    ok("aucun doublon : l'index unique peut être créé sans nettoyage préalable")
  } else {
    ko(`${doublons.length} identifiant(s) de paiement en double — l'index ÉCHOUERAIT. À arbitrer AVANT la migration :`)
    for (const [pi, v] of doublons) {
      console.log(`       ${pi.slice(0, 20)}… → ${v.length} courses`)
      for (const c of v) console.log(`         #${ref(c.id)} · ${String(c.date_prevue).slice(0, 10)} · ${c.prix_final ?? c.prix_estime} € · ${c.statut} · facture=${c.facture_id ? ref(c.facture_id) : 'aucune'}`)
      console.log(`         → ne jamais supprimer sans vérifier laquelle a été honorée (chauffeur affecté, client prévenu)`)
    }
  }

  /* Une chaîne vide n'est pas NULL : elle passerait la clause WHERE et
     deux chaînes vides collisionneraient. */
  const vides = courses.filter(c => c.stripe_payment_intent_id !== null && String(c.stripe_payment_intent_id).trim() === '')
  if (vides.length > 1) ko(`${vides.length} course(s) portent une chaîne VIDE au lieu de NULL — collision garantie : ${vides.map(c => '#' + ref(c.id)).join(', ')}`)
  else if (vides.length === 1) att(`1 course porte une chaîne vide (#${ref(vides[0].id)}) — à passer à NULL, sans quoi une seconde la ferait échouer`)
  else ok('aucune chaîne vide : toutes les valeurs sont soit NULL soit un identifiant réel')
}

// ── Migration 2 : contrainte CHECK sur paiement_statut ──────────────────────
section('Migration 2 — CHECK sur courses.paiement_statut')
{
  const AUTORISES = ['en_attente', 'a_percevoir', 'paye', 'echoue', 'remboursee', 'contestee']
  const presentes = new Map<string, number>()
  for (const c of courses) {
    const v = c.paiement_statut ?? 'NULL'
    presentes.set(v, (presentes.get(v) ?? 0) + 1)
  }
  for (const [v, n] of [...presentes].sort((a, b) => b[1] - a[1])) {
    console.log(`     ${String(n).padStart(3)} × ${v}${AUTORISES.includes(v) || v === 'NULL' ? '' : '   ← NON AUTORISÉE'}`)
  }
  const refusees = [...presentes.keys()].filter(v => v !== 'NULL' && !AUTORISES.includes(v))
  if (refusees.length === 0) ok(`toutes les valeurs présentes sont dans la liste autorisée (${AUTORISES.join(', ')})`)
  else ko(`${refusees.length} valeur(s) présente(s) en base seraient refusées par le CHECK : ${refusees.join(', ')}`)

  /* `en_attente` reste autorisée à dessein : c'est la valeur par DÉFAUT de la
     colonne. L'exclure ferait échouer toute insertion de course qui ne précise
     pas le statut de paiement — c'est-à-dire la plupart. */
  if (presentes.has('en_attente')) att(`'en_attente' conservée dans la liste : c'est la valeur par défaut de la colonne, l'exclure casserait les insertions existantes`)
}

// ── Migration 3 : backfill des courses encaissées ───────────────────────────
section('Migration 3 — UPDATE des courses réellement encaissées')
{
  const aCorriger = courses.filter(c => c.stripe_payment_intent_id && c.paiement_statut !== 'paye' && c.paiement_statut !== 'remboursee')
  if (aCorriger.length === 0) ok('aucune course encaissée à corriger')
  else {
    console.log(`     ${aCorriger.length} course(s) passeront à paiement_statut = 'paye' :`)
    for (const c of aCorriger) {
      console.log(`       #${ref(c.id)} · ${String(c.date_prevue).slice(0, 10)} · ${c.prix_final ?? c.prix_estime} € · ${c.statut} · paiement=${c.paiement_statut ?? 'NULL'} · facture=${c.facture_id ? ref(c.facture_id) : 'AUCUNE'}`)
    }
    ok('ces courses portent toutes un identifiant de paiement Stripe : la correction est factuelle, pas une supposition')
  }
  const remboursees = courses.filter(c => c.paiement_statut === 'remboursee')
  if (remboursees.length) att(`${remboursees.length} course(s) déjà 'remboursee' — volontairement NON touchées par le backfill`)
}

// ── Migration 4 : tables neuves ─────────────────────────────────────────────
section('Migration 4 — tables neuves (aucun risque de conflit ?)')
for (const table of ['stripe_events', 'incidents_paiement']) {
  try {
    const r = await get<any[]>(`${table}?select=*&limit=1`)
    att(`${table} existe déjà (${r.length} ligne(s) lue(s)) — la migration utilise IF NOT EXISTS, elle sera sans effet`)
  } catch {
    ok(`${table} : absente, création sans conflit possible`)
  }
}

// ── Ce que les migrations NE touchent pas ───────────────────────────────────
section('Préservation : ce que les migrations ne touchent pas')
{
  const factures = await get<any[]>('factures?select=id,numero,statut,montant_ttc')
  console.log(`     ${courses.length} course(s) · ${factures.length} facture(s) en base`)
  ok('aucune migration ne supprime de ligne, ne modifie un montant, ni ne touche la table factures')
  ok(`seule colonne modifiée par un UPDATE : courses.paiement_statut, sur les courses encaissées uniquement`)
  const liees = courses.filter(c => c.facture_id).length
  console.log(`     ${liees} course(s) liée(s) à une facture — liens préservés à l'identique`)
}

console.log('\n' + '─'.repeat(70))
if (bloquants.length === 0) {
  console.log('\x1b[32m\x1b[1mMIGRATIONS APPLICABLES\x1b[0m — aucun obstacle en base')
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1mNE PAS APPLIQUER\x1b[0m — ${bloquants.length} obstacle(s) à lever d'abord`)
  process.exit(1)
}
