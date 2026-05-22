import { createClient } from '@/lib/supabase/server'
import type { Course } from '@/lib/types'
import UpdateStatutButton from './UpdateStatutButton'

export const revalidate = 0

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('*, clients(*, profiles(*)), chauffeurs(*, profiles(*))')
    .order('date_prevue', { ascending: false })

  const list: Course[] = courses ?? []

  return (
    <>
      <style>{`.course-row:hover { background: rgba(201,168,76,.03); }`}</style>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
          Courses <span style={{ color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12 }}>({list.length})</span>
        </div>
        <a href="/admin/courses/nouvelle" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--gold)', color: 'var(--base)',
          padding: '8px 16px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
        }}>
          + Nouvelle course
        </a>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 140px 130px 160px 100px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>Trajet</div>
            <div>Client</div>
            <div>Chauffeur</div>
            <div>Date / Heure</div>
            <div>Statut</div>
            <div style={{ textAlign: 'right' }}>Prix</div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Aucune course enregistrée
            </div>
          ) : (
            list.map(course => {
              const client = (course as any).clients
              const chauffeur = (course as any).chauffeurs
              const clientNom = client?.profiles
                ? `${client.profiles.prenom} ${client.profiles.nom}`
                : client?.entreprise_nom ?? '—'
              const chauffeurNom = chauffeur?.profiles
                ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                : 'Non assigné'
              const date = new Date(course.date_prevue)

              return (
                <a
                  key={course.id}
                  href={`/admin/courses/${course.id}`}
                  className="course-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 140px 130px 160px 100px',
                    padding: '13px 20px',
                    borderBottom: '1px solid rgba(201,168,76,.04)',
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                      {course.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>{clientNom}</div>
                  <div style={{ fontSize: 12, color: chauffeur ? 'var(--t2)' : 'var(--t3)' }}>{chauffeurNom}</div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 11, color: 'var(--t2)',
                  }}>
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div onClick={e => e.preventDefault()}>
                    <UpdateStatutButton courseId={course.id} statut={course.statut} />
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 13, color: 'var(--gold)',
                  }}>
                    {course.prix_final ?? course.prix_estime ? `${(course.prix_final ?? course.prix_estime)!.toFixed(0)} €` : '—'}
                  </div>
                </a>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
