/**
 * test-prix-actuel.mts — LE « PRIX ACTUEL » DU SIMULATEUR EST-IL CELUI DU SITE ?
 *
 * Contrôle de src/lib/tarification-v2/prix-actuel.ts, sur les 92 trajets de
 * v2_trajets_types et les tarifs réels en base. Lecture seule.
 *  1. Les forfaits publiés sur les pages du site (meta « CDG 59€, Paris 125€,
 *     Orly 145€ » de la page Creil ; Chantilly → CDG 59 € de CLAUDE.md).
 *  2. Les trajets au km : recalculés ICI, sans calcPrix — prise en charge +
 *     distance arrondie × prix du km de la table `tarifs`.
 *  3. Aucun trajet × véhicule sans prix.
 *
 *   npx tsx scripts/tarification-v2/test-prix-actuel.mts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { prixActuel, chargerTarificationActuelle } from '../../src/lib/tarification-v2/prix-actuel'
import { VEHICULES_V2 } from '../../src/lib/tarification-v2/grille-db'

let ok = 0, ko = 0
const V = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', Z = '\x1b[0m'
const verifier = (c: boolean, m: string) => { if (c) { ok++; console.log(`${V}✓${Z} ${m}`) } else { ko++; console.log(`${R}✗ ${m}${Z}`) } }

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const t = await chargerTarificationActuelle(sb)
const { data: trajets, error } = await sb.from('v2_trajets_types').select('*').order('ordre')
if (error) throw new Error(error.message)

const prix = (tr: any, v: (typeof VEHICULES_V2)[number]) =>
  prixActuel({ label: tr.depart, cp: tr.depart_cp }, { label: tr.arrivee, cp: tr.arrivee_cp }, Number(tr.distance_km), v, t)
const trouver = (dep: string, arr: string) => trajets!.find(x => x.depart.startsWith(dep) && x.arrivee.includes(arr))

console.log(`${B}Les forfaits publiés sur le site${Z}`)
for (const [dep, arr, attendu] of [['Creil', 'Charles de Gaulle', 59], ['Creil', 'Châtelet', 125], ['Creil', 'Orly', 145], ['Chantilly', 'Charles de Gaulle', 59]] as const) {
  const tr = trouver(dep, arr); const p = tr && prix(tr, 'berline')
  verifier(!!p && p.prix === attendu && p.mode === 'forfait', `${dep} → ${arr}, berline : ${p ? p.prix + ' € (' + p.mode + ')' : 'aucun prix'} — publié ${attendu} €`)
}

console.log(`\n${B}Les trajets au kilomètre, recalculés sans calcPrix${Z}`)
const berline = t.tarifs.find(x => x.vehicule === 'Berline')!
const pec = (t.params as any)?.tarif_pec_actif ? Number((t.params as any).tarif_frais_pec ?? 0) : 0
const auKm = trajets!.map(tr => ({ tr, p: prix(tr, 'berline') })).filter(x => x.p?.mode === 'km')
const fauxKm = auKm.filter(({ tr, p }) => p!.prix !== Math.round(Number(berline.prise_en_charge) + Math.round(Number(tr.distance_km)) * Number(berline.prix_km) + pec))
verifier(auKm.length > 0 && fauxKm.length === 0, `${auKm.length} trajets berline au km : prise en charge + km × prix du km (${fauxKm.length} écart${fauxKm.length ? ' : ' + fauxKm.map(x => x.tr.depart + ' → ' + x.tr.arrivee).join(', ') : ''})`)

console.log(`\n${B}Couverture${Z}`)
const sansPrix = trajets!.flatMap(tr => VEHICULES_V2.filter(v => !prix(tr, v)).map(v => `${tr.depart} → ${tr.arrivee} (${v})`))
verifier(trajets!.length === 92 && sansPrix.length === 0, `${trajets!.length} trajets × 4 véhicules : tous ont un prix actuel (${sansPrix.length} sans prix${sansPrix.length ? ' : ' + sansPrix.slice(0, 5).join(', ') : ''})`)
const nbForfaits = trajets!.filter(tr => prix(tr, 'berline')?.mode === 'forfait').length
console.log(`  berline : ${nbForfaits} forfaits, ${trajets!.length - nbForfaits} au km`)

console.log(`\n${ko ? R : V}${B}${ok} contrôle(s) réussi(s), ${ko} échec(s)${Z}`)
process.exit(ko ? 1 : 0)
