import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import SousTraitantPortal from './SousTraitantPortal'

export const dynamic = 'force-dynamic'

export default async function SousTraitantPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sous-traitant-login')

  const admin = createAdminClient()

  // Récupérer la fiche sous-traitant liée à ce user
  const { data: st } = await admin
    .from('sous_traitants')
    .select('id, nom, telephone, mode_paiement')
    .eq('user_id', user.id)
    .single()

  if (!st) redirect('/sous-traitant-login')

  const now = new Date()
  const in30days = new Date(now)
  in30days.setDate(in30days.getDate() + 30)

  const COURSE_FIELDS = 'id, statut, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, type_vehicule, notes, prix_sous_traitant, client_id'
  const CLIENT_JOIN = ', clients(type_compte, entreprise_nom, nom, prenom, tel, profiles(prenom, nom, telephone))'

  const [coursesRes, planningRes, historiqueRes, facturesRes] = await Promise.all([
    admin.from('courses')
      .select(COURSE_FIELDS + CLIENT_JOIN)
      .eq('sous_traitant_id', st.id)
      .in('statut', ['en_attente', 'acceptee', 'en_route', 'prise_en_charge'])
      .order('date_prevue', { ascending: true }),

    admin.from('courses')
      .select(COURSE_FIELDS + CLIENT_JOIN)
      .eq('sous_traitant_id', st.id)
      .in('statut', ['acceptee', 'en_attente'])
      .gte('date_prevue', now.toISOString())
      .lte('date_prevue', in30days.toISOString())
      .order('date_prevue', { ascending: true })
      .limit(50),

    admin.from('courses')
      .select(COURSE_FIELDS + CLIENT_JOIN)
      .eq('sous_traitant_id', st.id)
      .eq('statut', 'terminee')
      .order('date_prevue', { ascending: false })
      .limit(20),

    admin.from('factures_sous_traitants')
      .select('*')
      .eq('sous_traitant_id', st.id)
      .order('periode', { ascending: false })
      .limit(12),
  ])

  return (
    <SousTraitantPortal
      userId={user.id}
      stId={st.id}
      stNom={st.nom}
      stTelephone={(st as any).telephone ?? ''}
      modePaiement={(st as any).mode_paiement ?? 'mensuel'}
      courses={coursesRes.data ?? []}
      planning={planningRes.data ?? []}
      historique={historiqueRes.data ?? []}
      factures={facturesRes.data ?? []}
    />
  )
}
