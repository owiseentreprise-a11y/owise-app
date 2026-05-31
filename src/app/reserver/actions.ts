'use server'

import { redirect } from 'next/navigation'
import { getStripe } from '@/lib/stripe'

export async function createReservationCheckout(data: {
  adresse_depart: string
  adresse_arrivee: string
  date_prevue: string
  type_vehicule: string
  nb_passagers: number
  prix: number
  nom: string
  prenom: string
  email: string
  telephone: string
  zone_depart_id: string
  zone_arrivee_id: string
}): Promise<void> {
  const stripe = getStripe()

  const label: Record<string, string> = {
    berline: 'Berline',
    berline_premium: 'Berline Premium',
    van: 'Van',
  }

  let session: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
  try {
    session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    customer_email: data.email,
    line_items: [{
      price_data: {
        currency: 'eur',
        unit_amount: Math.round(data.prix * 100),
        product_data: {
          name: `Course VTC — ${label[data.type_vehicule] ?? data.type_vehicule}`,
          description: `${data.adresse_depart} → ${data.adresse_arrivee}`,
        },
      },
      quantity: 1,
    }],
    success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/paiement/merci?session_id={CHECKOUT_SESSION_ID}&reservation=1`,
    cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/reserver`,
    metadata: {
      type: 'reservation',
      adresse_depart:  data.adresse_depart.slice(0, 499),
      adresse_arrivee: data.adresse_arrivee.slice(0, 499),
      date_prevue:     data.date_prevue,
      type_vehicule:   data.type_vehicule,
      nb_passagers:    String(data.nb_passagers),
      prix:            String(data.prix),
      nom:             data.nom,
      prenom:          data.prenom,
      email:           data.email,
      telephone:       data.telephone || '',
      zone_depart_id:  data.zone_depart_id,
      zone_arrivee_id: data.zone_arrivee_id,
    },
    })
  } catch (err: any) {
    console.error('[Stripe] checkout.sessions.create error:', err?.message ?? err)
    throw new Error(`Stripe: ${err?.message ?? 'Erreur inconnue'}`)
  }

  redirect(session.url!)
}
