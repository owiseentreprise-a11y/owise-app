import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * La seule porte par laquelle passe l'état d'un paiement.
 *
 * Même intention que `heure.ts` et `montant.ts` : une porte d'entrée, une
 * porte de sortie, et un contrôle automatique qui vérifie qu'aucun fichier ne
 * contourne. Trois incidents réels ont rendu ce fichier nécessaire :
 *
 *   2026-10-07  deux clients ont payé 89 € ; l'écriture de la course a échoué
 *               et l'erreur n'était que journalisée. Rien en base, rien dans
 *               les journaux une heure plus tard, personne prévenu.
 *   2026-10-08  les événements ont été RENVOYÉS À LA MAIN depuis Stripe pour
 *               récupérer ces réservations. Chaque renvoi a recréé une course
 *               et une facture : deux de chaque, pour deux clients.
 *   en continu  le webhook n'écrit jamais `paiement_statut`, par choix assumé.
 *               Les courses encaissées affichent donc « en attente », et le
 *               garde-fou de la facturation mensuelle, qui s'appuie sur cette
 *               colonne, ne protège aucun paiement Stripe.
 *
 * Règle tenue ici : l'idempotence est garantie par la BASE, jamais par une
 * lecture préalable. `stripe_events.id` est la clé primaire et vaut
 * l'identifiant d'événement Stripe ; `courses.stripe_payment_intent_id` porte
 * un index unique partiel. Deux traitements simultanés ne peuvent donc pas
 * aboutir tous les deux, quoi que fasse le code appelant.
 */

/** Code d'erreur Postgres : violation de contrainte d'unicité. */
export const VIOLATION_UNICITE = '23505'

export const STATUTS_PAIEMENT = [
  'en_attente',   // valeur par défaut de la colonne : rien d'enregistré
  'a_percevoir',  // à encaisser à bord
  'paye',         // encaissé, quel que soit le moyen
  'echoue',       // tentative refusée
  'remboursee',   // remboursé, total ou partiel
  'contestee',    // litige ouvert chez Stripe
] as const
export type StatutPaiement = typeof STATUTS_PAIEMENT[number]

export type SuiteAEvenement =
  | { action: 'traiter'; tentative: number }
  | { action: 'ignorer'; raison: 'deja-traite' }

/**
 * Enregistre un événement Stripe et dit s'il faut le traiter.
 *
 * L'insertion porte sur la clé primaire : un événement déjà connu est refusé
 * par la base, pas par une lecture. C'est ce qui rend un renvoi manuel depuis
 * le tableau de bord Stripe sans danger.
 *
 * Point délicat, et c'est le piège de ce genre de garde : un événement DÉJÀ
 * CONNU n'est pas forcément un événement déjà TRAITÉ. Si la première livraison
 * a journalisé puis échoué, refuser la seconde laisserait la course jamais
 * créée — on remplacerait un doublon par une perte, ce qui est pire. On ne
 * saute donc que les événements dont le traitement est allé au bout.
 */
export async function enregistrerEvenement(
  supabase: SupabaseClient,
  evenement: { id: string; type: string },
  payload: unknown,
): Promise<SuiteAEvenement> {
  const { error } = await supabase
    .from('stripe_events')
    .insert({ id: evenement.id, type: evenement.type, payload: payload as never, tentatives: 1 })

  if (!error) return { action: 'traiter', tentative: 1 }

  if (error.code !== VIOLATION_UNICITE) {
    /* Le journal est indisponible. On ne bloque pas le paiement pour autant :
     * perdre la trace est moins grave que perdre la réservation, et l'index
     * unique sur courses reste en place pour empêcher le doublon. */
    console.error('[paiement] journal indisponible, traitement poursuivi sans trace', error)
    return { action: 'traiter', tentative: 0 }
  }

  const { data } = await supabase
    .from('stripe_events').select('statut, tentatives').eq('id', evenement.id).maybeSingle()

  if (data?.statut === 'traite') return { action: 'ignorer', raison: 'deja-traite' }

  const tentative = (data?.tentatives ?? 1) + 1
  await supabase.from('stripe_events')
    .update({ statut: 'recu', tentatives: tentative, erreur: null }).eq('id', evenement.id)
  return { action: 'traiter', tentative }
}

export async function marquerEvenementTraite(
  supabase: SupabaseClient,
  evenementId: string,
  liens: { courseId?: string | null; factureId?: string | null } = {},
): Promise<void> {
  await supabase.from('stripe_events').update({
    statut: 'traite',
    traite_le: new Date().toISOString(),
    erreur: null,
    course_id: liens.courseId ?? null,
    facture_id: liens.factureId ?? null,
  }).eq('id', evenementId)
}

export async function marquerEvenementEchec(
  supabase: SupabaseClient,
  evenementId: string,
  erreur: unknown,
): Promise<void> {
  await supabase.from('stripe_events').update({
    statut: 'echec',
    erreur: String((erreur as { message?: string })?.message ?? erreur).slice(0, 2000),
  }).eq('id', evenementId)
}

/** Les événements qui méritent un nouvel essai, du plus ancien au plus récent. */
export async function evenementsAReprendre(
  supabase: SupabaseClient,
  depuisHeures = 72,
): Promise<{ id: string; type: string; payload: unknown; tentatives: number }[]> {
  const depuis = new Date(Date.now() - depuisHeures * 3600_000).toISOString()
  const { data } = await supabase
    .from('stripe_events')
    .select('id, type, payload, tentatives')
    .in('statut', ['recu', 'echec'])
    .gte('recu_le', depuis)
    .order('recu_le', { ascending: true })
  return data ?? []
}

/**
 * Le paiement d'une course est confirmé.
 *
 * Écrit les trois colonnes d'un coup, parce qu'elles ne veulent rien dire
 * séparément : un identifiant de paiement sans `paiement_statut = 'paye'` est
 * exactement l'état dans lequel les quatre courses d'octobre se trouvaient.
 */
export async function marquerPaiementConfirme(
  supabase: SupabaseClient,
  courseId: string,
  paymentIntentId: string | null,
): Promise<void> {
  const maj: Record<string, unknown> = { paiement_statut: 'paye', mode_paiement: 'stripe' }
  if (paymentIntentId) maj.stripe_payment_intent_id = paymentIntentId
  const { error } = await supabase.from('courses').update(maj).eq('id', courseId)
  if (error) throw new Error(`paiement confirmé non enregistré sur ${courseId} : ${error.message}`)
}

/**
 * Le paiement d'une course a été remboursé.
 *
 * Appelé par la réconciliation, pas par un webhook : la destination de
 * production n'écoute que `checkout.session.completed`, et la configuration
 * Stripe ne doit pas être modifiée. Un remboursement fait depuis le tableau de
 * bord Stripe ne nous est donc jamais notifié — il est découvert le lendemain.
 */
export async function marquerRemboursement(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<string | null> {
  const { data } = await supabase.from('courses')
    .update({ paiement_statut: 'remboursee' })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .neq('paiement_statut', 'remboursee')
    .select('id')
  return data?.[0]?.id ?? null
}

export async function marquerLitige(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<string | null> {
  const { data } = await supabase.from('courses')
    .update({ paiement_statut: 'contestee' })
    .eq('stripe_payment_intent_id', paymentIntentId)
    .neq('paiement_statut', 'contestee')
    .select('id')
  return data?.[0]?.id ?? null
}

/**
 * Ouvre un incident, ou laisse en place celui qui est déjà ouvert.
 *
 * L'index unique partiel `(type, reference) WHERE resolu_le IS NULL` fait le
 * travail : la réconciliation passe tous les jours et ne doit pas empiler
 * trente lignes pour le même problème. Une violation d'unicité est donc le
 * comportement attendu, pas une erreur.
 */
export async function signalerIncident(
  supabase: SupabaseClient,
  incident: { type: string; gravite: 'critique' | 'elevee' | 'info'; reference?: string | null; detail?: unknown },
): Promise<{ nouveau: boolean }> {
  const { error } = await supabase.from('incidents_paiement').insert({
    type: incident.type,
    gravite: incident.gravite,
    reference: incident.reference ?? null,
    detail: (incident.detail ?? {}) as never,
  })
  if (!error) return { nouveau: true }
  if (error.code === VIOLATION_UNICITE) return { nouveau: false }
  console.error('[paiement] incident non enregistré', error)
  return { nouveau: false }
}

export async function resoudreIncident(
  supabase: SupabaseClient,
  type: string,
  reference: string,
): Promise<void> {
  await supabase.from('incidents_paiement')
    .update({ resolu_le: new Date().toISOString(), resolu_par: 'reconciliation' })
    .eq('type', type).eq('reference', reference).is('resolu_le', null)
}

export async function incidentsOuverts(
  supabase: SupabaseClient,
): Promise<{ type: string; gravite: string; reference: string | null; created_at: string; detail: unknown }[]> {
  const { data } = await supabase.from('incidents_paiement')
    .select('type, gravite, reference, created_at, detail')
    .is('resolu_le', null)
    .order('created_at', { ascending: false })
  return data ?? []
}
