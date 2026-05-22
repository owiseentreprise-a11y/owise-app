'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { StatutCourse } from '@/lib/types'

export async function assignerChauffeur(courseId: string, chauffeurId: string | null): Promise<void> {
  const supabase = await createClient()
  await supabase
    .from('courses')
    .update({ chauffeur_id: chauffeurId || null })
    .eq('id', courseId)
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin')
}

export async function changerStatut(courseId: string, statut: StatutCourse, chauffeurId: string | null): Promise<void> {
  const supabase = await createClient()
  const updates: Record<string, unknown> = { statut }
  if (statut === 'en_route') updates.date_debut = new Date().toISOString()
  if (statut === 'terminee') updates.date_fin = new Date().toISOString()
  await supabase.from('courses').update(updates).eq('id', courseId)

  // Libérer le chauffeur si annulation ou remise en attente
  if (chauffeurId && (statut === 'annulee' || statut === 'en_attente')) {
    await supabase.from('chauffeurs').update({ statut: 'disponible' }).eq('id', chauffeurId)
  }
  // Marquer chauffeur en_course si terminee ne l'a pas libéré (terminee = disponible)
  if (chauffeurId && statut === 'terminee') {
    await supabase.from('chauffeurs').update({ statut: 'disponible' }).eq('id', chauffeurId)
  }

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin')
}

export async function setPrixFinal(courseId: string, prix: number | null): Promise<void> {
  const supabase = await createClient()
  await supabase.from('courses').update({ prix_final: prix }).eq('id', courseId)
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin')
}

export async function modifierNotes(courseId: string, notes: string): Promise<void> {
  const supabase = await createClient()
  await supabase.from('courses').update({ notes: notes || null }).eq('id', courseId)
  revalidatePath(`/admin/courses/${courseId}`)
}
