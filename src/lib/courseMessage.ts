import { dateCourse, heureCourse } from '@/lib/heure'
import { TYPE_VEHICULE_LABEL, type TypeVehicule } from './types'

export type InfosCourseParams = {
  ref: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  nbPassagers: number
  typeVehicule: TypeVehicule
  /** Arrêts intermédiaires, dans l'ordre du trajet. */
  etapes?: string[] | null
  numVolTrain?: string | null
  terminal?: string | null
  heureArriveeVol?: string | null
  passagerNom?: string | null
  passagerTel?: string | null
  notes?: string | null
  paiementABord: boolean
  prix?: number | null
}

// Message texte (WhatsApp) — le prix n'apparaît que si le paiement est à
// bord (paiementABord), sinon le chauffeur externe n'a pas besoin de le
// connaître.
export function buildInfosCourseTexte(p: InfosCourseParams): string {
  // Lecture par @/lib/heure : ce message part parfois d'un poste et parfois du
  // serveur, et l'heure doit etre la meme dans les deux cas.
  const dateStr = dateCourse(p.datePrevue, { weekday: 'long', day: 'numeric', month: 'long' })
  const heureStr = heureCourse(p.datePrevue)

  // Les étapes s'intercalent entre le départ et l'arrivée, dans l'ordre du
  // trajet. Elles n'y figuraient pas : un arrêt ajouté après coup n'apparaissait
  // que dans l'application chauffeur, jamais dans le message envoyé à un
  // chauffeur externe ou à un sous-traitant, qui partait donc sans le savoir.
  const etapes = (p.etapes ?? []).filter(e => e?.trim())

  const lignes = [
    `Course OWISE #${p.ref}`,
    '',
    `Départ : ${p.adresseDepart}`,
    ...etapes.map((e, i) => `Étape ${i + 1} : ${e}`),
    `Arrivée : ${p.adresseArrivee}`,
    `Date : ${dateStr} à ${heureStr}`,
    `Passagers : ${p.nbPassagers}`,
    `Véhicule : ${TYPE_VEHICULE_LABEL[p.typeVehicule]}`,
  ]

  if (p.numVolTrain) {
    lignes.push(`Vol/Train : ${p.numVolTrain}${p.terminal ? ` — ${p.terminal}` : ''}${p.heureArriveeVol ? ` — ${p.heureArriveeVol}` : ''}`)
  }
  if (p.passagerNom) {
    lignes.push(`Client : ${p.passagerNom}${p.passagerTel ? ` — ${p.passagerTel}` : ''}`)
  }
  if (p.paiementABord && p.prix != null) {
    lignes.push(`Montant à percevoir (paiement à bord) : ${p.prix.toFixed(2)} €`)
  }
  if (p.notes) {
    lignes.push(`Notes : ${p.notes}`)
  }

  return lignes.join('\n')
}
