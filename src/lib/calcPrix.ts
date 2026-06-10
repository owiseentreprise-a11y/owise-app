export type ZoneCalc   = { id: string; code: string; type: string; prefixes_postaux: string[] }
export type GrilleCalc = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }
export type TarifCalc  = {
  vehicule: string
  prise_en_charge: number
  prix_km: number
  cdg_fixe: number
  orly_fixe: number
  beauvais_fixe: number
}

// Coefficients véhicules appliqués à la grille berline de base
const COEF_PREMIUM = 1.5
const COEF_VAN     = 1.7

export const AIRPORT_COL: Record<string, keyof TarifCalc> = {
  CDG: 'cdg_fixe',
  ORY: 'orly_fixe',
  BVA: 'beauvais_fixe',
}

export const VEHICULE_NOM: Record<string, string> = {
  berline:         'Berline',
  berline_premium: 'Berline Premium',
  van:             'Van 7 places',
}

export const NOM_VERS_CLE: Record<string, string> = {
  'Berline':         'berline',
  'Berline Premium': 'berline_premium',
  'Van 7 places':    'van',
  'Grand Van':       'van',
}

export function calculerPrix(
  zoneDepId: string,
  zoneArrId: string,
  vehiculeKey: string,
  dateHeure: string,
  grille: GrilleCalc[],
  tarifs: TarifCalc[],
  zones: ZoneCalc[],
): number | null {
  const vehiculeNom = VEHICULE_NOM[vehiculeKey] ?? vehiculeKey

  // Priorité 1 : matrice zone-à-zone (dans les deux sens)
  const cell = grille.find(g =>
    (g.zone_depart_id === zoneDepId  && g.zone_arrivee_id === zoneArrId) ||
    (g.zone_depart_id === zoneArrId  && g.zone_arrivee_id === zoneDepId)
  )
  if (cell?.prix_berline) {
    let coef = 1
    if (vehiculeKey === 'berline_premium') coef = COEF_PREMIUM
    if (vehiculeKey === 'van')             coef = COEF_VAN
    return Math.round(Number(cell.prix_berline) * coef * 100) / 100
  }

  // Priorité 2 : tarif fixe aéroport (chaque véhicule a sa propre ligne dans tarifs)
  const zDep = zones.find(z => z.id === zoneDepId)
  const zArr = zones.find(z => z.id === zoneArrId)
  const airportZone = [zDep, zArr].find(z => z?.type === 'aeroport' && AIRPORT_COL[z.code ?? ''])
  if (airportZone) {
    const tarif = tarifs.find(t => t.vehicule === vehiculeNom)
    const col   = AIRPORT_COL[airportZone.code]
    if (tarif && col) {
      const prixBase = Number(tarif[col])
      if (prixBase > 0) return Math.round(prixBase * 100) / 100
    }
  }

  return null
}

export function calculerPrixKm(
  distanceKm: number,
  vehiculeKey: string,
  dateHeure: string,
  tarifs: TarifCalc[],
): number | null {
  const vehiculeNom = VEHICULE_NOM[vehiculeKey] ?? vehiculeKey
  const tarif = tarifs.find(t => t.vehicule === vehiculeNom)
  const base  = tarif ? Number(tarif.prise_en_charge) : 15
  const km    = tarif ? Number(tarif.prix_km)         : 2
  // Arrondir la distance à l'entier le plus proche pour absorber les
  // écarts de géocodage entre sources (BAN, LIEUX_CONNUS, Google Maps)
  const dist  = Math.round(distanceKm)
  return Math.round((base + dist * km) * 100) / 100
}
