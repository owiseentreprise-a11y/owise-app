'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TYPE_VEHICULE_LABEL, type StatutCourse, type StatutChauffeur } from '@/lib/types'

const ETAPES: { statut: StatutCourse; label: string; action: string; color: string }[] = [
  { statut: 'acceptee',        label: 'Course acceptée',  action: 'Départ vers le client', color: 'var(--blu)' },
  { statut: 'en_route',        label: 'En route',         action: 'Client pris en charge', color: 'var(--amb)' },
  { statut: 'prise_en_charge', label: 'Client à bord',    action: 'Terminer la course',    color: 'var(--grn)' },
  { statut: 'terminee',        label: 'Course terminée',  action: '',                       color: 'var(--t2)' },
]

const PROGRESSION: Partial<Record<StatutCourse, StatutCourse>> = {
  acceptee:        'en_route',
  en_route:        'prise_en_charge',
  prise_en_charge: 'terminee',
}

export default function ChauffeurApp({
  userId,
  profile,
  courses,
  coursesAVenir,
}: {
  userId: string
  profile: any
  courses: any[]
  coursesAVenir: any[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dispo, setDispo] = useState<StatutChauffeur>(profile?.chauffeurs?.statut ?? 'hors_ligne')

  // Realtime : refresh immédiat à chaque changement de course assignée
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('chauffeur-courses-rt')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'courses',
        filter: `chauffeur_id=eq.${userId}`,
      }, () => router.refresh())
      .subscribe()

    // Fallback polling 60s si la WebSocket tombe
    const fallback = setInterval(() => router.refresh(), 60_000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(fallback)
    }
  }, [userId, router])

  // Séparer course entrante (en_attente) des courses actives
  const pendingCourse = courses.find(c => c.statut === 'en_attente') ?? null
  const activeCourse = courses.find(c => ['acceptee', 'en_route', 'prise_en_charge'].includes(c.statut)) ?? null
  const todayCourses = courses.filter(c => c.statut === 'terminee')

  const prenom = profile?.prenom ?? 'Chauffeur'
  const nom = profile?.nom ?? ''
  const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()

  async function toggleDispo() {
    const next: StatutChauffeur = dispo === 'disponible' ? 'hors_ligne' : 'disponible'
    setDispo(next)
    const supabase = createClient()
    await supabase.from('chauffeurs').update({ statut: next }).eq('id', userId)
  }

  async function deconnecter() {
    const supabase = createClient()
    await supabase.from('chauffeurs').update({ statut: 'hors_ligne' }).eq('id', userId)
    await supabase.auth.signOut()
    router.push('/login')
  }

  function mapsUrl(adresse: string) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`
  }

  async function accepterCourse(courseId: string) {
    startTransition(async () => {
      const supabase = createClient()
      await supabase.from('courses').update({ statut: 'acceptee' }).eq('id', courseId)
      await supabase.from('chauffeurs').update({ statut: 'en_course' }).eq('id', userId)
      setDispo('en_course')
      router.refresh()
    })
  }

  async function refuserCourse(courseId: string) {
    startTransition(async () => {
      const supabase = createClient()
      // Désassigner le chauffeur et remettre en attente
      await supabase.from('courses').update({ statut: 'en_attente', chauffeur_id: null }).eq('id', courseId)
      router.refresh()
    })
  }

  async function nextStatut() {
    if (!activeCourse) return
    const next = PROGRESSION[activeCourse.statut as StatutCourse]
    if (!next) return
    startTransition(async () => {
      const supabase = createClient()
      const updates: Record<string, any> = { statut: next }
      if (next === 'en_route') updates.date_debut = new Date().toISOString()
      if (next === 'terminee') updates.date_fin = new Date().toISOString()
      await supabase.from('courses').update(updates).eq('id', activeCourse.id)
      if (next === 'terminee') {
        await supabase.from('chauffeurs').update({ statut: 'disponible' }).eq('id', userId)
        setDispo('disponible')
      }
      router.refresh()
    })
  }

  const etapeIndex = ETAPES.findIndex(e => e.statut === activeCourse?.statut)
  const etape = ETAPES[etapeIndex]
  const activeClient = activeCourse?.clients
  const activeClientNom = activeClient?.profiles
    ? `${activeClient.profiles.prenom} ${activeClient.profiles.nom}`
    : '—'
  const pendingClient = pendingCourse?.clients
  const pendingClientNom = pendingClient?.profiles
    ? `${pendingClient.profiles.prenom} ${pendingClient.profiles.nom}`
    : 'Client'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--base)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      paddingBottom: 32,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gb)',
        padding: '18px 20px 14px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg,rgba(201,168,76,.25),rgba(201,168,76,.06))',
              border: '1.5px solid rgba(201,168,76,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 17, fontWeight: 600, color: 'var(--gold)',
            }}>{initials}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{prenom} {nom}</div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                {profile?.chauffeurs?.vehicule_marque} {profile?.chauffeurs?.vehicule_modele}
              </div>
            </div>
          </div>
          {/* Déconnexion + Toggle dispo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={deconnecter}
            title="Se déconnecter"
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'var(--elevated)',
              border: '1px solid var(--t3)',
              color: 'var(--t2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
          >
            <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
          </button>
          <button
            onClick={toggleDispo}
            disabled={dispo === 'en_course'}
            style={{
              padding: '8px 16px', borderRadius: 100,
              background: dispo === 'disponible' ? 'var(--grn)'
                : dispo === 'en_course' ? 'rgba(74,142,208,.2)'
                : 'var(--elevated)',
              border: dispo === 'disponible' ? 'none'
                : dispo === 'en_course' ? '1px solid rgba(74,142,208,.3)'
                : '1px solid var(--t3)',
              color: dispo === 'disponible' ? 'var(--base)'
                : dispo === 'en_course' ? 'var(--blu)'
                : 'var(--t2)',
              fontSize: 12, fontWeight: 600,
              cursor: dispo === 'en_course' ? 'default' : 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              boxShadow: dispo === 'disponible' ? '0 4px 12px rgba(60,196,124,.3)' : 'none',
            }}
          >
            {dispo === 'disponible' ? '● Disponible' : dispo === 'en_course' ? '⚡ En course' : '○ Hors ligne'}
          </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 0' }}>

        {/* ── COURSE ENTRANTE (en_attente) ── */}
        {pendingCourse && !activeCourse && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid rgba(232,160,48,.35)',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(232,160,48,.12)',
            animation: 'pulse-border 2s ease-in-out infinite',
          }}>
            <style>{`
              @keyframes pulse-border {
                0%, 100% { box-shadow: 0 8px 32px rgba(232,160,48,.12); }
                50% { box-shadow: 0 8px 40px rgba(232,160,48,.25); }
              }
            `}</style>

            {/* Bande */}
            <div style={{
              background: 'linear-gradient(90deg,rgba(232,160,48,.18),transparent)',
              padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--amb)',
                boxShadow: '0 0 6px var(--amb)',
              }} />
              <span style={{
                fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                color: 'var(--amb)', fontWeight: 600,
              }}>
                Nouvelle course — Répondre
              </span>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {/* Trajet */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                  <a href={mapsUrl(pendingCourse.adresse_depart)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>{pendingCourse.adresse_depart}</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                  <a href={mapsUrl(pendingCourse.adresse_arrivee)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>{pendingCourse.adresse_arrivee}</a>
                </div>
              </div>

              {/* Infos */}
              <div style={{
                background: 'var(--elevated)', borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>Client</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{pendingClientNom}</div>
                  <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                    {new Date(pendingCourse.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {' · '}
                    {TYPE_VEHICULE_LABEL[pendingCourse.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL]}
                    {' · '}
                    {pendingCourse.nb_passagers} pass.
                  </div>
                </div>
                {pendingCourse.prix_estime && (
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 22, fontWeight: 500, color: 'var(--gold)',
                  }}>
                    {pendingCourse.prix_estime} €
                  </div>
                )}
              </div>

              {/* Boutons Accept / Refus */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button
                  onClick={() => refuserCourse(pendingCourse.id)}
                  disabled={pending}
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'rgba(217,80,80,.1)',
                    border: '1px solid rgba(217,80,80,.25)',
                    color: 'var(--red)',
                    fontSize: 14, fontWeight: 600,
                    cursor: pending ? 'wait' : 'pointer',
                    opacity: pending ? .5 : 1,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}
                >
                  ✕ Refuser
                </button>
                <button
                  onClick={() => accepterCourse(pendingCourse.id)}
                  disabled={pending}
                  style={{
                    padding: '14px',
                    borderRadius: 12,
                    background: 'linear-gradient(135deg,var(--grn),#2a9e62)',
                    border: 'none',
                    color: 'var(--base)',
                    fontSize: 14, fontWeight: 600,
                    cursor: pending ? 'wait' : 'pointer',
                    opacity: pending ? .5 : 1,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    boxShadow: '0 6px 20px rgba(60,196,124,.3)',
                  }}
                >
                  ✓ Accepter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── COURSE ACTIVE ── */}
        {activeCourse ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--gb)',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 16,
            boxShadow: '0 8px 32px rgba(0,0,0,.3)',
          }}>
            {/* Barre progression */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(201,168,76,.08)' }}>
              {ETAPES.slice(0, 3).map((e, i) => (
                <div key={e.statut} style={{
                  flex: 1, padding: '10px 6px', textAlign: 'center',
                  background: i <= etapeIndex ? 'rgba(201,168,76,.06)' : 'transparent',
                  borderRight: i < 2 ? '1px solid rgba(201,168,76,.08)' : 'none',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    margin: '0 auto 4px',
                    background: i < etapeIndex ? 'var(--grn)' : i === etapeIndex ? 'var(--gold)' : 'var(--t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600,
                    color: i <= etapeIndex ? 'var(--base)' : 'var(--t2)',
                  }}>
                    {i < etapeIndex ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 8.5, color: i <= etapeIndex ? 'var(--t1)' : 'var(--t3)' }}>
                    {['Accepté', 'En route', 'À bord'][i]}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>
                  Course #{activeCourse.id.slice(-6).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                    <a href={mapsUrl(activeCourse.adresse_depart)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>{activeCourse.adresse_depart}</a>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                    <a href={mapsUrl(activeCourse.adresse_arrivee)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>{activeCourse.adresse_arrivee}</a>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div style={{
                background: 'var(--elevated)', borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>Client</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{activeClientNom}</div>
                  {activeClient?.profiles?.telephone && (
                    <a href={`tel:${activeClient.profiles.telephone}`} style={{
                      fontSize: 11, color: 'var(--gold)', textDecoration: 'none',
                    }}>
                      {activeClient.profiles.telephone}
                    </a>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>Tarif</div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 20, fontWeight: 500, color: 'var(--gold)',
                  }}>
                    {activeCourse.prix_estime ? `${activeCourse.prix_estime} €` : '—'}
                  </div>
                </div>
              </div>

              {/* Bouton avancement */}
              {etape?.action && (
                <button
                  onClick={nextStatut}
                  disabled={pending}
                  style={{
                    width: '100%', padding: '16px',
                    borderRadius: 14,
                    background: etape.color === 'var(--grn)'
                      ? 'linear-gradient(135deg,var(--grn),#2a9e62)'
                      : etape.color === 'var(--amb)' ? 'var(--amb)' : 'var(--blu)',
                    border: 'none',
                    color: 'var(--base)',
                    fontSize: 15, fontWeight: 600,
                    cursor: pending ? 'wait' : 'pointer',
                    opacity: pending ? .7 : 1,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                  }}
                >
                  {pending ? '...' : etape.action}
                </button>
              )}
              {activeCourse.statut === 'terminee' && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--grn)', fontSize: 14, fontWeight: 500 }}>
                  ✓ Course terminée
                </div>
              )}
            </div>
          </div>
        ) : !pendingCourse ? (
          /* Aucune course */
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--gb)',
            borderRadius: 16, padding: '40px 24px',
            textAlign: 'center', marginBottom: 16,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
              Aucune course assignée
            </div>
            <div style={{ fontSize: 13, color: 'var(--t2)' }}>
              {dispo === 'disponible'
                ? 'Vous êtes disponible. En attente d\'une nouvelle course.'
                : 'Passez en mode disponible pour recevoir des courses.'}
            </div>
          </div>
        ) : null}

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>
              Courses du jour
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 24, color: 'var(--t1)' }}>
              {todayCourses.length}
            </div>
          </div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>
              Note moyenne
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 24, color: 'var(--gold)' }}>
              {profile?.chauffeurs?.note_moyenne?.toFixed(1) ?? '—'}
            </div>
          </div>
        </div>

        {/* ── Prochaines courses ── */}
        {coursesAVenir.length > 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 16, overflow: 'hidden',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid rgba(201,168,76,.07)',
              fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
              color: 'var(--t2)', fontWeight: 500,
            }}>
              Prochaines courses ({coursesAVenir.length})
            </div>
            {coursesAVenir.map((c: any) => {
              const client = c.clients
              const collab = c.collaborateurs
              const clientNom = client?.type_compte === 'entreprise'
                ? (client.entreprise_nom ?? '—')
                : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : '—'
              const collabNom = collab?.profiles
                ? `${collab.profiles.prenom} ${collab.profiles.nom}`
                : null
              const date = new Date(c.date_prevue)
              const isToday = date.toDateString() === new Date().toDateString()
              return (
                <div key={c.id} style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 14, fontWeight: 600,
                      color: isToday ? 'var(--gold)' : 'var(--t1)',
                    }}>
                      {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {isToday ? "Aujourd'hui" : date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>
                  <a href={mapsUrl(c.adresse_depart)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none', marginBottom: 2, display: 'block' }}>
                    {c.adresse_depart.split(',')[0]}
                  </a>
                  <a href={mapsUrl(c.adresse_arrivee)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: 'var(--t2)', textDecoration: 'none', marginBottom: collabNom ? 4 : 0, display: 'block' }}>
                    → {c.adresse_arrivee.split(',')[0]}
                  </a>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 10, color: 'var(--t2)' }}>{clientNom}</span>
                    {collabNom && (
                      <span style={{ fontSize: 10, color: 'var(--t3)' }}>↳ {collabNom}</span>
                    )}
                    <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 'auto' }}>
                      {c.nb_passagers} pass.
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
