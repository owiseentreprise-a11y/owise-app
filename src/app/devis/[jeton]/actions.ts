'use server'

/**
 * Le client accepte son devis.
 *
 * DEUX CHEMINS, et un seul décidé par l'exploitant
 *
 *   carte_requise = true  (le défaut) : on ouvre un paiement Stripe en
 *     AUTORISATION SEULE. La carte est retenue, pas débitée. L'exploitant
 *     encaisse après avoir confirmé le véhicule, ou libère s'il ne peut pas
 *     assurer. « Tant qu'on ne connaît pas le client, il faut qu'il paye sa
 *     réservation » — exploitant, 2026-11-11, pour éviter les no-show.
 *
 *   carte_requise = false : sur un client qu'il connaît, l'exploitant lève la
 *     carte depuis l'administration. Le client confirme d'un clic et règle
 *     comme convenu.
 *
 * CE QUI N'EST PAS FAIT ICI : créer les courses. Tant que la carte n'est pas
 * réellement retenue, rien ne doit entrer dans le planning — c'est le webhook
 * Stripe qui crée la course, une fois la retenue confirmée par Stripe. Ce
 * sens-là a été appris à la dure : le 2026-10-07, deux clients ont payé sans
 * qu'aucune course n'existe parce que le webhook écartait leur événement.
 *
 * Sans carte, en revanche, il n'y a pas de webhook : l'acceptation est
 * enregistrée tout de suite, et l'exploitant crée les courses depuis le devis
 * comme il le fait déjà.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { chargerDevisParJeton } from '@/lib/devis-client'
import { envoyerNotificationAdmin } from '@/lib/email'
import { aujourdhuiParis } from '@/lib/heure'

export async function accepterDevisAction(
  jeton: string,
): Promise<{ url?: string; error?: string }> {
  const devis = await chargerDevisParJeton(jeton)
  if (!devis) return { error: 'Ce lien ne correspond à aucun devis.' }

  if (devis.accepte_le) {
    /* Déjà accepté : on ne redemande rien et on ne crée pas un second
       paiement. Un client qui reclique sur son e-mail ne doit pas payer
       deux fois. */
    return {}
  }

  /* Même règle que sur la page : on compare des jours de Paris. Le décalage
     écrit à la main (« +01:00 ») était faux tout l'été. */
  if (devis.date_validite && aujourdhuiParis() > devis.date_validite) {
    return { error: 'Ce devis a dépassé sa date de validité. Appelez-nous, nous le refaisons.' }
  }

  const montant = Math.round(Number(devis.total_ht))
  if (!montant || montant <= 0) {
    return { error: 'Ce devis ne porte aucun montant. Appelez-nous.' }
  }

  const supabase = createAdminClient()

  // ── Sans carte : on enregistre l'accord, et c'est tout ────────────────────
  if (!devis.carte_requise) {
    const { error } = await supabase
      .from('devis_clients')
      .update({
        statut: 'accepte',
        accepte_le: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', devis.id)
      .is('accepte_le', null)

    if (error) return { error: `Enregistrement impossible : ${error.message}` }

    prevenirExploitant(devis).catch(e =>
      console.error('[ACCEPTATION DEVIS — ALERTE NON PARTIE]', devis.numero, e))

    return {}
  }

  // ── Avec carte : autorisation Stripe, sans débit ──────────────────────────
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    console.error('[ACCEPTATION DEVIS] STRIPE_SECRET_KEY absente')
    return { error: 'Le paiement est momentanément indisponible. Appelez-nous.' }
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const ligne = devis.lignes[0]
  const trajet = ligne ? `${ligne.depart} → ${ligne.arrivee}` : devis.numero

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  /* LE CŒUR DE LA PROMESSE FAITE AU CLIENT : la carte est autorisée, pas
     débitée. Le bandeau d'acceptation écrit « retenu, pas débité » ; sans
     cette ligne il mentirait. Stripe libère seul au bout de 7 jours — d'où
     la date limite affichée à l'exploitant. */
  params.set('payment_intent_data[capture_method]', 'manual')
  params.set('payment_method_types[]', 'card')
  if (devis.client_email) params.set('customer_email', devis.client_email)
  params.set('line_items[0][price_data][currency]', 'eur')
  params.set('line_items[0][price_data][unit_amount]', String(montant * 100))
  params.set('line_items[0][price_data][product_data][name]', `Devis ${devis.numero} — Owise`)
  params.set('line_items[0][price_data][product_data][description]', trajet.slice(0, 499))
  params.set('line_items[0][quantity]', '1')
  params.set('success_url', `${site}/devis/${jeton}?confirme=1`)
  params.set('cancel_url', `${site}/devis/${jeton}`)

  /* Ce que le webhook lira pour savoir quoi faire. `type` le distingue d'une
     réservation ordinaire ; `a_valider` lui dit qu'une session « unpaid » est
     légitime et non une session à écarter. */
  params.set('metadata[type]', 'devis')
  params.set('metadata[a_valider]', '1')
  params.set('metadata[devis_id]', devis.id)
  params.set('metadata[devis_numero]', devis.numero)

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })
    const json = await res.json() as { url?: string; id?: string; error?: { message?: string } }

    if (!res.ok || !json.url) {
      console.error('[ACCEPTATION DEVIS] Stripe a refusé :', json?.error?.message)
      return { error: 'Le paiement n’a pas pu s’ouvrir. Appelez-nous, nous réglons ça.' }
    }

    /* On range la session AVANT de renvoyer le client : si le webhook arrive
       en premier, il doit pouvoir rapprocher les deux. */
    if (json.id) {
      await supabase
        .from('devis_clients')
        .update({ stripe_session_id: json.id })
        .eq('id', devis.id)
    }

    return { url: json.url }
  } catch (e) {
    console.error('[ACCEPTATION DEVIS] appel Stripe impossible', e)
    return { error: 'Le paiement n’a pas pu s’ouvrir. Appelez-nous, nous réglons ça.' }
  }
}

/** Prévient Owise qu'un devis vient d'être accepté sans carte. */
async function prevenirExploitant(devis: {
  numero: string
  client_nom: string
  total_ht: number
  date_prestation: string | null
  lignes: { depart: string; arrivee: string }[]
}) {
  const l = devis.lignes[0]
  await envoyerNotificationAdmin({
    adresseDepart:  l?.depart ?? '—',
    adresseArrivee: l?.arrivee ?? '—',
    datePrevue:     devis.date_prestation ?? new Date().toISOString(),
    clientNom:      devis.client_nom,
    typeVehicule:   'devis accepté',
    refCourse:      devis.numero,
  })
}
