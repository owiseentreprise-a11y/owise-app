import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import ChauffeurApp from './ChauffeurApp'

export const dynamic = 'force-dynamic'

export default async function ChauffeurPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now      = new Date()
  const in30days = new Date(now)
  in30days.setDate(in30days.getDate() + 30)

  // Champs sans join clients (évite la récursion RLS)
  const COURSE_FIELDS = 'id, statut, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, type_vehicule, notes, prix_estime, prix_final, paiement_a_bord, prix_chauffeur, client_id, passager_prenom, passager_nom, passager_tel'

  const [profileRes, coursesActifRes, planningRes, historiqueRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, chauffeurs(*)')
      .eq('id', user.id)
      .single(),

    supabase
      .from('courses')
      .select(COURSE_FIELDS)
      .eq('chauffeur_id', user.id)
      .in('statut', ['en_attente', 'acceptee', 'en_route', 'prise_en_charge'])
      .order('date_prevue', { ascending: true }),

    supabase
      .from('courses')
      .select(COURSE_FIELDS)
      .eq('chauffeur_id', user.id)
      .in('statut', ['acceptee', 'en_attente'])
      .gte('date_prevue', now.toISOString())
      .lte('date_prevue', in30days.toISOString())
      .order('date_prevue', { ascending: true })
      .limit(30),

    supabase
      .from('courses')
      .select(COURSE_FIELDS)
      .eq('chauffeur_id', user.id)
      .eq('statut', 'terminee')
      .order('date_prevue', { ascending: false })
      .limit(20),
  ])

  // Fetch client data via admin client (bypass RLS, server-side uniquement)
  const allCourses = [
    ...(coursesActifRes.data ?? []),
    ...(planningRes.data ?? []),
    ...(historiqueRes.data ?? []),
  ]
  const clientIds = [...new Set(allCourses.map((c: any) => c.client_id).filter(Boolean))]

  const clientsById: Record<string, any> = {}
  if (clientIds.length > 0) {
    const admin = createAdminClient()
    const { data: clientsData } = await admin
      .from('clients')
      .select('id, type_compte, entreprise_nom, nom, prenom, tel, email, profiles(prenom, nom, telephone)')
      .in('id', clientIds)
    ;(clientsData ?? []).forEach((c: any) => { clientsById[c.id] = c })
  }

  function enrich(courses: any[]) {
    return courses.map((c: any) => ({
      ...c,
      clients: c.client_id ? (clientsById[c.client_id] ?? null) : null,
    }))
  }

  return (
    <ChauffeurApp
      userId={user.id}
      profile={profileRes.data}
      courses={enrich(coursesActifRes.data ?? [])}
      planning={enrich(planningRes.data ?? [])}
      historique={enrich(historiqueRes.data ?? [])}
    />
  )
}
