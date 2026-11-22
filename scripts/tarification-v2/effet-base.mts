/**
 * effet-base.mts — que change une base, et sa zone d'action ? (lecture seule,
 * aucun appel Google)
 *
 * Trois situations, avec la grille enregistrée (berline sur le banc, véhicule
 * réel sur les courses passées) :
 *   SANS   la base retirée
 *   LIBRE  la base sans zone d'action
 *   ZONE   la base telle qu'enregistrée (avec sa zone d'action)
 *   npx tsx scripts/tarification-v2/effet-base.mts <nom de la base>
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { lireGrilleV2, mesuresDepuisLigne } from '../../src/lib/tarification-v2/grille-db'
import { prixV2, cleVehiculeV2 } from '../../src/lib/tarification-v2/grille'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const NOM = process.argv[2]
const ZONE = await lireGrilleV2(sb)
const base = ZONE.bases.find(b => b.nom === NOM)
if (!base) throw new Error(`base « ${NOM} » introuvable`)
const SANS = { ...ZONE, bases: ZONE.bases.filter(b => b.nom !== NOM) }
const LIBRE = { ...ZONE, bases: ZONE.bases.map(b => (b.nom === NOM ? { ...b, zoneKm: null } : b)) }
const court = (s: string) => s.replace(/,? ?\d{5}.*$/, '').replace(/^Aéroport (de )?(Paris-)?/, '').replace(/ \(.*\)$/, '')
console.log(`Base « ${NOM} », zone d'action enregistrée : ${base.zoneKm == null ? 'aucune' : base.zoneKm + ' km'}\n`)

const { data: tt } = await sb.from('v2_trajets_types').select('*').order('ordre')
const tot = { s: 0, l: 0, z: 0 }; let nz = 0
const lignes: string[] = []
for (const t of tt ?? []) {
  const m = mesuresDepuisLigne({ ...t, course_id: t.id, mise_de_cote: null })
  const s = prixV2('berline', m, SANS), l = prixV2('berline', m, LIBRE), z = prixV2('berline', m, ZONE)
  tot.s += s.prix; tot.l += l.prix; tot.z += z.prix
  if (z.base === NOM) nz++
  if (s.prix !== l.prix || l.prix !== z.prix) lignes.push(`${court(t.depart).padEnd(22)} → ${court(t.arrivee).padEnd(16)} ${String(s.prix).padStart(4)} € ${String(l.prix).padStart(6)} € ${String(z.prix).padStart(6)} €${l.prix !== z.prix ? '   ← le rayon l’écarte' : ''}`)
}
console.log(`${'TRAJET'.padEnd(43)}  SANS  LIBRE   ZONE`)
for (const x of lignes) console.log(x)
console.log(`\nBANC (${tt?.length} trajets, berline) : SANS ${tot.s} € · LIBRE ${tot.l} € · ZONE ${tot.z} € — « ${NOM} » retenue sur ${nz} trajets avec la zone`)

const { data: mc } = await sb.from('v2_mesures_courses').select('*, courses(type_vehicule, prix_final, prix_estime)').is('mise_de_cote', null)
const c3 = { s: 0, l: 0, z: 0 }; let enc = 0
for (const x of mc ?? []) {
  const c = Array.isArray(x.courses) ? x.courses[0] : x.courses
  const v = cleVehiculeV2(c.type_vehicule) ?? 'berline', m = mesuresDepuisLigne(x)
  c3.s += prixV2(v, m, SANS).prix; c3.l += prixV2(v, m, LIBRE).prix; c3.z += prixV2(v, m, ZONE).prix
  enc += Number(c.prix_final ?? c.prix_estime ?? 0)
}
console.log(`COURSES PASSÉES (${mc?.length}) : encaissé ${enc} € · SANS ${c3.s} € · LIBRE ${c3.l} € · ZONE ${c3.z} €`)
