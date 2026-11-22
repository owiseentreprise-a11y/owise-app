/**
 * tarification-v2/points-cles.ts — LES LIEUX À COMPARER DEUX À DEUX.
 *
 * Demandé par l'exploitant le 2026-11-22 : « les tests en relation avec Paris,
 * avec les aéroports, toutes les possibilités avec les aéroports parisiens,
 * Paris, l'aéroport de Beauvais, Chantilly — que je puisse comparer ».
 *
 * Chaque lieu vers chacun des autres, dans les deux sens : 6 lieux, 30 trajets
 * (table v2_trajets_types, remplie par scripts/tarification-v2/mesurer-trajets-types.mts).
 * Les aéroports portent le libellé EXACT des lieux connus du site (lieux.ts) :
 * c'est ainsi qu'un client les choisit, et c'est ce que lit la détection de zone.
 *
 * `nom` sert aussi de groupe de destination à l'écran : les quatre premiers
 * sont ceux des trajets « commune → destination » déjà en place.
 */
/* `court` : le nom affiché, sans ambiguïté — la VILLE de Beauvais est aussi
   dans le banc, d'où « Beauvais (aéroport) ». */
export const POINTS_CLES: { nom: string; court: string; libelle: string }[] = [
  { nom: 'Paris', court: 'Paris',      libelle: 'Châtelet, 75001 Paris, France' },
  { nom: 'Roissy-CDG', court: 'Roissy-CDG', libelle: 'Aéroport Paris-Charles de Gaulle (CDG)' },
  { nom: 'Orly', court: 'Orly',       libelle: 'Aéroport de Paris-Orly (ORY)' },
  { nom: 'Le Bourget', court: 'Le Bourget', libelle: 'Aéroport Paris-Le Bourget' },
  { nom: 'Beauvais', court: 'Beauvais (aéroport)',   libelle: 'Aéroport Paris-Beauvais Tillé (BVA)' },
  { nom: 'Chantilly', court: 'Chantilly',  libelle: 'Chantilly 60500, France' },
]

const LIBELLES = new Set(POINTS_CLES.map(p => p.libelle))

/** Un trajet entre deux lieux clés (filtre « Paris & aéroports »). */
export const estEntrePointsCles = (depart: string, arrivee: string) => LIBELLES.has(depart) && LIBELLES.has(arrivee)

/** Le nom affiché d'un lieu clé (« Beauvais (aéroport) »), ou null. */
export const nomPointCle = (libelle: string) => POINTS_CLES.find(p => p.libelle === libelle)?.court ?? null
/** Le nom affiché d'un groupe de destination (« Beauvais » → « Beauvais (aéroport) »). */
export const nomGroupe = (groupe: string) => POINTS_CLES.find(p => p.nom === groupe)?.court ?? groupe
