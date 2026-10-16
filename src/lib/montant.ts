/**
 * L'écriture française d'une somme d'argent. Une seule définition, pour tout
 * le projet.
 *
 * En français, deux cent quarante-trois euros s'écrivent « 243,00 € », avec une
 * virgule. `Number.toFixed(2)` rend « 243.00 », avec un point : c'est
 * l'écriture anglaise, et elle est fautive sur un document, un écran ou un
 * e-mail destinés à un client français.
 *
 * POURQUOI CE FICHIER EXISTE, SÉPARÉ DE `facture-document.ts`
 *
 * Ces deux fonctions vivaient dans `facture-document.ts` depuis le 2026-09-20,
 * jour où l'on avait trouvé « 59,00 € » sur la page admin et « 59.00 € » sur la
 * copie remise au client. Mais `facture-document.ts` importe
 * `createAdminClient`, qui porte la clé de service : l'importer depuis un
 * composant qui tourne dans le navigateur — la vitrine, le portail
 * sous-traitant, les écrans d'administration — y embarquerait du code serveur.
 *
 * Ce module-ci n'importe rien. Il peut donc être appelé des deux côtés, et
 * `facture-document.ts` le réexporte pour que rien ne change pour ceux qui
 * l'importaient déjà. Il n'existe toujours qu'UNE écriture d'un montant dans
 * le projet.
 *
 * (Mesuré le 2026-10-15 : 32 montants du projet étaient encore écrits avec un
 * point, dont le sujet d'une relance partie le matin même à un vrai client —
 * « [Relance] Facture OW-202609-0001 – 343.00 € en retard ».
 * `test-format-montants.mjs` en tient la liste et refuse d'en laisser revenir.)
 */

/** « 1234.5 » → « 1 234,50 ». Deux décimales toujours, séparateur français. */
export function formaterNombre(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** « 1234.5 » → « 1 234,50 € ». Une valeur absente s'écrit « — », jamais « 0,00 € ». */
export function formaterMontant(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${formaterNombre(Number(v))} €`
}
