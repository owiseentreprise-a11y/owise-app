'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'

export async function addCollaborateur(
  clientId: string,
  data: { email: string; password: string; nom: string; prenom: string; telephone: string; poste: string },
): Promise<void> {
  const supabase = await requireAdminClient()
  const { error } = await supabase.rpc('create_collaborateur_account', {
    p_client_id:  clientId,
    p_email:      data.email,
    p_password:   data.password,
    p_nom:        data.nom,
    p_prenom:     data.prenom,
    p_telephone:  data.telephone || null,
    p_poste:      data.poste || null,
  })
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function deleteCollaborateur(clientId: string, collabId: string): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('collaborateurs').delete().eq('id', collabId)
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function updateProfile(
  id: string,
  data: { nom: string; prenom: string; telephone: string },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('profiles').update(data).eq('id', id)
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
