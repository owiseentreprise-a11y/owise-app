/**
 * La seule porte entre le vocabulaire de l'application et celui de la base.
 *
 * L'application dit `van` et `grand_van`. La base n'accepte que `van_7` et
 * `grand_van_8` — c'est un type enum Postgres, pas du texte libre. Les deux
 * vocabulaires n'ont jamais correspondu.
 *
 * Consequence reelle, constatee le 2026-10-07 : deux clients ont paye 89 EUR
 * chacun (6 et 7 octobre) pour un van. Stripe a encaisse, le site a cree leur
 * compte, puis l'ecriture de la course a ete refusee —
 * « invalid input value for enum type_vehicule: "van" ». L'erreur etait
 * attrapee et seulement journalisee : le client n'a rien recu, aucune course
 * n'existait, et personne n'a ete alerte. Seules les reservations en berline
 * aboutissaient, ce qui a masque le defaut pendant des mois.
 *
 * Regle : aucune ecriture de `type_vehicule` en base sans passer par
 * `vehiculePourBase()`. `scripts/test-vehicule.mts` verifie les deux choses —
 * que la traduction est juste, et qu'aucun fichier n'ecrit la colonne sans
 * cette fonction.
 */

import { GAMME, NOM_PAR_BASE } from './gamme'

/** Les valeurs que la base accepte, relevees dans l'enum public.type_vehicule. */
export const VEHICULES_BASE = ['berline', 'berline_premium', 'van_7', 'grand_van_8'] as const
export type VehiculeBase = typeof VEHICULES_BASE[number]

/**
 * Le vocabulaire de l'application, tel qu'il circule dans les formulaires, les
 * metadonnees Stripe et `calcPrix.ts`.
 *
 * Construit depuis `GAMME` et non ecrit a la main : ajouter un vehicule a la
 * gamme suffit desormais pour qu'il soit traduisible. Chaque valeur de base est
 * aussi acceptee telle quelle, pour que `van_7` relu depuis la base retraverse
 * la fonction sans encombre.
 */
const TRADUCTION: Record<string, VehiculeBase> = Object.fromEntries(
  GAMME.flatMap(v => [
    [v.cle, v.valeurBase as VehiculeBase],
    [v.valeurBase, v.valeurBase as VehiculeBase],
  ]),
)

/**
 * La gamme et l'enum de la base disent-ils la meme chose ?
 *
 * `VEHICULES_BASE` est un releve de l'enum Postgres ; `GAMME` est la gamme
 * commerciale. Si quelqu'un ajoute un vehicule a la gamme sans etendre l'enum,
 * l'ecriture echouera en production sur une valeur que le code croyait valide —
 * exactement la panne d'octobre. Mieux vaut le savoir au chargement du module.
 */
for (const v of GAMME) {
  if (!(VEHICULES_BASE as readonly string[]).includes(v.valeurBase)) {
    throw new Error(
      `Le vehicule « ${v.nom} » declare valeurBase = « ${v.valeurBase} », absente de l'enum `
      + `public.type_vehicule (${VEHICULES_BASE.join(', ')}). Ajouter la valeur a l'enum avant la gamme.`,
    )
  }
}

/**
 * Traduit une valeur de l'application vers l'enum de la base.
 *
 * Leve sur une valeur inconnue plutot que de retomber sur « berline » : une
 * reservation de van enregistree en berline enverrait le mauvais vehicule
 * chercher le client, et personne ne s'en apercevrait avant le jour J.
 */
export function vehiculePourBase(valeur: string | null | undefined): VehiculeBase {
  const cle = String(valeur ?? '').trim().toLowerCase()
  const trad = TRADUCTION[cle]
  if (!trad) {
    throw new Error(
      `Type de vehicule inconnu : « ${valeur} ». Valeurs acceptees : ${Object.keys(TRADUCTION).join(', ')}.`,
    )
  }
  return trad
}

/**
 * Le libelle montre au client et au chauffeur — celui de `GAMME`, pas une
 * deuxieme ecriture.
 *
 * Il y avait quatre orthographes du Grand Van dans le projet. Un client lisait
 * « Grand Van » dans sa demande de devis et « Grand Van 8 places » sur sa
 * confirmation.
 */
const LIBELLES: Record<string, string> = NOM_PAR_BASE

export function libelleVehicule(valeur: string | null | undefined): string {
  try {
    return LIBELLES[vehiculePourBase(valeur)]
  } catch {
    return String(valeur ?? '—')
  }
}
