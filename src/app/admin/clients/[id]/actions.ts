'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { envoyerBienvenueCollaborateur } from '@/lib/email'

export async function addCollaborateur(
  clientId: string,
  data: { email: string; password: string; nom: string; prenom: string; telephone: string; poste: string; adresse?: string },
): Promise<{ error?: string }> {
  // Vérifie que l'appelant est admin
  await requireAdminClient()

  const admin = createAdminClient()

  // 1. Créer le compte Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         data.email.trim(),
    password:      data.password,
    email_confirm: true,
    app_metadata: {
      provider: 'email', providers: ['email'],
      role: 'collaborateur', client_id: clientId,
    },
    user_metadata: { prenom: data.prenom, nom: data.nom },
  })
  if (authError) return { error: authError.message }

  const userId = authData.user.id

  // 2. Profil (rollback auth si échec)
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId, nom: data.nom, prenom: data.prenom,
    telephone: data.telephone || null, role: 'client',
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: `Profil: ${profileError.message}` }
  }

  // 3. Collaborateur — colonnes directes + id auth (rollback auth si échec)
  const { error: collabError } = await admin.from('collaborateurs').insert({
    id:        userId,
    client_id: clientId,
    poste:     data.poste    || null,
    nom:       data.nom      || '',
    prenom:    data.prenom   || '',
    tel:       data.telephone || null,
    adresse:   data.adresse  || null,
  })
  if (collabError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: `Collaborateur: ${collabError.message}` }
  }

  // Email de bienvenue — récupère le nom de l'entreprise
  const { data: clientData } = await admin
    .from('clients')
    .select('entreprise_nom, profiles(prenom, nom)')
    .eq('id', clientId)
    .single()
  const entrepriseNom = (clientData as any)?.entreprise_nom
    ?? ((clientData as any)?.profiles
      ? `${(clientData as any).profiles.prenom} ${(clientData as any).profiles.nom}`.trim()
      : 'OWISE')

  envoyerBienvenueCollaborateur({
    email: data.email, prenom: data.prenom, nom: data.nom,
    password: data.password, entrepriseNom, poste: data.poste || null,
  }).catch(() => {})

  revalidatePath(`/admin/clients/${clientId}`)
  return {}
}

export async function deleteCollaborateur(clientId: string, collabId: string): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('collaborateurs').delete().eq('id', collabId)
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function updateEmail(
  id: string,
  newEmail: string,
): Promise<{ error?: string }> {
  await requireAdminClient()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, { email: newEmail.trim() })
  if (error) return { error: error.message }
  revalidatePath(`/admin/clients/${id}`)
  return {}
}

export async function updateProfile(
  id: string,
  data: { nom: string; prenom: string; telephone: string },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('profiles').update(data).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function togglePayerAbord(id: string, valeur: boolean): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({ payer_a_bord: valeur }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function updateCompte(
  id: string,
  data: { type_compte: string; entreprise_nom: string; adresse_facturation: string },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({
    type_compte: data.type_compte,
    entreprise_nom: data.entreprise_nom || null,
    adresse_facturation: data.adresse_facturation || null,
  }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
  revalidatePath('/admin/clients')
}

export async function updateFacturationMode(
  id: string,
  mode: 'mensuelle' | 'par_prestation',
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({ facturation_mode: mode }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function updateTarifClient(
  id: string,
  data: { coef_tarifaire: number; paiement_differe: boolean },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({
    coef_tarifaire: data.coef_tarifaire,
    paiement_differe: data.paiement_differe,
  }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}
