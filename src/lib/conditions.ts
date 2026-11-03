/**
 * Les conditions d'annulation et d'attente — écrites ici, et nulle part ailleurs.
 *
 * Pourquoi ce fichier existe
 * ──────────────────────────
 * Le 2026-11-03, un inventaire a trouvé **trois** politiques d'annulation
 * vivantes en même temps :
 *
 *  - le cahier des charges §4.7 : 24 h / 4 h, 0 % / 50 % / 100 % ;
 *  - les CGV publiées et toutes les pages du site : avant attribution du
 *    chauffeur, puis 3 € sous dix minutes, 8 € au-delà ;
 *  - le devis, où une quatrième règle venait d'être ajoutée.
 *
 * La deuxième n'était pas faite pour ce métier : c'est une politique de VTC
 * à la demande, où le chauffeur est attribué en quelques secondes. Chez
 * Owise une course se réserve des semaines à l'avance, et le dédommagement
 * plafonnait à 8 € — y compris sur une course à 1 234 € annulée une heure
 * avant.
 *
 * Décision de l'exploitant, 2026-11-03 : **le cahier des charges fait foi**,
 * pour l'annulation comme pour l'attente. Ce fichier le transcrit.
 *
 * Il est **pur** — aucun import en dehors de `montant.ts`, lui-même pur —
 * pour qu'un composant client puisse le lire comme le serveur.
 *
 * Toute surface qui annonce ces règles doit les lire ici.
 * `node test-conditions.mjs` échoue si l'une d'elles diverge.
 */
import { formaterMontant } from '@/lib/montant'

// ── Annulation ──────────────────────────────────────────────────────────────

/** Les paliers, du plus lointain au plus proche. Cahier des charges §4.7. */
export const PALIERS_ANNULATION: { delai: string; penalite: string }[] = [
  { delai: 'Plus de 24 h avant la course',  penalite: 'Gratuit' },
  { delai: 'Entre 24 h et 4 h avant',       penalite: '50 % du montant' },
  { delai: 'Moins de 4 h avant',            penalite: '100 % du montant' },
  /* Le cahier des charges ne traite pas le no-show. Il est aligné sur le
     dernier palier : un passager absent alors que le chauffeur est sur
     place, c'est une annulation à l'instant de la course. */
  { delai: 'Passager absent, chauffeur sur place', penalite: '100 % du montant' },
]

/** Une ligne, pour un bouton ou une accroche. */
export const ANNULATION_COURTE = 'Annulation gratuite jusqu à 24 h avant la course'

/** La phrase complète, pour une FAQ. */
export const ANNULATION_PHRASE =
  "L'annulation est gratuite jusqu'à 24 heures avant la course. "
  + "Entre 24 heures et 4 heures avant, 50 % du montant reste dû. "
  + "Moins de 4 heures avant, ou si le passager est absent alors que le "
  + "chauffeur s'est présenté, la totalité est due. "
  + "Le détail figure dans nos mentions légales."

/** Une seule ligne, pour le bas d'un devis. */
export const ANNULATION_MENTION =
  "Annulation — gratuite jusqu'à 24 h avant la course ; "
  + "50 % du montant entre 24 h et 4 h avant ; "
  + "100 % moins de 4 h avant ou en cas d'absence du passager."

// ── Temps d'attente ─────────────────────────────────────────────────────────

/**
 * Cahier des charges §4.6 pour la berline, decision de l'exploitant du
 * 2026-11-03 pour les gros vehicules.
 *
 * Immobiliser un van ou une berline Premium coute plus cher qu'une berline :
 * ces deux categories passent a un tarif horaire, a l'heure entamee.
 */
export const ATTENTE_OFFERTE_MIN = 15
export const ATTENTE_PRIX_MINUTE = 0.5   // berline
export const ATTENTE_PRIX_HEURE  = 70    // van, grand van, berline Premium

/**
 * Le vehicule releve-t-il du tarif horaire d'attente ?
 *
 * Le critere, donne par l'exploitant le 2026-11-03 : **tout ce qui depasse
 * quatre places** — van, minibus, grand van, de 5 a 8 places — **plus la
 * berline executive (Premium)**, qui n'a que 1 a 4 places mais se loue plus
 * cher. La berline ordinaire reste au tarif a la minute.
 *
 * Le libelle est saisi en texte libre sur un devis : les valeurs reellement
 * rencontrees en base sont « 1 berline », « 1 berline Premium », « 1 van »,
 * « 1 van + 1 berline », « Berline ». La fonction accepte aussi les cles de
 * la base — `van`, `grand_van`, `berline_premium`.
 *
 * Une ligne qui melange deux vehicules suit le plus gros : c'est lui qu'on
 * immobilise.
 */
export function attenteAuTarifHoraire(libelleVehicule: string): boolean {
  return /van|minibus|premium|ex[eé]cutiv/i.test(libelleVehicule ?? '')
}

export const ATTENTE_PHRASE =
  `Les ${ATTENTE_OFFERTE_MIN} premières minutes d'attente sont offertes sur `
  + `chaque prise en charge. Au-delà, l'attente est facturée `
  + `${formaterMontant(ATTENTE_PRIX_MINUTE)} par minute entamée en berline, et `
  + `${formaterMontant(ATTENTE_PRIX_HEURE)} par heure entamée en van ou en berline Premium.`

/** Une seule ligne, pour le bas d'un devis. */
export const ATTENTE_MENTION =
  `Temps d'attente — ${ATTENTE_OFFERTE_MIN} minutes offertes sur chaque prise en charge. `
  + `Au-delà : ${formaterMontant(ATTENTE_PRIX_MINUTE)} par minute entamée en berline, `
  + `${formaterMontant(ATTENTE_PRIX_HEURE)} par heure entamée en van ou en berline Premium. `
  + `Ces frais ne sont pas compris dans le montant indiqué : ils ne s'appliquent `
  + `que s'ils sont constatés, et figureront alors sur la facture.`

/**
 * Ce que coûte une attente, en euros.
 *
 * Exposé pour que le calcul d'une facture et l'annonce faite au client
 * viennent du même endroit — c'est la divergence qu'on vient de corriger.
 */
export function coutAttente(minutes: number, libelleVehicule = ''): number {
  const dues = Math.max(0, Math.ceil(minutes) - ATTENTE_OFFERTE_MIN)
  if (dues === 0) return 0
  return attenteAuTarifHoraire(libelleVehicule)
    ? Math.ceil(dues / 60) * ATTENTE_PRIX_HEURE
    : Math.round(dues * ATTENTE_PRIX_MINUTE * 100) / 100
}

/**
 * Ce que coûte une annulation, en euros.
 *
 * `heuresAvant` est le délai entre l'annulation et l'heure de la course.
 */
export function coutAnnulation(montantCourse: number, heuresAvant: number): number {
  if (heuresAvant >= 24) return 0
  if (heuresAvant >= 4) return Math.round(montantCourse * 50) / 100
  return montantCourse
}
