'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function desactiverChauffeurAction(id: string): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('chauffeurs')
    .update({ statut: 'hors_ligne', disponible: false })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/chauffeurs')
  return {}
}

export async function supprimerChauffeurAction(id: string): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()

  // Vérifier pas de course active liée
  const { data: coursesActives } = await supabase
    .from('courses')
    .select('id')
    .eq('chauffeur_id', id)
    .in('statut', ['en_attente', 'acceptee', 'en_route', 'prise_en_charge'])
    .limit(1)

  if (coursesActives && coursesActives.length > 0) {
    return { error: 'Ce chauffeur a des courses actives. Désactivez-le d\'abord.' }
  }

  const { error } = await supabase.from('chauffeurs').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/chauffeurs')
  return {}
}
