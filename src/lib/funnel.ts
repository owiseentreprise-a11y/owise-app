'use client'

import { logFunnelEvent } from '@/app/actions/funnel'
import { gtagEvent } from '@/lib/ga'
import { analytiquesAutorisees } from '@/lib/consentement'
import { nettoyerMetaFunnel } from '@/lib/funnel-confidentialite'

/** Identifiant de parcours, le temps d'un onglet. Voir le commentaire plus bas. */
export const CLE_SESSION_FUNNEL = 'ow_fsid'

function getSessionId(): string {
  if (typeof window === 'undefined') return 'ssr'
  try {
    let id = sessionStorage.getItem(CLE_SESSION_FUNNEL)
    if (!id) {
      id = crypto.randomUUID()
      sessionStorage.setItem(CLE_SESSION_FUNNEL, id)
    }
    return id
  } catch {
    return 'no-storage'
  }
}

/**
 * Enregistre une étape du parcours devis / réservation.
 *
 * ── Deux corrections apportées à l'étape 97 ─────────────────────────────
 *
 * **1. Le consentement.** Jusqu'ici, l'envoi à Google était bien conditionné
 * — depuis l'étape 88 — mais l'écriture dans la table `funnel_events`
 * partait dans tous les cas : avant toute réponse au bandeau comme après un
 * refus. C'était la dernière mesure facultative à y échapper.
 *
 * L'identifiant de parcours (`ow_fsid`) est un `randomUUID` conservé le
 * temps de l'onglet. Il relie entre elles les actions d'une même visite :
 * c'est précisément ce qui permet de reconstituer un parcours, et c'est
 * aussi ce qui empêche de qualifier ces lignes d'anonymes. Un événement sans
 * nom n'est pas pour autant exempté de consentement.
 *
 * **2. Les données.** `devis_step2_enter` transmettait l'adresse complète du
 * visiteur, et deux chemins d'erreur enregistraient un message libre venu de
 * Stripe. Tout passe désormais par `nettoyerMetaFunnel`, et la route serveur
 * refait le même travail sans faire confiance au navigateur.
 *
 * Rien ici ne conditionne le service : une estimation, une réservation et un
 * paiement fonctionnent à l'identique, que le visiteur accepte ou refuse.
 */
export function logFunnel(step: string, meta?: Record<string, unknown>) {
  if (typeof window === 'undefined') return
  /* L'absence de réponse vaut refus — `analytiquesAutorisees()` rend false
     tant que le choix n'est pas « accepted ». */
  if (!analytiquesAutorisees()) return

  const metaPropre = nettoyerMetaFunnel(meta)
  const sessionId = getSessionId()
  const page = window.location.pathname
  gtagEvent(step, metaPropre ?? undefined)
  logFunnelEvent({ sessionId, step, page, meta: metaPropre ?? undefined }).catch(() => {})
}
