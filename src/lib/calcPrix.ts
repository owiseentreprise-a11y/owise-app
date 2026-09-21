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
  supplement_etape?: number | null
  tarif_pec_actif?: boolean | null
  tarif_frais_pec?: number | null
  // Options du formulaire de devis (bagages/panneau/animaux/siège enfant) —
  // non utilisées par les fonctions de calcul de ce fichier, juste
  // transportées jusqu'à VitrineBody pour piloter l'affichage des cases à cocher.
  supplement_bagages_actif?: boolean | null
  supplement_bagages_prix?: number | null
  supplement_panneau_actif?: boolean | null
  supplement_panneau_prix?: number | null
  supplement_animaux_actif?: boolean | null
  supplement_animaux_prix?: number | null
  supplement_siege_enfant_actif?: boolean | null
  supplement_siege_enfant_prix?: number | null
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
 * Vocabulaire des destinations belges desservies.
 *
 * Sert à deux choses qui doivent rester d'accord : la détection de zone
 * ci-dessous, et le géocodage (`/api/geocode`), qui doit chercher en Belgique
 * plutôt qu'en France pour ces adresses. La France compte des homonymes —
 * « Bruxelles » est un hameau de Dammarie-sur-Loing (45230), « Tournai » une
 * commune de l'Orne, « Mouscron » un lieu-dit de Willems — et Google renvoyait
 * ces lieux-là, à 400-500 km de la vraie destination (constaté le 2026-09-19).
 */
export const TERMES_CHARLEROI = ['charleroi', 'gosselies'] as const
export const TERMES_BELGIQUE  = [
  'belgique', 'belgium', 'bruxelles', 'brussels', 'zaventem',
  'mouscron', 'kortrijk', 'courtrai', 'tournai',
] as const

/** Vrai si le libellé désigne une destination belge desservie. */
export function estAdresseBelge(label: string): boolean {
  const l = (label ?? '').toLowerCase()
  return TERMES_CHARLEROI.some(t => l.includes(t)) || TERMES_BELGIQUE.some(t => l.includes(t))
}

/**
 * Détecte la zone tarifaire d'une adresse.
 * Libellé en priorité (aéroports, gares, Paris), code postal en fallback
 * (préfixe le plus long gagne — ex: "60550" > "60").
 */
export function detectZone<T extends ZoneCalc>(codePostal: string, zones: T[], addressLabel?: string): T | null {
  if (addressLabel) {
    // Les traits d'union sont neutralisés avant toute comparaison : Google
    // réécrit les libellés qu'on lui envoie, et « Aéroport Paris-Charles de
    // Gaulle (CDG) » revient en « Aéroport Charles-de-Gaulle, Rue du Luxembourg,
    // 93290 Tremblay-en-France ». Le mot « CDG » a disparu, « Charles de Gaulle »
    // a pris des traits d'union, et 93290 n'appartient à aucune zone : le
    // forfait aéroport ne s'appliquait plus sur les liens pré-remplis.
    const lower = addressLabel.toLowerCase().replace(/[-‐‑–—]/g, ' ')
    const marqueurAeroport = /a[ée]roport|terminal/.test(lower)

    // « Charles de Gaulle » est l'un des noms de rue les plus répandus de
    // France : sans marqueur d'aéroport, une adresse de Creil ou de Neuilly
    // était facturée comme un transfert CDG. « Roissy en Brie » (77) est une
    // commune de Seine-et-Marne, à 40 km de l'aéroport.
    const estRoissyAeroport = lower.includes('roissy') && !lower.includes('roissy en brie')
    if (/\bcdg\b/.test(lower)
        || estRoissyAeroport
        || (lower.includes('charles de gaulle') && marqueurAeroport)) {
      const z = zones.find(z => z.code === 'CDG'); if (z) return z
    }
    if (lower.includes('orly')) {
      const z = zones.find(z => z.code === 'ORY'); if (z) return z
    }
    // Aéroport de Beauvais-Tillé : on exige « Tillé » comme mot entier, ou
    // « Beauvais » accompagné d'un marqueur d'aéroport — sinon une adresse dans
    // la ville de Beauvais (zone BEA) est absorbée par la zone aéroport.
    // Le mot entier est indispensable : « bastille » contient « tille », si bien
    // que « Place de la Bastille, 75011 Paris » était facturée comme un départ
    // de l'aéroport de Beauvais.
    // À noter : la ville et l'aéroport partagent le code postal 60000 (l'aéroport
    // est sur la commune de Tillé). Seul le libellé peut donc les distinguer —
    // la zone BVA n'a d'ailleurs aucun préfixe postal en base.
    if (/\btill[ée]\b/.test(lower)
        || (lower.includes('beauvais') && marqueurAeroport)) {
      const z = zones.find(z => z.code === 'BVA'); if (z) return z
    }
    // Charleroi : aéroport belge distinct de Bruxelles, sensiblement plus proche
    // de l'Oise (~45 km de moins) — mérite son propre tarif, pas celui de "BEL".
    if (TERMES_CHARLEROI.some(t => lower.includes(t))) {
      const z = zones.find(z => z.code === 'CHR'); if (z) return z
    }
    // Belgique (reste) : pas de code postal français exploitable, donc détection
    // uniquement par libellé (nom de pays ou grandes villes du trajet longue distance).
    if (TERMES_BELGIQUE.some(t => lower.includes(t))) {
      const z = zones.find(z => z.code === 'BEL'); if (z) return z
    }
    // "gare" dans l'adresse → zone gare uniquement si Paris intramuros (CP 75xxx)
    if ((lower.includes('gare ') || lower.startsWith('gare') || lower.includes(' gare')) && /^75/.test(codePostal)) {
      const z = zones.find(z => z.type === 'gare'); if (z) return z
    }
    // "paris" dans le libellé → Z1 uniquement si le code postal connu confirme
    // Paris intramuros (75xxx) — évite de faire matcher "Disneyland Paris"
    // (77700) ou "Aéroport Paris-Le Bourget" (93350) sur la zone Paris.
    if (/\bparis\b/.test(lower) && (!codePostal || /^75/.test(codePostal))) {
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

  // Plus de forfait aéroport « global » en repli : un prix unique appliqué dès
  // qu'une zone aéroport était impliquée, quelle que soit la distance. Il
  // facturait Orly → Charleroi 59 € pour 300 km, et CDG → Charleroi 69 € pour
  // 262 km. Sans ligne de grille, on passe désormais au kilomètre, ce que les
  // trois points d'entrée savent faire.
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
