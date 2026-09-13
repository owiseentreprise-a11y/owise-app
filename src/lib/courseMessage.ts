import { TYPE_VEHICULE_LABEL, type TypeVehicule } from './types'

export type InfosCourseParams = {
  ref: string
  adresseDepart: string
  adresseArrivee: string
  datePrevue: string
  nbPassagers: number
  typeVehicule: TypeVehicule
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
  const date = new Date(p.datePrevue)
  const dateStr = date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
  const heureStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

  const lignes = [
    `Course OWISE #${p.ref}`,
    '',
    `Départ : ${p.adresseDepart}`,
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
