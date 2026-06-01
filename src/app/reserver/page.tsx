import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import ReserverClient from './ReserverClient'

export const dynamic = 'force-dynamic'

export default async function ReserverPage() {
  const admin    = createAdminClient()
  const supabase = await createClient()

  const [{ data: { user } }, zonesRes, grilleRes, paramsRes, tarifsRes] = await Promise.all([
    supabase.auth.getUser(),
    admin.from('zones').select('*').order('ordre'),
    admin.from('grilles_tarifaires').select('*'),
    admin.from('parametres').select('*').eq('id', true).single(),
    admin.from('tarifs').select('*'),
  ])

  let profil: { prenom: string; nom: string; email: string; telephone: string } | null = null
  if (user) {
    const { data: p } = await admin
      .from('profiles')
      .select('prenom, nom, telephone')
      .eq('id', user.id)
      .single()
    if (p) {
      profil = {
        prenom:    p.prenom    ?? '',
        nom:       p.nom       ?? '',
        email:     user.email  ?? '',
        telephone: p.telephone ?? '',
      }
    }
  }

  return (
    <ReserverClient
      zones={zonesRes.data ?? []}
      grille={grilleRes.data ?? []}
      params={paramsRes.data}
      tarifs={tarifsRes.data ?? []}
      profil={profil}
    />
  )
}
