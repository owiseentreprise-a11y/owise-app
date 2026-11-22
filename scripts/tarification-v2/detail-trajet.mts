/**
 * detail-trajet.mts — le détail du prix v2 d'un trajet du banc, BASE PAR BASE.
 * Lecture seule (base de données seulement, aucun appel Google).
 *   npx tsx scripts/tarification-v2/detail-trajet.mts "<départ commence par>" "<arrivée contient>"
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { lireGrilleV2, mesuresDepuisLigne } from '../../src/lib/tarification-v2/grille-db'
import { prixV2 } from '../../src/lib/tarification-v2/grille'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const g = await lireGrilleV2(sb)
const { data } = await sb.from('v2_trajets_types').select('*')
const t = (data ?? []).find(x => x.depart.startsWith(process.argv[2]) && x.arrivee.includes(process.argv[3]))
if (!t) throw new Error('trajet introuvable')
const m = mesuresDepuisLigne({ ...t, course_id: t.id, mise_de_cote: null })
console.log(`${t.depart} → ${t.arrivee} : trajet ${m.trajet.km.toFixed(1)} km / ${Math.round(m.trajet.min)} min`)
for (const b of g.bases) {
  const a = m.approches[b.nom], r = m.retoursBase[b.nom]
  const seule = { ...g, bases: g.bases.map(x => ({ ...x, active: x.nom === b.nom })) }
  const d = prixV2('berline', m, seule)
  console.log(`  base ${b.nom.padEnd(15)} ${b.active ? 'active ' : 'INACTIVE'} approche ${a?.km.toFixed(1)} km / ${Math.round(a?.min ?? 0)} min · retour ${r?.km.toFixed(1)} km / ${Math.round(r?.min ?? 0)} min → ${d.prix} € (${Math.round(d.kmFactures)} km, ${Math.round(d.minFactures)} min)`)
}
const d = prixV2('berline', m, g)
console.log(`  RETENUE : ${d.base} → ${d.prix} €`)
