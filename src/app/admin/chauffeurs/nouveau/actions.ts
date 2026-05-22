'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createChauffeur(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const email          = formData.get('email') as string
  const password       = formData.get('password') as string
  const nom            = formData.get('nom') as string
  const prenom         = formData.get('prenom') as string
  const telephone      = formData.get('telephone') as string
  const type_contrat   = formData.get('type_contrat') as string
  const type_vehicule  = formData.get('type_vehicule') as string
  const vehicule_marque        = (formData.get('vehicule_marque') as string) || null
  const vehicule_modele        = (formData.get('vehicule_modele') as string) || null
  const vehicule_immatriculation = (formData.get('vehicule_immatriculation') as string) || null

  const { data, error } = await supabase.rpc('create_chauffeur_account', {
    p_email: email,
    p_password: password,
    p_nom: nom,
    p_prenom: prenom,
    p_telephone: telephone,
    p_type_contrat: type_contrat,
    p_type_vehicule: type_vehicule,
    p_vehicule_marque: vehicule_marque,
    p_vehicule_modele: vehicule_modele,
    p_vehicule_immatriculation: vehicule_immatriculation,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/chauffeurs')
  revalidatePath('/admin')
  redirect(`/admin/chauffeurs/${data}`)
}
