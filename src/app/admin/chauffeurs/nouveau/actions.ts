'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { envoyerBienvenueChauffeur } from '@/lib/email'

export async function createChauffeur(
  _prev: { error?: string } | null,
  formData: FormData,
): Promise<{ error?: string } | null> {
  await requireAdminClient()
  const admin = createAdminClient()

  const email          = formData.get('email') as string
  const password       = formData.get('password') as string
  const nom            = formData.get('nom') as string
  const prenom         = formData.get('prenom') as string
  const telephone      = (formData.get('telephone') as string) || null
  const type_contrat   = formData.get('type_contrat') as string
  const type_vehicule  = formData.get('type_vehicule') as string
  const vehicule_marque          = (formData.get('vehicule_marque') as string) || null
  const vehicule_modele          = (formData.get('vehicule_modele') as string) || null
  const vehicule_immatriculation = (formData.get('vehicule_immatriculation') as string) || null

  if (!email?.trim() || !password || !nom || !prenom) {
    return { error: 'Tous les champs obligatoires doivent être remplis.' }
  }

  // 1. Créer le compte Auth avec le bon rôle
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         email.trim(),
    password,
    email_confirm: true,
    app_metadata: {
      provider: 'email', providers: ['email'],
      role: 'chauffeur',
    },
    user_metadata: { prenom, nom },
  })
  if (authError) {
    if (authError.message.toLowerCase().includes('already exists'))
      return { error: `Un compte existe déjà avec l'adresse ${email.trim()}. Utilisez un autre email.` }
    return { error: authError.message }
  }

  const userId = authData.user.id

  // 2. Profil
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId, nom, prenom, telephone, role: 'chauffeur',
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: profileError.message }
  }

  // 3. Enregistrement chauffeur
  const { error: chauffeurError } = await admin.from('chauffeurs').insert({
    id:                       userId,
    statut:                   'hors_ligne',
    type_contrat,
    type_vehicule,
    vehicule_marque,
    vehicule_modele,
    vehicule_immatriculation,
    note_moyenne:             0,
    nb_courses:               0,
  })
  if (chauffeurError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: chauffeurError.message }
  }

  // Email de bienvenue (non bloquant)
  envoyerBienvenueChauffeur({
    email, prenom, nom, password,
    typeContrat: type_contrat,
    vehicule: [vehicule_marque, vehicule_modele].filter(Boolean).join(' ') || null,
  }).catch(() => {})

  revalidatePath('/admin/chauffeurs')
  revalidatePath('/admin')
  redirect(`/admin/chauffeurs/${userId}`)
}
