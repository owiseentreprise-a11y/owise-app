// Source unique de vérité pour le calcul des prix Owise.
// Utilisé par : VitrineBody (widget devis), ReserverClient (formulaire), actions.ts (serveur Stripe).

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
export type ParamsCalc = {
  coef_berline_premium?: number | null
  coef_van?: number | null
  tarif_pec_actif?: boolean | null
  tarif_frais_pec?: number | null
  supplement_nuit?: number | null
  supplement_weekend?: number | null
}

export const AIRPORT_COL: Record<string, keyof TarifCalc> = {
  CDG: 'cdg_fixe',
  ORY: 'orly_fixe',
  BVA: 'beauvais_fixe',
}

// Clé interne → nom en base tarifs
export const VEHICULE_NOM: Record<string, string> = {
  berline:         'Berline',
  berline_premium: 'Berline Premium',
  van:             'Van 7 places',
}

// Nom affiché → clé interne (pour le widget vitrine qui travaille avec des noms)
export const NOM_VERS_CLE: Record<string, string> = {
  'Berline':         'berline',
  'Berline Premium': 'berline_premium',
  'Van 7 places':    'van',
  'Grand Van':       'van', // fallback sur van
}

export function appliquerSupplements(prix: number, dateHeure: string, params: ParamsCalc | null): number {
  if (!dateHeure) return prix
  const d = new Date(dateHeure)
  const h = d.getHours()
  const j = d.getDay()
  if (h >= 22 || h < 6)   prix *= 1 + (params?.supplement_nuit    ?? 0) / 100
  if (j === 0 || j === 6)  prix *= 1 + (params?.supplement_weekend ?? 0) / 100
  return prix
}

/**
 * Calcule le prix à partir de zones connues (grille + tarifs aéroport).
 * Retourne null si aucun tarif configuré pour cette paire de zones.
 */
export function calculerPrix(
  zoneDepId: string,
  zoneArrId: string,
  vehiculeKey: string,
  dateHeure: string,
  grille: GrilleCalc[],
  params: ParamsCalc | null,
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
    if (vehiculeKey === 'berline_premium') coef = params?.coef_berline_premium ?? 1.25
    if (vehiculeKey === 'van')             coef = params?.coef_van             ?? 1.5
    let prix = Number(cell.prix_berline) * coef
    if (params?.tarif_pec_actif) prix += Number(params.tarif_frais_pec ?? 0)
    prix = appliquerSupplements(prix, dateHeure, params)
    return Math.round(prix * 100) / 100
  }

  // Priorité 2 : tarif fixe aéroport
  const zDep = zones.find(z => z.id === zoneDepId)
  const zArr = zones.find(z => z.id === zoneArrId)
  const airportZone = [zDep, zArr].find(z => z?.type === 'aeroport' && AIRPORT_COL[z.code ?? ''])
  if (airportZone) {
    const tarif = tarifs.find(t => t.vehicule === vehiculeNom)
    const col   = AIRPORT_COL[airportZone.code]
    if (tarif && col) {
      const prixBase = Number(tarif[col])
      if (prixBase > 0) {
        let prix = prixBase
        if (params?.tarif_pec_actif) prix += Number(params.tarif_frais_pec ?? 0)
        prix = appliquerSupplements(prix, dateHeure, params)
        return Math.round(prix * 100) / 100
      }
    }
  }

  return null
}

/**
 * Calcule le prix au kilomètre (OSRM) quand aucune grille de zone ne s'applique.
 */
export function calculerPrixKm(
  distanceKm: number,
  vehiculeKey: string,
  dateHeure: string,
  params: ParamsCalc | null,
  tarifs: TarifCalc[],
): number | null {
  const vehiculeNom = VEHICULE_NOM[vehiculeKey] ?? vehiculeKey
  const tarif = tarifs.find(t => t.vehicule === vehiculeNom)
  const base  = tarif ? Number(tarif.prise_en_charge) : 15
  const km    = tarif ? Number(tarif.prix_km)         : 2
  let prix = base + distanceKm * km
  if (params?.tarif_pec_actif) prix += Number(params.tarif_frais_pec ?? 0)
  prix = appliquerSupplements(prix, dateHeure, params)
  return Math.round(prix * 100) / 100
}
