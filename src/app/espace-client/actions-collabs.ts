'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function ajouterCollaborateur(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const nom    = (formData.get('nom')    as string).trim()
  const prenom = (formData.get('prenom') as string).trim()
  if (!nom && !prenom) return

  await supabase.from('collaborateurs').insert({
    client_id: user.id,
    nom,
    prenom,
    tel:     (formData.get('tel')     as string).trim() || null,
    email:   (formData.get('email')   as string).trim() || null,
    poste:   (formData.get('poste')   as string).trim() || null,
    adresse: (formData.get('adresse') as string).trim() || null,
  })
  revalidatePath('/espace-client')
}

export async function modifierCollaborateur(collabId: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('collaborateurs')
    .update({
      nom:     (formData.get('nom')     as string).trim(),
      prenom:  (formData.get('prenom')  as string).trim(),
      tel:     (formData.get('tel')     as string).trim() || null,
      email:   (formData.get('email')   as string).trim() || null,
      poste:   (formData.get('poste')   as string).trim() || null,
      adresse: (formData.get('adresse') as string).trim() || null,
    })
    .eq('id', collabId)
    .eq('client_id', user.id)

  revalidatePath('/espace-client')
}

export async function supprimerCollaborateur(collabId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase.from('collaborateurs')
    .delete()
    .eq('id', collabId)
    .eq('client_id', user.id)

  revalidatePath('/espace-client')
}
