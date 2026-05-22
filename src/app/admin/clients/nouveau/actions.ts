'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function createClientAccount(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const email               = formData.get('email') as string
  const password            = formData.get('password') as string
  const nom                 = formData.get('nom') as string
  const prenom              = formData.get('prenom') as string
  const telephone           = (formData.get('telephone') as string) || null
  const type_compte         = formData.get('type_compte') as string
  const entreprise_nom      = (formData.get('entreprise_nom') as string) || null
  const adresse_facturation = (formData.get('adresse_facturation') as string) || null

  const { data, error } = await supabase.rpc('create_client_account', {
    p_email: email,
    p_password: password,
    p_nom: nom,
    p_prenom: prenom,
    p_telephone: telephone,
    p_type_compte: type_compte,
    p_entreprise_nom: entreprise_nom,
    p_adresse_facturation: adresse_facturation,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/admin/clients')
  revalidatePath('/admin')
  redirect(`/admin/clients/${data}`)
}
