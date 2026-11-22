/**
 * mesurer-trajets-types.mts — REMPLIT v2_trajets_types.
 *
 * Projet « Tarification v2 » (c:\websitebuilding\TARIFICATION-V2.md).
 * Chaque commune d'une page ville du site → Roissy-CDG, Orly, Beauvais, Paris ;
 * puis chaque lieu clé vers chacun des autres, dans les deux sens (Paris,
 * Roissy-CDG, Orly, Le Bourget, Beauvais, Chantilly — points-cles.ts).
 * Mesuré UNE fois par Google (mêmes fonctions que le simulateur :
 * src/lib/tarification-v2/mesures-google.ts) ; les prix sont recalculés à
 * l'affichage.
 *
 * COUVERTURE : la liste des pages est relue dans src/app/[destination]/page.tsx
 * (clés de DESTINATIONS). Une page ville sans commune dans COMMUNES arrête le
 * script — une page ajoutée demain ne peut pas être oubliée en silence.
 *
 * ÉCRIT UNIQUEMENT dans v2_trajets_types (table neuve, autorisée le 2026-11-21).
 *   npx tsx scripts/tarification-v2/mesurer-trajets-types.mts [--remesurer]
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
process.env.GOOGLE_MAPS_KEY = env.GOOGLE_MAPS_KEY
const { createClient } = await import('@supabase/supabase-js')
const { mesurerTrajet } = await import('../../src/lib/tarification-v2/mesures-google')
const { lireGrilleV2 } = await import('../../src/lib/tarification-v2/grille-db')
const { POINTS_CLES } = await import('../../src/lib/tarification-v2/points-cles')
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const remesurer = process.argv.includes('--remesurer')

/* slug de la page ville → libellé tel qu'un client le taperait (commune + code postal). */
const COMMUNES: Record<string, string> = {
  'vtc-creil': 'Creil 60100, France',
  'vtc-compiegne': 'Compiègne 60200, France',
  'vtc-senlis': 'Senlis 60300, France',
  'vtc-gouvieux': 'Gouvieux 60270, France',
  'vtc-saint-maximin': 'Saint-Maximin 60740, France',
  'vtc-chantilly': 'Chantilly 60500, France',
  'vtc-beauvais': 'Beauvais 60000, France',
  'vtc-lamorlaye': 'Lamorlaye 60260, France',
  'vtc-pontoise': 'Pontoise 95300, France',
  'vtc-versailles': 'Versailles 78000, France',
  'vtc-coye-la-foret': 'Coye-la-Forêt 60580, France',
  'vtc-orry-la-ville': 'Orry-la-Ville 60560, France',
  'vtc-la-chapelle-en-serval': 'La Chapelle-en-Serval 60520, France',
  'vtc-boran-sur-oise': 'Boran-sur-Oise 60820, France',
  'vtc-precy-sur-oise': 'Précy-sur-Oise 60460, France',
  'vtc-luzarches': 'Luzarches 95270, France',
  'vtc-goussainville': 'Goussainville 95190, France',
  'vtc-clermont': 'Clermont 60600, France',
  'vtc-liancourt': 'Liancourt 60140, France',
  'vtc-chambly': 'Chambly 60230, France',
  'vtc-meru': 'Méru 60110, France',
  'vtc-verberie': 'Verberie 60410, France',
  'vtc-noyon': 'Noyon 60400, France',
}
/* Pages qui ne sont PAS une commune de départ : FAQ, Paris, aéroports, et
   pages « commune → aéroport » (déjà couvertes par la commune). */
const PAS_UNE_COMMUNE = /^(faq|vtc-paris|vtc-aeroport-.*|vtc-.*-(cdg|orly|beauvais))$/

/* Les arrivées : libellés EXACTS des lieux connus du site (lieux.ts) pour les
   aéroports — c'est ainsi qu'un client les choisit — et le centre de Paris. */
const ARRIVEES: [string, string][] = [
  ['Roissy-CDG', 'Aéroport Paris-Charles de Gaulle (CDG)'],
  ['Orly', 'Aéroport de Paris-Orly (ORY)'],
  ['Beauvais', 'Aéroport Paris-Beauvais Tillé (BVA)'],
  ['Paris', 'Châtelet, 75001 Paris, France'],
]

const page = readFileSync(resolve('src/app/[destination]/page.tsx'), 'utf8')
const bloc = page.slice(page.indexOf('export const DESTINATIONS'))
/* Guillemets facultatifs : « faq: { » s'écrit sans, et une page future
   écrite ainsi échapperait au contrôle de couverture. */
const slugs = [...bloc.matchAll(/^\s{2}'?([a-z0-9-]+)'?:\s*\{/gm)].map(m => m[1])
const oubliees = slugs.filter(s => !PAS_UNE_COMMUNE.test(s) && !COMMUNES[s])
if (slugs.length < 30) throw new Error(`Liste des pages illisible (${slugs.length} trouvées)`)
if (oubliees.length) throw new Error(`Pages villes sans commune dans le banc : ${oubliees.join(', ')}`)
const inconnues = Object.keys(COMMUNES).filter(s => !slugs.includes(s))
if (inconnues.length) throw new Error(`Communes dont la page n'existe plus : ${inconnues.join(', ')}`)
console.log(`${slugs.length} pages lues, ${Object.keys(COMMUNES).length} communes, ${ARRIVEES.length} destinations`)

const grille = await lireGrilleV2(sb)
const { data: deja } = await sb.from('v2_trajets_types').select('depart, arrivee')
const present = new Set((deja ?? []).map(d => d.depart + '→' + d.arrivee))

let ecrits = 0, sautes = 0, echecs = 0, ordre = 0
async function mesurerEtEcrire(groupe: string, depart: string, arrivee: string) {
  ordre++
  if (!remesurer && present.has(depart + '→' + arrivee)) { sautes++; return }
  const m = await mesurerTrajet(depart, arrivee, grille.bases)
  if ('erreur' in m) { echecs++; console.log(`✗ ${depart} → ${arrivee} : ${m.erreur}`); return }
  if (m.distanceKm === null) { echecs++; console.log(`✗ ${depart} → ${arrivee} : distance du site introuvable`); return }
  const { error } = await sb.from('v2_trajets_types').upsert({
    groupe, ordre, depart, arrivee, depart_cp: m.depart.cp, arrivee_cp: m.arrivee.cp,
    distance_km: m.distanceKm, trajet_km: m.mesures.trajet.km, trajet_min: m.mesures.trajet.min,
    retour_km: m.mesures.retour.km, retour_min: m.mesures.retour.min, approches: m.mesures.approches, retours_base: m.mesures.retoursBase,
    mesure_le: new Date().toISOString(),
  }, { onConflict: 'depart,arrivee' })
  if (error) { echecs++; console.log(`✗ ${depart} → ${arrivee} : ${error.message}`) } else { ecrits++; present.add(depart + '→' + arrivee) }
}
for (const [groupe, arrivee] of ARRIVEES) for (const depart of Object.values(COMMUNES)) await mesurerEtEcrire(groupe, depart, arrivee)
/* Les lieux clés deux à deux, dans les deux sens. Le groupe est le lieu
   d'arrivée : « Chantilly → Roissy-CDG » reste dans « Roissy-CDG ». */
for (const a of POINTS_CLES) for (const d of POINTS_CLES) if (a !== d) await mesurerEtEcrire(a.nom, d.libelle, a.libelle)
console.log(`${ecrits} trajet(s) écrit(s), ${sautes} déjà présent(s), ${echecs} échec(s)`)
process.exit(echecs ? 1 : 0)
