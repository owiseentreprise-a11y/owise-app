'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculerPrix, calculerPrixKm } from '@/lib/calcPrix'
import { capiLead } from '@/lib/capi'

const VEHICULE_LABEL: Record<string, string> = {
  berline: 'Berline',
  berline_premium: 'Berline Premium',
  van: 'Van',
}

async function calculerPrixServeur(
  zoneDepId: string,
  zoneArrId: string,
  vehicule: string,
  dateHeure: string,
): Promise<number | null> {
  const admin = createAdminClient()
  const [grilleRes, tarifsRes, zonesRes, paramsRes] = await Promise.all([
    admin.from('grilles_tarifaires').select('zone_depart_id,zone_arrivee_id,prix_berline'),
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code','HORS').eq('active', true),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec').single(),
  ])
  return calculerPrix(
    zoneDepId,
    zoneArrId,
    vehicule,
    dateHeure,
    grilleRes.data ?? [],
    tarifsRes.data ?? [],
    zonesRes.data ?? [],
    paramsRes.data,
  )
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
  aller_retour?: boolean
  date_retour?: string
  num_vol_train?: string
  terminal?: string
  heure_arrivee_vol?: string
  code_parrainage?: string
  distance_km?: number
}): Promise<{ error?: string; checkoutUrl?: string }> {
  const rawKey = process.env.STRIPE_SECRET_KEY ?? ''
  const key = rawKey.charCodeAt(0) === 0xFEFF ? rawKey.slice(1) : rawKey
  if (!key) return { error: 'Clé Stripe manquante' }

  // Recalculer le prix côté serveur — ne jamais faire confiance au prix client
  let prixServeur = await calculerPrixServeur(
    data.zone_depart_id,
    data.zone_arrivee_id,
    data.type_vehicule,
    data.date_prevue,
  )
  // Fallback km-based si pas de grille (ex : Creil → Gare de Lyon)
  if ((!prixServeur || prixServeur <= 0) && data.distance_km && data.distance_km > 0) {
    const admin = createAdminClient()
    const [{ data: tarifs }, { data: params }] = await Promise.all([
      admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
      admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec').single(),
    ])
    const dist = Math.min(Math.max(data.distance_km, 1), 600) // borne 1–600 km
    prixServeur = calculerPrixKm(dist, data.type_vehicule, data.date_prevue, tarifs ?? [], params)
  }
  if (!prixServeur || prixServeur <= 0) {
    console.error('[createReservation] prix serveur introuvable', {
      zone_depart_id: data.zone_depart_id,
      zone_arrivee_id: data.zone_arrivee_id,
      type_vehicule: data.type_vehicule,
    })
    return { error: 'Tarif introuvable pour ce trajet. Veuillez contacter le support.' }
  }

  // Aller-retour : ×2
  if (data.aller_retour && data.date_retour) {
    prixServeur = Math.round(prixServeur * 2 * 100) / 100
  }

  // Code parrainage : -10% si code actif en base
  if (data.code_parrainage) {
    const admin = createAdminClient()
    const { data: codeRow } = await admin
      .from('codes_parrainage')
      .select('id')
      .eq('code', data.code_parrainage.toUpperCase().trim())
      .eq('actif', true)
      .single()
    if (codeRow) {
      prixServeur = Math.round(prixServeur * 0.9 * 100) / 100
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const label = VEHICULE_LABEL[data.type_vehicule] ?? data.type_vehicule

  const params = new URLSearchParams()
  params.set('mode', 'payment')
  params.set('payment_method_types[]', 'card')
  params.set('customer_email', data.email)
  params.set('line_items[0][price_data][currency]', 'eur')
  const prixEntier = Math.round(prixServeur)
  params.set('line_items[0][price_data][unit_amount]', String(prixEntier * 100))
  const prixFinal = prixEntier
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
  params.set('metadata[prix]', String(prixFinal))
  params.set('metadata[nom]', data.nom)
  params.set('metadata[prenom]', data.prenom)
  params.set('metadata[email]', data.email)
  params.set('metadata[telephone]', data.telephone || '')
  params.set('metadata[zone_depart_id]', data.zone_depart_id)
  params.set('metadata[zone_arrivee_id]', data.zone_arrivee_id)
  if (data.aller_retour && data.date_retour) {
    params.set('metadata[aller_retour]', 'true')
    params.set('metadata[date_retour]', data.date_retour)
  }
  if (data.code_parrainage) {
    params.set('metadata[code_parrainage]', data.code_parrainage)
  }

  // Créer le retour immédiatement en_attente si aller-retour demandé
  if (data.aller_retour && data.date_retour) {
    try {
      const dateRetourParsed = new Date(data.date_retour)
      if (!isNaN(dateRetourParsed.getTime())) {
        const supabaseAdmin = createAdminClient()
        await supabaseAdmin.from('courses').insert({
          adresse_depart:  data.adresse_arrivee,
          adresse_arrivee: data.adresse_depart,
          date_prevue:     dateRetourParsed.toISOString(),
          type_vehicule:   data.type_vehicule,
          nb_passagers:    data.nb_passagers,
          prix_estime:     Math.round(prixServeur / 2),
          notes:           `Retour — ${data.nom} ${data.prenom} (paiement à définir)`,
          mode_paiement:   'stripe',
          statut:          'en_attente',
          passager_prenom: data.prenom || null,
          passager_nom:    data.nom || null,
          passager_tel:    data.telephone || null,
        })
      }
    } catch { /* non-bloquant */ }
  }

  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    })

    const json = await res.json() as { url: string; error?: { message?: string } }

    if (!res.ok) {
      console.error('[Stripe] API error:', json?.error?.message)
      return { error: json?.error?.message ?? `HTTP ${res.status}` }
    }

    // Événement Lead CAPI server-side — indépendant du consentement cookie
    capiLead({
      eventId:   `lead-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      email:     data.email     || undefined,
      phone:     data.telephone || undefined,
      firstName: data.prenom    || undefined,
      lastName:  data.nom       || undefined,
      value:     prixFinal,
      currency:  'EUR',
    }).catch(() => {})

    return { checkoutUrl: json.url }
  } catch (err: unknown) {
    const e = err as { message?: string }
    console.error('[Stripe] fetch error:', e?.message)
    return { error: `Connexion: ${e?.message}` }
  }
  return { error: 'Erreur inattendue' }
}
