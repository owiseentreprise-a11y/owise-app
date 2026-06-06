import { createAdminClient } from '@/lib/supabase/admin'
import PlanningCalendar from './PlanningCalendar'

export const dynamic = 'force-dynamic'

export default async function PlanningPage() {
  const supabase = createAdminClient()

  const now  = new Date()
  const from = new Date(now); from.setDate(from.getDate() - 7); from.setHours(0,0,0,0)
  const to   = new Date(now); to.setDate(now.getDate() + 90); to.setHours(23,59,59,999)

  const [coursesRes, chauffeursRes] = await Promise.all([
    supabase
      .from('courses')
      .select(`
        id, statut, chauffeur_id,
        adresse_depart, adresse_arrivee, date_prevue, nb_passagers, notes,
        clients(type_compte, entreprise_nom, profiles(prenom, nom, telephone)),
        chauffeurs(profiles(prenom, nom)),
        collaborateurs(prenom, nom, tel)
      `)
      .gte('date_prevue', from.toISOString())
      .lte('date_prevue', to.toISOString())
      .not('statut', 'eq', 'annulee')
      .order('date_prevue', { ascending: true }),
    supabase
      .from('chauffeurs')
      .select('id, statut, profiles(prenom, nom)')
      .order('statut'),
  ])

  const courses = (coursesRes.data ?? []) as any[]
  const chauffeursRaw = chauffeursRes.data ?? []
  const chauffeurs = chauffeursRaw.map((c: any) => ({
    id:       c.id,
    statut:   c.statut,
    profiles: Array.isArray(c.profiles) ? (c.profiles[0] ?? null) : (c.profiles ?? null),
  }))

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 24px', height: 60,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Planning</div>
      </div>

      <PlanningCalendar
        courses={courses}
        chauffeurs={chauffeurs}
        initialCourses={courses}
      />
    </>
  )
}
