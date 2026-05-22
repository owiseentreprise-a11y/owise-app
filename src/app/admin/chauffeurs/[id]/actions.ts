'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { StatutChauffeur, TypeContrat, TypeVehicule, TypeDocument } from '@/lib/types'

export async function updateProfile(
  id: string,
  data: { nom: string; prenom: string; telephone: string },
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('profiles').update(data).eq('id', id)
  revalidatePath(`/admin/chauffeurs/${id}`)
}

export async function updateVehicule(
  id: string,
  data: {
    vehicule_marque: string
    vehicule_modele: string
    vehicule_immatriculation: string
    type_vehicule: TypeVehicule
  },
): Promise<void> {
  const supabase = await createClient()
  await supabase.from('chauffeurs').update(data).eq('id', id)
  revalidatePath(`/admin/chauffeurs/${id}`)
  revalidatePath('/admin/chauffeurs')
}

export async function updateContrat(id: string, type_contrat: TypeContrat): Promise<void> {
  const supabase = await createClient()
  await supabase.from('chauffeurs').update({ type_contrat }).eq('id', id)
  revalidatePath(`/admin/chauffeurs/${id}`)
}

export async function updateStatut(id: string, statut: StatutChauffeur): Promise<void> {
  const supabase = await createClient()
  await supabase.from('chauffeurs').update({ statut }).eq('id', id)
  revalidatePath(`/admin/chauffeurs/${id}`)
  revalidatePath('/admin/chauffeurs')
  revalidatePath('/admin')
}

export async function addDocument(
  chauffeurId: string,
  data: { type: TypeDocument; date_expiration: string },
): Promise<void> {
  const supabase = await createClient()
  const expiry = new Date(data.date_expiration)
  const now = new Date()
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86400000)
  const statut = daysLeft < 0 ? 'expire' : daysLeft < 30 ? 'bientot_expire' : 'valide'

  await supabase.from('documents_chauffeur').upsert(
    { chauffeur_id: chauffeurId, type: data.type, date_expiration: data.date_expiration, statut },
    { onConflict: 'chauffeur_id,type' },
  )
  revalidatePath(`/admin/chauffeurs/${chauffeurId}`)
}

export async function deleteDocument(chauffeurId: string, docId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('documents_chauffeur').delete().eq('id', docId)
  revalidatePath(`/admin/chauffeurs/${chauffeurId}`)
}
