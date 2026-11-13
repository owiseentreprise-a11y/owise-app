/**
 * La mise à disposition : un chauffeur et un véhicule réservés à l'heure.
 *
 * POURQUOI CE SERVICE EXISTE SUR LE SITE
 * ──────────────────────────────────────
 * Mesure Search Console du 2026-11-12 : la recherche « private chauffeur in
 * paris for a full day, how much » montrait owise.fr 29 fois en huit
 * semaines, en **position 9,4** — page 1 — et récoltait **zéro clic**. Des
 * gens demandaient le prix d'une journée de chauffeur, Google proposait
 * Owise, et le site n'avait rien à répondre : une seule phrase, en bas de
 * `/en/private-chauffeur-paris`, invitait à écrire un e-mail.
 *
 * C'est aussi, en pratique, ce que SKORP Production a acheté le 2026-10-07 :
 * cinq courses le même jour, 1 090 €, soit 63 % du chiffre d'octobre. Une
 * journée de tournage, pas cinq transferts.
 *
 * CE QUE CE FICHIER CONTIENT, ET CE QU'IL NE CONTIENT PAS
 * ───────────────────────────────────────────────────────
 * Ici : les MOTS, en français et en anglais, et les durées proposées.
 * Ailleurs : les PRIX, qui vivent dans la table `tarifs`, colonne
 * `prix_heure`, réglables depuis /admin/tarifs ; et le CALCUL, qui vit dans
 * `calcPrix.ts` avec les autres règles de prix (`prixMiseADisposition`).
 *
 * Trois endroits, trois natures différentes. Les mélanger, c'est se
 * retrouver avec deux vérités — ce projet l'a déjà payé trois fois.
 *
 * CE MODULE EST PUR : aucun import. Il s'appelle donc depuis le serveur
 * comme depuis le navigateur, sans risque d'embarquer une clé de service —
 * la règle tirée de l'incident du 2026-11-03.
 */

/**
 * Durées proposées au client, en heures.
 *
 * Elles commencent à 3 h : c'est l'entrée la plus courante des maisons
 * parisiennes (Chabé démarre même à 5 h), et la décision de l'exploitant du
 * 2026-11-13. `DUREE_MIN_MAD`, dans `calcPrix.ts`, porte la même valeur et
 * fait foi pour le calcul ; `scripts/` vérifie que les deux concordent.
 */
export const DUREES_PROPOSEES = [3, 4, 5, 6, 8, 10, 12] as const

/** Au-delà de cette durée, le site renvoie vers une demande de devis. */
export const DUREE_MAX_EN_LIGNE = 12

/**
 * « Toute heure entamée est due. »
 *
 * Règle de l'exploitant, 2026-11-12. Elle doit être LUE par le client avant
 * qu'il réserve, pas découverte sur la facture : c'est la différence entre
 * une règle et une mauvaise surprise. Le calcul correspondant est
 * `heuresFacturees()` dans `calcPrix.ts`.
 */
export const HEURE_ENTAMEE = 'Toute heure entamée est due.'
export const HEURE_ENTAMEE_EN = 'Any hour started is charged in full.'

/**
 * « Sous réserve de disponibilité. »
 *
 * Règle de l'exploitant, 2026-11-13. Elle vaut pour TOUS les véhicules, y
 * compris ceux dont le prix horaire est affiché : un prix annoncé n'est pas
 * une place réservée. Elle doit apparaître partout où un tarif horaire est
 * montré — c'est la raison d'être de ce fichier plutôt que d'une phrase
 * recopiée sur chaque page.
 */
export const SOUS_RESERVE = 'Tarifs proposés sous réserve de disponibilité.'
export const SOUS_RESERVE_EN = 'Rates offered subject to availability.'

/**
 * « 80 km compris, au-delà 2,00 € du kilomètre. »
 *
 * La limite doit être LUE avant la réservation, pas découverte à la
 * facturation. Elle se construit ici pour que les deux pages, française et
 * anglaise, disent exactement la même chose — et pour qu'ajouter une langue
 * n'oblige pas à retrouver la phrase dans un composant.
 */
export function phraseKilometres(
  kmInclus: number, prixKmSup: number | null, montant: (n: number) => string, en = false,
): string {
  if (en) {
    return prixKmSup == null
      ? `${kmInclus} km included.`
      : `${kmInclus} km included, then ${montant(prixKmSup)} per extra kilometre.`
  }
  return prixKmSup == null
    ? `${kmInclus} km compris.`
    : `${kmInclus} km compris, puis ${montant(prixKmSup)} du kilomètre au-delà.`
}

/**
 * « La prestation se termine dans la zone où elle a commencé. »
 *
 * Règle reprise de Blacklane, validée le 2026-11-13 : elle remplace tout
 * rayon kilométrique. Une seule limite — le forfait de kilomètres — au lieu
 * de deux géographies à maintenir. Si la course finit ailleurs, ce n'est
 * plus une mise à disposition mais un transfert, qui a déjà son tarif.
 */
export const MEME_ZONE =
  'La prestation se termine dans la zone où elle a commencé ; sinon il s’agit '
  + 'd’un transfert, qui a son propre tarif.'

export const MEME_ZONE_EN =
  'The booking ends in the area where it started; otherwise it is a transfer, '
  + 'which has its own fare.'

/** Ce qui reste à la charge du client, comme partout sur le marché. */
export const FRAIS_EN_SUS =
  'Péages et stationnement ne sont pas compris : ils sont refacturés au réel.'

export const FRAIS_EN_SUS_EN =
  'Tolls and parking are not included: they are re-invoiced at cost.'

/** La phrase complète, celle qui accompagne la grille de prix. */
export const MENTION_TARIFS =
  `${SOUS_RESERVE} ${HEURE_ENTAMEE} Le prix couvre le chauffeur et le véhicule `
  + `mis à votre disposition pour la durée convenue.`

export const MENTION_TARIFS_EN =
  `${SOUS_RESERVE_EN} ${HEURE_ENTAMEE_EN} The price covers the driver and the `
  + `vehicle placed at your disposal for the agreed duration.`

/** Ce que le service est, dit en une phrase. */
export const DEFINITION =
  'Un chauffeur et un véhicule réservés pour une durée, pas pour un trajet : '
  + 'vous décidez du programme au fur et à mesure, le chauffeur reste avec vous.'

export const DEFINITION_EN =
  'A driver and a vehicle booked for a duration, not for a route: you decide '
  + 'where to go as the day unfolds, and the driver stays with you.'

/** Les occasions où ce service a un sens, telles qu'elles se présentent. */
export const USAGES = [
  'Journée de tournage ou de production',
  'Rendez-vous d’affaires en chaîne dans la journée',
  'Mariage, cérémonie, événement familial',
  'Visite de Paris et de l’Île-de-France à votre rythme',
  'Déplacement d’un dirigeant ou d’une délégation',
] as const

export const USAGES_EN = [
  'A filming or production day',
  'Several business meetings in a single day',
  'Weddings, ceremonies, family events',
  'Discovering Paris and the Île-de-France at your own pace',
  'An executive or a delegation on the move',
] as const

/** « 4 h » — la durée telle qu'on l'écrit partout. */
export function libelleDuree(heures: number, en = false): string {
  if (!Number.isFinite(heures) || heures <= 0) return '—'
  return en ? `${heures} h` : `${heures} h`
}

/**
 * Le texte qui part dans la demande, à la place d'une adresse d'arrivée.
 *
 * `soumettreDevis` attend une destination : une mise à disposition n'en a
 * pas. On y écrit donc la durée, de sorte que la ligne reste lisible telle
 * quelle dans « Demandes reçues », sans qu'aucun écran d'administration ait
 * à connaître ce service.
 */
export function destinationPourDemande(heures: number): string {
  return `Mise à disposition — ${libelleDuree(heures)}`
}

/** Reconnaît une demande de mise à disposition parmi les autres. */
export const MARQUEUR_DEMANDE = 'Mise à disposition —'
