/**
 * essai-simulateur.mts — la chaîne du simulateur, sans l'écran.
 * Même enchaînement que simulerTrajet (actions.ts) : mesurerTrajet puis
 * prixActuel pour les 4 véhicules, puis prixV2 avec la grille enregistrée.
 * Lecture seule (Google + base).
 *   npx tsx scripts/tarification-v2/essai-simulateur.mts "<départ>" "<arrivée>"
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
process.env.GOOGLE_MAPS_KEY = env.GOOGLE_MAPS_KEY
const { createClient } = await import('@supabase/supabase-js')
const { mesurerTrajet } = await import('../../src/lib/tarification-v2/mesures-google')
const { prixActuel, chargerTarificationActuelle } = await import('../../src/lib/tarification-v2/prix-actuel')
const { lireGrilleV2, VEHICULES_V2 } = await import('../../src/lib/tarification-v2/grille-db')
const { prixV2 } = await import('../../src/lib/tarification-v2/grille')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const [dep, arr] = [process.argv[2], process.argv[3]]
const [g, t] = await Promise.all([lireGrilleV2(sb), chargerTarificationActuelle(sb)])
const m = await mesurerTrajet(dep, arr, g.bases)
if ('erreur' in m) { console.log('ERREUR', m.erreur); process.exit(1) }
console.log(`${m.depart.libelleGoogle} (${m.depart.cp}) → ${m.arrivee.libelleGoogle} (${m.arrivee.cp}) · ${m.distanceKm} km`)
for (const v of VEHICULES_V2) {
  const a = prixActuel({ label: m.depart.saisie, cp: m.depart.cp }, { label: m.arrivee.saisie, cp: m.arrivee.cp }, m.distanceKm, v, t)
  const d = prixV2(v, m.mesures, g)
  console.log(`${v.padEnd(16)} actuel ${a ? a.prix + ' € (' + a.mode + ')' : '—'}   v2 ${d.prix} € (${Math.round(d.kmFactures)} km, base ${d.base})`)
}
