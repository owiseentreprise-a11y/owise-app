import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import NouvelleCourseForm from './NouvelleCourseForm'

export const dynamic = 'force-dynamic'

export default async function NouvelleCourse() {
  await requireAdminClient()
  const supabase = createAdminClient()

  const [clientsRes, chauffeursRes, collabsRes, sousTraitantsRes, zonesRes, grilleRes, paramsRes] = await Promise.all([
    supabase.from('clients').select('id, entreprise_nom, type_compte, profiles(prenom, nom)'),
    supabase.from('chauffeurs').select('id, statut, vehicule_marque, vehicule_modele, profiles(prenom, nom)')
      .in('statut', ['disponible', 'hors_ligne']),
    supabase.from('collaborateurs').select('id, client_id, poste, profiles(prenom, nom)'),
    supabase.from('sous_traitants').select('id, nom').eq('actif', true).order('nom'),
    supabase.from('zones').select('*').order('ordre'),
    supabase.from('grilles_tarifaires').select('*'),
    supabase.from('parametres').select('*').eq('id', true).single(),
  ])

  const now = new Date()
  now.setHours(now.getHours() + 1, Math.ceil(now.getMinutes() / 15) * 15, 0, 0)
  const defaultDatetime = now.toISOString().slice(0, 16)

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <a href="/admin/courses" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Courses
        </a>
        <div style={{ width: 1, height: 16, background: 'var(--t3)' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Nouvelle course</div>
      </div>

      <div style={{ padding: '32px', maxWidth: 700 }}>
        <NouvelleCourseForm
          clients={clientsRes.data as any ?? []}
          collabs={collabsRes.data as any ?? []}
          chauffeurs={chauffeursRes.data as any ?? []}
          sousTraitants={sousTraitantsRes.data as any ?? []}
          zones={zonesRes.data as any ?? []}
          grille={grilleRes.data as any ?? []}
          params={paramsRes.data as any}
          defaultDatetime={defaultDatetime}
        />
      </div>
    </>
  )
}
