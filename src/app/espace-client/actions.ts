'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerConfirmationClient, envoyerNotificationAdmin } from '@/lib/email'

export async function clientLogoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/client-login')
}

export async function demanderCourse(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const depart       = formData.get('depart') as string
  const arrivee      = formData.get('arrivee') as string
  const date         = formData.get('date') as string
  const note         = (formData.get('note') as string) || null
  const vehicule     = (formData.get('vehicule') as string) || 'berline'
  const passagers    = parseInt(formData.get('passagers') as string) || 1
  const modePaiement = (formData.get('mode_paiement') as string) || null
  const etapesRaw    = (formData.get('etapes') as string) || '[]'
  let etapes: string[] = []
  try { etapes = JSON.parse(etapesRaw).filter((e: string) => e.trim()) } catch { etapes = [] }
  const allerRetour   = formData.get('aller_retour') === 'true'
  const dateRetourRaw = (formData.get('date_retour') as string) || ''
  const numVolTrain   = (formData.get('num_vol_train') as string) || null
  const terminal      = (formData.get('terminal') as string) || null
  const heureArriveeVol = (formData.get('heure_arrivee_vol') as string) || null

  if (!depart || !arrivee || !date) redirect('/espace-client?error=champs-manquants')

  const isCollab = user.app_metadata?.role === 'collaborateur'

  // Sécurité : les particuliers doivent passer par Stripe (sauf si cash/chèque/virement autorisé)
  if (!isCollab) {
    const { data: clientData } = await supabase.from('clients').select('type_compte, payer_a_bord').eq('id', user.id).single()
    const isEntreprise   = clientData?.type_compte === 'entreprise'
    const peutPayerAbord = clientData?.payer_a_bord === true
    if (!isEntreprise && !peutPayerAbord && modePaiement !== 'cheque' && modePaiement !== 'virement') {
      redirect('/espace-client?error=paiement-requis')
    }
  }

  const dateParsed = new Date(date)
  if (isNaN(dateParsed.getTime())) redirect('/espace-client?error=champs-manquants')
  if (dateParsed < new Date(Date.now() - 5 * 60_000)) redirect('/espace-client?error=champs-manquants')

  let clientId: string | null = null
  let collabId: string | null = null
  let clientNom = ''

  if (isCollab) {
    const { data: collab } = await supabase
      .from('collaborateurs')
      .select('client_id')
      .eq('id', user.id)
      .single()
    clientId = collab?.client_id ?? null
    collabId = user.id
  } else {
    clientId = user.id
    // Entreprise sélectionnant un collaborateur depuis le formulaire
    const collabIdForm = formData.get('collaborateur_id') as string | null
    if (collabIdForm) collabId = collabIdForm
  }

  const courseBase = {
    client_id:        clientId,
    collaborateur_id: collabId,
    type_vehicule:    vehicule,
    nb_passagers:     passagers,
    mode_paiement:    modePaiement,
    statut:           'en_attente' as const,
    num_vol_train:    numVolTrain,
    terminal,
    heure_arrivee_vol: heureArriveeVol,
  }

  const { data: newCourse } = await supabase.from('courses').insert({
    ...courseBase,
    adresse_depart:  depart,
    adresse_arrivee: arrivee,
    etapes:          etapes.length > 0 ? etapes : null,
    date_prevue:     dateParsed.toISOString(),
    notes:           note,
  }).select('id').single()

  // Retour — adresses inversées
  if (allerRetour && dateRetourRaw) {
    const dateRetourParsed = new Date(dateRetourRaw)
    if (!isNaN(dateRetourParsed.getTime())) {
      await supabase.from('courses').insert({
        ...courseBase,
        adresse_depart:  arrivee,
        adresse_arrivee: depart,
        etapes:          etapes.length > 0 ? [...etapes].reverse() : null,
        date_prevue:     dateRetourParsed.toISOString(),
        notes:           note ? `Retour — ${note}` : 'Retour',
      })
    }
  }

  // Envoi emails en arrière-plan (non bloquant)
  if (newCourse) {
    const refCourse = newCourse.id.slice(-6).toUpperCase()
    const { data: profileData } = await supabase
      .from('profiles')
      .select('prenom, nom')
      .eq('id', user.id)
      .single()
    const prenom = profileData?.prenom ?? ''
    clientNom = `${prenom} ${profileData?.nom ?? ''}`.trim()
    const email = user.email ?? null

    await Promise.all([
      email ? envoyerConfirmationClient({
        clientEmail: email,
        clientPrenom: prenom,
        adresseDepart: depart,
        adresseArrivee: arrivee,
        datePrevue: dateParsed.toISOString(),
        typeVehicule: vehicule,
        nbPassagers: passagers,
        refCourse,
      }) : Promise.resolve(),
      envoyerNotificationAdmin({
        adresseDepart: depart,
        adresseArrivee: arrivee,
        datePrevue: dateParsed.toISOString(),
        clientNom: clientNom || email || 'Client',
        typeVehicule: 'berline',
        refCourse,
      }),
    ])
  }

  redirect('/espace-client?success=demande-envoyee')
}

export async function noterCourse(courseId: string, note: number): Promise<{ ok: boolean; error?: string }> {
  if (note < 1 || note > 5) return { ok: false, error: 'Note invalide' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Non connecté' }

  const admin = createAdminClient()

  // Vérifier que la course appartient au client et est terminée
  const { data: course } = await admin
    .from('courses')
    .select('id, chauffeur_id, statut, note_client')
    .eq('id', courseId)
    .or(`client_id.eq.${user.id},collaborateur_id.eq.${user.id}`)
    .eq('statut', 'terminee')
    .is('note_client', null)
    .single()

  if (!course) return { ok: false, error: 'Course introuvable ou déjà notée' }

  // Enregistrer la note sur la course
  await admin.from('courses').update({ note_client: note }).eq('id', courseId)

  // Recalculer la note moyenne du chauffeur
  if (course.chauffeur_id) {
    const { data: notes } = await admin
      .from('courses')
      .select('note_client')
      .eq('chauffeur_id', course.chauffeur_id)
      .eq('statut', 'terminee')
      .not('note_client', 'is', null)

    if (notes && notes.length > 0) {
      const moyenne = notes.reduce((sum, c) => sum + (c.note_client ?? 0), 0) / notes.length
      await admin.from('chauffeurs')
        .update({ note_moyenne: Math.round(moyenne * 10) / 10 })
        .eq('id', course.chauffeur_id)
    }
  }

  return { ok: true }
}

export async function annulerCourseClient(courseId: string): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const admin = createAdminClient()

  // Vérifie que la course appartient à cet utilisateur et est annulable
  const { data: course } = await admin
    .from('courses')
    .select('id, statut, chauffeur_id, adresse_depart, adresse_arrivee, date_prevue')
    .eq('id', courseId)
    .or(`client_id.eq.${user.id},collaborateur_id.eq.${user.id}`)
    .eq('statut', 'en_attente')
    .single()

  if (!course) return { error: 'Course introuvable ou déjà prise en charge' }

  await admin.from('courses').update({ statut: 'annulee' }).eq('id', courseId)
  return {}
}

export async function modifierReservationClient(
  courseId: string,
  data: { date_prevue: string; nb_passagers: number }
): Promise<{ error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié' }

  const dateParsed = new Date(data.date_prevue)
  if (dateParsed < new Date(Date.now() - 5 * 60_000)) {
    return { error: 'La date ne peut pas être dans le passé' }
  }

  const admin = createAdminClient()

  const { data: course } = await admin
    .from('courses')
    .select('id, statut')
    .eq('id', courseId)
    .or(`client_id.eq.${user.id},collaborateur_id.eq.${user.id}`)
    .eq('statut', 'en_attente')
    .single()

  if (!course) return { error: 'Course introuvable ou déjà prise en charge' }

  const { error } = await admin.from('courses').update({
    date_prevue:  data.date_prevue,
    nb_passagers: data.nb_passagers,
  }).eq('id', courseId)

  if (error) return { error: error.message }
  return {}
}
