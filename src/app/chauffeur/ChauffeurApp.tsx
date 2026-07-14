'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TYPE_VEHICULE_LABEL, type StatutCourse, type StatutChauffeur, type CSSVarStyle } from '@/lib/types'
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

// Retourne une clé YYYY-MM-DD en heure locale (évite le décalage UTC)
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
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

function relativeDayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const diffDays = Math.round(
    (new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() -
     new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) / 86400000
  )
  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'demain'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

const COUNTDOWN_SECONDS = 30

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
  const [selectedDate, setSelectedDate] = useState(() => localDateKey(new Date()))
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [planningOpen, setPlanningOpen] = useState(false)
  const [planningTab, setPlanningTab] = useState<'avenir' | 'historique'>('avenir')

  // Mode nuit — auto 20h-7h sauf préférence manuelle sauvegardée.
  // Démarre toujours à false (identique serveur/client) pour éviter un
  // mismatch d'hydratation — la vraie valeur est appliquée au montage.
  const [nightMode, setNightMode] = useState<boolean>(false)

  // Compte à rebours visuel sur les nouvelles demandes
  const [countdown, setCountdown] = useState<number | null>(null)
  const countdownStartedFor = useRef<string | null>(null)

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

  // Applique la vraie valeur (localStorage ou heure locale) au montage,
  // puis re-vérifie toutes les 10 min (sauf préférence manuelle sauvegardée)
  useEffect(() => {
    const applyAuto = () => {
      const saved = window.localStorage.getItem('owise_chauffeur_theme')
      if (saved === 'night') { setNightMode(true); return }
      if (saved === 'day')   { setNightMode(false); return }
      const h = new Date().getHours()
      setNightMode(h >= 20 || h < 7)
    }
    applyAuto()
    const interval = setInterval(() => {
      const saved = window.localStorage.getItem('owise_chauffeur_theme')
      if (saved === 'night' || saved === 'day') return
      applyAuto()
    }, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [])

  function toggleNightMode() {
    setNightMode(v => {
      const next = !v
      window.localStorage.setItem('owise_chauffeur_theme', next ? 'night' : 'day')
      return next
    })
  }

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
    (c.statut === 'acceptee' && new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')).toDateString() === todayStr)
  ) ?? null
  const todayCourses = [
    ...courses.filter(c => new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')).toDateString() === todayStr),
    ...historique.filter(c => new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')).toDateString() === todayStr),
  ]

  // Prochaine course à venir — affichée quand rien n'est actif/en attente aujourd'hui
  const nextCourse = (() => {
    if (activeCourse || pendingCourse) return null
    const seen = new Set<string>()
    const now = Date.now()
    return [...courses, ...planning]
      .filter(c => {
        if (seen.has(c.id)) return false
        seen.add(c.id)
        return !['terminee', 'annulee'].includes(c.statut) && new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')).getTime() > now
      })
      .sort((a, b) => new Date(a.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')).getTime() - new Date(b.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')).getTime())[0] ?? null
  })()

  // Courses du jour à afficher sur l'écran principal (hors mission active / demande déjà mises en avant)
  const todayCoursesForList = todayCourses
    .filter(c => c.id !== activeCourse?.id && c.id !== pendingCourse?.id)
    .slice()
    .sort((a: any, b: any) => a.date_prevue.localeCompare(b.date_prevue))

  // Démarre/relance le compte à rebours quand une nouvelle demande arrive
  useEffect(() => {
    if (!pendingCourse) {
      setCountdown(null)
      countdownStartedFor.current = null
      return
    }
    if (countdownStartedFor.current !== pendingCourse.id) {
      countdownStartedFor.current = pendingCourse.id
      setCountdown(COUNTDOWN_SECONDS)
    }
  }, [pendingCourse?.id])

  useEffect(() => {
    if (countdown === null || countdown <= 0) return
    const t = setTimeout(() => setCountdown(c => (c !== null ? c - 1 : null)), 1000)
    return () => clearTimeout(t)
  }, [countdown])

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

  const rootStyle: CSSVarStyle = {
    minHeight: '100vh',
    fontFamily: 'var(--font-dm-sans), sans-serif',
    paddingBottom: 110,
    background: nightMode ? '#09091A' : '#F8F6F1',
    transition: 'background .3s',
    '--base':     nightMode ? '#09091A' : '#F8F6F1',
    '--surface':  nightMode ? '#111128' : '#FFFFFF',
    '--elevated': nightMode ? '#181832' : '#F3F0EB',
    '--floating': nightMode ? '#202042' : '#EDEAE4',
    '--gb':       nightMode ? 'rgba(201,168,76,.16)' : 'rgba(0,0,0,.08)',
    '--gm':       nightMode ? 'rgba(201,168,76,.12)' : 'rgba(201,168,76,.08)',
    '--t1':       nightMode ? '#EDE8DF' : '#0A0A0A',
    '--t2':       nightMode ? '#9494A8' : '#555555',
    '--t3':       nightMode ? '#5C5C78' : '#999999',
    '--gold':     nightMode ? '#DDB95A' : '#C9A84C',
    '--gold2':    nightMode ? '#E8C878' : '#DDB95A',
    '--grn':      nightMode ? '#4ECB8F' : '#3DB87A',
    '--amb':      nightMode ? '#F0B040' : '#E8A030',
    '--red':      nightMode ? '#E36868' : '#D95454',
    '--blu':      nightMode ? '#5C9CE0' : '#4D8ED4',
  }

  return (
    <div style={rootStyle}>
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
                <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                    background: dispo === 'disponible' ? 'var(--grn)' : dispo === 'en_course' ? 'var(--blu)' : 'var(--t3)',
                  }} />
                  {[profile?.chauffeurs?.vehicule_marque, profile?.chauffeurs?.vehicule_modele].filter(Boolean).join(' ') || 'Chauffeur OWISE'}
                </div>
              </div>
            </div>
          </div>

          {/* Actions droite */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
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
                {activeCourse.prix_chauffeur && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--grn)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Votre rémunération</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 20, fontWeight: 700, color: 'var(--grn)' }}>
                      {activeCourse.prix_chauffeur} €
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
              {countdown !== null && (
                countdown > 0 ? (
                  <span style={{
                    fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, fontWeight: 700,
                    color: countdown <= 10 ? 'var(--red)' : 'var(--amb)',
                    background: countdown <= 10 ? 'rgba(217,80,80,.12)' : 'rgba(232,160,48,.12)',
                    padding: '2px 9px', borderRadius: 20, flexShrink: 0,
                  }}>{countdown}s</span>
                ) : (
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                    color: 'var(--red)', background: 'rgba(217,80,80,.12)',
                    padding: '3px 9px', borderRadius: 20, flexShrink: 0,
                  }}>Délai dépassé</span>
                )
              )}
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--gold)', fontWeight: 600 }}>
                {new Date(pendingCourse.date_prevue).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                {' · '}
                {new Date(pendingCourse.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Barre de temps restant */}
            {countdown !== null && (
              <div style={{ height: 3, background: 'rgba(232,160,48,.12)' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.max(0, (countdown / COUNTDOWN_SECONDS) * 100)}%`,
                  background: countdown <= 10 ? 'var(--red)' : 'var(--amb)',
                  transition: 'width 1s linear, background .3s',
                }} />
              </div>
            )}

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
                {pendingCourse.prix_chauffeur && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: 'var(--grn)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Votre rémunération</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 22, fontWeight: 700, color: 'var(--grn)' }}>
                      {pendingCourse.prix_chauffeur} €
                    </div>
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
                <><span style={{ color: 'var(--grn)', fontWeight: 500 }}>● Vous êtes disponible</span><br/>En attente d&apos;une course.</>
              ) : (
                <>Passez en mode <strong style={{ color: 'var(--t1)' }}>Disponible</strong><br/>pour recevoir des courses.</>
              )}
            </div>

            {nextCourse && (
              <button
                onClick={() => setSelectedDate(localDateKey(new Date(nextCourse.date_prevue)))}
                style={{
                  marginTop: 16, width: '100%', textAlign: 'left',
                  background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)',
                  borderRadius: 12, padding: '12px 16px', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--gold)', fontWeight: 600, marginBottom: 4 }}>
                  Prochaine course
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 3, textTransform: 'capitalize' }}>
                  {relativeDayLabel(nextCourse.date_prevue)} à {new Date(nextCourse.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                  {nextCourse.adresse_depart.split(',')[0]} → {nextCourse.adresse_arrivee.split(',')[0]}
                </div>
              </button>
            )}
          </div>
        )}

        {/* ── Aujourd'hui — toujours visible, sans clic ── */}
        {todayCoursesForList.length > 0 && (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid rgba(201,168,76,.18)',
            borderRadius: 16, overflow: 'hidden', marginBottom: 16,
          }}>
            <div style={{
              padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 600 }}>
                Aujourd'hui
              </span>
              <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                {todayCoursesForList.length} course{todayCoursesForList.length > 1 ? 's' : ''}
              </span>
            </div>

            {todayCoursesForList.map((c: any, i: number) => {
              const date = new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, ''))
              const nom = clientNom(c)
              const tel = clientTel(c)
              const prix = c.prix_chauffeur ?? null
              const isExpanded = expandedId === c.id

              const statutBadge = {
                acceptee:        { label: 'Acceptée',    color: 'var(--gold)' },
                en_attente:      { label: 'À confirmer', color: 'var(--amb)'  },
                en_route:        { label: 'En route',    color: 'var(--blu)'  },
                prise_en_charge: { label: 'À bord',      color: 'var(--grn)'  },
                terminee:        { label: '✓ Terminée',  color: 'var(--grn)'  },
              }[c.statut as string]

              return (
                <div key={c.id} style={{
                  borderBottom: i < todayCoursesForList.length - 1 ? '1px solid rgba(201,168,76,.06)' : 'none',
                }}>
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

                  {isExpanded && (
                    <div style={{
                      margin: '0 12px 12px',
                      background: 'rgba(201,168,76,.04)',
                      border: '1px solid rgba(201,168,76,.14)',
                      borderRadius: 12, padding: '14px',
                      display: 'flex', flexDirection: 'column', gap: 10,
                    }}>
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
                              <div style={{ fontSize: 9, color: 'var(--grn)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 2 }}>Votre rémunération</div>
                              <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 20, fontWeight: 700, color: 'var(--grn)' }}>{prix} €</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
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

        {/* ── Accès Planning & historique (1 clic) ── */}
        <button
          onClick={() => setPlanningOpen(true)}
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer',
            background: 'var(--surface)', border: '1px solid rgba(201,168,76,.18)',
            borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
            }}>📅</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Planning & historique</div>
              <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 1 }}>
                Courses à venir et terminées
              </div>
            </div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2.5}>
            <polyline points="9 6 15 12 9 18"/>
          </svg>
        </button>

        {/* ── Modal Planning & Historique ── */}
        {planningOpen && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'var(--base)',
            display: 'flex', flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid rgba(201,168,76,.15)',
              background: 'var(--surface)', flexShrink: 0,
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--t1)' }}>Planning</div>
              <button onClick={() => setPlanningOpen(false)} style={{
                width: 34, height: 34, borderRadius: 10,
                background: 'var(--elevated)', border: '1px solid var(--t3)',
                color: 'var(--t2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div style={{ display: 'flex', gap: 8, padding: '12px 16px 0', flexShrink: 0 }}>
              {(['avenir', 'historique'] as const).map(tab => (
                <button key={tab} onClick={() => setPlanningTab(tab)} style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                  background: planningTab === tab ? 'var(--gold)' : 'var(--elevated)',
                  color: planningTab === tab ? 'var(--base)' : 'var(--t2)',
                  border: planningTab === tab ? 'none' : '1px solid var(--t3)',
                  cursor: 'pointer',
                }}>
                  {tab === 'avenir' ? 'À venir' : 'Historique'}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 24px' }}>
            {planningTab === 'avenir' && (() => {
          // Déduplique courses actives + planning par ID
          const seen = new Set<string>()
          const allCal = [...courses, ...planning].filter(c => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
          })

          // Groupe par jour (clé YYYY-MM-DD en heure locale)
          const byDay: Record<string, any[]> = {}
          for (const c of allCal) {
            const key = localDateKey(new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, '')))
            if (!byDay[key]) byDay[key] = []
            byDay[key].push(c)
          }

          // 30 jours à partir d'aujourd'hui
          const todayKey = localDateKey(new Date())
          const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
          const days = Array.from({ length: 30 }, (_, i) => {
            const d = new Date()
            d.setDate(d.getDate() + i)
            return { key: localDateKey(d), date: d }
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
                    const date = new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, ''))
                    const nom = clientNom(c)
                    const tel = clientTel(c)
                    const prix = c.prix_chauffeur ?? null
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

        {planningTab === 'historique' && (
          historique.length > 0 ? (
          <div style={{ background: 'var(--surface)', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid rgba(201,168,76,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>Historique</span>
              <span style={{ fontSize: 9, fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--t3)' }}>{historique.length} course{historique.length > 1 ? 's' : ''}</span>
            </div>
            {historique.map((c: any, i: number) => {
              const date = new Date(c.date_prevue.replace(/([+-]\d{2}:\d{2}|Z)$/, ''))
              const nom = clientNom(c)
              const prix = c.prix_chauffeur ?? null
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
          ) : (
            <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
              Aucune course terminée pour le moment
            </div>
          )
        )}
            </div>
          </div>
        )}
      </div>

      {/* ── Barre d'action fixe — accessible au pouce ── */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 60,
        background: 'var(--surface)',
        borderTop: '1px solid rgba(201,168,76,.2)',
        boxShadow: '0 -4px 24px rgba(0,0,0,.1)',
        padding: '10px 16px calc(10px + env(safe-area-inset-bottom, 0px))',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Son */}
        <button
          onClick={() => { resumeAudioCtx(); setSoundEnabled(v => !v) }}
          title={soundEnabled ? 'Couper le son' : 'Activer le son'}
          style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: soundEnabled ? 'rgba(201,168,76,.12)' : 'var(--elevated)',
            border: `1px solid ${soundEnabled ? 'rgba(201,168,76,.35)' : 'var(--t3)'}`,
            color: soundEnabled ? 'var(--gold)' : 'var(--t3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          {soundEnabled ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
              <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
            </svg>
          )}
        </button>

        {/* Disponibilité — action principale, plein pouce */}
        <button
          onClick={toggleDispo}
          disabled={dispo === 'en_course' && !!activeCourse}
          style={{
            flex: 1, padding: '14px', borderRadius: 14, fontSize: 14, fontWeight: 700,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            cursor: (dispo === 'en_course' && !!activeCourse) ? 'default' : 'pointer',
            transition: 'all .2s',
            ...(dispo === 'disponible' ? {
              background: 'linear-gradient(135deg,#3DB87A,#2a9e62)', border: 'none', color: '#fff',
              boxShadow: '0 4px 16px rgba(60,196,124,.3)',
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

        {/* Mode nuit/jour */}
        <button
          onClick={toggleNightMode}
          title={nightMode ? 'Passer en mode jour' : 'Passer en mode nuit'}
          style={{
            width: 48, height: 48, borderRadius: 14, flexShrink: 0,
            background: nightMode ? 'rgba(201,168,76,.15)' : 'var(--elevated)',
            border: `1px solid ${nightMode ? 'rgba(201,168,76,.35)' : 'var(--t3)'}`,
            color: 'var(--gold)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', transition: 'all .15s',
          }}
        >
          {nightMode ? (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="5"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
            </svg>
          )}
        </button>
      </div>
    </div>
  )
}
