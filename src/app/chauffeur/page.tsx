import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import ChauffeurApp from './ChauffeurApp'

export default async function ChauffeurPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Charger le profil + les courses assignées
  const [profileRes, coursesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('*, chauffeurs(*)')
      .eq('id', user.id)
      .single(),
    supabase
      .from('courses')
      .select('*, clients(*, profiles(*))')
      .eq('chauffeur_id', user.id)
      .in('statut', ['acceptee', 'en_route', 'prise_en_charge', 'en_attente'])
      .order('date_prevue', { ascending: true }),
  ])

  return (
    <ChauffeurApp
      userId={user.id}
      profile={profileRes.data}
      courses={coursesRes.data ?? []}
    />
  )
}
