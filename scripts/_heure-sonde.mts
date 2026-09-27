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
  // Le point aveugle de tous les controles precedents : ce que donnent les
  // fonctions d'affichage quand on leur passe la SAISIE NUE, sans fuseau,
  // au lieu de l'instant converti. Sur un poste parisien c'est juste ; sur
  // le serveur Vercel, en temps universel, cela decale de deux heures.
  heureBrute: heureCourse(saisie),
  jourBrut: jourParis(saisie),
  champ: pourChampSaisie(instant),
}))
