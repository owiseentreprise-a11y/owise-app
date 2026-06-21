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
  supplement_nuit?: number | null
  supplement_weekend?: number | null
  tarif_pec_actif?: boolean | null
  tarif_frais_pec?: number | null
}

// Valeurs par défaut si /admin/tarifs n'a jamais été configuré
const DEFAULT_COEF_PREMIUM = 1.25
const DEFAULT_COEF_VAN     = 1.5

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

/**
 * Détecte la zone tarifaire d'une adresse.
 * Libellé en priorité (aéroports, gares, Paris), code postal en fallback
 * (préfixe le plus long gagne — ex: "60550" > "60").
 */
export function detectZone<T extends ZoneCalc>(codePostal: string, zones: T[], addressLabel?: string): T | null {
  if (addressLabel) {
    const lower = addressLabel.toLowerCase()
    if (lower.includes('charles de gaulle') || lower.includes('roissy') || /\bcdg\b/.test(lower)) {
      const z = zones.find(z => z.code === 'CDG'); if (z) return z
    }
    if (lower.includes('orly')) {
      const z = zones.find(z => z.code === 'ORY'); if (z) return z
    }
    if (lower.includes('beauvais')) {
      const z = zones.find(z => z.code === 'BVA'); if (z) return z
    }
    // "gare" dans l'adresse → zone gare uniquement si Paris intramuros (CP 75xxx)
    if ((lower.includes('gare ') || lower.startsWith('gare') || lower.includes(' gare')) && /^75/.test(codePostal)) {
      const z = zones.find(z => z.type === 'gare'); if (z) return z
    }
    if (/\bparis\b/.test(lower)) {
      const z = zones.find(z => z.code === 'Z1'); if (z) return z
    }
  }
  if (!codePostal) return null
  const sorted = [...zones].sort((a, b) => {
    const maxA = Math.max(0, ...(a.prefixes_postaux as string[]).map(p => p.trim().length))
    const maxB = Math.max(0, ...(b.prefixes_postaux as string[]).map(p => p.trim().length))
    return maxB - maxA
  })
  return sorted.find(z =>
    (z.prefixes_postaux as string[]).some(p => p.trim() && codePostal.startsWith(p.trim()))
  ) ?? null
}

/** Forfait si l'une des zones est un aéroport, une gare, ou Paris intramuros (Z1) */
export function isForfaitZone(zone: ZoneCalc): boolean {
  return zone.type === 'aeroport' || zone.type === 'gare' || zone.code === 'Z1'
}

/** Majorations nuit (22h-6h) et weekend, appliquées multiplicativement sur le prix de base */
export function appliquerSupplements(prix: number, dateHeure: string, params?: ParamsCalc | null): number {
  if (!dateHeure) return prix
  const d = new Date(dateHeure)
  const h = d.getHours()
  const j = d.getDay()
  let p = prix
  if (h >= 22 || h < 6)   p *= 1 + (params?.supplement_nuit    ?? 0) / 100
  if (j === 0 || j === 6) p *= 1 + (params?.supplement_weekend ?? 0) / 100
  return p
}

/**
 * Calcule le prix forfait pour un trajet entre deux zones.
 * Priorité 1 : matrice zone-à-zone (grilles_tarifaires) — la plus spécifique.
 * Priorité 2 : tarif fixe aéroport (tarifs.cdg_fixe/orly_fixe/beauvais_fixe),
 * utilisé seulement si aucune entrée de grille n'existe pour cette paire.
 */
export function calculerPrix(
  zoneDepId: string,
  zoneArrId: string,
  vehiculeKey: string,
  dateHeure: string,
  grille: GrilleCalc[],
  tarifs: TarifCalc[],
  zones: ZoneCalc[],
  params?: ParamsCalc | null,
): number | null {
  const vehiculeNom = VEHICULE_NOM[vehiculeKey] ?? vehiculeKey

  // Priorité 1 : matrice zone-à-zone (dans les deux sens)
  const cell = grille.find(g =>
    (g.zone_depart_id === zoneDepId  && g.zone_arrivee_id === zoneArrId) ||
    (g.zone_depart_id === zoneArrId  && g.zone_arrivee_id === zoneDepId)
  )
  if (cell?.prix_berline) {
    let coef = 1
    if (vehiculeKey === 'berline_premium') coef = params?.coef_berline_premium ?? DEFAULT_COEF_PREMIUM
    if (vehiculeKey === 'van')             coef = params?.coef_van ?? DEFAULT_COEF_VAN
    let prix = Number(cell.prix_berline) * coef
    if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
    return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
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
      if (prixBase > 0) {
        let prix = prixBase
        if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
        return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
      }
    }
  }

  return null
}

/** Calcule le prix au kilomètre — utilisé quand aucun forfait n'est disponible */
export function calculerPrixKm(
  distanceKm: number,
  vehiculeKey: string,
  dateHeure: string,
  tarifs: TarifCalc[],
  params?: ParamsCalc | null,
): number | null {
  const vehiculeNom = VEHICULE_NOM[vehiculeKey] ?? vehiculeKey
  const tarif = tarifs.find(t => t.vehicule === vehiculeNom)
  const base  = tarif ? Number(tarif.prise_en_charge) : 15
  const km    = tarif ? Number(tarif.prix_km)         : 2
  // Arrondir la distance à l'entier le plus proche pour absorber les
  // écarts de géocodage entre sources (BAN, LIEUX_CONNUS, Google Maps)
  const dist  = Math.round(distanceKm)
  let prix = base + dist * km
  if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
  return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
}
