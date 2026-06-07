import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import NouveauChauffeurForm from './NouveauChauffeurForm'

export const dynamic = 'force-dynamic'

export default async function NouveauChauffeurPage() {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { data: sousTraitants } = await supabase
    .from('sous_traitants')
    .select('id, nom')
    .eq('actif', true)
    .order('nom')

  return <NouveauChauffeurForm sousTraitants={sousTraitants ?? []} />
}
