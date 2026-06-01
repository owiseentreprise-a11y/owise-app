'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { envoyerConfirmationClient, envoyerNotificationAdmin } from '@/lib/email'

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

  const { data: newCourse } = await supabase.from('courses').insert({
    client_id:        clientId,
    collaborateur_id: collabId,
    adresse_depart:   depart,
    adresse_arrivee:  arrivee,
    etapes:           etapes.length > 0 ? etapes : null,
    date_prevue:      dateParsed.toISOString(),
    notes:            note,
    type_vehicule:    vehicule,
    nb_passagers:     passagers,
    mode_paiement:    modePaiement,
    statut:           'en_attente',
  }).select('id').single()

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
        typeVehicule: 'berline',
        nbPassagers: 1,
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
