/**
 * Heure d'une course : saisie à Paris, stockée en instant réel, affichée à Paris.
 *
 * L'exploitant saisit une heure française. Jusqu'au 2026-09-22, cette heure
 * était enregistrée telle quelle avec un suffixe « +00:00 » mensonger : 04:15
 * saisi à Paris devenait « 04:15 UTC », alors que l'instant réel est 02:15 UTC.
 * Selon l'endroit où le code tournait, l'affichage donnait 04:15 ou 06:15.
 *
 * Dégât réel : Mme Ménagé, attendue à 04:15, a reçu une confirmation annonçant
 * 06:15 et a dû téléphoner la veille pour faire corriger. Son retour lui était
 * annoncé à 22:15 au lieu de 20:15.
 *
 * Règle désormais, sans exception :
 *   - à l'écriture  : `instantDepuisSaisieParis()` convertit la saisie en instant réel ;
 *   - à la lecture  : `heureCourse()` / `dateCourse()` formatent en Europe/Paris.
 *
 * Le décalage est calculé à la date de la course, jamais supposé : +2 h en été,
 * +1 h en hiver, et correct le week-end du changement d'heure.
 */

const FUSEAU = 'Europe/Paris'

/** Décalage de Paris par rapport au temps universel, en minutes, à cet instant. */
function decalageParisMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSEAU, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instant)
  const v = (t: string) => Number(parts.find(p => p.type === t)!.value)
  const murale = Date.UTC(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second'))
  return (murale - Math.floor(instant.getTime() / 1000) * 1000) / 60000
}

/**
 * Convertit une heure saisie à Paris en instant réel.
 *
 * Accepte « 2026-09-22T04:15 », « 2026-09-22T04:15:00 », et tolère un suffixe
 * de fuseau déjà présent — qu'elle ignore, puisque la saisie est parisienne.
 *
 * Deux passes : la première estime le décalage, la seconde le corrige. C'est
 * nécessaire la nuit du changement d'heure, où le décalage dépend du résultat.
 */
export function instantDepuisSaisieParis(saisie: string | Date): Date {
  if (saisie instanceof Date) return saisie
  const brut = String(saisie).replace(/([+-]\d{2}:\d{2}|Z)$/, '')
  const m = brut.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/)
  if (!m) return new Date(saisie)
  const [A, M, J, h, min, s] = m.slice(1).map(x => Number(x ?? 0))
  const murale = Date.UTC(A, M - 1, J, h, min, s || 0)
  let instant = murale
  for (let i = 0; i < 2; i++) {
    instant = murale - decalageParisMinutes(new Date(instant)) * 60000
  }
  return new Date(instant)
}

/** La même chose, prête à être écrite en base. */
export function pourLaBase(saisie: string | Date): string {
  return instantDepuisSaisieParis(saisie).toISOString()
}

/**
 * Ramène n'importe quelle valeur à un instant réel, avant lecture.
 *
 * `new Date("2026-09-29T09:30")` — une date-heure **sans marqueur de fuseau** —
 * est lue par JavaScript dans le fuseau de la machine. Sur un poste parisien
 * elle donne 09:30 ; sur le serveur Vercel, qui tourne en temps universel, elle
 * donne 09:30 UTC, soit 11:30 à Paris. Le même e-mail annonce donc deux heures
 * différentes selon l'endroit d'où il part — et le défaut est **invisible en
 * développement**, ce qui l'a fait revenir cinq fois.
 *
 * Ici, une date-heure sans fuseau ne peut vouloir dire qu'une chose : une heure
 * saisie à Paris. On la convertit comme telle, au lieu de laisser la machine
 * deviner.
 *
 * Dégâts réels : Mme Ménagé attendue à 04:15 avertie pour 06:15, son retour de
 * 20:15 annoncé à 22:15, la course de M. Gylden du 29/09 à 09:30 annoncée à
 * 11:30 dans l'e-mail d'exploitation (#F9557D, 2026-09-27).
 */
function instantReel(valeur: string | Date): Date {
  if (valeur instanceof Date) return valeur
  const s = String(valeur)
  const aUneHeure = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)
  const aUnFuseau = /([+-]\d{2}:?\d{2}|Z)$/.test(s)
  // Une date seule (« 2026-09-29 ») est laissée à JavaScript, qui la lit à
  // minuit en temps universel — c'est le comportement attendu ailleurs.
  return aUneHeure && !aUnFuseau ? instantDepuisSaisieParis(s) : new Date(s)
}

/** « 04:15 » — toujours en heure de Paris, quelle que soit la machine. */
export function heureCourse(valeur: string | Date): string {
  return instantReel(valeur).toLocaleTimeString('fr-FR', {
    timeZone: FUSEAU, hour: '2-digit', minute: '2-digit',
  })
}

/** « mardi 22 septembre 2026 » — toujours en heure de Paris. */
export function dateCourse(
  valeur: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
): string {
  return instantReel(valeur).toLocaleDateString('fr-FR', { timeZone: FUSEAU, ...options })
}

/**
 * « 2026-09-25 » — le jour parisien d'un instant, pour regrouper et comparer.
 *
 * Découper la chaîne de la base (`date_prevue.slice(0, 10)`) donne le jour
 * **universel**, qui n'est pas le même en début de nuit : une arrivée à CDG le
 * 25 à 00:30 heure de Paris est enregistrée « 2026-09-24T22:30:00Z ». Elle
 * apparaissait donc au 24 dans l'agenda du sous-traitant et dans le compteur
 * « courses aujourd'hui », et basculait de mois dans les statistiques.
 */
export function jourParis(valeur: string | Date): string {
  const d = heureMuraleParis(valeur)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Le jour parisien en cours — jamais `new Date().toISOString().slice(0, 10)`. */
export function aujourdhuiParis(): string {
  return jourParis(new Date())
}

/**
 * Arithmétique de calendrier sur un jour « AAAA-MM-JJ ».
 * Passe par midi pour ne jamais tomber sur l'heure manquante du changement
 * d'heure, où minuit n'existe pas dans certains fuseaux.
 */
export function decalerJour(jour: string, nbJours: number): string {
  const d = new Date(`${jour}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + nbJours)
  return d.toISOString().slice(0, 10)
}

/** Le jour de la semaine d'un jour parisien : 0 = dimanche. */
export function jourDeLaSemaine(jour: string): number {
  return new Date(`${jour}T12:00:00Z`).getUTCDay()
}

/**
 * L'instant où commence un jour parisien, pour borner une requête.
 * `debutJourParis('2026-09-01')` vaut le 31 août à 22:00 en temps universel.
 */
export function debutJourParis(jour: string): Date {
  return instantDepuisSaisieParis(`${jour}T00:00`)
}

/**
 * Formatage libre d'un instant, toujours lu à Paris.
 *
 * Pour les écrans qui composent eux-mêmes leurs options (« 24 sept. 2026 »,
 * « 24/09 16:00 »…) plutôt que d'utiliser `heureCourse` / `dateCourse`.
 */
export function formaterAParis(
  valeur: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions,
  vide = '—',
): string {
  if (!valeur) return vide
  const d = instantReel(valeur)
  if (isNaN(d.getTime())) return vide
  return d.toLocaleString('fr-FR', { timeZone: FUSEAU, ...options })
}

/** « 22/09/2026 04:15 ». */
export function dateHeureCourse(
  valeur: string | Date,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return `${dateCourse(valeur, options)} ${heureCourse(valeur)}`
}

/**
 * « 2026-09-24T14:00 » — le format qu'attend un `<input type="datetime-local">`,
 * rempli avec l'heure de Paris.
 *
 * Indispensable : un champ pré-rempli avec la chaîne brute de la base affiche
 * l'heure universelle. L'exploitant la voit décalée, la « corrige », et sa
 * correction décale la course pour de bon.
 *
 * Dégât réel, 2026-09-23 : le retour de Mme Bouchard, prévu à 14:00, est passé
 * à 16:00 après un simple changement d'année dans ce formulaire.
 */
export function pourChampSaisie(valeur: string | Date): string {
  const d = heureMuraleParis(valeur)
  if (isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/**
 * Un objet Date dont les composantes locales valent l'heure parisienne.
 *
 * C'est la fonction qu'utilisent les écrans : `getHours()`, `toDateString()`,
 * `toLocaleTimeString()` sur son résultat donnent l'heure de Paris, quelle que
 * soit la machine. Elle sert aussi au regroupement par jour et au tri, l'ordre
 * des heures murales étant celui des instants réels.
 *
 * Deux interdits :
 *   - ne jamais l'écrire en base — ce n'est pas l'instant réel ;
 *   - ne jamais comparer son `getTime()` à `Date.now()` — utiliser
 *     `new Date(valeur)` pour toute distance au moment présent.
 */
export function heureMuraleParis(valeur: string | Date): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSEAU, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(instantReel(valeur))
  const v = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return new Date(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second'))
}

/**
 * Nom court de `heureMuraleParis`, utilisé par les écrans.
 * Les deux interdits ci-dessus s'appliquent.
 */
export const lireHeureCourse = heureMuraleParis
