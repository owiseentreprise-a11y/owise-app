/**
 * simulation-courses-passees.mts — ÉTAPE 1 DU PROJET « TARIFICATION V2 ».
 *
 * Que vous auraient coûté vos courses passées avec la nouvelle règle ?
 * LECTURE SEULE : la base est lue, Google est interrogé, RIEN n'est écrit
 * (ni en base, ni dans le code). Voir c:\websitebuilding\TARIFICATION-V2.md.
 *
 * La règle (journal des décisions, 2026-11-18) :
 *   · aller-retour depuis le point de départ du client (étapes comprises à l'aller,
 *     retour direct), durée NORMALE de Google, aucune majoration ;
 *   · 0,40 €/km et 25 €/h ; AUCUNE commission ;
 *   · approche incluse : Roissy-CDG 35 km / 35 min, Paris Châtelet 30 km / 30 min ;
 *     au-delà, l'éloignement s'ajoute ; on retient la base la moins chère ;
 *   · minimum 59 € en berline ; Premium ×1,3, Van ×1,5, Grand van ×1,8.
 *
 *   npx tsx scripts/tarification-v2/simulation-courses-passees.mts <sortie.json>
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'

export const REGLE = {
  coutKm: 0.40, coutHeure: 25, minimumBerline: 59,
  ratio: { berline: 1, berline_premium: 1.3, van: 1.5, van_7: 1.5, grand_van: 1.8, grand_van_8: 1.8 } as Record<string, number>,
  bases: [
    { nom: 'Roissy-CDG', adresse: 'Aéroport Paris-Charles de Gaulle, France', km: 35, min: 35 },
    { nom: 'Paris Châtelet', adresse: 'Châtelet, 75001 Paris, France', km: 30, min: 30 },
  ],
}

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/* Google, durée normale (sans `departure_time`) ; mémorisé par paire. */
const memo = new Map<string, { km: number; min: number } | null>()
async function trajet(a: string, b: string) {
  const k = a + '→' + b
  if (memo.has(k)) return memo.get(k)!
  const u = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
  u.searchParams.set('origins', a); u.searchParams.set('destinations', b)
  u.searchParams.set('mode', 'driving'); u.searchParams.set('language', 'fr'); u.searchParams.set('key', env.GOOGLE_MAPS_KEY)
  const e = (await (await fetch(u)).json()).rows?.[0]?.elements?.[0]
  const r = e?.status === 'OK' ? { km: e.distance.value / 1000, min: e.duration.value / 60 } : null
  memo.set(k, r); return r
}

const { data: courses, error } = await sb.from('courses')
  .select('id, date_prevue, adresse_depart, adresse_arrivee, etapes, type_vehicule, prix_final, prix_estime, statut')
  .eq('statut', 'terminee').order('date_prevue')
if (error) throw new Error(error.message)

const lignes: any[] = []
for (const c of courses ?? []) {
  const etapes: string[] = Array.isArray(c.etapes) ? c.etapes : []
  const points = [c.adresse_depart, ...etapes, c.adresse_arrivee]
  let km = 0, min = 0, manque = false
  for (let i = 0; i < points.length - 1; i++) { const t = await trajet(points[i], points[i + 1]); if (!t) { manque = true; break } km += t.km; min += t.min }
  const retour = manque ? null : await trajet(c.adresse_arrivee, c.adresse_depart)
  const encaisse = Number(c.prix_final ?? c.prix_estime ?? 0)
  if (manque || !retour) { lignes.push({ id: c.id, date: c.date_prevue, depart: c.adresse_depart, arrivee: c.adresse_arrivee, vehicule: c.type_vehicule, encaisse, erreur: 'distance introuvable' }); continue }

  const coutAR = (km + retour.km) * REGLE.coutKm + ((min + retour.min) / 60) * REGLE.coutHeure
  const parBase = []
  for (const b of REGLE.bases) {
    const ap = await trajet(b.adresse, c.adresse_depart)
    if (!ap) continue
    const eloignement = Math.max(0, ap.km - b.km) * REGLE.coutKm + (Math.max(0, ap.min - b.min) / 60) * REGLE.coutHeure
    parBase.push({ base: b.nom, approcheKm: ap.km, approcheMin: ap.min, eloignement })
  }
  const meilleure = parBase.sort((a, b) => a.eloignement - b.eloignement)[0]
  const ratio = REGLE.ratio[c.type_vehicule] ?? 1
  const berline = Math.max(REGLE.minimumBerline, Math.ceil(coutAR + (meilleure?.eloignement ?? 0)))
  const nouveau = Math.ceil(berline * ratio)
  lignes.push({
    id: c.id, date: c.date_prevue, depart: c.adresse_depart, arrivee: c.adresse_arrivee, etapes: etapes.length,
    vehicule: c.type_vehicule, encaisse,
    km: +km.toFixed(1), min: Math.round(min), retourKm: +retour.km.toFixed(1), retourMin: Math.round(retour.min),
    coutAR: +coutAR.toFixed(2), base: meilleure?.base, approcheKm: +(meilleure?.approcheKm ?? 0).toFixed(1),
    eloignement: +(meilleure?.eloignement ?? 0).toFixed(2), berline, nouveau, ecart: +(nouveau - encaisse).toFixed(2),
  })
}

const ok = lignes.filter(l => !l.erreur)
const total = (k: string) => ok.reduce((s, l) => s + l[k], 0)
const resume = {
  regle: REGLE, nbCourses: lignes.length, nbCalculees: ok.length, erreurs: lignes.filter(l => l.erreur).length,
  totalEncaisse: total('encaisse'), totalNouveau: total('nouveau'),
  sousLeCout: ok.filter(l => l.encaisse < l.nouveau).length,
  appelsGoogle: memo.size,
}
writeFileSync(process.argv[2] ?? 'simulation.json', JSON.stringify({ resume, lignes }, null, 1))
console.log(JSON.stringify(resume, null, 1))
