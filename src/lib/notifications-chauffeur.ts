/**
 * notifications-chauffeur.ts — UNE COURSE PASSÉE NE S'ANNONCE PLUS AU CHAUFFEUR.
 *
 * Fonction PURE, testée par `scripts/test-relances-devis.mts` (section
 * « chauffeur »).
 *
 * Défaut constaté le 2026-11-19 : le 18/11 à 16:52, un chauffeur a été
 * affecté à la course #30728B du 5 novembre — pour enregistrer qui l'avait
 * faite. Le site lui a envoyé « Course #30728B – jeudi 5 novembre 2026 à
 * 15:45 » et une notification « Nouvelle course », comme une mission à
 * venir. Même chose à la création d'une course déjà effectuée avec chauffeur
 * (celle de Mme Rivere du 16/11), alors que le CLIENT, lui, n'était déjà
 * plus prévenu dans ce cas.
 */
import { instantDepuisSaisieParis } from './heure'

/** Une course commencée depuis plus de 2 h n'est plus une mission à annoncer. */
export const MARGE_COURSE_PASSEE_MS = 2 * 60 * 60 * 1000

export function courseAAnnoncerAuChauffeur(
  course: { statut?: string | null; date_prevue: string | null },
  maintenant: Date = new Date(),
): boolean {
  if (course.statut === 'terminee' || course.statut === 'annulee') return false
  if (!course.date_prevue) return true
  return instantDepuisSaisieParis(course.date_prevue).getTime() > maintenant.getTime() - MARGE_COURSE_PASSEE_MS
}
