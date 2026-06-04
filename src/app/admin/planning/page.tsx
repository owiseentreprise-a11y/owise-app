import { createAdminClient } from '@/lib/supabase/admin'
import { STATUT_COURSE_COLOR, STATUT_COURSE_LABEL } from '@/lib/types'
import DispatchRapideButton from '../courses/DispatchRapideButton'

export const dynamic = 'force-dynamic'

function dateKey(date: Date) {
  return date.toISOString().split('T')[0]
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function formatJourLabel(date: Date, todayKey: string) {
  const key = dateKey(date)
  if (key === todayKey) return "Aujourd'hui"
  const diff = Math.round((date.setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / 86400000)
  if (diff === 1) return 'Demain'
  if (diff === -1) return 'Hier'
  return new Date(key).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric' })
}

function formatMonthLabel(mk: string) {
  const [y, m] = mk.split('-')
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export default async function PlanningPage() {
  const supabase = createAdminClient()

  const now = new Date()
  const from = new Date(now); from.setHours(0, 0, 0, 0)
  const to   = new Date(now); to.setDate(now.getDate() + 90); to.setHours(23, 59, 59, 999)

  const [coursesRes, chauffeursRes] = await Promise.all([
    supabase
      .from('courses')
      .select(`
        id, statut, chauffeur_id, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, notes,
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

  const { data: courses } = coursesRes
  const chauffeursRaw = chauffeursRes.data ?? []
  const chauffeursList = chauffeursRaw.map((c: any) => ({
    id: c.id,
    statut: c.statut,
    profiles: c.profiles ?? null,
  }))

  const list = courses ?? []
  const todayKey = dateKey(from)

  // Grouper par jour (seulement les jours avec des courses)
  const byDay = new Map<string, typeof list>()
  for (const c of list) {
    const key = dateKey(new Date(c.date_prevue))
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(c)
  }

  // Grouper les jours par mois
  const byMonth = new Map<string, string[]>()
  for (const key of byDay.keys()) {
    const mk = monthKey(new Date(key))
    if (!byMonth.has(mk)) byMonth.set(mk, [])
    byMonth.get(mk)!.push(key)
  }

  const months = Array.from(byMonth.keys()).sort()
  const totalCourses = list.length
  const todayCount = byDay.get(todayKey)?.length ?? 0
  const daysWithCourses = byDay.size

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Planning</div>
          <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
          <div style={{ fontSize: 11, color: 'var(--t2)', display: 'flex', gap: 12 }}>
            <span>
              <span style={{ color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>{todayCount}</span>
              {' '}aujourd'hui
            </span>
            <span>
              <span style={{ color: 'var(--gold)', fontFamily: 'var(--font-jetbrains), monospace' }}>{totalCourses}</span>
              {' '}sur 90 jours
            </span>
            <span>
              <span style={{ color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>{daysWithCourses}</span>
              {' '}jours chargés
            </span>
          </div>
        </div>
        <a href="/admin/courses/nouvelle" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--gold)', color: 'var(--base)',
          padding: '7px 14px', borderRadius: 8,
          fontSize: 11, fontWeight: 600, textDecoration: 'none',
        }}>
          + Nouvelle course
        </a>
      </div>

      {/* Navigation par mois */}
      {months.length > 1 && (
        <div style={{
          position: 'sticky', top: 60, zIndex: 40,
          background: 'var(--surface)', 
          borderBottom: '1px solid rgba(201,168,76,.06)',
          padding: '0 32px',
          display: 'flex', alignItems: 'center', gap: 6, height: 40, overflowX: 'auto',
        }}>
          {months.map(mk => (
            <a
              key={mk}
              href={`#month-${mk}`}
              style={{
                padding: '4px 12px', borderRadius: 6,
                fontSize: 11, fontWeight: 500,
                color: 'var(--t2)', textDecoration: 'none',
                whiteSpace: 'nowrap',
                border: '1px solid transparent',
              }}
            >
              {formatMonthLabel(mk)}
              <span style={{
                marginLeft: 6, fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 9, color: 'var(--t3)',
              }}>
                {byMonth.get(mk)!.reduce((s, k) => s + (byDay.get(k)?.length ?? 0), 0)}
              </span>
            </a>
          ))}
        </div>
      )}

      <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>

        {totalCourses === 0 ? (
          <div style={{
            padding: '60px', textAlign: 'center',
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, color: 'var(--t3)', fontSize: 13,
          }}>
            Aucune course programmée sur les 90 prochains jours
          </div>
        ) : months.map(mk => (
          <div key={mk} id={`month-${mk}`}>
            {/* En-tête mois */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 16,
              padding: '24px 0 12px',
            }}>
              <div style={{
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 20, fontWeight: 500, color: 'var(--t1)',
                textTransform: 'capitalize',
              }}>
                {formatMonthLabel(mk)}
              </div>
              <div style={{ flex: 1, height: 1, background: 'rgba(201,168,76,.1)' }} />
              <div style={{
                fontSize: 10, color: 'var(--t3)',
                fontFamily: 'var(--font-jetbrains), monospace',
              }}>
                {byMonth.get(mk)!.reduce((s, k) => s + (byDay.get(k)?.length ?? 0), 0)} courses
              </div>
            </div>

            {/* Jours du mois */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {byMonth.get(mk)!.sort().map(dayKey => {
                const dayCourses = byDay.get(dayKey) ?? []
                const dayDate = new Date(dayKey + 'T12:00:00')
                const isToday = dayKey === todayKey
                const jourLabel = formatJourLabel(new Date(dayKey + 'T12:00:00'), todayKey)

                return (
                  <div key={dayKey}>
                    {/* En-tête jour */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6,
                    }}>
                      <div style={{
                        minWidth: 36, height: 36, borderRadius: isToday ? 10 : 8,
                        background: isToday ? 'var(--gold)' : 'var(--elevated)',
                        border: isToday ? 'none' : '1px solid var(--t3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexDirection: 'column',
                        flexShrink: 0,
                      }}>
                        <div style={{
                          fontFamily: 'var(--font-jetbrains), monospace',
                          fontSize: 14, fontWeight: 700, lineHeight: 1,
                          color: isToday ? 'var(--base)' : 'var(--t1)',
                        }}>
                          {dayDate.getDate()}
                        </div>
                      </div>
                      <div>
                        <div style={{
                          fontSize: 12, fontWeight: 600, color: isToday ? 'var(--gold)' : 'var(--t1)',
                          textTransform: 'capitalize',
                        }}>
                          {jourLabel}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                          {dayCourses.length} course{dayCourses.length > 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>

                    {/* Liste des courses */}
                    <div style={{ marginLeft: 46, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {dayCourses.map((course: any) => {
                        const date = new Date(course.date_prevue)
                        const client = course.clients
                        const chauffeur = course.chauffeurs
                        const collab = course.collaborateurs

                        const clientNom = client?.type_compte === 'entreprise'
                          ? (client.entreprise_nom ?? '—')
                          : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : '—'

                        const collabNom = collab?.profiles
                          ? `${collab.profiles.prenom} ${collab.profiles.nom}`
                          : null

                        const tel = collab?.profiles?.telephone
                          ?? (client?.type_compte !== 'entreprise' ? client?.profiles?.telephone : null)

                        const chauffeurNom = chauffeur?.profiles
                          ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                          : null

                        const statColor = STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR]
                        const statLabel = STATUT_COURSE_LABEL[course.statut as keyof typeof STATUT_COURSE_LABEL]

                        return (
                          <a
                            key={course.id}
                            href={`/admin/courses/${course.id}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '60px 1fr 160px 156px 40px 80px',
                              padding: '11px 16px',
                              background: 'var(--surface)',
                              border: `1px solid ${isToday ? 'rgba(201,168,76,.1)' : 'var(--gb)'}`,
                              borderRadius: 9,
                              alignItems: 'center', gap: 14,
                              textDecoration: 'none',
                            }}
                          >
                            {/* Heure */}
                            <div style={{
                              fontFamily: 'var(--font-jetbrains), monospace',
                              fontSize: 16, fontWeight: 600,
                              color: isToday ? 'var(--gold)' : 'var(--t1)',
                            }}>
                              {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>

                            {/* Trajet */}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                                {course.adresse_depart}
                              </div>
                              <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                                → {course.adresse_arrivee}
                              </div>
                              {course.notes && (
                                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 3, fontStyle: 'italic' }}>
                                  {course.notes}
                                </div>
                              )}
                            </div>

                            {/* Client */}
                            <div>
                              <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{clientNom}</div>
                              {collabNom && (
                                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>↳ {collabNom}</div>
                              )}
                              {tel && (
                                <div style={{ fontSize: 10, color: 'var(--gold)', marginTop: 2 }}>{tel}</div>
                              )}
                            </div>

                            {/* Chauffeur — dispatch inline */}
                            <div onClick={e => e.preventDefault()}>
                              {course.statut === 'terminee' || course.statut === 'annulee' ? (
                                <span style={{ fontSize: 11, color: 'var(--t2)' }}>
                                  {chauffeurNom ?? '—'}
                                </span>
                              ) : (
                                <DispatchRapideButton
                                  courseId={course.id}
                                  chauffeurs={chauffeursList}
                                  currentChauffeurId={(course as any).chauffeur_id ?? null}
                                  currentChauffeurNom={chauffeurNom}
                                />
                              )}
                            </div>

                            {/* Passagers */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                              <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="var(--t3)" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                              </svg>
                              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: 'var(--t2)' }}>
                                {course.nb_passagers ?? 1}
                              </span>
                            </div>

                            {/* Statut */}
                            <div style={{ textAlign: 'right' }}>
                              <span style={{
                                fontSize: 9, padding: '3px 7px', borderRadius: 4, fontWeight: 500,
                                color: statColor,
                                background: `${statColor}18`,
                                border: `1px solid ${statColor}30`,
                              }}>
                                {statLabel}
                              </span>
                            </div>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
