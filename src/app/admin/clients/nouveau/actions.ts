'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerBienvenueClient } from '@/lib/email'

export async function createClientAccount(formData: FormData): Promise<void> {
  await requireAdminClient()

  const email               = (formData.get('email') as string)?.trim()
  const password            = formData.get('password') as string
  const nom                 = (formData.get('nom') as string)?.trim()
  const prenom              = (formData.get('prenom') as string)?.trim()
  const telephone           = (formData.get('telephone') as string)?.trim() || null
  const type_compte         = formData.get('type_compte') as string
  const entreprise_nom      = (formData.get('entreprise_nom') as string)?.trim() || null
  const adresse_facturation = (formData.get('adresse_facturation') as string)?.trim() || null

  const admin = createAdminClient()

  // 1. Créer le compte auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'client' },
    user_metadata: { prenom, nom },
  })
  if (authError) throw new Error(authError.message)

  const userId = authData.user.id

  // 2. Profil
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId, nom, prenom, telephone, role: 'client',
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw new Error(profileError.message)
  }

  // 3. Client
  const { error: clientError } = await admin.from('clients').upsert({
    id: userId,
    type_compte: type_compte || 'particulier',
    entreprise_nom,
    adresse_facturation,
  })
  if (clientError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {})
    throw new Error(clientError.message)
  }

  envoyerBienvenueClient({
    email, prenom, nom, password,
    typeCompte: type_compte,
    entrepriseNom: entreprise_nom,
  }).catch(() => {})

  revalidatePath('/admin/clients')
  revalidatePath('/admin')
  redirect(`/admin/clients/${userId}`)
}
