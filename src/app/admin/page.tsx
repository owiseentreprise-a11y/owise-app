import { createClient } from '@/lib/supabase/server'
import { STATUT_COURSE_LABEL } from '@/lib/types'
import type { Course, Chauffeur } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function AdminDashboard() {
  const supabase = await createClient()

  // Charger tout en parallèle
  const [coursesRes, chauffeursRes] = await Promise.all([
    supabase
      .from('courses')
      .select('*, clients(*, profiles(*)), chauffeurs(*, profiles(*))')
      .order('date_prevue', { ascending: false })
      .limit(50),
    supabase
      .from('chauffeurs')
      .select('*, profiles(*)'),
  ])

  const courses: Course[] = coursesRes.data ?? []
  const chauffeurs: Chauffeur[] = chauffeursRes.data ?? []
  const dbError = coursesRes.error?.message ?? chauffeursRes.error?.message ?? null

  // KPIs
  const today = new Date().toISOString().split('T')[0]
  const coursesAujourdHui = courses.filter(c => c.date_prevue.startsWith(today))
  const coursesEnCours = courses.filter(c => ['en_route', 'prise_en_charge', 'acceptee'].includes(c.statut))
  const chauffeursDisponibles = chauffeurs.filter(c => c.statut === 'disponible')
  const caJour = coursesAujourdHui
    .filter(c => c.statut === 'terminee')
    .reduce((sum, c) => sum + (c.prix_final ?? c.prix_estime ?? 0), 0)

  const now = new Date()
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      {dbError && (
        <div style={{ background: 'rgba(217,80,80,.15)', border: '1px solid var(--red)', borderRadius: 8, padding: '10px 16px', margin: '16px 32px', fontSize: 12, color: 'var(--red)', fontFamily: 'monospace' }}>
          DB error: {dbError}
        </div>
      )}
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.9)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Dashboard</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'capitalize' }}>{dateLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 11, color: 'var(--grn)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
            {chauffeursDisponibles.length} disponible{chauffeursDisponibles.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 32px', flex: 1 }}>

        {/* KPI Strip */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4,1fr)',
          gap: 14, marginBottom: 28,
        }}>
          {[
            { label: "Courses aujourd'hui", value: coursesAujourdHui.length, unit: 'courses', color: 'var(--t1)' },
            { label: 'En cours maintenant', value: coursesEnCours.length, unit: 'actives', color: 'var(--blu)' },
            { label: 'Chauffeurs disponibles', value: chauffeursDisponibles.length, unit: `/ ${chauffeurs.length}`, color: 'var(--grn)' },
            { label: "CA du jour", value: caJour.toFixed(0), unit: '€', color: 'var(--gold)' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--surface)',
              border: '1px solid var(--gb)',
              borderRadius: 12, padding: '18px 20px',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 10 }}>
                {kpi.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 28, fontWeight: 500, color: kpi.color, lineHeight: 1,
              }}>
                {kpi.value}
                <span style={{ fontSize: 13, color: 'var(--t2)', fontWeight: 400, marginLeft: 4 }}>{kpi.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Courses récentes */}
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(201,168,76,.08)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>
              Courses récentes
            </div>
            <a href="/admin/courses" style={{
              fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              Voir tout →
            </a>
          </div>

          {courses.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Aucune course pour le moment
            </div>
          ) : (
            <div>
              {/* Header table */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 140px 120px 100px',
                padding: '10px 20px',
                fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--t3)', fontWeight: 500,
                borderBottom: '1px solid rgba(201,168,76,.05)',
              }}>
                <div>Trajet</div>
                <div>Client</div>
                <div>Chauffeur</div>
                <div>Date / Heure</div>
                <div style={{ textAlign: 'right' }}>Statut</div>
              </div>

              {courses.slice(0, 10).map(course => {
                const client = (course as any).clients
                const chauffeur = (course as any).chauffeurs
                const clientNom = client?.profiles
                  ? `${client.profiles.prenom} ${client.profiles.nom}`
                  : client?.entreprise_nom ?? '—'
                const chauffeurNom = chauffeur?.profiles
                  ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                  : '—'
                const date = new Date(course.date_prevue)
                const dateStr = date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
                const timeStr = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

                return (
                  <a
                    key={course.id}
                    href={`/admin/courses/${course.id}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr 140px 120px 100px',
                      padding: '13px 20px',
                      borderBottom: '1px solid rgba(201,168,76,.04)',
                      textDecoration: 'none',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                        {course.adresse_depart.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                        → {course.adresse_arrivee.split(',')[0]}
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>{clientNom}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>{chauffeurNom}</div>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 11, color: 'var(--t2)',
                    }}>
                      {dateStr} · {timeStr}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 9.5, padding: '3px 8px',
                        borderRadius: 4, fontWeight: 500,
                        border: '1px solid',
                        ...statusStyle(course.statut),
                      }}>
                        {STATUT_COURSE_LABEL[course.statut]}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function statusStyle(statut: string) {
  const map: Record<string, { color: string; background: string; borderColor: string }> = {
    en_attente:      { color: 'var(--amb)', background: 'rgba(232,160,48,.1)', borderColor: 'rgba(232,160,48,.2)' },
    acceptee:        { color: 'var(--blu)', background: 'rgba(74,142,208,.1)', borderColor: 'rgba(74,142,208,.2)' },
    en_route:        { color: 'var(--blu)', background: 'rgba(74,142,208,.1)', borderColor: 'rgba(74,142,208,.2)' },
    prise_en_charge: { color: 'var(--grn)', background: 'rgba(60,196,124,.1)', borderColor: 'rgba(60,196,124,.2)' },
    terminee:        { color: 'var(--t2)', background: 'var(--elevated)', borderColor: 'var(--t3)' },
    annulee:         { color: 'var(--red)', background: 'rgba(217,80,80,.1)', borderColor: 'rgba(217,80,80,.2)' },
  }
  return map[statut] ?? map.en_attente
}
