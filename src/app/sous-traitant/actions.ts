'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
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
