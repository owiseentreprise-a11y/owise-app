'use server'

import { redirect } from 'next/navigation'
import { requireAdminClient } from '@/lib/supabase/server'
import { envoyerConfirmationClient, envoyerNotificationAdmin } from '@/lib/email'
import { getUserEmail } from '@/lib/supabase/admin'

export async function creerCourseAction(formData: FormData): Promise<void> {
  const supabase = await requireAdminClient()

  const adresse_depart  = formData.get('adresse_depart') as string
  const adresse_arrivee = formData.get('adresse_arrivee') as string
  const date_prevue     = formData.get('date_prevue') as string
  const type_vehicule   = formData.get('type_vehicule') as string
  const nb_passagers    = parseInt(formData.get('nb_passagers') as string, 10) || 1
  const prix_estime_raw = formData.get('prix_estime') as string
  const prix_estime     = prix_estime_raw ? parseFloat(prix_estime_raw) : null
  const notes           = (formData.get('notes') as string) || null
  const client_id        = (formData.get('client_id') as string) || null
  const chauffeur_id     = (formData.get('chauffeur_id') as string) || null
  const collaborateur_id = (formData.get('collaborateur_id') as string) || null
  const sous_traitant_id = (formData.get('sous_traitant_id') as string) || null

  if (!adresse_depart || !adresse_arrivee || !date_prevue || !type_vehicule) {
    redirect('/admin/courses/nouvelle?error=Champs+obligatoires+manquants')
  }

  const { error, data: newCourse } = await supabase.from('courses').insert({
    adresse_depart,
    adresse_arrivee,
    date_prevue,
    type_vehicule,
    nb_passagers,
    prix_estime,
    notes,
    client_id,
    chauffeur_id: sous_traitant_id ? null : chauffeur_id,
    collaborateur_id,
    sous_traitant_id,
    statut: 'en_attente',
  }).select('id').single()

  if (error) redirect(`/admin/courses/nouvelle?error=${encodeURIComponent(error.message)}`)

  if (client_id) {
    const [emailResult, profileRes, clientRes] = await Promise.all([
      getUserEmail(client_id),
      supabase.from('profiles').select('prenom, nom').eq('id', client_id).single(),
      supabase.from('clients').select('type_compte, entreprise_nom').eq('id', client_id).single(),
    ])
    const email = emailResult
    const prenom = profileRes.data?.prenom ?? ''
    const clientNom = clientRes.data?.type_compte === 'entreprise'
      ? (clientRes.data.entreprise_nom ?? prenom)
      : `${prenom} ${profileRes.data?.nom ?? ''}`.trim()
    const refCourse = (newCourse?.id ?? '').slice(-6).toUpperCase()

    await Promise.all([
      email ? envoyerConfirmationClient({
        clientEmail: email, clientPrenom: prenom,
        adresseDepart: adresse_depart, adresseArrivee: adresse_arrivee,
        datePrevue: date_prevue, typeVehicule: type_vehicule,
        nbPassagers: nb_passagers, prixEstime: prix_estime, refCourse,
      }) : Promise.resolve(),
      envoyerNotificationAdmin({
        adresseDepart: adresse_depart, adresseArrivee: adresse_arrivee,
        datePrevue: date_prevue, clientNom, typeVehicule: type_vehicule, refCourse,
      }),
    ])
  }

  redirect('/admin/courses')
}
