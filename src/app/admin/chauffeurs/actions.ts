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

  // Bloquer si le chauffeur est physiquement avec un client (client dans la voiture ou en route)
  const { data: coursesEnCours } = await supabase
    .from('courses')
    .select('id')
    .eq('chauffeur_id', id)
    .in('statut', ['en_route', 'prise_en_charge'])
    .limit(1)

  if (coursesEnCours && coursesEnCours.length > 0) {
    return { error: 'Le chauffeur est en course en ce moment. Impossible de le supprimer.' }
  }

  // Libérer les courses en attente ou acceptées → retour dans le panier
  await supabase
    .from('courses')
    .update({ chauffeur_id: null, statut: 'en_attente' })
    .eq('chauffeur_id', id)
    .in('statut', ['en_attente', 'acceptee'])

  const { error } = await supabase.from('chauffeurs').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/chauffeurs')
  revalidatePath('/admin')
  return {}
}
