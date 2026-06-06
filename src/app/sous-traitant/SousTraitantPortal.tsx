'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { progresserCourseSTAction, accepterCourseSTAction, refuserCourseSTAction, updateProfilSTAction } from './actions'
import { TYPE_VEHICULE_LABEL, type StatutCourse } from '@/lib/types'

const ETAPES = [
  { statut: 'acceptee',        label: 'Acceptée',     action: 'Départ vers le client', color: 'var(--blu)' },
  { statut: 'en_route',        label: 'En route',      action: 'Client pris en charge', color: 'var(--amb)' },
  { statut: 'prise_en_charge', label: 'Client à bord', action: 'Terminer la course',    color: 'var(--grn)' },
]
const PROGRESSION: Partial<Record<StatutCourse, StatutCourse>> = {
  acceptee: 'en_route', en_route: 'prise_en_charge', prise_en_charge: 'terminee',
}

function mapsUrl(adresse: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(adresse)}`
}

function getClientNom(course: any): string | null {
  const c = course.clients
  if (!c) return null
  if (c.type_compte === 'entreprise' && c.entreprise_nom) return c.entreprise_nom
  const direct = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim()
  if (direct) return direct
  const fromProfile = `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
  return fromProfile || null
}

function getClientTel(course: any): string | null {
  return course.clients?.tel ?? course.clients?.profiles?.telephone ?? null
}

export default function SousTraitantPortal({
  userId, stId, stNom, stTelephone, modePaiement, courses, planning, historique, factures,
}: {
  userId: string; stId: string; stNom: string; stTelephone: string; modePaiement: string
  courses: any[]; planning: any[]; historique: any[]; factures: any[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'courses' | 'factures' | 'profil'>('courses')

  // Profil état
  const [profilNom,        setProfilNom]        = useState(stNom)
  const [profilTel,        setProfilTel]        = useState(stTelephone)
  const [profilMode,       setProfilMode]       = useState(modePaiement)
  const [profilSaving,     setProfilSaving]     = useState(false)
  const [profilMsg,        setProfilMsg]        = useState('')

  // Realtime refresh
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase.channel('st-courses-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses', filter: `sous_traitant_id=eq.${stId}` },
        () => router.refresh())
      .subscribe()
    const fallback = setInterval(() => router.refresh(), 60_000)
    return () => { supabase.removeChannel(channel); clearInterval(fallback) }
  }, [stId, router])

  async function deconnecter() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sous-traitant-login')
  }

  const todayStr = new Date().toDateString()
  const activeCourse = courses.find(c =>
    ['en_route', 'prise_en_charge'].includes(c.statut) ||
    (c.statut === 'acceptee' && new Date(c.date_prevue).toDateString() === todayStr)
  ) ?? null
  const etapeIndex = ETAPES.findIndex(e => e.statut === activeCourse?.statut)
  const etape = ETAPES[etapeIndex]

  // Agenda
  const seen = new Set<string>()
  const allCal = [...courses, ...planning].filter(c => { if (seen.has(c.id)) return false; seen.add(c.id); return true })
  const byDay: Record<string, any[]> = {}
  for (const c of allCal) {
    const key = c.date_prevue.slice(0, 10)
    if (!byDay[key]) byDay[key] = []
    byDay[key].push(c)
  }
  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i)
    return { key: d.toISOString().split('T')[0], date: d }
  })
  const DAY_LABELS = ['D', 'L', 'M', 'M', 'J', 'V', 'S']
  const todayKey = new Date().toISOString().split('T')[0]
  const selCourses = (byDay[selectedDate] ?? []).sort((a: any, b: any) => a.date_prevue.localeCompare(b.date_prevue))
  const selLabel = selectedDate === todayKey ? "Aujourd'hui"
    : new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Stats factures
  const totalDu = factures.filter(f => f.statut === 'en_attente').reduce((s, f) => s + f.montant_ht, 0)
  const totalPaye = factures.filter(f => f.statut === 'payee').reduce((s, f) => s + f.montant_ht, 0)

  const modeBadge = modePaiement === 'immediat' ? { label: 'Paiement immédiat', color: 'var(--grn)' }
    : modePaiement === 'hebdomadaire' ? { label: 'Paiement hebdomadaire', color: 'var(--blu)' }
    : { label: 'Paiement mensuel', color: 'var(--gold)' }

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif', paddingBottom: 32 }}>

      {/* Header */}
      <div style={{
        background: '#FFFFFF', borderBottom: '1px solid rgba(201,168,76,.2)',
        position: 'sticky', top: 0, zIndex: 50,
        boxShadow: '0 1px 0 rgba(0,0,0,.06)',
      }}>
        <div style={{ height: 2, background: 'linear-gradient(90deg,transparent,#C9A84C 30%,#DDB95A 60%,transparent)' }} />
        <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, color: '#fff',
            }}>O</div>
            <div style={{ width: 1, height: 26, background: 'rgba(0,0,0,.1)' }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>{stNom}</div>
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>Espace partenaire</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              fontSize: 9, padding: '4px 10px', borderRadius: 100, fontWeight: 600,
              color: modeBadge.color,
              background: `color-mix(in srgb, ${modeBadge.color} 12%, transparent)`,
              border: `1px solid color-mix(in srgb, ${modeBadge.color} 30%, transparent)`,
            }}>{modeBadge.label}</span>
            <button onClick={deconnecter} title="Déconnexion" style={{
              width: 34, height: 34, borderRadius: 9, background: 'var(--elevated)',
              border: '1px solid var(--gb)', color: 'var(--t2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderTop: '1px solid rgba(0,0,0,.06)', padding: '0 20px' }}>
          {([['courses', 'Courses'], ['factures', 'Facturation'], ['profil', 'Profil']] as const).map(([tab, label]) => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--gold)' : 'var(--t2)',
              borderBottom: activeTab === tab ? '2px solid var(--gold)' : '2px solid transparent',
              fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
              transition: 'color .12s',
            }}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ padding: '18px 20px 0' }}>

        {/* ── TAB COURSES ── */}
        {activeTab === 'courses' && (<>
          <style>{`@keyframes pulse-amb{0%,100%{box-shadow:0 0 0 0 rgba(232,160,48,.4)}50%{box-shadow:0 0 0 6px rgba(232,160,48,0)}}`}</style>

          {/* Mission active */}
          {activeCourse && (
            <div style={{
              background: '#FFFFFF', border: '1px solid rgba(77,142,212,.3)',
              borderRadius: 16, overflow: 'hidden', marginBottom: 12,
              boxShadow: '0 2px 16px rgba(77,142,212,.08)',
            }}>
              <div style={{
                background: 'linear-gradient(90deg,rgba(77,142,212,.1),transparent)',
                padding: '9px 16px', borderBottom: '1px solid rgba(77,142,212,.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--blu)', boxShadow: '0 0 6px rgba(77,142,212,.6)' }} />
                  <span style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--blu)', fontWeight: 700 }}>Mission en cours</span>
                </div>
                <span style={{ fontFamily: 'monospace', fontSize: 10, color: 'var(--gold)', fontWeight: 600 }}>
                  {new Date(activeCourse.date_prevue).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                  {' · '}
                  {new Date(activeCourse.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Timeline */}
              <div style={{ display: 'flex', borderBottom: '1px solid rgba(77,142,212,.08)' }}>
                {ETAPES.map((e, i) => (
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
                      fontSize: 9, fontWeight: 700, color: i <= etapeIndex ? '#fff' : 'var(--t3)',
                    }}>
                      {i < etapeIndex ? '✓' : i + 1}
                    </div>
                    <div style={{ fontSize: 8.5, fontWeight: i === etapeIndex ? 600 : 400, color: i <= etapeIndex ? 'var(--t1)' : 'var(--t3)' }}>
                      {e.label}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <a href={mapsUrl(activeCourse.adresse_depart)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,.3)' }}>{activeCourse.adresse_depart}</span>
                  </a>
                  {(Array.isArray(activeCourse.etapes) ? activeCourse.etapes : []).map((etape: string, i: number) => (
                    <a key={i} href={mapsUrl(etape)} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--amb)', marginTop: 4, flexShrink: 0, boxShadow: '0 0 4px rgba(232,160,48,.4)' }} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(232,160,48,.3)' }}>
                        <span style={{ fontSize: 8, color: 'var(--amb)', fontWeight: 700, marginRight: 4 }}>ÉTAPE {i + 1}</span>
                        {etape}
                      </span>
                    </a>
                  ))}
                  <a href={mapsUrl(activeCourse.adresse_arrivee)} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'flex-start', gap: 8, textDecoration: 'none' }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,.3)' }}>{activeCourse.adresse_arrivee}</span>
                  </a>
                </div>

                {/* Client info */}
                {(() => {
                  const nom = getClientNom(activeCourse)
                  const tel = getClientTel(activeCourse)
                  return (
                    <div style={{
                      background: 'rgba(77,142,212,.05)', border: '1px solid rgba(77,142,212,.12)',
                      borderRadius: 10, padding: '10px 14px', marginBottom: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <div>
                        <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>Client</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: nom ? 'var(--t1)' : 'var(--t3)' }}>
                          {nom ?? 'Non renseigné'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 2 }}>
                          {activeCourse.nb_passagers} pass. · {TYPE_VEHICULE_LABEL[activeCourse.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL] ?? activeCourse.type_vehicule}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                        {tel && (
                          <a href={`tel:${tel}`} style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '8px 14px', borderRadius: 100,
                            background: 'rgba(77,142,212,.12)', border: '1px solid rgba(77,142,212,.25)',
                            color: 'var(--blu)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                          }}>
                            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                            </svg>
                            {tel}
                          </a>
                        )}
                        {activeCourse.prix_sous_traitant && (
                          <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--gold)' }}>
                            {activeCourse.prix_sous_traitant} €
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}

                {etape?.action && (
                  <button
                    onClick={() => startTransition(async () => {
                      const next = PROGRESSION[activeCourse.statut as StatutCourse]
                      if (next && next !== 'en_attente' && next !== 'acceptee' && next !== 'annulee') {
                        await progresserCourseSTAction(activeCourse.id, next as 'en_route' | 'prise_en_charge' | 'terminee')
                        router.refresh()
                      }
                    })}
                    disabled={pending}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 14, border: 'none',
                      background: etape.statut === 'prise_en_charge' ? 'linear-gradient(135deg,#3DB87A,#2a9e62)'
                        : etape.statut === 'en_route' ? 'linear-gradient(135deg,#E8A030,#c47e10)'
                        : 'linear-gradient(135deg,#4D8ED4,#2a6cb8)',
                      color: '#fff', fontSize: 15, fontWeight: 700,
                      cursor: pending ? 'wait' : 'pointer', opacity: pending ? .7 : 1,
                      fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                    }}
                  >
                    {pending ? '…' : etape.action}
                  </button>
                )}
              </div>
            </div>
          )}

          {!activeCourse && (
            <div style={{
              background: '#FFFFFF', border: '1px solid rgba(0,0,0,.08)',
              borderRadius: 16, padding: '32px 24px', textAlign: 'center', marginBottom: 12,
            }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>🚘</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 4 }}>Aucune mission aujourd'hui</div>
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>Consultez le planning pour vos prochaines courses.</div>
            </div>
          )}

          {/* Agenda */}
          <div style={{ marginBottom: 16 }}>
            <style>{`.st-datepicker::-webkit-scrollbar{display:none}`}</style>
            <div className="st-datepicker" style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none', padding: '2px 0 10px' }}>
              {days.map(({ key, date }) => {
                const isSel = key === selectedDate
                const isToday = key === todayKey
                const hasCourses = (byDay[key] ?? []).length > 0
                return (
                  <button key={key} onClick={() => setSelectedDate(key)} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                    padding: '9px 10px', borderRadius: 14, flexShrink: 0, minWidth: 46,
                    background: isSel ? 'var(--gold)' : isToday ? 'rgba(201,168,76,.08)' : '#FFFFFF',
                    border: `1px solid ${isSel ? 'transparent' : isToday ? 'rgba(201,168,76,.25)' : 'rgba(0,0,0,.08)'}`,
                    cursor: 'pointer', boxShadow: isSel ? '0 4px 14px rgba(201,168,76,.25)' : 'none',
                  }}>
                    <span style={{ fontSize: 8.5, letterSpacing: '.06em', textTransform: 'uppercase', fontWeight: 600, color: isSel ? 'rgba(9,9,26,.55)' : 'var(--t3)' }}>
                      {DAY_LABELS[date.getDay()]}
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace', color: isSel ? '#09091A' : isToday ? 'var(--gold)' : 'var(--t1)' }}>
                      {date.getDate()}
                    </span>
                    <div style={{ width: 4, height: 4, borderRadius: '50%', background: hasCourses ? (isSel ? 'rgba(9,9,26,.45)' : 'var(--gold)') : 'transparent' }} />
                  </button>
                )
              })}
            </div>

            <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 600 }}>{selLabel}</span>
                {selCourses.length > 0 && <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'monospace' }}>{selCourses.length} course{selCourses.length > 1 ? 's' : ''}</span>}
              </div>

              {selCourses.length === 0 ? (
                <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>Aucune course ce jour</div>
              ) : selCourses.map((c: any, i: number) => {
                const date = new Date(c.date_prevue)
                const isExpanded = expandedId === c.id
                const statutColors: Record<string, { label: string; color: string }> = {
                  acceptee: { label: 'Acceptée', color: 'var(--gold)' },
                  en_attente: { label: 'À confirmer', color: 'var(--amb)' },
                  en_route: { label: 'En route', color: 'var(--blu)' },
                  prise_en_charge: { label: 'À bord', color: 'var(--grn)' },
                }
                const badge = statutColors[c.statut]
                return (
                  <div key={c.id} style={{ borderBottom: i < selCourses.length - 1 ? '1px solid rgba(201,168,76,.06)' : 'none' }}>
                    <button onClick={() => setExpandedId(isExpanded ? null : c.id)} style={{
                      width: '100%', background: isExpanded ? 'rgba(201,168,76,.04)' : 'transparent',
                      border: 'none', cursor: 'pointer', padding: '13px 16px',
                      display: 'grid', gridTemplateColumns: '52px 1fr auto', gap: '0 10px',
                      alignItems: 'start', textAlign: 'left',
                    }}>
                      <div>
                        <div style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 700, color: 'var(--gold)' }}>
                          {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {badge && <div style={{ fontSize: 7.5, letterSpacing: '.06em', textTransform: 'uppercase', color: badge.color, fontWeight: 600, marginTop: 3 }}>{badge.label}</div>}
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
                        {c.prix_sous_traitant && <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{c.prix_sous_traitant} €</span>}
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2.5} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </div>
                    </button>

                    {isExpanded && (() => {
                      const cNom = getClientNom(c)
                      const cTel = getClientTel(c)
                      return (
                        <div style={{ margin: '0 12px 12px', background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.14)', borderRadius: 12, padding: '14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {/* Client */}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10, borderBottom: '1px solid rgba(201,168,76,.1)' }}>
                            <div>
                              <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 3 }}>Client</div>
                              <div style={{ fontSize: 14, fontWeight: 600, color: cNom ? 'var(--t1)' : 'var(--t3)' }}>{cNom ?? 'Non renseigné'}</div>
                            </div>
                            {cTel ? (
                              <a href={`tel:${cTel}`} style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                padding: '8px 14px', borderRadius: 100,
                                background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)',
                                color: 'var(--gold)', fontSize: 12, fontWeight: 600, textDecoration: 'none',
                              }}>
                                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                                </svg>
                                {cTel}
                              </a>
                            ) : (
                              <span style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Pas de numéro</span>
                            )}
                          </div>
                          {/* Adresses */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            <a href={mapsUrl(c.adresse_depart)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 8, textDecoration: 'none' }}>
                              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--grn)', flexShrink: 0, marginTop: 4 }} />
                              <span style={{ fontSize: 12, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,.3)' }}>{c.adresse_depart}</span>
                            </a>
                            <a href={mapsUrl(c.adresse_arrivee)} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', gap: 8, textDecoration: 'none' }}>
                              <span style={{ width: 7, height: 7, borderRadius: 2, border: '2px solid var(--red)', flexShrink: 0, marginTop: 4 }} />
                              <span style={{ fontSize: 12, color: 'var(--t1)', textDecoration: 'underline', textDecorationColor: 'rgba(201,168,76,.3)' }}>{c.adresse_arrivee}</span>
                            </a>
                          </div>
                          {c.notes && (
                            <div style={{ fontSize: 11, color: 'var(--t2)', background: 'rgba(201,168,76,.05)', borderRadius: 8, padding: '8px 10px' }}>
                              <span style={{ fontSize: 9, color: 'var(--gold)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.08em', marginRight: 4 }}>Note :</span>
                              {c.notes}
                            </div>
                          )}
                          {/* Accepter / Refuser si en_attente */}
                          {c.statut === 'en_attente' && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                              <button
                                disabled={pending}
                                onClick={() => startTransition(() => accepterCourseSTAction(c.id).then(() => router.refresh()))}
                                style={{
                                  padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer',
                                  background: 'rgba(61,184,122,.12)', color: 'var(--grn)',
                                  fontSize: 13, fontWeight: 700, opacity: pending ? .6 : 1,
                                  fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                                }}
                              >
                                ✓ Accepter
                              </button>
                              <button
                                disabled={pending}
                                onClick={() => startTransition(() => refuserCourseSTAction(c.id).then(() => router.refresh()))}
                                style={{
                                  padding: '11px', borderRadius: 10, border: '1px solid rgba(217,84,84,.2)', cursor: 'pointer',
                                  background: 'rgba(217,84,84,.06)', color: 'var(--red)',
                                  fontSize: 13, fontWeight: 600, opacity: pending ? .6 : 1,
                                  fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
                                }}
                              >
                                ✕ Refuser
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Historique */}
          {historique.length > 0 && (
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '11px 16px', borderBottom: '1px solid rgba(201,168,76,.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>Historique</span>
                <span style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'monospace' }}>{historique.length} course{historique.length > 1 ? 's' : ''}</span>
              </div>
              {historique.map((c: any, i: number) => (
                <div key={c.id} style={{
                  padding: '11px 16px', borderBottom: i < historique.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                  display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--t3)', fontFamily: 'monospace', marginBottom: 3 }}>
                      {new Date(c.date_prevue).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: 'short' })}
                      {' · '}
                      {new Date(c.date_prevue).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {' '}
                      <span style={{ fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(61,184,122,.1)', color: 'var(--grn)', fontWeight: 500 }}>✓ Terminée</span>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{c.adresse_depart.split(',')[0]}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>→ {c.adresse_arrivee.split(',')[0]}</div>
                  </div>
                  {c.prix_sous_traitant && (
                    <span style={{ fontFamily: 'monospace', fontSize: 15, fontWeight: 600, color: 'var(--grn)' }}>{c.prix_sous_traitant} €</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </>)}

        {/* ── TAB FACTURATION ── */}
        {activeTab === 'factures' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Résumé */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'À recevoir', value: totalDu > 0 ? `${totalDu.toFixed(2)} €` : '—', color: 'var(--amb)' },
                { label: 'Déjà reçu', value: totalPaye > 0 ? `${totalPaye.toFixed(2)} €` : '—', color: 'var(--grn)' },
              ].map(k => (
                <div key={k.label} style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,.18)', borderRadius: 14, padding: '16px 18px' }}>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>{k.label}</div>
                  <div style={{ fontFamily: 'monospace', fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* Liste factures */}
            {factures.length === 0 ? (
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,.08)', borderRadius: 16, padding: '40px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                Aucune facture
              </div>
            ) : (
              <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden' }}>
                {factures.map((f: any, i: number) => (
                  <div key={f.id} style={{
                    padding: '14px 16px',
                    borderBottom: i < factures.length - 1 ? '1px solid rgba(201,168,76,.06)' : 'none',
                    display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 2 }}>{f.periode}</div>
                      {f.notes && <div style={{ fontSize: 10, color: 'var(--t3)' }}>{f.notes}</div>}
                      {f.date_paiement && (
                        <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: 2 }}>
                          Payée le {new Date(f.date_paiement).toLocaleDateString('fr-FR')}
                        </div>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>
                        {f.montant_ht.toFixed(2)} €
                      </div>
                      <span style={{
                        fontSize: 9, padding: '2px 8px', borderRadius: 4, fontWeight: 600,
                        color: f.statut === 'payee' ? 'var(--grn)' : 'var(--amb)',
                        background: f.statut === 'payee' ? 'rgba(61,184,122,.1)' : 'rgba(232,160,48,.1)',
                        border: f.statut === 'payee' ? '1px solid rgba(61,184,122,.25)' : '1px solid rgba(232,160,48,.25)',
                      }}>
                        {f.statut === 'payee' ? '✓ Payée' : 'En attente'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TAB PROFIL ── */}
        {activeTab === 'profil' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Infos personnelles */}
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,.08)' }}>
                <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 600 }}>Informations</span>
              </div>
              <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { label: 'Nom / Société', val: profilNom, set: setProfilNom, ph: 'Transport Dupont' },
                  { label: 'Téléphone', val: profilTel, set: setProfilTel, ph: '+33 6 00 00 00 00' },
                ].map(f => (
                  <div key={f.label}>
                    <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 5 }}>{f.label}</div>
                    <input
                      value={f.val} onChange={e => f.set(e.target.value)}
                      placeholder={f.ph}
                      style={{
                        width: '100%', padding: '10px 13px', borderRadius: 9, fontSize: 13,
                        background: 'var(--elevated)', border: '1px solid var(--gb)', color: 'var(--t1)',
                        outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
                      }}
                    />
                  </div>
                ))}

                {/* Mode de paiement */}
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 5 }}>Mode de paiement</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {[
                      { val: 'immediat',    label: 'Immédiat' },
                      { val: 'hebdomadaire', label: 'Hebdo' },
                      { val: 'mensuel',     label: 'Mensuel' },
                    ].map(opt => (
                      <button key={opt.val} onClick={() => setProfilMode(opt.val)} style={{
                        padding: '8px 16px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                        fontFamily: 'inherit', fontWeight: profilMode === opt.val ? 700 : 400,
                        background: profilMode === opt.val ? 'rgba(201,168,76,.12)' : 'var(--elevated)',
                        border: profilMode === opt.val ? '1px solid rgba(201,168,76,.35)' : '1px solid var(--gb)',
                        color: profilMode === opt.val ? 'var(--gold)' : 'var(--t2)',
                      }}>{opt.label}</button>
                    ))}
                  </div>
                </div>

                {profilMsg && (
                  <div style={{ fontSize: 12, color: profilMsg.startsWith('✓') ? 'var(--grn)' : 'var(--red)', padding: '8px 12px', borderRadius: 8, background: profilMsg.startsWith('✓') ? 'rgba(61,184,122,.08)' : 'rgba(217,84,84,.08)' }}>
                    {profilMsg}
                  </div>
                )}

                <button
                  disabled={profilSaving}
                  onClick={async () => {
                    setProfilSaving(true); setProfilMsg('')
                    const { error } = await updateProfilSTAction(stId, { nom: profilNom, telephone: profilTel, mode_paiement: profilMode })
                    setProfilMsg(error ? `Erreur : ${error}` : '✓ Profil mis à jour')
                    setProfilSaving(false)
                  }}
                  style={{
                    width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                    background: profilSaving ? 'var(--elevated)' : 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
                    color: profilSaving ? 'var(--t3)' : '#fff', fontSize: 13, fontWeight: 700,
                    cursor: profilSaving ? 'wait' : 'pointer', fontFamily: 'inherit',
                  }}
                >
                  {profilSaving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </div>

            {/* Documents */}
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(201,168,76,.18)', borderRadius: 16, overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(201,168,76,.08)' }}>
                <span style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 600 }}>Documents légaux</span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { label: 'Carte VTC', desc: 'Carte professionnelle VTC en cours de validité' },
                  { label: 'Assurance RC Pro', desc: 'Assurance responsabilité civile professionnelle' },
                  { label: 'Visite médicale', desc: 'Certificat médical en cours de validité' },
                  { label: 'Permis de conduire', desc: 'Permis B (ou D) en cours de validité' },
                ].map(doc => (
                  <div key={doc.label} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '12px 14px', background: 'var(--elevated)', borderRadius: 10,
                    border: '1px solid var(--gb)',
                  }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>{doc.label}</div>
                      <div style={{ fontSize: 10, color: 'var(--t3)' }}>{doc.desc}</div>
                    </div>
                    <div style={{
                      fontSize: 9, padding: '3px 9px', borderRadius: 6, fontWeight: 600,
                      color: 'var(--amb)', background: 'rgba(232,160,48,.1)', border: '1px solid rgba(232,160,48,.2)',
                    }}>
                      À transmettre
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 11, color: 'var(--t3)', textAlign: 'center', marginTop: 4 }}>
                  Envoyez vos documents par WhatsApp :{' '}
                  <a href="https://wa.me/33619106356" style={{ color: 'var(--gold)', textDecoration: 'none' }}>+33 6 19 10 63 56</a>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
