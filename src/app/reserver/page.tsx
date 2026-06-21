import { createAdminClient } from '@/lib/supabase/admin'
import { createClient }      from '@/lib/supabase/server'
import ReserverClient from './ReserverClient'

export const dynamic = 'force-dynamic'

export default async function ReserverPage() {
  const admin    = createAdminClient()
  const supabase = await createClient()

  const [{ data: { user } }, zonesRes, grilleRes, tarifsRes, paramsRes] = await Promise.all([
    supabase.auth.getUser(),
    admin.from('zones').select('*').eq('active', true).order('ordre'),
    admin.from('grilles_tarifaires').select('*'),
    admin.from('tarifs').select('*'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec').single(),
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
      tarifs={tarifsRes.data ?? []}
      params={paramsRes.data}
      profil={profil}
    />
  )
}
