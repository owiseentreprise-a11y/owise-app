'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function demanderCourse(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const depart  = formData.get('depart') as string
  const arrivee = formData.get('arrivee') as string
  const date    = formData.get('date') as string
  const note    = (formData.get('note') as string) || null

  if (!depart || !arrivee || !date) redirect('/espace-client?error=champs-manquants')
  const dateParsed = new Date(date)
  if (isNaN(dateParsed.getTime())) redirect('/espace-client?error=champs-manquants')

  const isCollab = user.app_metadata?.role === 'collaborateur'

  let clientId: string | null = null
  let collabId: string | null = null

  if (isCollab) {
    // Récupère l'entreprise liée
    const { data: collab } = await supabase
      .from('collaborateurs')
      .select('client_id')
      .eq('id', user.id)
      .single()
    clientId = collab?.client_id ?? null
    collabId = user.id
  } else {
    clientId = user.id
  }

  await supabase.from('courses').insert({
    client_id:        clientId,
    collaborateur_id: collabId,
    adresse_depart:   depart,
    adresse_arrivee:  arrivee,
    date_prevue:      new Date(date).toISOString(),
    notes:            note,
    statut:           'en_attente',
  })

  redirect('/espace-client?success=demande-envoyee')
}
