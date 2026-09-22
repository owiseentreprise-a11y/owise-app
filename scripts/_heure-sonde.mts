/** Affiche l'heure d'une course telle que la verrait cette machine. Usage interne. */
import { heureCourse, dateCourse } from '../src/lib/heure'
const [, , valeur] = process.argv
console.log(JSON.stringify({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, heure: heureCourse(valeur), date: dateCourse(valeur) }))
