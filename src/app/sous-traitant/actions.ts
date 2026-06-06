'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { StatutCourse } from '@/lib/types'

export async function progresserCourseSTAction(
  courseId: string,
  nextStatut: 'en_route' | 'prise_en_charge' | 'terminee',
): Promise<void> {
  const supabase = await createClient()
  const updates: Record<string, unknown> = { statut: nextStatut }
  if (nextStatut === 'en_route')  updates.date_debut = new Date().toISOString()
  if (nextStatut === 'terminee')  updates.date_fin   = new Date().toISOString()
  await supabase.from('courses').update(updates).eq('id', courseId)
  revalidatePath('/sous-traitant')
}

export async function accepterCourseSTAction(courseId: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('courses').update({ statut: 'acceptee' }).eq('id', courseId)
  revalidatePath('/sous-traitant')
}

export async function refuserCourseSTAction(courseId: string): Promise<void> {
  // Retirer l'assignation — la course revient en_attente sans sous-traitant
  const admin = createAdminClient()
  await admin.from('courses').update({ sous_traitant_id: null, statut: 'en_attente' }).eq('id', courseId)
  revalidatePath('/sous-traitant')
}

export async function updateProfilSTAction(
  stId: string,
  data: { nom: string; telephone: string; mode_paiement: string }
): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { error } = await admin.from('sous_traitants').update({
    nom: data.nom.trim(),
    telephone: data.telephone.trim(),
    mode_paiement: data.mode_paiement,
  }).eq('id', stId)
  if (error) return { error: error.message }
  revalidatePath('/sous-traitant')
  return {}
}
