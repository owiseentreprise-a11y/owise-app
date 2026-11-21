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
 * LA RÈGLE (journal du 2026-11-18) :
 *   km facturés    = trajet du client + retour à son point de départ
 *                    + part de l'approche AU-DELÀ de ce qu'inclut la base
 *   temps facturé  = idem, en minutes (durée normale, sans bouchons)
 *   prix           = prise en charge + km × prix du km + heures × prix de l'heure
 *                    jamais sous le minimum du véhicule, arrondi à l'euro supérieur
 *   base retenue   = celle qui donne le prix le plus bas au client
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
  /** Approche incluse dans le prix, en km et en minutes. */
  kmInclus: number
  minInclus: number
  active: boolean
}

export type GrilleV2 = {
  vehicules: Record<CleVehiculeV2, LigneVehicule>
  bases: BaseV2[]
}

/**
 * La grille de départ : les décisions du journal (0,40 €/km et 25 €/h pour la
 * berline, minimum 59 €), et pour les autres véhicules les rapports retenus
 * (Premium ×1,3, Van ×1,5, Grand van ×1,8) traduits EN LIGNES DE GRILLE —
 * chacune se règle ensuite seule. Prise en charge à 0 : la règle aller-retour
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
    { nom: 'Roissy-CDG',     adresse: 'Aéroport Paris-Charles de Gaulle, France', kmInclus: 35, minInclus: 35, active: true },
    { nom: 'Paris Châtelet', adresse: 'Châtelet, 75001 Paris, France',            kmInclus: 30, minInclus: 30, active: true },
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
  /** Arrivée → départ du client. */
  retour: Mesure
  /** De chaque base au départ du client, par nom de base. */
  approches: Record<string, Mesure | null>
}

export type DetailPrix = {
  prix: number
  base: string | null
  kmFactures: number
  minFactures: number
  eloignementKm: number
  eloignementMin: number
  auMinimum: boolean
}

export function prixV2(vehicule: CleVehiculeV2, m: MesuresTrajet, g: GrilleV2): DetailPrix {
  const l = g.vehicules[vehicule]
  const candidats: DetailPrix[] = []
  const bases = g.bases.filter(b => b.active && m.approches[b.nom])
  // Sans base mesurable, le prix couvre l'aller-retour seul (et une ligne « base : aucune » le dit).
  const essais: { base: string | null; ek: number; em: number }[] = bases.length
    ? bases.map(b => {
        const a = m.approches[b.nom]!
        return { base: b.nom, ek: Math.max(0, a.km - b.kmInclus), em: Math.max(0, a.min - b.minInclus) }
      })
    : [{ base: null, ek: 0, em: 0 }]
  for (const e of essais) {
    const km = m.trajet.km + m.retour.km + e.ek
    const min = m.trajet.min + m.retour.min + e.em
    const brut = l.priseEnCharge + km * l.prixKm + (min / 60) * l.prixHeure
    const prix = Math.ceil(Math.max(l.minimum, brut) - 1e-9)
    candidats.push({ prix, base: e.base, kmFactures: km, minFactures: min, eloignementKm: e.ek, eloignementMin: e.em, auMinimum: brut < l.minimum })
  }
  // À prix égal (souvent au minimum), la base la plus proche : c'est elle que
  // l'administration affichera, et elle doit dire vrai.
  return candidats.sort((a, b) => a.prix - b.prix || (a.eloignementKm + a.eloignementMin) - (b.eloignementKm + b.eloignementMin))[0]
}
