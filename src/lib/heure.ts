/**
 * Heure d'une course : une seule lecture, la même partout.
 *
 * `courses.date_prevue` contient l'heure française telle que l'exploitant l'a
 * tapée — mais Postgres la range avec un suffixe « +00:00 » qui la fait passer
 * pour une heure universelle. Ce suffixe est faux : 04:15 saisi à Paris est
 * enregistré « 04:15 UTC », alors que l'instant réel est 02:15 UTC.
 *
 * Conséquence, avant ce fichier : `new Date(valeur).toLocaleTimeString()`
 * donnait 04:15 sur le serveur Vercel (réglé en heure universelle) et 06:15
 * dans un navigateur français. Deux heures d'écart selon l'écran.
 *
 * Dégât réel, le 2026-09-19 : Mme Ménagé, attendue à 04:15, a reçu une
 * confirmation annonçant 06:15 — parce que cet e-mail avait été généré depuis
 * un poste réglé à l'heure de Paris et non depuis le serveur. Elle a dû
 * téléphoner la veille pour faire corriger. Son retour du 25 lui a été annoncé
 * à 22:15 au lieu de 20:15.
 *
 * Ces fonctions lisent la valeur comme une heure murale : elles retirent le
 * suffixe de fuseau avant de formater, et rendent donc le même résultat quel
 * que soit le fuseau de la machine.
 *
 * À n'utiliser que pour `date_prevue` et `date_retour`. Les vraies dates —
 * `created_at`, dates de facture — sont de véritables instants : les afficher
 * avec ces fonctions les décalerait.
 */

/** Lit une heure de course comme une heure murale, sans conversion de fuseau. */
export function lireHeureCourse(valeur: string | Date): Date {
  if (valeur instanceof Date) return valeur
  return new Date(String(valeur).replace(/([+-]\d{2}:\d{2}|Z)$/, ''))
}

/** « 04:15 » */
export function heureCourse(valeur: string | Date): string {
  return lireHeureCourse(valeur).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

/** « mardi 22 septembre 2026 », ou le format demandé. */
export function dateCourse(
  valeur: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
): string {
  return lireHeureCourse(valeur).toLocaleDateString('fr-FR', options)
}

/** « 22/09/2026 04:15 » — date et heure en une ligne. */
export function dateHeureCourse(
  valeur: string | Date,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return `${dateCourse(valeur, options)} ${heureCourse(valeur)}`
}
