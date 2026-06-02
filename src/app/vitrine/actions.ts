'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerNouveauDevis } from '@/lib/email'

export async function soumettreDevis(params: {
  nom: string
  tel: string
  email: string
  societe?: string | null
  origin: string
  destination: string
  date_course?: string | null
  heure?: string | null
  pax: number
  vehicle: string
  price?: number | null
  supplements?: string[] | null
  dest_type?: string | null
}) {
  const sb = createAdminClient()

  const { error } = await sb.from('devis').insert({
    nom:         params.nom,
    tel:         params.tel,
    email:       params.email,
    societe:     params.societe ?? null,
    origin:      params.origin,
    destination: params.destination,
    date_course: params.date_course ?? null,
    heure:       params.heure ?? null,
    pax:         params.pax,
    vehicle:     params.vehicle,
    price:       params.price ?? null,
    supplements: params.supplements?.length ? params.supplements : null,
    dest_type:   params.dest_type ?? null,
  })

  if (error) throw new Error(error.message)

  // Email en arrière-plan — ne bloque pas la réponse
  envoyerNouveauDevis(params).catch(() => {})

  return { ok: true }
}
