/**
 * conservation.ts — combien de temps on garde quoi.
 *
 * Une durée de conservation est annoncée aux visiteurs dans les mentions
 * légales ET appliquée par une tâche planifiée. Si les deux divergent, la
 * page ment. Elles lisent donc la même constante, et
 * `scripts/test-detail-visiteur.mts` vérifie que le texte publié porte bien
 * ce nombre.
 *
 * Module volontairement sans aucun import : lu depuis une route serveur, un
 * composant client et un contrôle.
 */

/**
 * Détail nominatif d'une simulation de prix : adresses exactes saisies,
 * référent, UTM. Au-delà, `/api/cron/purge-estimations` les efface, en
 * conservant la statistique anonyme (commune, zone, véhicule, prix).
 */
export const MOIS_CONSERVATION_SIMULATIONS = 12
