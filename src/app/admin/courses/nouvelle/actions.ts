'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function creerCourseAction(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const adresse_depart  = formData.get('adresse_depart') as string
  const adresse_arrivee = formData.get('adresse_arrivee') as string
  const date_prevue     = formData.get('date_prevue') as string
  const type_vehicule   = formData.get('type_vehicule') as string
  const nb_passagers    = parseInt(formData.get('nb_passagers') as string, 10) || 1
  const prix_estime_raw = formData.get('prix_estime') as string
  const prix_estime     = prix_estime_raw ? parseFloat(prix_estime_raw) : null
  const notes           = (formData.get('notes') as string) || null
  const client_id       = (formData.get('client_id') as string) || null
  const chauffeur_id    = (formData.get('chauffeur_id') as string) || null

  if (!adresse_depart || !adresse_arrivee || !date_prevue || !type_vehicule) {
    redirect('/admin/courses/nouvelle?error=Champs+obligatoires+manquants')
  }

  const { error } = await supabase.from('courses').insert({
    adresse_depart,
    adresse_arrivee,
    date_prevue,
    type_vehicule,
    nb_passagers,
    prix_estime,
    notes,
    client_id,
    chauffeur_id,
    statut: 'en_attente',
  })

  if (error) redirect(`/admin/courses/nouvelle?error=${encodeURIComponent(error.message)}`)

  redirect('/admin/courses')
}
