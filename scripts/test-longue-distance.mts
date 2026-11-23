/**
 * test-longue-distance.mts — la règle longue distance (décision du 2026-11-23).
 *   npx tsx scripts/test-longue-distance.mts
 *
 * Au-delà du seuil, chaque km se paie `prix_km_longue_distance` (aller + retour
 * à vide) ; en dessous, et pour les forfaits, rien ne change ; un aller-retour
 * le même jour n'est pas concerné. Lecture seule : aucun réseau, aucune base.
 */
import { readFileSync } from 'fs'
import { calculerPrixKm, calculerPrix, allerRetourMemeJour, regleLongueDistance, type TarifCalc, type ParamsCalc } from '../src/lib/calcPrix'
import { CLES_PARAMS_CALC, paramsPourNavigateur } from '../src/lib/tarification'

let ok = 0, ko = 0
const V = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', Z = '\x1b[0m'
const verifier = (c: boolean, m: string) => { if (c) { ok++; console.log(`${V}✓${Z} ${m}`) } else { ko++; console.log(`${R}✗ ${m}${Z}`) } }

const T = (vehicule: string, pec: number, km: number, ld: number | null): TarifCalc =>
  ({ vehicule, prise_en_charge: pec, prix_km: km, cdg_fixe: 0, orly_fixe: 0, beauvais_fixe: 0, prix_km_longue_distance: ld })
// Les valeurs décidées par l'exploitant le 2026-11-23.
const TARIFS = [T('Berline', 39, 1.25, 2.00), T('Berline Premium', 49, 1.50, 2.40), T('Van 7 places', 49, 1.55, 2.50), T('Grand Van 8 places', 65, 1.65, 2.65)]
const P: ParamsCalc = { seuil_longue_distance_km: 100, supplement_nuit: 0, supplement_weekend: 0 }
const px = (km: number, v = 'berline', p: ParamsCalc = P, t = TARIFS, o?: { sansRetourAVide?: boolean }) => calculerPrixKm(km, v, '', t, p, o)

console.log(`${B}Le calcul${Z}`)
verifier(px(80) === 39 + 80 * 1.25, `sous le seuil : rien ne change (80 km → ${px(80)} €)`)
verifier(px(100) === 39 + 100 * 1.25, `au seuil exact : rien ne change (100 km → ${px(100)} €)`)
verifier(px(312) === 39 + 100 * 1.25 + 212 * 2, `Paris → Bruxelles, 312 km : 39 + 100 × 1,25 + 212 × 2 = ${px(312)} € (exemple donné à l'exploitant : 588 €)`)
verifier(px(101) === 39 + 125 + 2, 'pas de saut au passage du seuil : le 101e km coûte 2 €, pas les 101')
verifier(px(466, 'berline_premium') === 49 + 150 + 366 * 2.4 && px(466, 'van') === 49 + 155 + 366 * 2.5 && px(466, 'grand_van') === 65 + 165 + 366 * 2.65,
  `chaque véhicule a son prix au-delà (Lyon : Premium ${px(466, 'berline_premium')} €, Van ${px(466, 'van')} €, Grand Van ${px(466, 'grand_van')} €)`)

console.log(`\n${B}Quand la règle ne s'applique pas${Z}`)
verifier(px(312, 'berline', P, TARIFS, { sansRetourAVide: true }) === 39 + 312 * 1.25, 'aller-retour le même jour : prix normal sur tout le trajet')
verifier(px(312, 'berline', { ...P, seuil_longue_distance_km: 0 }) === 39 + 312 * 1.25 && px(312, 'berline', { ...P, seuil_longue_distance_km: null }) === 39 + 312 * 1.25, 'seuil à 0 ou vide : règle coupée')
verifier(px(312, 'berline', P, [T('Berline', 39, 1.25, null)]) === 39 + 312 * 1.25, 'véhicule sans prix longue distance : règle coupée pour lui seul')
{
  const grille = [{ zone_depart_id: 'A', zone_arrivee_id: 'B', prix_berline: 139, prix_berline_premium: null, prix_van: null, prix_grand_van: null }]
  verifier(calculerPrix('A', 'B', 'berline', '', grille as never, TARIFS, [], P) === 139, 'un forfait de la grille (ex. Paris → Beauvais 139 €) n’est pas touché')
}

console.log(`\n${B}Les cas particuliers${Z}`)
{
  // Grand van sans ligne à lui : repli sur le van + surcoût au km, au-delà du seuil aussi.
  const sansGV = TARIFS.filter(t => t.vehicule !== 'Grand Van 8 places')
  const r = regleLongueDistance('grand_van', sansGV, { ...P, surcout_km_grand_van: 0.10 })
  verifier(!!r && Math.abs(r.prixKm - 2.6) < 1e-9, 'grand van sans ligne propre : prix du van au-delà du seuil + son surcoût au km')
  const nuit = calculerPrixKm(312, 'berline', '2026-11-25T23:30', TARIFS, { ...P, supplement_nuit: 20 })
  verifier(nuit === Math.round((39 + 125 + 424) * 1.2 * 100) / 100, `la majoration de nuit s’applique au prix total (${nuit} €)`)
}

console.log(`\n${B}Aller-retour le même jour${Z}`)
verifier(allerRetourMemeJour('2026-11-29T07:00', '2026-11-29T19:00'), 'même date, matin et soir : même jour')
verifier(!allerRetourMemeJour('2026-11-29T07:00', '2026-11-30T07:00'), 'lendemain : pas le même jour')
verifier(!allerRetourMemeJour('2026-11-29T23:30', '2026-11-30T00:30'), 'minuit passé : pas le même jour')
verifier(!allerRetourMemeJour('2026-11-29T07:00', '') && !allerRetourMemeJour('', ''), 'sans date de retour : non')
// Une date venue de la base est un instant (UTC) : 22:30Z = 23:30 à Paris, 23:30Z = 00:30 le lendemain.
verifier(!allerRetourMemeJour('2026-11-29T22:30:00Z', '2026-11-29T23:30:00Z'), 'instants en heure universelle : le jour se lit à Paris (23:30 puis 00:30 le lendemain → pas le même jour)')

console.log(`\n${B}Le réglage arrive partout${Z}`)
verifier((CLES_PARAMS_CALC as readonly string[]).includes('seuil_longue_distance_km'), 'le seuil fait partie des paramètres envoyés au navigateur')
verifier(paramsPourNavigateur({ ...P, seuil_longue_distance_km: 100 })?.seuil_longue_distance_km === 100, '… et y arrive réellement (sinon la page afficherait un autre prix que le serveur)')
for (const f of ['src/app/reserver/ReserverClient.tsx', 'src/app/reserver/actions.ts', 'src/app/admin/courses/nouvelle/NouvelleCourseForm.tsx']) {
  verifier(/allerRetourMemeJour\(/.test(readFileSync(f, 'utf8')), `${f.split('/').pop()} applique l’exception aller-retour le même jour`)
}
{
  // Aucun autre calcul au km écrit à la main : la règle ne vit que dans calcPrix.ts.
  const s = readFileSync('src/lib/calcPrix.ts', 'utf8')
  verifier((s.match(/prix_km_longue_distance/g) ?? []).length >= 2 && (s.match(/function calculerPrixKm/g) ?? []).length === 1, 'une seule fonction de calcul au km')
}

console.log(`\n${ko ? R : V}${B}${ok} contrôle(s) réussi(s), ${ko} échec(s)${Z}`)
process.exit(ko ? 1 : 0)
