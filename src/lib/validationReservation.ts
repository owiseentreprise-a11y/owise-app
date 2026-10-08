/**
 * La seule porte de verification d'une reservation.
 *
 * Utilisee par le formulaire — pour prevenir le client tout de suite — ET par
 * l'action serveur, qui est la vraie barriere : le formulaire peut etre
 * contourne, et jusqu'au 2026-10-08 le serveur ne verifiait RIEN d'autre que
 * le prix. Un client pouvait payer sans telephone, avec un e-mail sans point,
 * ou pour une date deja passee.
 *
 * Ce que ca a donne, constate le 2026-10-08 sur les deux seules reservations
 * en ligne encaissees :
 *   « 016233005065 »  — 12 chiffres, incomposable tel quel
 *   « 2142932755 »    — 10 chiffres sans indicatif
 * Deux accueils a l'aeroport, et aucun numero utilisable si le chauffeur ne
 * trouve pas son client.
 *
 * Principe sur le telephone : on normalise ce qui est certain, et on REFUSE
 * ce qui est ambigu en demandant le format international. Deviner un
 * indicatif pays, c'est enregistrer un numero faux avec l'air d'etre juste.
 */
import { instantDepuisSaisieParis } from './heure'

export type ChampsReservation = {
  nom?: string
  prenom?: string
  email?: string
  telephone?: string
  date_prevue?: string
  adresse_depart?: string
  adresse_arrivee?: string
  /** Le type de la zone de depart, lu en base : « aeroport », « gare »… */
  type_zone_depart?: string | null
  /** Numero de vol ou de train, ou a defaut la provenance. */
  num_vol_train?: string
  /** Heure d'atterrissage ou d'arrivee en gare, au format HH:MM. */
  heure_arrivee_vol?: string
}

export type Verdict =
  | { ok: true; telephone: string }
  | { ok: false; champ: keyof ChampsReservation; erreur: string }

const refus = (champ: keyof ChampsReservation, erreur: string): Verdict => ({ ok: false, champ, erreur })

/**
 * Ramene un numero a sa forme internationale, ou rend null si c'est ambigu.
 *
 * Les cas traites, du plus sur au moins sur :
 *   +33612345678 / 0033612345678  -> deja international
 *   06 12 34 56 78                -> francais a 10 chiffres commencant par 0
 *   0 1 623 300 5065              -> un 0 d'habitude devant un numero etranger
 * Tout le reste est refuse.
 */
export function normaliserTelephone(valeur: string | null | undefined): string | null {
  const brut = String(valeur ?? '').replace(/[\s.\-()\/]/g, '')
  if (!brut) return null
  if (!/^[+0-9]+$/.test(brut)) return null

  if (brut.startsWith('+')) {
    const chiffres = brut.slice(1)
    return /^[1-9][0-9]{7,14}$/.test(chiffres) ? `+${chiffres}` : null
  }

  if (brut.startsWith('00')) {
    const chiffres = brut.slice(2)
    return /^[1-9][0-9]{7,14}$/.test(chiffres) ? `+${chiffres}` : null
  }

  // Numero francais : 10 chiffres, commence par 0 puis 1 a 9.
  if (/^0[1-9][0-9]{8}$/.test(brut)) return `+33${brut.slice(1)}`

  /* Un 0 colle devant un numero deja international. « 016233005065 » devient
   * « 16233005065 », soit +1 623 300 5065 — l'indicatif 623 est bien celui de
   * l'Arizona, ou reside le client concerne. On n'accepte ce cas que si ce qui
   * reste est un numero international plausible. */
  if (/^0[1-9][0-9]{9,13}$/.test(brut)) {
    const reste = brut.slice(1)
    return /^[1-9][0-9]{9,13}$/.test(reste) ? `+${reste}` : null
  }

  // 10 chiffres sans indicatif et sans 0 initial : impossible de savoir d'ou.
  return null
}

/**
 * La prise en charge se fait-elle dans un aeroport ou une gare ?
 *
 * Le type de zone, lu en base, fait foi. Le libelle n'est utilise QUE pour les
 * aeroports, ou il est sans ambiguite — « aeroport », « CDG », « Orly »,
 * « Beauvais-Tille ». On ne cherche surtout pas le mot « gare » dans une
 * adresse : « 12 rue de la Gare » a Senlis est une adresse de particulier, et
 * exiger un numero de vol l'empecherait de reserver.
 *
 * Meme famille de piege que detectZone, ou « Place de la Bastille » etait lue
 * comme un depart de Beauvais-Tille parce que « bastille » contient « tille ».
 */
const RE_AEROPORT = /a[ée]roport|\bcdg\b|\borly\b|roissy[- ]charles|beauvais[- ]till[ée]|le bourget/i

export function priseEnChargeAeroportOuGare(
  adresse: string | null | undefined,
  typeZone?: string | null,
): boolean {
  if (typeZone === 'aeroport' || typeZone === 'gare') return true
  return RE_AEROPORT.test(String(adresse ?? ''))
}

/** Un e-mail doit au moins avoir un nom, un arobase, un domaine et une extension. */
const EMAIL = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/

/**
 * @param maintenant injectable pour que les tests ne dependent pas de l'heure.
 */
export function verifierReservation(d: ChampsReservation, maintenant: Date = new Date()): Verdict {
  const nom = String(d.nom ?? '').trim()
  const prenom = String(d.prenom ?? '').trim()
  const email = String(d.email ?? '').trim()

  if (nom.length < 2) return refus('nom', 'Merci d’indiquer votre nom.')
  if (prenom.length < 2) return refus('prenom', 'Merci d’indiquer votre prénom.')
  if (!EMAIL.test(email)) return refus('email', 'Cette adresse e-mail semble incomplète.')

  const telephone = normaliserTelephone(d.telephone)
  if (!telephone) {
    return refus('telephone',
      'Merci d’indiquer un téléphone joignable, avec l’indicatif du pays — par exemple +33 6 12 34 56 78 ou +1 623 300 5065. Votre chauffeur en a besoin le jour du trajet.')
  }

  if (!String(d.adresse_depart ?? '').trim()) return refus('adresse_depart', 'Adresse de départ requise.')
  if (!String(d.adresse_arrivee ?? '').trim()) return refus('adresse_arrivee', 'Adresse d’arrivée requise.')

  const saisie = String(d.date_prevue ?? '').trim()
  if (!saisie) return refus('date_prevue', 'Date et heure requises.')

  /* La saisie est une heure de Paris, jamais un instant : la comparer
   * directement donnerait deux resultats selon la machine. */
  const quand = instantDepuisSaisieParis(saisie)
  if (isNaN(quand.getTime())) return refus('date_prevue', 'Date et heure invalides.')
  if (quand.getTime() <= maintenant.getTime()) {
    return refus('date_prevue', 'Cette date est déjà passée. Merci de choisir un horaire à venir.')
  }

  /* Depart d'un aeroport ou d'une gare : sans le vol et son heure, un retard
   * n'est pas vu et le chauffeur repart. Les deux seules reservations en ligne
   * encaissees avant cette regle etaient justement deux accueils a CDG, sans
   * aucune de ces informations. On accepte la PROVENANCE a defaut du numero :
   * « Reykjavik », « TGV depuis Lyon » valent mieux que rien. */
  if (priseEnChargeAeroportOuGare(d.adresse_depart, d.type_zone_depart)) {
    const vol = String(d.num_vol_train ?? '').trim()
    if (vol.length < 2) {
      return refus('num_vol_train',
        'Merci d’indiquer votre numéro de vol ou de train — ou, à défaut, votre ville de provenance. Votre chauffeur suit votre arrivée et vous attend en cas de retard.')
    }
    const heure = String(d.heure_arrivee_vol ?? '').trim()
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) {
      return refus('heure_arrivee_vol', 'Merci d’indiquer l’heure d’arrivée de votre vol ou de votre train.')
    }
  }

  return { ok: true, telephone }
}
