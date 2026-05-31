'use server'

import { redirect } from 'next/navigation'

const VEHICULE_LABEL: Record<string, string> = {
  berline: 'Berline',
  berline_premium: 'Berline Premium',
  van: 'Van',
}

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
}): Promise<{ error?: string } | void> {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return { error: 'Clé Stripe manquante' }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const label = VEHICULE_LABEL[data.type_vehicule] ?? data.type_vehicule

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('payment_method_types[]', 'card')
  params.set('customer_email', data.email)
  params.set('line_items[0][price_data][currency]', 'eur')
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(data.prix * 100)))
  params.set('line_items[0][price_data][product_data][name]', `Course VTC — ${label}`)
  params.set('line_items[0][price_data][product_data][description]', `${data.adresse_depart} → ${data.adresse_arrivee}`)
  params.set('line_items[0][quantity]', '1')
  params.set('success_url', `${siteUrl}/paiement/merci?session_id={CHECKOUT_SESSION_ID}&reservation=1`)
  params.set('cancel_url', `${siteUrl}/reserver`)
  params.set('metadata[type]', 'reservation')
  params.set('metadata[adresse_depart]', data.adresse_depart.slice(0, 499))
  params.set('metadata[adresse_arrivee]', data.adresse_arrivee.slice(0, 499))
  params.set('metadata[date_prevue]', data.date_prevue)
  params.set('metadata[type_vehicule]', data.type_vehicule)
  params.set('metadata[nb_passagers]', String(data.nb_passagers))
  params.set('metadata[prix]', String(data.prix))
  params.set('metadata[nom]', data.nom)
  params.set('metadata[prenom]', data.prenom)
  params.set('metadata[email]', data.email)
  params.set('metadata[telephone]', data.telephone || '')
  params.set('metadata[zone_depart_id]', data.zone_depart_id)
  params.set('metadata[zone_arrivee_id]', data.zone_arrivee_id)

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const json = await res.json() as any

    if (!res.ok) {
      console.error('[Stripe] API error:', json?.error?.message)
      return { error: json?.error?.message ?? `HTTP ${res.status}` }
    }

    redirect(json.url)
  } catch (err: any) {
    console.error('[Stripe] fetch error:', err?.message)
    return { error: `Connexion: ${err?.message}` }
  }
}
