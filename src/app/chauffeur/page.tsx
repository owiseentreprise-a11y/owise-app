import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChauffeurApp from './ChauffeurApp'

export const dynamic = 'force-dynamic'

export default async function ChauffeurPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const in7days = new Date(now)
  in7days.setDate(in7days.getDate() + 7)

  const [profileRes, coursesActifRes, coursesAVenirRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, chauffeurs(*)')
      .eq('id', user.id)
      .single(),
    // Courses actives ou en attente d'acceptation
    supabase
      .from('courses')
      .select('*, clients(type_compte, entreprise_nom, profiles(prenom, nom, telephone)), collaborateurs(profiles(prenom, nom, telephone))')
      .eq('chauffeur_id', user.id)
      .in('statut', ['en_attente', 'acceptee', 'en_route', 'prise_en_charge'])
      .order('date_prevue', { ascending: true }),
    // Prochaines courses planifiées (futures, pas encore démarrées)
    supabase
      .from('courses')
      .select('id, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, type_vehicule, clients(type_compte, entreprise_nom, profiles(prenom, nom)), collaborateurs(profiles(prenom, nom))')
      .eq('chauffeur_id', user.id)
      .eq('statut', 'acceptee')
      .gte('date_prevue', now.toISOString())
      .order('date_prevue', { ascending: true })
      .limit(10),
  ])

  return (
    <ChauffeurApp
      userId={user.id}
      profile={profileRes.data}
      courses={coursesActifRes.data ?? []}
      coursesAVenir={coursesAVenirRes.data ?? []}
    />
  )
}
