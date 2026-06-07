'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TYPE_VEHICULE_LABEL, type StatutCourse, type StatutChauffeur } from '@/lib/types'
import { accepterCourseAction, refuserCourseAction, progresserCourseAction } from './actions'
import { useFcmRegistration } from './useFcmRegistration'
import { soundNouvelleCourse, soundConfirmation, soundTerminee, resumeAudioCtx } from '@/lib/sound'

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

// Groupe un tableau de courses par jour
function groupByDay(courses: any[]): { label: string; date: string; items: any[] }[] {
  const map = new Map<string, any[]>()
  const now = new Date()
  for (const c of courses) {
    const d = new Date(c.date_prevue)
    const key = d.toISOString().split('T')[0]
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c)
  }
  return Array.from(map.entries()).map(([key, items]) => {
    const d = new Date(key + 'T12:00:00')
    const diff = Math.round((d.getTime() - new Date(now.toDateString()).getTime()) / 86400000)
    const label = diff === 0 ? "Aujourd'hui"
      : diff === 1 ? 'Demain'
      : d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    return { label, date: key, items }
  })
}

function clientNom(course: any): string {
  const c = course.clients
  if (c) {
    if (c.type_compte === 'entreprise' && c.entreprise_nom) return c.entreprise_nom
    const direct = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim()
    if (direct) return direct
    const fromProfile = `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
    if (fromProfile) return fromProfile
    if (c.email) return c.email
  }
  // Passager libre (saisie sans compte)
  const libre = `${course.passager_prenom ?? ''} ${course.passager_nom ?? ''}`.trim()
  return libre || 'Client inconnu'
}

function clientTel(course: any): string | null {
  return course.clients?.tel
    ?? course.clients?.profiles?.telephone
    ?? course.passager_tel
    ?? null
}

export default function ChauffeurApp({
  userId,
  profile,
  courses,
  planning,
  historique,
}: {
  userId: string
  profile: any
  courses: any[]
  planning: any[]
  historique: any[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useFcmRegistration()
  const [dispo, setDispo] = useState<StatutChauffeur>(profile?.chauffeurs?.statut ?? 'hors_ligne')
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)

  // Refs pour détecter les changements et déclencher les sons
  const prevPendingId  = useRef<string | null>(null)
  const prevActiveId   = useRef<string | null>(null)
  const prevStatut     = useRef<StatutCourse | null>(null)

  // Réveille le contexte audio dès la première interaction
  useEffect(() => {
    const handler = () => resumeAudioCtx()
    document.addEventListener('click', handler, { once: true })
    document.addEventListener('touchstart', handler, { once: true })
  }, [])

  // Realtime : refresh + sons sur changements de courses
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

    const fallback = setInterval(() => router.refresh(), 60_000)
    return () => { supabase.removeChannel(channel); clearInterval(fallback) }
  }, [userId, router])

  // Détection des changements → sons
  useEffect(() => {
    const pendingId = courses.find(c => c.statut === 'en_attente')?.id ?? null
    const active    = courses.find(c => ['en_route','prise_en_charge','acceptee'].includes(c.statut)) ?? null

    // Nouvelle course en attente → son urgent
    if (pendingId && pendingId !== prevPendingId.current) {
      if (soundEnabled) soundNouvelleCourse()
    }
    prevPendingId.current = pendingId

    // Changement de statut course active → son de confirmation ou terminée
    if (active) {
      if (active.id !== prevActiveId.current || active.statut !== prevStatut.current) {
        if (prevActiveId.current !== null && soundEnabled) {
          if (active.statut === 'terminee') soundTerminee()
          else soundConfirmation()
        }
      }
      prevActiveId.current = active.id
      prevStatut.current   = active.statut
    } else {
      prevActiveId.current = null
      prevStatut.current   = null
    }
  }, [courses, soundEnabled])

  // Séparer course entrante (en_attente) des courses actives
  const todayStr = new Date().toDateString()
  const pendingCourse = courses.find(c => c.statut === 'en_attente') ?? null
  // Active = vraiment en cours (en_route/prise_en_charge) OU acceptée pour aujourd'hui
  const activeCourse = courses.find(c =>
    ['en_route', 'prise_en_charge'].includes(c.statut) ||
    (c.statut === 'acceptee' && new Date(c.date_prevue).toDateString() === todayStr)
  ) ?? null
  const todayCourses = [
    ...courses.filter(c => new Date(c.date_prevue).toDateString() === todayStr),
    ...historique.filter(c => new Date(c.date_prevue).toDateString() === todayStr),
  ]

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
      await accepterCourseAction(courseId)
      setDispo('en_course')
      router.refresh()
    })
  }

  async function refuserCourse(courseId: string) {
    startTransition(async () => {
      await refuserCourseAction(courseId)
      router.refresh()
    })
  }

  async function nextStatut() {
    if (!activeCourse) return
    const next = PROGRESSION[activeCourse.statut as StatutCourse]
    if (!next) return
    startTransition(async () => {
      await progresserCourseAction(activeCourse.id, next as 'en_route' | 'prise_en_charge' | 'terminee')
      if (next === 'terminee') setDispo('disponible')
      router.refresh()
    })
  }

  const etapeIndex = ETAPES.findIndex(e => e.statut === activeCourse?.statut)
  const etape = ETAPES[etapeIndex]
  const activeClientNom = activeCourse ? clientNom(activeCourse) : '—'
  const activeClientTel = activeCourse ? clientTel(activeCourse) : null
  const pendingClientNom = pendingCourse ? clientNom(pendingCourse) : '—'
  const pendingClientTel = pendingCourse ? clientTel(pendingCourse) : null

  return (
    <div style={{
      minHeight: '100vh',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      paddingBottom: 32,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(201,168,76,.2)',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 0 rgba(0,0,0,.06), 0 4px 16px rgba(0,0,0,.07)',
      }}>
        {/* Bande or */}
        <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#C9A84C 30%,#DDB95A 60%,transparent)' }} />

        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Logo + identité chauffeur */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, color: '#fff',
              boxShadow: '0 4px 12px rgba(201,168,76,.25)',
            }}>O</div>
            <div style={{ width: 1, height: 28, background: 'var(--t3)', opacity: .4 }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.05))',
                border: '1.5px solid rgba(201,168,76,.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-cormorant), Georgia, serif',
                fontSize: 15, fontWeight: 600, color: 'var(--gold)',
              }}>{initials}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', lineHeight: 1.2 }}>{prenom} {nom}</div>
                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>
                  {[profile?.chauffeurs?.vehicule_marque, profile?.chauffeurs?.vehicule_modele].filter(Boolean).join(' ') || 'Chauffeur OWISE'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions droite */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Bouton son */}
            <button
              onClick={() => { resumeAudioCtx(); setSoundEnabled(v => !v) }}
              title={soundEnabled ? 'Couper le son' : 'Activer le son'}
              style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: soundEnabled ? 'rgba(201,168,76,.12)' : 'var(--elevated)',
                border: `1px solid ${soundEnabled ? 'rgba(201,168,76,.35)' : 'var(--t3)'}`,
                color: soundEnabled ? 'var(--gold)' : 'var(--t3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all .15s',
              }}
            >
              {soundEnabled ? (
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
                </svg>
              ) : (
                <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                  <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
                </svg>
              )}
            </button>
            <button
              onClick={toggleDispo}
              disabled={dispo === 'en_course' && !!activeCourse}
              style={{
                padding: '7px 14px', borderRadius: 100, fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                cursor: (dispo === 'en_course' && !!activeCourse) ? 'default' : 'pointer',
                transition: 'all .2s',
                ...(dispo === 'disponible' ? {
                  background: 'rgba(60,196,124,.15)', border: '1px solid rgba(60,196,124,.35)',
                  color: 'var(--grn)', boxShadow: '0 0 12px rgba(60,196,124,.15)',
                } : dispo === 'en_course' ? {
                  background: 'rgba(74,142,208,.12)', border: '1px solid rgba(74,142,208,.25)',
                  color: 'var(--blu)',
                } : {
                  background: 'var(--elevated)', border: '1px solid var(--t3)',
                  color: 'var(--t2)',
                }),
              }}
            >
              {dispo === 'disponible' ? '● Disponible' : dispo === 'en_course' ? '⚡ En course' : '○ Hors ligne'}
            </button>
            <button
              onClick={deconnecter}
              title="Se déconnecter"
              style={{
                width: 34, height: 34, borderRadius: 9,
                background: 'var(--elevated)', border: '1px solid var(--t3)',
                color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, transition: 'all .15s',
              }}
            >
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div style={{ padding: '18px 20px 0' }}>

        <style>{`
          @keyframes pulse-amb {
            0%,100% { box-shadow: 0 0 0 0 rgba(232,160,48,.4); }
            50%      { box-shadow: 0 0 0 6px rgba(232,160,48,0); }
          }
        `}</style>

        {/* ── MISSION EN COURS ── */}
        {activeCourse && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid rgba(77,142,212,.3)',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 12,
            boxShadow: '0 2px 16px rgba(77,142,212,.08)',
          }}>
            {/* Header mission */}
            <div style={{
              background: 'linear-gradient(90deg, rgba(77,142,212,.1), transparent)',
              padding: '9px 16px',
              borderBottom: '1px solid rgba(77,142,212,.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blu)', boxShadow: '0 0 6px rgba(77,142,212,.6)' }} />
                <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--blu)', fontWeight: 700 }}>
                  Mission en cours
                </span>
              </div>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 9, color: 'var(--t3)' }}>
                #{activeCourse.id.slice(-6).toUpperCase()}
              </span>
            </div>

            {/* Timeline étapes */}
            <div style={{ display: 'flex', borderBottom: '1px solid rgba(77,142,212,.08)' }}>
              {ETAPES.slice(0, 3).map((e, i) => (
                <div key={e.statut} style={{
                  flex: 1, padding: '10px 6px', textAlign: 'center',
                  background: i <= etapeIndex ? 'rgba(77,142,212,.05)' : 'transparent',
                  borderRight: i < 2 ? '1px solid rgba(77,142,212,.08)' : 'none',
                }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%', margin: '0 auto 4px',
                    background: i < etapeIndex ? 'var(--grn)' : i === etapeIndex ? 'var(--blu)' : 'var(--elevated)',
                    border: `2px solid ${i < etapeIndex ? 'var(--grn)' : i === etapeIndex ? 'var(--blu)' : 'rgba(0,0,0,.1)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700,
                    color: i <= etapeIndex ? '#fff' : 'var(--t3)',
                  }}>
                    {i < etapeIndex ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 8.5, fontWeight: i === etapeIndex ? 600 : 400, color: i <= etapeIndex ? 'var(--t1)' : 'var(--t3)' }}>
                    {['Accepté', 'En route', 'À bord'][i]}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ padding: '14px 16px' }}>
              {/* Date/heure */}
              <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'flex-end' }}>
                <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: 'var(--gold)', fontWeight: 600 }}>
                  {new Date(activeCourse.date_prevue).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {' · '}
                  {new Date(activeCourse.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Trajet */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                <a href={mapsUrl(activeCourse.adresse_depart)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{activeCourse.adresse_depart}</span>
                </a>
                {(Array.isArray(activeCourse.etapes) ? activeCourse.etapes : []).map((etape: string, i: number) => (
                  <a key={i} href={mapsUrl(etape)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amb)', marginTop: 4, flexShrink: 0, boxShadow: '0 0 4px rgba(232,160,48,.4)' }} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>
                      <span style={{ fontSize: 9, color: 'var(--amb)', fontWeight: 600, marginRight: 4 }}>ÉTAPE {i + 1}</span>
                      {etape}
                    </span>
                  </a>
                ))}
                <a href={mapsUrl(activeCourse.adresse_arrivee)} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{activeCourse.adresse_arrivee}</span>
                </a>
              </div>

              {/* Vol / Train — priorité haute pour le chauffeur */}
              {(activeCourse as any).num_vol_train && (
                <div style={{
                  background: 'rgba(77,142,212,.1)', border: '1px solid rgba(77,142,212,.3)',
                  borderRadius: 10, padding: '10px 14px', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                }}>
                  <div>
                    <div style={{ fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: '#4D8ED4', marginBottom: 2 }}>
                      ✈ N° VOL / TRAIN
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: '#4D8ED4', fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '.1em' }}>
                      {(activeCourse as any).num_vol_train}
                    </div>
                  </div>
                  {(activeCourse as any).terminal && (
                    <div>
                      <div style={{ fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>
                        TERMINAL / VOIE
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                        {(activeCourse as any).terminal}
                      </div>
                    </div>
                  )}
                  {(activeCourse as any).heure_arrivee_vol && (
                    <div style={{ marginLeft: 'auto' }}>
                      <div style={{ fontSize: 8, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>
                        ARRIVÉE PRÉVUE
                      </div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                        {(activeCourse as any).heure_arrivee_vol}
                      </div>
                    </div>
                  )}
                  {(() => {
                    const num = ((activeCourse as any).num_vol_train as string).trim()
                    const isVol = /^[A-Za-z]{2}\d{1,4}$/.test(num.replace(/\s/g, ''))
                    return isVol ? (
                      <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                        <a href={`https://www.flightradar24.com/data/flights/${num.toLowerCase().replace(/\s/g, '')}`}
                          target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 7, textAlign: 'center', background: 'rgba(77,142,212,.25)', border: '1px solid rgba(77,142,212,.4)', color: '#4D8ED4', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                          📡 FlightRadar24
                        </a>
                        <a href="https://www.aeroport.fr/vols?type=arrivee"
                          target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 7, textAlign: 'center', background: 'rgba(77,142,212,.12)', border: '1px solid rgba(77,142,212,.25)', color: '#4D8ED4', fontSize: 11, fontWeight: 500, textDecoration: 'none' }}>
                          ✈ ADP Arrivées
                        </a>
                      </div>
                    ) : (
                      <div style={{ width: '100%', display: 'flex', gap: 8 }}>
                        <a href="https://www.sncf-connect.com/recherche/trains"
                          target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 7, textAlign: 'center', background: 'rgba(61,184,122,.2)', border: '1px solid rgba(61,184,122,.4)', color: '#3DB87A', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}>
                          🚄 SNCF Connect
                        </a>
                        <a href="https://www.infra.sncf.com/fr/ponctualite-transilien"
                          target="_blank" rel="noopener noreferrer"
                          style={{ flex: 1, padding: '7px 10px', borderRadius: 7, textAlign: 'center', background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)', color: '#3DB87A', fontSize: 11, fontWeight: 500, textDecoration: 'none' }}>
                          📊 Info trafic
                        </a>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Client */}
              <div style={{
                background: 'rgba(77,142,212,.05)', border: '1px solid rgba(77,142,212,.12)',
                borderRadius: 10, padding: '10px 14px',
                display: 'grid', gridTemplateColumns: '1fr auto',
                alignItems: 'center', gap: 12, marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginBottom: 3 }}>{activeClientNom}</div>
                  {activeClientTel ? (
                    <a href={`tel:${activeClientTel}`} style={{ fontSize: 12, color: 'var(--blu)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                      {activeClientTel}
                    </a>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--t3)' }}>
                      {activeCourse.nb_passagers} passager{activeCourse.nb_passagers > 1 ? 's' : ''} · {TYPE_VEHICULE_LABEL[activeCourse.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL] ?? activeCourse.type_vehicule}
                    </span>
                  )}
                  {activeClientTel && (
                    <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                      {activeCourse.nb_passagers} pass. · {TYPE_VEHICULE_LABEL[activeCourse.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL] ?? activeCourse.type_vehicule}
                    </div>
                  )}
                </div>
                {(activeCourse.prix_final ?? activeCourse.prix_estime) && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Tarif</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>
                      {activeCourse.prix_final ?? activeCourse.prix_estime} €
                    </div>
                  </div>
                )}
              </div>

              {activeCourse.notes && (
                <div style={{
                  background: 'rgba(77,142,212,.04)', border: '1px solid rgba(77,142,212,.1)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 14,
                  fontSize: 11, color: 'var(--t2)', lineHeight: 1.5,
                }}>
                  <span style={{ color: 'var(--blu)', fontWeight: 600, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', marginRight: 4 }}>Note :</span>
                  {activeCourse.notes}
                </div>
              )}

              {/* Bouton avancement */}
              {etape?.action && (
                <button onClick={nextStatut} disabled={pending} style={{
                  width: '100%', padding: '15px', borderRadius: 14, border: 'none',
                  background: etape.statut === 'prise_en_charge'
                    ? 'linear-gradient(135deg,#3DB87A,#2a9e62)'
                    : etape.statut === 'en_route'
                    ? 'linear-gradient(135deg,#E8A030,#c47e10)'
                    : 'linear-gradient(135deg,#4D8ED4,#2a6cb8)',
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  cursor: pending ? 'wait' : 'pointer', opacity: pending ? .7 : 1,
                  fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '.02em',
                  boxShadow: etape.statut === 'prise_en_charge'
                    ? '0 8px 24px rgba(61,184,122,.3)'
                    : etape.statut === 'en_route'
                    ? '0 8px 24px rgba(232,160,48,.3)'
                    : '0 8px 24px rgba(77,142,212,.3)',
                  transition: 'opacity .15s',
                }}>
                  {pending ? '…' : etape.action}
                </button>
              )}
              {activeCourse.statut === 'terminee' && (
                <div style={{ textAlign: 'center', padding: '12px', color: 'var(--grn)', fontSize: 14, fontWeight: 500 }}>
                  ✓ Course terminée
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── NOUVELLE DEMANDE ── toujours visible même si mission active */}
        {pendingCourse && (
          <div style={{
            background: 'var(--surface)',
            border: '2px solid rgba(232,160,48,.5)',
            borderRadius: 16, overflow: 'hidden',
            marginBottom: 12,
            boxShadow: '0 4px 24px rgba(232,160,48,.12)',
          }}>
            {/* Header demande */}
            <div style={{
              background: 'linear-gradient(90deg, rgba(232,160,48,.15), rgba(232,160,48,.04))',
              padding: '11px 16px',
              borderBottom: '1px solid rgba(232,160,48,.2)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <div style={{
                width: 9, height: 9, borderRadius: '50%',
                background: 'var(--amb)', flexShrink: 0,
                animation: 'pulse-amb 1.4s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--amb)', fontWeight: 700, flex: 1 }}>
                Nouvelle demande · à répondre
              </span>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--gold)', fontWeight: 600 }}>
                {new Date(pendingCourse.date_prevue).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                {' · '}
                {new Date(pendingCourse.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <div style={{ padding: '14px 16px' }}>
              {/* Trajet */}
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                  <a href={mapsUrl(pendingCourse.adresse_depart)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>{pendingCourse.adresse_depart}</a>
                </div>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                  <a href={mapsUrl(pendingCourse.adresse_arrivee)} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>{pendingCourse.adresse_arrivee}</a>
                </div>
              </div>

              {/* Client + prix */}
              <div style={{
                background: 'rgba(232,160,48,.06)', border: '1px solid rgba(232,160,48,.15)',
                borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 12,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{pendingClientNom}</div>
                  <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                    {TYPE_VEHICULE_LABEL[pendingCourse.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL]}
                    {' · '}
                    {pendingCourse.nb_passagers} pass.
                  </div>
                </div>
                {pendingCourse.prix_estime && (
                  <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 22, fontWeight: 700, color: 'var(--amb)' }}>
                    {pendingCourse.prix_estime} €
                  </div>
                )}
              </div>

              {pendingCourse.notes && (
                <div style={{
                  background: 'rgba(232,160,48,.05)', border: '1px solid rgba(232,160,48,.12)',
                  borderRadius: 8, padding: '8px 12px', marginBottom: 12,
                  fontSize: 11, color: 'var(--t2)', lineHeight: 1.5,
                }}>
                  <span style={{ color: 'var(--amb)', fontWeight: 600, fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', marginRight: 4 }}>Note :</span>
                  {pendingCourse.notes}
                </div>
              )}

              {/* Boutons */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <button onClick={() => refuserCourse(pendingCourse.id)} disabled={pending} style={{
                  padding: '13px', borderRadius: 12,
                  background: 'rgba(217,80,80,.08)', border: '1.5px solid rgba(217,80,80,.3)',
                  color: 'var(--red)', fontSize: 14, fontWeight: 600,
                  cursor: pending ? 'wait' : 'pointer', opacity: pending ? .5 : 1,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}>
                  ✕ Refuser
                </button>
                <button onClick={() => accepterCourse(pendingCourse.id)} disabled={pending} style={{
                  padding: '13px', borderRadius: 12,
                  background: 'linear-gradient(135deg,#3DB87A,#2a9e62)', border: 'none',
                  color: '#fff', fontSize: 14, fontWeight: 700,
                  cursor: pending ? 'wait' : 'pointer', opacity: pending ? .5 : 1,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  boxShadow: '0 6px 20px rgba(60,196,124,.3)',
                }}>
                  ✓ Accepter
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Aucune course */}
        {!activeCourse && !pendingCourse && (
          <div style={{
            background: 'var(--surface)',
            border: `1px solid ${dispo === 'disponible' ? 'rgba(60,196,124,.2)' : 'rgba(0,0,0,.08)'}`,
            borderRadius: 16, padding: '40px 24px',
            textAlign: 'center', marginBottom: 12,
            boxShadow: dispo === 'disponible' ? '0 0 32px rgba(60,196,124,.06)' : 'none',
            transition: 'all .3s',
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: '50%', margin: '0 auto 14px',
              background: dispo === 'disponible' ? 'rgba(60,196,124,.1)' : 'var(--elevated)',
              border: `1px solid ${dispo === 'disponible' ? 'rgba(60,196,124,.2)' : 'rgba(0,0,0,.08)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
            }}>🚘</div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
              Aucune course assignée
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>
              {dispo === 'disponible' ? (
                <><span style={{ color: 'var(--grn)', fontWeight: 500 }}>● Vous êtes disponible</span><br/>En attente d'une course.</>
              ) : (
                <>Passez en mode <strong style={{ color: 'var(--t1)' }}>Disponible</strong><br/>pour recevoir des courses.</>
              )}
            </div>
          </div>
        )}

        {/* ── Stats ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          {[
            { label: 'Courses du jour', value: todayCourses.length, color: 'var(--t1)', mono: true },
            { label: 'Note moyenne', value: profile?.chauffeurs?.note_moyenne?.toFixed(1) ?? '0.0', color: 'var(--gold)', mono: true },
          ].map(stat => (
            <div key={stat.label} style={{
              background: 'var(--surface)',
              border: '1px solid rgba(201,168,76,.18)',
              borderRadius: 14, padding: '16px 18px',
              boxShadow: '0 1px 4px rgba(0,0,0,.06)',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8, fontWeight: 500 }}>
                {stat.label}
              </div>
              <div style={{ fontFamily: 'var(--font-jetbrains), JetBrains Mono, monospace', fontSize: 26, fontWeight: 500, color: stat.color }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* ── Agenda ── */}
        {(() => {
          // Déduplique courses actives + planning par ID
          const seen = new Set<string>()
          const allCal = [...courses, ...planning].filter(c => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
          })

          // Groupe par jour (clé YYYY-MM-DD)
          const byDay: Record<string, any[]> = {}
          for (const c of allCal) {
            const key = c.date_prevue.slice(0, 10)
            if (!byDay[key]) byDay[key] = []
            byDay[key].push(c)
          }

          // 30 jours à partir d'aujourd'hui
          const todayKey = new Date().toISOString().split('T')[0]
          const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
          const days = Array.from({ length: 30 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() + i)
            return { key: d.toISOString().split('T')[0], date: d }
          })

          const selCourses = (byDay[selectedDate] ?? [])
            .slice().sort((a: any, b: any) => a.date_prevue.localeCompare(b.date_prevue))

          const selLabel = selectedDate === todayKey
            ? "Aujourd'hui"
            : new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

          return (
            <div style={{ marginBottom: 16 }}>
              {/* Banderole dates */}
              <style>{`.owise-datepicker::-webkit-scrollbar{display:none}`}</style>
              <div className="owise-datepicker" style={{
                display: 'flex', gap: 6, overflowX: 'auto',
                scrollbarWidth: 'none', padding: '2px 0 10px',
              }}>
                {days.map(({ key, date }) => {
                  const isSel = key === selectedDate
                  const isToday = key === todayKey
                  const hasCourses = (byDay[key] ?? []).length > 0
                  return (
                    <button key={key} onClick={() => setSelectedDate(key)} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 3, padding: '9px 10px', borderRadius: 14, flexShrink: 0, minWidth: 46,
                      background: isSel ? 'var(--gold)' : isToday ? 'rgba(201,168,76,.08)' : 'var(--surface)',
                      border: `1px solid ${isSel ? 'transparent' : isToday ? 'rgba(201,168,76,.25)' : 'rgba(0,0,0,.08)'}`,
                      cursor: 'pointer', transition: 'background .12s',
                      boxShadow: isSel ? '0 4px 14px rgba(201,168,76,.25)' : 'none',
                    }}>
                      <span style={{
                        fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600,
                        color: isSel ? 'rgba(9,9,26,.55)' : 'var(--t3)',
                      }}>{DAY_LABELS[date.getDay()]}</span>
                      <span style={{
                        fontSize: 16, fontWeight: 700, lineHeight: 1,
                        fontFamily: 'var(--font-jetbrains), monospace',
                        color: isSel ? '#09091A' : isToday ? 'var(--gold)' : 'var(--t1)',
                      }}>{date.getDate()}</span>
                      <div style={{
                        width: 4, height: 4, borderRadius: '50%',
                        background: hasCourses
                          ? (isSel ? 'rgba(9,9,26,.45)' : 'var(--gold)')
                          : 'transparent',
                        transition: 'background .12s',
                      }} />
                    </button>
                  )
                })}
              </div>

              {/* Liste du jour sélectionné */}
              <div style={{
                background: 'var(--surface)',
                border: '1px solid rgba(201,168,76,.18)',
                borderRadius: 16, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,.08)',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{
                    fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
                    color: 'var(--t2)', fontWeight: 600,
                  }}>{selLabel}</span>
                  {selCourses.length > 0 && (
                    <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {selCourses.length} course{selCourses.length > 1 ? 's' : ''}
                    </span>
                  )}
                </div>

                {selCourses.length === 0 ? (
                  <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                    Aucune course ce jour
                  </div>
                ) : (
                  selCourses.map((c: any, i: number) => {
                    const date = new Date(c.date_prevue)
                    const nom = clientNom(c)
                    const tel = clientTel(c)
                    const prix = c.prix_final ?? c.prix_estime
                    const isExpanded = expandedId === c.id

                    const statutBadge = {
                      acceptee:        { label: 'Acceptée',    color: 'var(--gold)' },
                      en_attente:      { label: 'À confirmer', color: 'var(--amb)'  },
                      en_route:        { label: 'En route',    color: 'var(--blu)'  },
                      prise_en_charge: { label: 'À bord',      color: 'var(--grn)'  },
                    }[c.statut as string]

                    return (
                      <div key={c.id} style={{
                        borderBottom: i < selCourses.length - 1 ? '1px solid rgba(201,168,76,.06)' : 'none',
                      }}>
                        {/* Ligne principale — tappable */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : c.id)}
                          style={{
                            width: '100%', background: isExpanded ? 'rgba(201,168,76,.04)' : 'transparent',
                            border: 'none', cursor: 'pointer', padding: '13px 16px',
                            display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: '0 10px',
                            alignItems: 'start', textAlign: 'left',
                            transition: 'background .12s',
                          }}
                        >
                          {/* Heure + badge */}
                          <div>
                            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
                              {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                            {statutBadge && (
                              <div style={{ fontSize: 7.5, letterSpacing: '.06em', textTransform: 'uppercase', color: statutBadge.color, fontWeight: 600, marginTop: 3 }}>
                                {statutBadge.label}
                              </div>
                            )}
                          </div>

                          {/* Trajet résumé */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', flexShrink: 0 }} />
                              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{c.adresse_depart.split(',')[0]}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                              <span style={{ width: 6, height: 6, borderRadius: 1, border: '1.5px solid var(--red)', flexShrink: 0 }} />
                              <span style={{ fontSize: 11, color: 'var(--t2)' }}>{c.adresse_arrivee.split(',')[0]}</span>
                            </div>
                            <span style={{ fontSize: 10, color: 'var(--t3)' }}>
                              {c.nb_passagers} pass. · {TYPE_VEHICULE_LABEL[c.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL] ?? c.type_vehicule}
                            </span>
                          </div>

                          {/* Chevron */}
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, paddingTop: 2 }}>
                            {prix && (
                              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>
                                {prix} €
                              </span>
                            )}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2.5}
                              style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }}>
                              <polyline points="6 9 12 15 18 9"/>
                            </svg>
                          </div>
                        </button>

                        {/* Panel détail expandable */}
                        {isExpanded && (
                          <div style={{
                            margin: '0 12px 12px',
                            background: 'rgba(201,168,76,.04)',
                            border: '1px solid rgba(201,168,76,.14)',
                            borderRadius: 12, padding: '14px',
                            display: 'flex', flexDirection: 'column', gap: 10,
                          }}>
                            {/* Client */}
                            <div style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              paddingBottom: 10, borderBottom: '1px solid rgba(201,168,76,.1)',
                            }}>
                              <div>
                                <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>Client</div>
                                <div style={{ fontSize: 14, fontWeight: 600, color: nom === 'Client inconnu' ? 'var(--t3)' : 'var(--t1)' }}>{nom}</div>
                              </div>
                              {tel ? (
                                <a href={`tel:${tel}`} style={{
                                  display: 'flex', alignItems: 'center', gap: 7,
                                  padding: '9px 16px', borderRadius: 100,
                                  background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)',
                                  color: 'var(--gold)', fontSize: 13, fontWeight: 600, textDecoration: 'none',
                                }}>
                                  <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                  </svg>
                                  {tel}
                                </a>
                              ) : (
                                <span style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Pas de numéro</span>
                              )}
                            </div>

                            {/* Adresses complètes + Maps */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <a href={mapsUrl(c.adresse_depart)} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                                <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--grn)', flexShrink: 0, marginTop: 4 }} />
                                <span style={{ fontSize: 12, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,.3)' }}>{c.adresse_depart}</span>
                              </a>
                              <a href={mapsUrl(c.adresse_arrivee)} target="_blank" rel="noopener noreferrer"
                                style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                                <span style={{ width: 7, height: 7, borderRadius: 2, border: '2px solid var(--red)', flexShrink: 0, marginTop: 4 }} />
                                <span style={{ fontSize: 12, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,.3)' }}>{c.adresse_arrivee}</span>
                              </a>
                            </div>

                            {/* Notes + prix */}
                            {(c.notes || prix) && (
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingTop: 8, borderTop: '1px solid rgba(201,168,76,.1)' }}>
                                {c.notes ? (
                                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5, flex: 1 }}>
                                    <span style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 4 }}>Note :</span>
                                    {c.notes}
                                  </div>
                                ) : <div />}
                                {prix && (
                                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                    <div style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Tarif</div>
                                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 20, fontWeight: 700, color: 'var(--gold)' }}>{prix} €</div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })()}

        {/* ── Historique ── */}
        {historique.length > 0 && (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden', marginTop: 16 }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(201,168,76,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>Historique</span>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--t3)' }}>{historique.length} course{historique.length > 1 ? 's' : ''}</span>
            </div>
            {historique.map((c: any, i: number) => {
              const date = new Date(c.date_prevue)
              const nom = clientNom(c)
              const prix = c.prix_final ?? c.prix_estime
              return (
                <div key={c.id} style={{
                  padding: '11px 16px',
                  borderBottom: i < historique.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
                  opacity: .85,
                }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)' }}>
                        {date.toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                        {' · '}
                        {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 4, background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.2)', color: 'var(--grn)', fontWeight: 500 }}>
                        ✓ Terminée
                      </span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                      {c.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>→ {c.adresse_arrivee.split(',')[0]}</div>
                    {nom !== '—' && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>{nom} · {c.nb_passagers} pass.</div>}
                  </div>
                  {prix && (
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 16, fontWeight: 600, color: 'var(--grn)', textAlign: 'right' }}>
                      {prix} €
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
