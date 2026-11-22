/**
 * tarification-v2/grille.ts — UNE SEULE GRILLE, ET TOUS LES TRAJETS LA SUIVENT.
 *
 * Projet « Tarification v2 » (voir c:\websitebuilding\TARIFICATION-V2.md).
 * Ce fichier N'EST BRANCHÉ NULLE PART dans le site : il sert au mode fantôme
 * et aux simulations. La tarification actuelle (calcPrix.ts) reste seule en
 * service tant que l'exploitant n'a pas décidé la bascule.
 *
 * L'exploitant, le 2026-11-21 : « il faut juste qu'on ait une seule grille
 * tarifaire […] par véhicule, régler les frais de prise en charge et les
 * frais kilométriques […] quand on modifie, tout sera effectif sur tous les
 * trajets. Une sorte de compteur de voiture […] on lève le pied, tout lève
 * le pied. » Pas de forfait pour l'instant.
 *
 * LA RÈGLE — « circuit réel », décidée par l'exploitant le 2026-11-22
 * (remplace celle du 2026-11-18, qui facturait le retour au départ du client
 * EN PLUS de l'approche : Beauvais → CDG 166 € contre CDG → Beauvais 133 €,
 * alors que le chauffeur fait le même chemin) :
 *   km facturés    = base → départ du client  (l'approche)
 *                  + départ → (étapes) → arrivée  (le trajet du client)
 *                  + arrivée → base  (le retour du chauffeur chez lui)
 *   temps facturé  = idem, en minutes (durée normale, sans bouchons)
 *   prix           = prise en charge + km × prix du km + heures × prix de l'heure
 *                    jamais sous le minimum du véhicule, arrondi à l'euro supérieur
 *   base retenue   = celle qui donne le prix le plus bas au client, parmi les
 *                    bases actives dont la zone d'action (si elle en a une)
 *                    contient le départ ou l'arrivée du client
 * La règle est GLOBALE : la même pour tous les trajets et tous les véhicules ;
 * seules les lignes de la grille diffèrent d'un véhicule à l'autre.
 * APPROCHE OFFERTE (rétablie à la demande de l'exploitant le 2026-11-22, pour
 * régler les prix) : chaque base peut offrir une partie de l'APPROCHE —
 * `kmInclus` km et `minInclus` minutes sont retirés de l'approche facturée
 * (jamais en dessous de zéro). Le trajet du client et le retour du chauffeur
 * restent payés en entier. 0 = rien d'offert. La zone d'action se juge sur
 * l'approche RÉELLE, pas sur l'approche facturée.
 *
 * FONCTION PURE : aucun accès à la base, à Google ou au réseau. Les distances
 * lui sont fournies. Contrôle : scripts/tarification-v2/test-grille.mts.
 */

export type CleVehiculeV2 = 'berline' | 'berline_premium' | 'van' | 'grand_van'

/** Une ligne de la grille : ce que l'exploitant règle pour un véhicule. */
export type LigneVehicule = {
  /** Montant fixe ajouté à chaque course (€). */
  priseEnCharge: number
  /** Prix d'un kilomètre facturé (€). */
  prixKm: number
  /** Prix d'une heure facturée (€) — le temps du chauffeur. */
  prixHeure: number
  /** Aucun trajet en dessous (€). */
  minimum: number
}

export type BaseV2 = {
  nom: string
  /** Adresse que Google sait mesurer. */
  adresse: string
  active: boolean
  /** Zone d'action (km, route) : la base ne sert que si le client part OU
   *  arrive à moins de cette distance. null = aucune limite. Ce n'est PAS un
   *  nombre de km offerts : le circuit réel reste payé en entier. (2026-11-22) */
  zoneKm: number | null
  /** Approche offerte : km et minutes retirés de l'approche facturée (0 = rien). */
  kmInclus: number
  minInclus: number
}

export type GrilleV2 = {
  vehicules: Record<CleVehiculeV2, LigneVehicule>
  bases: BaseV2[]
}

/**
 * La grille de départ : les décisions du journal (0,40 €/km et 25 €/h pour la
 * berline, minimum 59 €), et pour les autres véhicules les rapports retenus
 * (Premium ×1,3, Van ×1,5, Grand van ×1,8) traduits EN LIGNES DE GRILLE —
 * chacune se règle ensuite seule. Prise en charge à 0 : le circuit réel
 * paie déjà l'approche ; le champ existe pour que l'exploitant s'en serve.
 */
export const GRILLE_DE_DEPART: GrilleV2 = {
  vehicules: {
    berline:         { priseEnCharge: 0, prixKm: 0.40, prixHeure: 25,   minimum: 59 },
    berline_premium: { priseEnCharge: 0, prixKm: 0.52, prixHeure: 32.5, minimum: 77 },
    van:             { priseEnCharge: 0, prixKm: 0.60, prixHeure: 37.5, minimum: 89 },
    grand_van:       { priseEnCharge: 0, prixKm: 0.72, prixHeure: 45,   minimum: 107 },
  },
  bases: [
    { nom: 'Roissy-CDG',     adresse: 'Aéroport Paris-Charles de Gaulle, France', active: true, zoneKm: null, kmInclus: 0, minInclus: 0 },
    { nom: 'Paris Châtelet', adresse: 'Châtelet, 75001 Paris, France',            active: true, zoneKm: null, kmInclus: 0, minInclus: 0 },
  ],
}

/** Les noms de véhicule trouvés en base (« grand_van_8 », « van_7 ») ramenés aux quatre clés. */
export function cleVehiculeV2(brut: string | null | undefined): CleVehiculeV2 | null {
  const v = (brut ?? '').toLowerCase()
  if (v.startsWith('grand_van')) return 'grand_van'
  if (v.startsWith('van')) return 'van'
  if (v === 'berline_premium' || v === 'premium') return 'berline_premium'
  if (v === 'berline') return 'berline'
  return null
}

export type Mesure = { km: number; min: number }
export type MesuresTrajet = {
  /** Départ → (étapes) → arrivée. */
  trajet: Mesure
  /** Arrivée → départ du client. Gardé pour information ; n'entre PAS dans le prix depuis le 2026-11-22. */
  retour?: Mesure
  /** De chaque base au départ du client, par nom de base. */
  approches: Record<string, Mesure | null>
  /** De l'arrivée à chaque base, par nom de base (retour du chauffeur). */
  retoursBase: Record<string, Mesure | null>
}

export type DetailPrix = {
  prix: number
  base: string | null
  kmFactures: number
  minFactures: number
  /** Approche RÉELLE (base → client) et retour (arrivée → base), en km. */
  approcheKm: number
  /** Part de l'approche offerte par la base, en km (déjà retirée de kmFactures). */
  approcheOfferteKm: number
  retourBaseKm: number
  auMinimum: boolean
}

export function prixV2(vehicule: CleVehiculeV2, m: MesuresTrajet, g: GrilleV2): DetailPrix {
  const l = g.vehicules[vehicule]
  const tarif = (km: number, min: number) => {
    const brut = l.priseEnCharge + km * l.prixKm + (min / 60) * l.prixHeure
    return { prix: Math.ceil(Math.max(l.minimum, brut) - 1e-9), auMinimum: brut < l.minimum }
  }
  const candidats: DetailPrix[] = []
  for (const b of g.bases) {
    const a = m.approches[b.nom], r = m.retoursBase?.[b.nom]
    if (!b.active || !a || !r) continue
    if (b.zoneKm != null && a.km > b.zoneKm && r.km > b.zoneKm) continue // client hors de la zone d'action
    const offertKm = Math.min(a.km, b.kmInclus), offertMin = Math.min(a.min, b.minInclus)
    const km = a.km - offertKm + m.trajet.km + r.km
    const min = a.min - offertMin + m.trajet.min + r.min
    candidats.push({ ...tarif(km, min), base: b.nom, kmFactures: km, minFactures: min, approcheKm: a.km, approcheOfferteKm: offertKm, retourBaseKm: r.km })
  }
  // Aucune base active ou mesurable : l'aller-retour du trajet seul, et
  // « base : aucune » le dit à l'écran. Jamais un prix silencieusement faux.
  if (!candidats.length) {
    const km = 2 * m.trajet.km, min = 2 * m.trajet.min
    return { ...tarif(km, min), base: null, kmFactures: km, minFactures: min, approcheKm: 0, approcheOfferteKm: 0, retourBaseKm: 0 }
  }
  // À prix égal (souvent au minimum), le circuit le plus court : c'est la base
  // que l'administration affiche, et elle doit dire vrai.
  return candidats.sort((x, y) => x.prix - y.prix || x.kmFactures - y.kmFactures)[0]
}
