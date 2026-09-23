/** Sonde : ce que cette machine calcule pour une saisie parisienne. Usage interne. */
import { instantDepuisSaisieParis, heureCourse, dateCourse, heureMuraleParis, jourParis, pourChampSaisie } from '../src/lib/heure'
const saisie = process.argv[2]
const instant = instantDepuisSaisieParis(saisie)
console.log(JSON.stringify({
  tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
  stocke: instant.toISOString(),
  heure: heureCourse(instant),
  date: dateCourse(instant),
  murale: heureMuraleParis(instant).getHours() + 'h' + String(heureMuraleParis(instant).getMinutes()).padStart(2, '0'),
  jour: jourParis(instant),
  champ: pourChampSaisie(instant),
}))
