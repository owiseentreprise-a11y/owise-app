/**
 * mesurer-courses-passees.mts — REMPLIT v2_mesures_courses.
 *
 * Projet « Tarification v2 » (c:\websitebuilding\TARIFICATION-V2.md), étape 2.
 * Mesure une fois, par Google (durée NORMALE, sans heure de départ), les
 * distances de chaque course terminée : trajet (étapes comprises), retour au
 * départ du client (information), approche depuis chaque base de v2_bases et
 * retour de l'arrivée à chaque base (règle du circuit réel, 2026-11-22). La page
 * /admin/tarification-v2 recalcule ensuite les prix à chaque réglage sans
 * rappeler Google.
 *
 * ÉCRIT UNIQUEMENT dans v2_mesures_courses (table neuve, autorisée le
 * 2026-11-21). `courses` et `v2_bases` sont LUES, jamais modifiées.
 * Une course déjà mesurée est sautée, sauf --remesurer.
 *
 *   npx tsx scripts/tarification-v2/mesurer-courses-passees.mts [--remesurer]
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const remesurer = process.argv.includes('--remesurer')

type Mesure = { km: number; min: number }
const memo = new Map<string, Mesure | null>()
async function trajet(a: string, b: string): Promise<Mesure | null> {
  const k = a + '→' + b
  if (memo.has(k)) return memo.get(k)!
  const u = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  u.searchParams.set('origins', a); u.searchParams.set('destinations', b)
  u.searchParams.set('mode', 'driving'); u.searchParams.set('language', 'fr'); u.searchParams.set('key', env.GOOGLE_MAPS_KEY)
  const e = (await (await fetch(u)).json()).rows?.[0]?.elements?.[0]
  const r = e?.status === 'OK' ? { km: e.distance.value / 1000, min: e.duration.value / 60 } : null
  memo.set(k, r); return r
}

/* Les mêmes courses mises de côté qu'à l'étape 1 (journal du 2026-11-20). */
function raisonMiseDeCote(depart: string, km: number): string | null {
  if (/Athis-Mons/i.test(depart)) return 'Prestation particulière du 6/10 (Athis-Mons, 180 à 250 €)'
  if (km === 0) return 'Trajet de 0 km (départ = arrivée)'
  return null
}

const { data: bases, error: eb } = await sb.from('v2_bases').select('nom, adresse').order('ordre')
if (eb || !bases?.length) throw new Error('v2_bases illisible : ' + (eb?.message ?? 'aucune base'))
const { data: courses, error } = await sb.from('courses')
  .select('id, adresse_depart, adresse_arrivee, etapes').eq('statut', 'terminee').order('date_prevue')
if (error) throw new Error(error.message)
const { data: deja } = await sb.from('v2_mesures_courses').select('course_id')
const dejaMesurees = new Set((deja ?? []).map(d => d.course_id))

let ecrites = 0, sautees = 0, echecs = 0
for (const c of courses ?? []) {
  if (!remesurer && dejaMesurees.has(c.id)) { sautees++; continue }
  const etapes: string[] = Array.isArray(c.etapes) ? c.etapes : []
  const points = [c.adresse_depart, ...etapes, c.adresse_arrivee]
  let km = 0, min = 0, manque = false
  for (let i = 0; i < points.length - 1; i++) { const t = await trajet(points[i], points[i + 1]); if (!t) { manque = true; break } km += t.km; min += t.min }
  const retour = manque ? null : await trajet(c.adresse_arrivee, c.adresse_depart)
  if (manque || !retour) { echecs++; console.log(`✗ ${c.id} : distance introuvable`); continue }
  const approches: Record<string, Mesure | null> = {}
  for (const b of bases) approches[b.nom] = await trajet(b.adresse, c.adresse_depart)
  const retoursBase: Record<string, Mesure | null> = {}
  for (const b of bases) retoursBase[b.nom] = await trajet(c.adresse_arrivee, b.adresse)
  const { error: ew } = await sb.from('v2_mesures_courses').upsert({
    course_id: c.id, trajet_km: km, trajet_min: min, retour_km: retour.km, retour_min: retour.min,
    approches, retours_base: retoursBase, mise_de_cote: raisonMiseDeCote(c.adresse_depart, km), mesure_le: new Date().toISOString(),
  })
  if (ew) { echecs++; console.log(`✗ ${c.id} : ${ew.message}`) } else ecrites++
}
console.log(`${ecrites} mesure(s) écrite(s), ${sautees} déjà présente(s), ${echecs} échec(s) — ${memo.size} appels Google`)
process.exit(echecs ? 1 : 0)
