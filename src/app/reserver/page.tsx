import { createAdminClient } from '@/lib/supabase/admin'
import ReserverClient from './ReserverClient'

export const dynamic = 'force-dynamic'

export default async function ReserverPage() {
  const supabase = createAdminClient()

  const [zonesRes, grilleRes, paramsRes, tarifsRes] = await Promise.all([
    supabase.from('zones').select('*').order('ordre'),
    supabase.from('grilles_tarifaires').select('*'),
    supabase.from('parametres').select('*').eq('id', true).single(),
    supabase.from('tarifs').select('*'),
  ])

  return (
    <ReserverClient
      zones={zonesRes.data ?? []}
      grille={grilleRes.data ?? []}
      params={paramsRes.data}
      tarifs={tarifsRes.data ?? []}
    />
  )
}
