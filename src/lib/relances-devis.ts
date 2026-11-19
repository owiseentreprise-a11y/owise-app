/**
 * relances-devis.ts — QUI RELANCER, ET QUI NE PLUS RELANCER.
 *
 * Fonction PURE (aucun accès à la base, aucun envoi) : le cron
 * `/api/cron/relance-devis` lui donne les demandes d'un palier et les
 * réservations récentes, elle dit à qui écrire. Testée par
 * `scripts/test-relances-devis.mts`.
 *
 * ── LES DEUX DÉFAUTS CORRIGÉS (constatés le 2026-11-19) ─────────────────
 *
 * 1. Une cliente a demandé deux devis Versailles → Orly à 4 minutes
 *    d'intervalle (la seconde fois avec l'adresse précise). Elle a reçu
 *    CHAQUE relance — J+1, J+4, J+7 — EN DOUBLE, à la même seconde.
 *    → Un seul message par adresse e-mail et par palier.
 *
 * 2. La même cliente avait RÉSERVÉ le 13 novembre ; sa course a eu lieu le
 *    17. Le 18, elle a reçu « Dernière chance pour votre transfert VTC ».
 *    La relance ne regardait jamais si la demande avait abouti.
 *    → On ne relance plus une adresse qui a réservé depuis sa demande.
 *    Le lien `courses.devis_id` ne suffit pas : pour cette course, recréée
 *    lors de l'incident du 13/11, il est vide. On compare donc aussi l'e-mail
 *    et le téléphone (la course ne portait que le téléphone).
 */

export type DemandeDevis = { id: string; email: string | null; tel?: string | null; created_at: string }
export type Reservation = { devis_id: string | null; email: string | null; tel?: string | null; created_at: string }

const norm = (e: string | null | undefined) => (e ?? '').trim().toLowerCase()
/* Le téléphone compte aussi : la course de cette cliente ne portait AUCUN
   e-mail (ni passager, ni fiche liée) — seulement son numéro. On compare les
   9 derniers chiffres : « +33 6 12… », « 06 12… » et « 0612… » sont le même. */
const tel9 = (t: string | null | undefined) => {
  const c = (t ?? '').replace(/\D/g, '')
  return c.length >= 9 ? c.slice(-9) : ''
}
const memePersonne = (r: Reservation, d: DemandeDevis) =>
  (norm(r.email) !== '' && norm(r.email) === norm(d.email)) ||
  (tel9(r.tel) !== '' && tel9(r.tel) === tel9(d.tel))

export function trierRelances<T extends DemandeDevis>(
  demandes: T[],
  reservations: Reservation[],
): {
  /** Une demande par adresse : la plus récente. Ce sont les seules à écrire. */
  aRelancer: T[]
  /** Doublons d'une adresse déjà relancée dans ce palier : à marquer, sans écrire. */
  doublons: T[]
  /** Demandes qui ont abouti à une réservation : plus aucune relance, à aucun palier. */
  dejaReservees: T[]
} {
  const convertis = new Set(reservations.map(r => r.devis_id).filter(Boolean) as string[])
  const reserveDepuis = (d: T) =>
    convertis.has(d.id) ||
    reservations.some(r => r.created_at >= d.created_at && memePersonne(r, d))

  const dejaReservees: T[] = []
  const restantes: T[] = []
  for (const d of demandes) (reserveDepuis(d) ? dejaReservees : restantes).push(d)

  // Une seule par adresse : la plus récente (souvent la plus précise).
  const parEmail = new Map<string, T>()
  const doublons: T[] = []
  for (const d of [...restantes].sort((a, b) => b.created_at.localeCompare(a.created_at))) {
    const k = norm(d.email)
    if (!k) continue
    if (parEmail.has(k)) doublons.push(d)
    else parEmail.set(k, d)
  }
  return { aRelancer: [...parEmail.values()], doublons, dejaReservees }
}
