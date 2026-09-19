/**
 * Faut-il montrer le montant au passager ?
 *
 * Un collaborateur réserve pour le compte de son entreprise : le prix est une
 * information commerciale entre Owise et l'entreprise, pas quelque chose qu'il
 * a à connaître. Un particulier paie lui-même et doit le voir.
 *
 * La colonne clients.afficher_prix laissée à NULL applique cette règle ; une
 * valeur explicite l'emporte, pour les cas particuliers (entreprise qui veut
 * la transparence, particulier qui réserve pour un tiers).
 */
export function afficherPrixPourClient(client: {
  type_compte?: string | null
  afficher_prix?: boolean | null
} | null | undefined): boolean {
  if (!client) return true
  if (typeof client.afficher_prix === 'boolean') return client.afficher_prix
  return client.type_compte !== 'entreprise'
}
