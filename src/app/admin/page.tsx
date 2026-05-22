import { createClient } from '@/lib/supabase/server'
import { STATUT_COURSE_LABEL, STATUT_COURSE_COLOR } from '@/lib/types'
import type { Course } from '@/lib/types'
import DashboardRefresh from './DashboardRefresh'

export const dynamic = 'force-dynamic'

const STATUT_CHAUFFEUR_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  disponible: { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', label: 'Disponible' },
  en_course:  { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', label: 'En course' },
  hors_ligne: { color: 'var(--t3)',  bg: 'var(--elevated)',      label: 'Hors ligne' },
}

export default async function AdminDashboard() {
  const supabase = await createClient()

  const now    = new Date()
  const today  = now.toISOString().split('T')[0]
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [coursesRes, chauffeursRes, weekRes, monthRes] = await Promise.all([
    supabase
      .from('courses')
      .select('*, clients(*, profiles(*)), chauffeurs(*, profiles(*))')
      .order('date_prevue', { ascending: false })
      .limit(60),
    supabase
      .from('chauffeurs')
      .select('id, statut, vehicule_marque, vehicule_modele, type_vehicule, profiles(prenom, nom)')
      .order('statut'),
    supabase
      .from('courses')
      .select('prix_final, prix_estime, statut')
      .gte('date_prevue', weekStart.toISOString()),
    supabase
      .from('courses')
      .select('prix_final, prix_estime, statut')
      .gte('date_prevue', monthStart.toISOString()),
  ])

  const courses: Course[] = coursesRes.data ?? []
  const chauffeurs        = chauffeursRes.data ?? []
  const weekCourses = weekRes.data ?? []
  const monthCourses = monthRes.data ?? []

  // KPIs jour
  const coursesAujourdHui = courses.filter(c => c.date_prevue.startsWith(today))
  const coursesActives    = courses.filter(c => ['en_route', 'prise_en_charge', 'acceptee'].includes(c.statut))
  const coursesEnAttente  = courses.filter(c => c.statut === 'en_attente')
  const nonAssignees      = coursesEnAttente.filter(c => !c.chauffeur_id)
  const caJour = coursesAujourdHui
    .filter(c => c.statut === 'terminee')
    .reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)

  // KPIs semaine
  const caSemaine = weekCourses
    .filter(c => c.statut === 'terminee')
    .reduce((s: number, c: any) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const coursesSemaine = weekCourses.filter((c: any) => c.statut === 'terminee').length

  // KPIs mois
  const caMois = monthCourses
    .filter(c => c.statut === 'terminee')
    .reduce((s: number, c: any) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const coursesMois = monthCourses.filter((c: any) => c.statut === 'terminee').length

  const chauffeursDisponibles = chauffeurs.filter(c => c.statut === 'disponible')
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <>
      <DashboardRefresh intervalMs={30000} />

      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Dashboard</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'capitalize' }}>{dateLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {nonAssignees.length > 0 && (
            <a href="/admin/courses" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              background: 'rgba(232,160,48,.12)', border: '1px solid rgba(232,160,48,.3)',
              color: 'var(--amb)', fontSize: 11, fontWeight: 500, textDecoration: 'none',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amb)', display: 'inline-block' }} />
              {nonAssignees.length} sans chauffeur
            </a>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--grn)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
            {chauffeursDisponibles.length} disponible{chauffeursDisponibles.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
          {[
            { label: "Aujourd'hui", value: coursesAujourdHui.length, unit: 'courses', color: 'var(--t1)' },
            { label: 'En cours', value: coursesActives.length, unit: 'actives', color: 'var(--blu)' },
            { label: 'Sans chauffeur', value: nonAssignees.length, unit: 'en attente', color: nonAssignees.length > 0 ? 'var(--amb)' : 'var(--t3)' },
            { label: 'CA du jour', value: caJour.toFixed(0), unit: '€', color: 'var(--gold)' },
            { label: 'Disponibles', value: `${chauffeursDisponibles.length}/${chauffeurs.length}`, unit: 'chauffeurs', color: 'var(--grn)' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}>
                {kpi.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 26, fontWeight: 500, color: kpi.color, lineHeight: 1,
              }}>
                {kpi.value}
                <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400, marginLeft: 5 }}>{kpi.unit}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Alert dispatch */}
        {nonAssignees.length > 0 && (
          <div style={{
            background: 'rgba(232,160,48,.06)', border: '1px solid rgba(232,160,48,.2)',
            borderRadius: 12, padding: '14px 20px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>⚠</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--amb)' }}>
                  {nonAssignees.length} course{nonAssignees.length > 1 ? 's' : ''} en attente sans chauffeur
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>
                  {nonAssignees.map(c => c.adresse_depart.split(',')[0]).join(' · ')}
                </div>
              </div>
            </div>
            <a href="/admin/courses" style={{
              padding: '8px 16px', borderRadius: 8, fontSize: 11, fontWeight: 600,
              background: 'rgba(232,160,48,.15)', border: '1px solid rgba(232,160,48,.3)',
              color: 'var(--amb)', textDecoration: 'none',
            }}>
              Dispatcher →
            </a>
          </div>
        )}

        {/* 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

          {/* Colonne principale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Courses actives */}
            {coursesActives.length > 0 && (
              <div style={{
                background: 'var(--surface)', border: '1px solid rgba(74,142,208,.2)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '13px 20px', fontSize: 11, fontWeight: 500, color: 'var(--blu)',
                  borderBottom: '1px solid rgba(74,142,208,.1)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blu)', display: 'inline-block' }} />
                  Courses en cours ({coursesActives.length})
                </div>
                {coursesActives.map(course => {
                  const chauffeur = (course as any).chauffeurs
                  const client = (course as any).clients
                  const chauffeurNom = chauffeur?.profiles ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}` : '—'
                  const clientNom = client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : client?.entreprise_nom ?? '—'
                  return (
                    <a key={course.id} href={`/admin/courses/${course.id}`} style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 90px 70px',
                      padding: '11px 20px', alignItems: 'center',
                      borderBottom: '1px solid rgba(201,168,76,.04)',
                      textDecoration: 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                          {course.adresse_depart.split(',')[0]}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t2)' }}>{chauffeurNom}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{clientNom}</div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                          color: STATUT_COURSE_COLOR[course.statut], background: `${STATUT_COURSE_COLOR[course.statut]}18`,
                          border: `1px solid ${STATUT_COURSE_COLOR[course.statut]}30`,
                        }}>
                          {STATUT_COURSE_LABEL[course.statut]}
                        </span>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Courses récentes */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,.07)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Courses récentes</div>
                <a href="/admin/courses" style={{ fontSize: 11, color: 'var(--t2)', textDecoration: 'none' }}>
                  Voir tout →
                </a>
              </div>

              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 70px',
                padding: '8px 20px', fontSize: 9.5, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 500,
                borderBottom: '1px solid rgba(201,168,76,.05)',
              }}>
                <div>Trajet</div><div>Client</div><div>Chauffeur</div><div>Date</div><div style={{ textAlign: 'right' }}>Statut</div>
              </div>

              {courses.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  Aucune course
                </div>
              ) : courses.slice(0, 12).map(course => {
                const client   = (course as any).clients
                const chauffeur = (course as any).chauffeurs
                const clientNom = client?.profiles
                  ? `${client.profiles.prenom} ${client.profiles.nom}`
                  : client?.entreprise_nom ?? '—'
                const chauffeurNom = chauffeur?.profiles
                  ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                  : '—'
                const date = new Date(course.date_prevue)
                return (
                  <a key={course.id} href={`/admin/courses/${course.id}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 70px',
                    padding: '11px 20px', borderBottom: '1px solid rgba(201,168,76,.04)',
                    textDecoration: 'none', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                        {course.adresse_depart.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{clientNom}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{chauffeurNom}</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)' }}>
                      {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                      {' · '}{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                        color: STATUT_COURSE_COLOR[course.statut],
                        background: `${STATUT_COURSE_COLOR[course.statut]}18`,
                        border: `1px solid ${STATUT_COURSE_COLOR[course.statut]}30`,
                      }}>
                        {STATUT_COURSE_LABEL[course.statut]}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stats semaine / mois */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14, fontWeight: 500 }}>
                Périodes
              </div>
              {[
                { label: 'Cette semaine', courses: coursesSemaine, ca: caSemaine },
                { label: 'Ce mois', courses: coursesMois, ca: caMois },
              ].map(p => (
                <div key={p.label} style={{
                  paddingBottom: 12, marginBottom: 12,
                  borderBottom: '1px solid rgba(201,168,76,.07)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>{p.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 18, color: 'var(--t1)' }}>
                      {p.courses}
                      <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 4 }}>courses</span>
                    </span>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 16, color: 'var(--gold)' }}>
                      {p.ca.toFixed(0)} €
                    </span>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: -4 }}>Courses terminées uniquement</div>
            </div>

            {/* Chauffeurs */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '13px 16px', fontSize: 11, fontWeight: 500, color: 'var(--t1)',
                borderBottom: '1px solid rgba(201,168,76,.07)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>Chauffeurs</span>
                <a href="/admin/chauffeurs" style={{ fontSize: 10, color: 'var(--t2)', textDecoration: 'none' }}>
                  Gérer →
                </a>
              </div>

              {chauffeurs.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>
                  Aucun chauffeur
                </div>
              ) : chauffeurs.map((c: any) => {
                const p = c.profiles
                const prenom = p?.prenom ?? ''
                const nom    = p?.nom ?? ''
                const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
                const s = STATUT_CHAUFFEUR_STYLE[c.statut] ?? STATUT_CHAUFFEUR_STYLE.hors_ligne
                return (
                  <a key={c.id} href={`/admin/chauffeurs/${c.id}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px', borderBottom: '1px solid rgba(201,168,76,.04)',
                    textDecoration: 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: 11, fontWeight: 600, color: 'var(--gold)',
                      }}>{initials}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t1)' }}>
                          {prenom} {nom}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--t3)', marginTop: 1 }}>
                          {[c.vehicule_marque, c.vehicule_modele].filter(Boolean).join(' ') || '—'}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 12, fontWeight: 500,
                      color: s.color, background: s.bg,
                    }}>{s.label}</span>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
