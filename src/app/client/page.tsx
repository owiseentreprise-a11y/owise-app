import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STATUT_COURSE_LABEL, TYPE_VEHICULE_LABEL } from '@/lib/types'
import type { Course } from '@/lib/types'

export const revalidate = 0

const statutStyle = (statut: string) => {
  const map: Record<string, { color: string; bg: string }> = {
    en_attente:      { color: 'var(--amb)', bg: 'rgba(232,160,48,.1)' },
    acceptee:        { color: 'var(--blu)', bg: 'rgba(74,142,208,.1)' },
    en_route:        { color: 'var(--blu)', bg: 'rgba(74,142,208,.1)' },
    prise_en_charge: { color: 'var(--grn)', bg: 'rgba(60,196,124,.1)' },
    terminee:        { color: 'var(--t2)',  bg: 'var(--elevated)' },
    annulee:         { color: 'var(--red)', bg: 'rgba(217,80,80,.1)' },
  }
  return map[statut] ?? map.en_attente
}

export default async function ClientPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, clientRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('clients').select('*').eq('id', user.id).single(),
  ])

  const profile = profileRes.data
  const client = clientRes.data

  // Prochaine course
  const { data: prochainesCourses } = await supabase
    .from('courses')
    .select('*, chauffeurs(*, profiles(*))')
    .eq('client_id', user.id)
    .in('statut', ['en_attente', 'acceptee', 'en_route', 'prise_en_charge'])
    .order('date_prevue', { ascending: true })
    .limit(1)

  // Historique
  const { data: historique } = await supabase
    .from('courses')
    .select('*, chauffeurs(*, profiles(*))')
    .eq('client_id', user.id)
    .in('statut', ['terminee', 'annulee'])
    .order('date_prevue', { ascending: false })
    .limit(10)

  const prochaine: Course | null = prochainesCourses?.[0] ?? null
  const courses: Course[] = historique ?? []

  const prenom = profile?.prenom ?? 'Client'
  const nom = profile?.nom ?? ''
  const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--base)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      paddingBottom: 40,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gb)',
        padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 22, fontWeight: 500,
            letterSpacing: '.1em', color: 'var(--gold)',
          }}>OWISE</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))',
            border: '1px solid rgba(201,168,76,.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 15, fontWeight: 600, color: 'var(--gold)',
          }}>{initials}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{prenom} {nom}</div>
            <div style={{ fontSize: 10, color: 'var(--t2)' }}>
              {client?.type_compte === 'entreprise' ? client.entreprise_nom : 'Client particulier'}
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 24px 0', maxWidth: 640, margin: '0 auto' }}>

        {/* Course active / prochaine */}
        {prochaine ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid rgba(201,168,76,.2)',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 20,
            boxShadow: '0 8px 32px rgba(201,168,76,.06)',
          }}>
            {/* Bande or */}
            <div style={{
              background: 'linear-gradient(90deg,rgba(201,168,76,.12),transparent)',
              padding: '10px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{
                fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                color: 'var(--gold)', fontWeight: 500,
              }}>
                {['en_route', 'prise_en_charge'].includes(prochaine.statut) ? 'Course en cours' : 'Prochaine course'}
              </div>
              {(() => {
                const s = statutStyle(prochaine.statut)
                return (
                  <span style={{
                    fontSize: 9.5, padding: '3px 10px', borderRadius: 20,
                    color: s.color, background: s.bg,
                    border: `1px solid ${s.color}30`, fontWeight: 500,
                  }}>
                    {STATUT_COURSE_LABEL[prochaine.statut]}
                  </span>
                )
              })()}
            </div>

            <div style={{ padding: '16px 18px' }}>
              {/* Trajet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{prochaine.adresse_depart}</div>
                </div>
                <div style={{ marginLeft: 4, width: 1, height: 12, background: 'var(--t3)' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{prochaine.adresse_arrivee}</div>
                </div>
              </div>

              {/* Méta */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>Date</div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 12, color: 'var(--t1)',
                  }}>
                    {new Date(prochaine.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long' })}
                    {' · '}
                    {new Date(prochaine.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>Véhicule</div>
                  <div style={{ fontSize: 12, color: 'var(--t1)' }}>{TYPE_VEHICULE_LABEL[prochaine.type_vehicule]}</div>
                </div>
                {prochaine.prix_estime && (
                  <div>
                    <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>Tarif</div>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 13, fontWeight: 500, color: 'var(--gold)',
                    }}>{prochaine.prix_estime} €</div>
                  </div>
                )}
              </div>

              {/* Chauffeur */}
              {(prochaine as any).chauffeurs && (
                <div style={{
                  background: 'var(--elevated)', borderRadius: 10,
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,rgba(201,168,76,.15),rgba(201,168,76,.04))',
                    border: '1px solid rgba(201,168,76,.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: 13, color: 'var(--gold)',
                  }}>
                    {((prochaine as any).chauffeurs?.profiles?.prenom?.[0] ?? '') + ((prochaine as any).chauffeurs?.profiles?.nom?.[0] ?? '')}
                  </div>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>
                      {(prochaine as any).chauffeurs?.profiles?.prenom} {(prochaine as any).chauffeurs?.profiles?.nom}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                      {(prochaine as any).chauffeurs?.vehicule_marque} {(prochaine as any).chauffeurs?.vehicule_modele}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--gb)',
            borderRadius: 16, padding: '32px 24px',
            textAlign: 'center', marginBottom: 20,
          }}>
            <div style={{ fontSize: 30, marginBottom: 10 }}>🚗</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
              Aucune course prévue
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>
              Contactez-nous pour réserver votre prochain trajet.
            </div>
          </div>
        )}

        {/* Historique */}
        {courses.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--gb)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 18px',
              borderBottom: '1px solid rgba(201,168,76,.07)',
              fontSize: 12, fontWeight: 500, color: 'var(--t1)',
            }}>
              Historique
            </div>

            {courses.map((course, i) => {
              const s = statutStyle(course.statut)
              const date = new Date(course.date_prevue)
              return (
                <div
                  key={course.id}
                  style={{
                    padding: '12px 18px',
                    borderBottom: i < courses.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                      {course.adresse_depart.split(',')[0]}
                      <span style={{ color: 'var(--t3)', margin: '0 6px' }}>→</span>
                      {course.adresse_arrivee.split(',')[0]}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 10, color: 'var(--t2)',
                    }}>
                      {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      {' · '}
                      {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {course.prix_final && (
                      <div style={{
                        fontFamily: 'var(--font-jetbrains), monospace',
                        fontSize: 13, color: 'var(--gold)',
                      }}>
                        {course.prix_final} €
                      </div>
                    )}
                    <span style={{
                      fontSize: 9.5, padding: '3px 8px', borderRadius: 4,
                      color: s.color, background: s.bg,
                      border: `1px solid ${s.color}30`, fontWeight: 500,
                    }}>
                      {STATUT_COURSE_LABEL[course.statut]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
