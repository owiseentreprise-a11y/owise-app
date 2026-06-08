'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function requireSTUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'sous_traitant') return null
  return user
}

export async function progresserCourseSTAction(
  courseId: string,
  nextStatut: 'en_route' | 'prise_en_charge' | 'terminee',
): Promise<void> {
  const user = await requireSTUser()
  if (!user) return

  const admin = createAdminClient()
  // Récupérer le sous_traitant_id lié à cet utilisateur
  const { data: st } = await admin.from('sous_traitants').select('id').eq('user_id', user.id).single()
  if (!st) return

  const updates: Record<string, unknown> = { statut: nextStatut }
  if (nextStatut === 'en_route')  updates.date_debut = new Date().toISOString()
  if (nextStatut === 'terminee')  updates.date_fin   = new Date().toISOString()
  // Limité aux courses assignées à CE sous-traitant
  await admin.from('courses').update(updates).eq('id', courseId).eq('sous_traitant_id', st.id)
  revalidatePath('/sous-traitant')
}

export async function accepterCourseSTAction(courseId: string): Promise<void> {
  const user = await requireSTUser()
  if (!user) return

  const admin = createAdminClient()
  const { data: st } = await admin.from('sous_traitants').select('id').eq('user_id', user.id).single()
  if (!st) return

  await admin.from('courses').update({ statut: 'acceptee' }).eq('id', courseId).eq('sous_traitant_id', st.id)
  revalidatePath('/sous-traitant')
}

export async function refuserCourseSTAction(courseId: string): Promise<void> {
  const user = await requireSTUser()
  if (!user) return

  const admin = createAdminClient()
  const { data: st } = await admin.from('sous_traitants').select('id').eq('user_id', user.id).single()
  if (!st) return

  await admin.from('courses')
    .update({ sous_traitant_id: null, statut: 'en_attente' })
    .eq('id', courseId)
    .eq('sous_traitant_id', st.id)
  revalidatePath('/sous-traitant')
}

export async function updateProfilSTAction(
  stId: string,
  data: { nom: string; telephone: string; mode_paiement: string }
): Promise<{ error?: string }> {
  const user = await requireSTUser()
  if (!user) return { error: 'Non autorisé' }

  const admin = createAdminClient()
  // Vérifier que ce stId appartient bien à l'utilisateur connecté
  const { data: st } = await admin.from('sous_traitants').select('id').eq('id', stId).eq('user_id', user.id).single()
  if (!st) return { error: 'Non autorisé' }

  const { error } = await admin.from('sous_traitants').update({
    nom: data.nom.trim(),
    telephone: data.telephone.trim(),
    mode_paiement: data.mode_paiement,
  }).eq('id', stId)
  if (error) return { error: error.message }
  revalidatePath('/sous-traitant')
  return {}
}
