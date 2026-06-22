'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function desactiverChauffeurAction(id: string): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  // actif=false est distinct de statut/disponible : ces deux derniers champs
  // peuvent être remis par le chauffeur lui-même depuis son app (toggle dispo),
  // alors qu'actif ne peut être changé que par un admin — c'est ce flag qui
  // détermine l'éligibilité à de nouvelles courses (même rôle que sous_traitants.actif).
  const { error } = await supabase
    .from('chauffeurs')
    .update({ statut: 'hors_ligne', disponible: false, actif: false })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/chauffeurs')
  return {}
}

export async function reactiverChauffeurAction(id: string): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('chauffeurs').update({ actif: true }).eq('id', id)
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

  // Toute course historique (terminée/annulée) ou document chauffeur référençant ce
  // chauffeur bloque la suppression définitive — vérifié AVANT toute mutation pour ne
  // jamais libérer des courses puis échouer sur le delete sans retour arrière possible.
  const [{ data: coursesHistorique }, { data: documents }] = await Promise.all([
    supabase.from('courses').select('id').eq('chauffeur_id', id)
      .in('statut', ['terminee', 'annulee']).limit(1),
    supabase.from('documents_chauffeur').select('id').eq('chauffeur_id', id).limit(1),
  ])
  if ((coursesHistorique && coursesHistorique.length > 0) || (documents && documents.length > 0)) {
    return { error: 'Ce chauffeur a un historique de courses ou des documents enregistrés — désactivez-le plutôt que de le supprimer.' }
  }

  // Libérer les courses en attente ou acceptées → retour dans le panier
  await supabase
    .from('courses')
    .update({ chauffeur_id: null, statut: 'en_attente' })
    .eq('chauffeur_id', id)
    .in('statut', ['en_attente', 'acceptee'])

  // Supprimer la ligne chauffeur, le profil, puis le compte auth
  await supabase.from('chauffeurs').delete().eq('id', id)
  await supabase.from('profiles').delete().eq('id', id)
  const { error } = await supabase.auth.admin.deleteUser(id)
  if (error) return { error: error.message }

  revalidatePath('/admin/chauffeurs')
  revalidatePath('/admin')
  return {}
}
