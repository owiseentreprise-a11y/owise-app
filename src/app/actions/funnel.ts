'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { nettoyerMetaFunnel, nettoyerEtape, nettoyerPage } from '@/lib/funnel-confidentialite'

/**
 * Écrit une étape de parcours.
 *
 * ── Le serveur ne fait pas confiance au navigateur ───────────────────────
 *
 * Le navigateur nettoie déjà `meta` avant d'appeler (voir `lib/funnel.ts`),
 * mais cette action est joignable depuis n'importe quel client : un onglet
 * resté ouvert sur une ancienne version, un script, une régression future.
 * Le même filtre est donc réappliqué ici, et c'est lui qui a le dernier mot.
 *
 * Ce que le serveur peut garantir :
 *   · aucune adresse de voirie, aucune coordonnée, aucun nom, téléphone ou
 *     e-mail — seules des valeurs numériques, booléennes, des codes courts
 *     et des lieux généralisés survivent au filtre ;
 *   · aucun message d'erreur libre ;
 *   · aucune chaîne de requête dans la page ;
 *   · un nom d'étape de forme contrainte.
 *
 * ── Ce que le serveur ne peut PAS garantir, et il faut le dire ──────────
 *
 * **Il ne peut pas vérifier le consentement.** Le refus est appliqué dans le
 * navigateur : sans accord, `logFunnel` n'appelle pas cette action. Mais un
 * appel direct contournerait ce contrôle, et le serveur n'a aucun moyen de
 * distinguer un visiteur consentant d'un autre.
 *
 * Ajouter un champ `consent: true` envoyé par le client serait pire que
 * rien : cela donnerait l'apparence d'une preuve là où il n'y en a pas. Une
 * garantie réelle demanderait un jeton signé côté serveur, posé au moment
 * de l'acceptation — une architecture que cette étape n'introduit pas.
 *
 * La limite est donc assumée : le consentement est appliqué côté navigateur,
 * la minimisation des données côté serveur.
 */
export async function logFunnelEvent(params: {
  sessionId: string
  step: string
  page?: string
  meta?: Record<string, unknown>
}) {
  const step = nettoyerEtape(params.step)
  if (!step) return

  const sessionId = typeof params.sessionId === 'string'
    && /^[A-Za-z0-9_-]{1,64}$/.test(params.sessionId)
    ? params.sessionId
    : 'invalide'

  const admin = createAdminClient()
  // Best-effort : le tracking ne doit jamais faire échouer le parcours réel.
  await admin.from('funnel_events').insert({
    session_id: sessionId,
    step,
    page:       nettoyerPage(params.page),
    meta:       nettoyerMetaFunnel(params.meta),
  }).then(() => {}, () => {})
}
