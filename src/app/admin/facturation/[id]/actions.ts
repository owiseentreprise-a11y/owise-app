'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'

export async function changerStatutFacture(
  factureId: string,
  statut: 'payee' | 'retard' | 'en_attente',
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('factures').update({ statut }).eq('id', factureId)
  revalidatePath(`/admin/facturation/${factureId}`)
  revalidatePath('/admin/facturation')
}
