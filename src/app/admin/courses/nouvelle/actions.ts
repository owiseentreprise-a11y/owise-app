'use server'

import { redirect } from 'next/navigation'
import { requireAdminClient } from '@/lib/supabase/server'
import { envoyerConfirmationClient, envoyerNotificationAdmin, envoyerNotificationChauffeur } from '@/lib/email'
import { getUserEmail, createAdminClient } from '@/lib/supabase/admin'

export async function creerCourseAction(formData: FormData): Promise<{ error?: string } | void> {
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
  const sous_traitant_id    = (formData.get('sous_traitant_id') as string) || null
  const etapesRaw = (formData.get('etapes') as string) || '[]'
  let etapes: string[] = []
  try { etapes = JSON.parse(etapesRaw).filter((e: string) => e.trim()) } catch { etapes = [] }
  const allerRetour   = formData.get('aller_retour') === 'true'
  const dateRetourRaw = (formData.get('date_retour') as string) || ''
  const num_vol_train    = (formData.get('num_vol_train') as string) || null
  const terminal_val     = (formData.get('terminal') as string) || null
  const heure_arrivee_vol = (formData.get('heure_arrivee_vol') as string) || null
  const prix_sous_traitant_raw = formData.get('prix_sous_traitant') as string
  const prix_sous_traitant  = prix_sous_traitant_raw ? parseFloat(prix_sous_traitant_raw) : null

  if (!adresse_depart || !adresse_arrivee || !date_prevue || !type_vehicule) {
    return { error: 'Champs obligatoires manquants' }
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
    prix_sous_traitant: sous_traitant_id ? prix_sous_traitant : null,
    etapes: etapes.length > 0 ? etapes : null,
    num_vol_train,
    terminal: terminal_val,
    heure_arrivee_vol,
    statut: 'en_attente',
  }).select('id').single()

  if (error) return { error: error.message }

  // Retour — adresses inversées
  if (allerRetour && dateRetourRaw && newCourse) {
    const dateRetourParsed = new Date(dateRetourRaw)
    if (!isNaN(dateRetourParsed.getTime())) {
      await supabase.from('courses').insert({
        adresse_depart:    adresse_arrivee,
        adresse_arrivee:   adresse_depart,
        etapes:            etapes.length > 0 ? [...etapes].reverse() : null,
        date_prevue:       dateRetourParsed.toISOString(),
        type_vehicule,
        nb_passagers,
        prix_estime:       null,
        notes:             notes ? `Retour — ${notes}` : 'Retour',
        client_id,
        collaborateur_id,
        chauffeur_id:      sous_traitant_id ? null : chauffeur_id,
        sous_traitant_id,
        prix_sous_traitant: sous_traitant_id ? prix_sous_traitant : null,
        statut:            'en_attente',
      })
    }
  }

  const refCourse = (newCourse?.id ?? '').slice(-6).toUpperCase()

  // Notifier le chauffeur si assigné à la création
  if (chauffeur_id && !sous_traitant_id) {
    const adminClient = createAdminClient()
    const [chauffeurEmail, chauffeurProfileRes] = await Promise.all([
      getUserEmail(chauffeur_id),
      adminClient.from('profiles').select('prenom').eq('id', chauffeur_id).single(),
    ])
    if (chauffeurEmail) {
      await envoyerNotificationChauffeur({
        chauffeurEmail,
        chauffeurPrenom: chauffeurProfileRes.data?.prenom ?? '',
        adresseDepart: adresse_depart, adresseArrivee: adresse_arrivee,
        datePrevue: date_prevue, clientNom: '—',
        nbPassagers: nb_passagers, notes: notes ?? null, refCourse,
      })
    }
  }

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
