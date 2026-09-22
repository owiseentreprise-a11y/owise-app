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

/** « 04:15 » — toujours en heure de Paris, quelle que soit la machine. */
export function heureCourse(valeur: string | Date): string {
  return new Date(valeur).toLocaleTimeString('fr-FR', {
    timeZone: FUSEAU, hour: '2-digit', minute: '2-digit',
  })
}

/** « mardi 22 septembre 2026 » — toujours en heure de Paris. */
export function dateCourse(
  valeur: string | Date,
  options: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
): string {
  return new Date(valeur).toLocaleDateString('fr-FR', { timeZone: FUSEAU, ...options })
}

/** « 22/09/2026 04:15 ». */
export function dateHeureCourse(
  valeur: string | Date,
  options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return `${dateCourse(valeur, options)} ${heureCourse(valeur)}`
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
  }).formatToParts(new Date(valeur))
  const v = (t: string) => Number(parts.find(p => p.type === t)!.value)
  return new Date(v('year'), v('month') - 1, v('day'), v('hour') % 24, v('minute'), v('second'))
}

/**
 * Nom court de `heureMuraleParis`, utilisé par les écrans.
 * Les deux interdits ci-dessus s'appliquent.
 */
export const lireHeureCourse = heureMuraleParis
