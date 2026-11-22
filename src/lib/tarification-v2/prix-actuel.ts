/**
 * tarification-v2/prix-actuel.ts — LE PRIX D'AUJOURD'HUI, POUR COMPARER.
 *
 * Projet « Tarification v2 » (c:\websitebuilding\TARIFICATION-V2.md).
 * SEUL fichier du projet v2 autorisé à LIRE le calcul actuel — autorisation
 * de l'exploitant du 2026-11-21, déclarée dans controle-prod-intacte.mjs
 * (LECTEURS_AUTORISES). Il ne modifie rien : il appelle les fonctions de
 * calcPrix.ts telles quelles, pour afficher le prix actuel à côté du prix v2
 * dans le simulateur et le banc de trajets de /admin/tarification-v2.
 *
 * Il reproduit le chemin du formulaire de devis de la vitrine
 * (`estimerPrixBase`, src/components/VitrineBody.tsx), sans date — donc sans
 * majoration de nuit ou de week-end :
 *   1. zone du départ et de l'arrivée (detectZone, code postal + libellé) ;
 *   2. forfait de la grille entre ces deux zones (calculerPrix) ;
 *   3. sinon, prix au kilomètre sur la distance routière (calculerPrixKm) ;
 *   4. arrondi à l'euro, comme la vitrine.
 * Si la vitrine change de chemin, ce fichier doit suivre : le contrôle
 * scripts/tarification-v2/test-prix-actuel.mts recalcule le prix sans ces
 * fonctions et compare.
 */
import { calculerPrix, calculerPrixKm, detectZone } from '@/lib/calcPrix'
import { chargerTarification, type Tarification } from '@/lib/tarification'
import { vehiculeParCle } from '@/lib/gamme'
import type { CleVehiculeV2 } from './grille'

export type { Tarification }
/** Les tarifs actuels (zones, grille, tarifs, paramètres), lus comme les lit le site. */
export const chargerTarificationActuelle = (sb: Parameters<typeof chargerTarification>[0]) => chargerTarification(sb)

export type PointActuel = { label: string; cp: string }
export type PrixActuel = { prix: number; mode: 'forfait' | 'km'; zoneDepart: string | null; zoneArrivee: string | null } | null

export function prixActuel(
  depart: PointActuel, arrivee: PointActuel, distanceKm: number | null,
  vehicule: CleVehiculeV2, t: Tarification,
): PrixActuel {
  const vg = vehiculeParCle(vehicule)
  if (!vg) return null
  const tarif = t.tarifs.find(x => x.vehicule === vg.nomTarif)
  if (!tarif || !depart.label || !arrivee.label) return null
  const zoneDep = detectZone(depart.cp ?? '', t.zones, depart.label)
  const zoneArr = detectZone(arrivee.cp ?? '', t.zones, arrivee.label)
  const zones = { zoneDepart: zoneDep?.code ?? null, zoneArrivee: zoneArr?.code ?? null }
  if (zoneDep && zoneArr) {
    const px = calculerPrix(zoneDep.id, zoneArr.id, vg.cle, '', t.grille, t.tarifs, t.zones, t.params)
    if (px !== null) return { prix: Math.round(px), mode: 'forfait', ...zones }
  }
  if (distanceKm !== null) {
    const px = calculerPrixKm(distanceKm, vg.cle, '', t.tarifs, t.params)
    if (px !== null) return { prix: Math.round(px), mode: 'km', ...zones }
  }
  return null
}
