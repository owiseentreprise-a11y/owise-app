/**
 * test-lieu-court.mts — CHAQUE ADRESSE DIT-ELLE OÙ C'EST ?
 *
 * Contrôle de src/lib/tarification-v2/lieu-court.ts.
 *  1. Des cas écrits à la main, pris dans les adresses RÉELLES des courses
 *     (relevées en base le 2026-11-21), avec la ville attendue.
 *  2. Toutes les adresses des courses mesurées (v2_mesures_courses), lues en
 *     base : aucune ne doit finir sans ville ni lieu reconnaissable.
 *
 *   npx tsx scripts/tarification-v2/test-lieu-court.mts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { lieuCourt } from '../../src/lib/tarification-v2/lieu-court'

let ok = 0, ko = 0
const V = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', Z = '\x1b[0m'
const verifier = (c: boolean, m: string) => { if (c) { ok++; console.log(`${V}✓${Z} ${m}`) } else { ko++; console.log(`${R}✗ ${m}${Z}`) } }

const CAS: [string, string, string | null][] = [
  ['14 Rue des Coteaux, 60870 Villers-Saint-Paul, France', 'Villers-Saint-Paul', '14 Rue des Coteaux'],
  ['13 Rue Sainte-Anastase, 75003 Paris, France', 'Paris 3e', '13 Rue Sainte-Anastase'],
  ['Nation, 75012 Paris, France', 'Paris 12e', 'Nation'],
  ['Paris 11e, 75011 Paris, France', 'Paris 11e', null],
  ['77990 Le Mesnil-Amelot, France', 'Le Mesnil-Amelot', null],
  ['1 rue du jeu de paume 60200 Compiegne.', 'Compiegne', '1 rue du jeu de paume'],
  ['Athis-Mons, 91200, France', 'Athis-Mons', null],
  ['Gare de Lyon', 'Gare de Lyon', 'Paris 12e'],
  ['Aéroport de Paris-Orly (ORY)', 'Aéroport de Paris-Orly (ORY)', null],
  ['Aéroport Paris-Charles de Gaulle (CDG)', 'Aéroport Paris-Charles de Gaulle (CDG)', 'Roissy-en-France'],
  ['Aéroport CDG - Terminal 2A, 93290 Tremblay-en-France, France', 'Aéroport CDG - Terminal 2A', 'Tremblay-en-France'],
  ['Le Château, All. des Marronniers, 60520 La Chapelle-en-Serval, France', 'La Chapelle-en-Serval', 'Le Château'],
  ['4 Rue du Connétable, 60500 Chantilly, France', 'Chantilly', '4 Rue du Connétable'],
]
console.log(`${B}Adresses réelles, ville attendue${Z}`)
for (const [a, p, d] of CAS) {
  const r = lieuCourt(a)
  verifier(r.principal === p && r.detail === d, `${a} → « ${r.principal} »${r.detail ? ' / ' + r.detail : ''}`)
}

console.log(`\n${B}Toutes les adresses des courses mesurées${Z}`)
const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const { data, error } = await sb.from('v2_mesures_courses').select('courses(adresse_depart, adresse_arrivee)')
if (error) throw new Error(error.message)
const adresses = [...new Set((data ?? []).flatMap((l: any) => { const c = Array.isArray(l.courses) ? l.courses[0] : l.courses; return [c.adresse_depart, c.adresse_arrivee] }))]
/* « Où c'est » : soit une ville sortie d'un code postal ou d'un lieu connu, soit un lieu nommé (aéroport, gare). */
const sansVille = adresses.filter(a => { const r = lieuCourt(a); return /^\d|\brue\b|\bav(enue)?\.?\b|\bbd\b|\bchem/i.test(r.principal) })
verifier(adresses.length > 20 && sansVille.length === 0, `${adresses.length} adresses : aucune n'affiche une rue à la place de la ville (${sansVille.length}${sansVille.length ? ' : ' + sansVille.join(' | ') : ''})`)

console.log(`\n${ko ? R : V}${B}${ok} contrôle(s) réussi(s), ${ko} échec(s)${Z}`)
process.exit(ko ? 1 : 0)
