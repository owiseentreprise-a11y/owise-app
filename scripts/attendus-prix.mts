/**
 * Les prix ATTENDUS, calculés depuis la grille, pour les trajets d'essai.
 *
 * Sert de référence au test navigateur : sans ce tableau, on ne saurait pas
 * si le prix affiché est juste, seulement qu'il s'affiche.
 *
 *   npx tsx scripts/attendus-prix.mts [--json]
 */
import { readFileSync } from 'fs'
import { join } from 'path'

for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const { createAdminClient } = await import('../src/lib/supabase/admin')
const { calculerPrix, detectZone } = await import('../src/lib/calcPrix')
const { GAMME } = await import('../src/lib/gamme')

/** Les trajets d'essai, avec le code postal qui les situe. */
export const TRAJETS = [
  { nom: 'Compiègne → CDG',   depCp: '60200', arrCp: '95700', depLabel: '7 Rue Jean-Jacques Bernard, 60200 Compiègne', arrLabel: 'Aéroport Paris-Charles de Gaulle (CDG)' },
  { nom: 'Chantilly → CDG',   depCp: '60500', arrCp: '95700', depLabel: '1 Avenue du Maréchal Joffre, 60500 Chantilly', arrLabel: 'Aéroport Paris-Charles de Gaulle (CDG)' },
  { nom: 'Senlis → Orly',     depCp: '60300', arrCp: '94390', depLabel: '1 Place Henri IV, 60300 Senlis',              arrLabel: 'Aéroport de Paris-Orly' },
  { nom: 'Creil → Paris',     depCp: '60100', arrCp: '75008', depLabel: '1 Place du Général de Gaulle, 60100 Creil',   arrLabel: '1 Avenue des Champs-Élysées, 75008 Paris' },
  { nom: 'Chantilly → Orly',  depCp: '60500', arrCp: '94390', depLabel: '1 Avenue du Maréchal Joffre, 60500 Chantilly', arrLabel: 'Aéroport de Paris-Orly' },
]

const sb = createAdminClient()
const [{ data: zones }, { data: grille }, { data: tarifs }, { data: params }] = await Promise.all([
  sb.from('zones').select('id, nom, code, type, prefixes_postaux').eq('actif', true),
  sb.from('grilles_tarifaires').select('zone_depart_id, zone_arrivee_id, prix_berline'),
  sb.from('tarifs').select('*'),
  sb.from('parametres').select('*').eq('id', true).single(),
])

const QUAND = ''   // pas de date : aucune majoration nuit/week-end
const resultat: Record<string, Record<string, number | null>> = {}

for (const t of TRAJETS) {
  const zd = detectZone(t.depCp, zones as never, t.depLabel)
  const za = detectZone(t.arrCp, zones as never, t.arrLabel)
  resultat[t.nom] = {}
  for (const v of GAMME) {
    if (v.surDevis) { resultat[t.nom][v.cle] = null; continue }
    resultat[t.nom][v.cle] = (zd && za)
      ? calculerPrix(zd.id, za.id, v.cle, QUAND, grille as never, tarifs as never, zones as never, params as never)
      : null
  }
  resultat[t.nom].__zones = null
  ;(resultat[t.nom] as Record<string, unknown>).__libelleZones = `${zd?.code ?? '?'} → ${za?.code ?? '?'}`
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ trajets: TRAJETS, attendus: resultat }, null, 2))
} else {
  console.log('\nPrix attendus, calculés depuis la grille\n')
  console.log('  trajet                zones        berline   premium      van')
  console.log('  ────────────────────────────────────────────────────────────────')
  for (const t of TRAJETS) {
    const r = resultat[t.nom] as Record<string, number | null> & { __libelleZones?: string }
    const f = (x: number | null | undefined) => x == null ? '     —' : String(Math.round(x)).padStart(6)
    console.log(`  ${t.nom.padEnd(21)} ${(r.__libelleZones ?? '').padEnd(12)} ${f(r.berline)}   ${f(r.berline_premium)}   ${f(r.van)}`)
  }
  console.log()
}
