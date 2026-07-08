'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import DispatchRapideButton from '../courses/DispatchRapideButton'
import { STATUT_COURSE_COLOR, STATUT_COURSE_LABEL } from '@/lib/types'

// ── Constants ─────────────────────────────────────────────────────────────────
const HOUR_H    = 60   // px par heure dans la vue semaine
const START_H   = 5    // 05:00
const END_H     = 23   // 23:00
const HOURS     = Array.from({ length: END_H - START_H + 1 }, (_, i) => START_H + i)
const DAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

// ── Types ─────────────────────────────────────────────────────────────────────
type CourseItem = {
  id: string
  statut: string
  chauffeur_id: string | null
  adresse_depart: string
  adresse_arrivee: string
  date_prevue: string
  nb_passagers: number | null
  notes: string | null
  passager_prenom: string | null
  passager_nom: string | null
  clients: any
  chauffeurs: any
  collaborateurs: any
}
type ChauffeurItem = { id: string; statut: string; profiles: { prenom: string; nom: string } | null }
type View = 'semaine' | 'mois' | 'liste'

// ── Helpers ───────────────────────────────────────────────────────────────────

// Les dates Supabase arrivent en UTC ("2026-07-18T04:00:00+00:00") mais l'heure
// saisie par l'admin est déjà l'heure Paris — on retire le suffixe TZ pour
// éviter que le navigateur convertisse en heure locale (+2h en été).
function parseAsLocal(iso: string): Date {
  return new Date(iso.replace(/([+-]\d{2}:\d{2}|Z)$/, ''))
}

function dk(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate()
}
function weekStart(date: Date): Date {
  const d = new Date(date); const day = d.getDay()
  d.setDate(d.getDate() + (day===0 ? -6 : 1-day)); d.setHours(0,0,0,0); return d
}
function weekDays(date: Date): Date[] {
  const s = weekStart(date)
  return Array.from({length:7},(_,i)=>{ const d=new Date(s); d.setDate(s.getDate()+i); return d })
}
function monthGrid(date: Date): Date[] {
  const s = weekStart(new Date(date.getFullYear(), date.getMonth(), 1))
  return Array.from({length:42},(_,i)=>{ const d=new Date(s); d.setDate(s.getDate()+i); return d })
}
function topPx(date: Date): number {
  return ((date.getHours()-START_H) + date.getMinutes()/60) * HOUR_H
}
function clientNom(c: CourseItem): string {
  const cl = c.clients
  if (cl) {
    return cl.type_compte === 'entreprise'
      ? (cl.entreprise_nom ?? '—')
      : cl.profiles ? `${cl.profiles.prenom} ${cl.profiles.nom}` : '—'
  }
  const passager = `${c.passager_prenom ?? ''} ${c.passager_nom ?? ''}`.trim()
  return passager || '—'
}
function chauffeurNom(c: CourseItem): string|null {
  return c.chauffeurs?.profiles
    ? `${c.chauffeurs.profiles.prenom} ${c.chauffeurs.profiles.nom}` : null
}
// Assignation de "tracks" pour éviter le chevauchement visuel dans la vue semaine
function assignTracks(courses: CourseItem[]): Map<string,{track:number;total:number}> {
  const sorted = [...courses].sort((a,b)=>parseAsLocal(a.date_prevue).getTime()-parseAsLocal(b.date_prevue).getTime())
  const tracks: number[] = [] // chaque slot = fin estimée en ms
  const result = new Map<string,{track:number;total:number}>()
  for (const c of sorted) {
    const start = parseAsLocal(c.date_prevue).getTime()
    const end   = start + 60*60*1000 // durée estimée 60min
    let t = tracks.findIndex(e => e <= start)
    if (t === -1) { t = tracks.length; tracks.push(end) } else tracks[t] = end
    result.set(c.id, { track: t, total: 0 })
  }
  // Calculer total par groupe (chevauchements réels)
  // Simple : recalcul sur chaque course
  for (const c of sorted) {
    const start = parseAsLocal(c.date_prevue).getTime()
    const end   = start + 60*60*1000
    let maxTrack = 0
    for (const c2 of sorted) {
      const s2 = parseAsLocal(c2.date_prevue).getTime()
      const e2 = s2 + 60*60*1000
      if (start < e2 && end > s2) {
        const t2 = result.get(c2.id)?.track ?? 0
        if (t2 > maxTrack) maxTrack = t2
      }
    }
    const info = result.get(c.id)!
    result.set(c.id, { ...info, total: maxTrack + 1 })
  }
  return result
}

// ── CourseCard (vue semaine) ──────────────────────────────────────────────────
function SemaineCourseCard({
  course, chauffeurs, track, total,
}: {
  course: CourseItem; chauffeurs: ChauffeurItem[]; track: number; total: number
}) {
  const date   = parseAsLocal(course.date_prevue)
  const top    = topPx(date)
  const color  = STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR] ?? 'var(--t3)'
  const unassigned = !course.chauffeur_id && !['terminee','annulee'].includes(course.statut)
  const width  = total > 1 ? `calc(${100/total}% - 3px)` : 'calc(100% - 6px)'
  const left   = total > 1 ? `calc(${(track/total)*100}% + 3px)` : '3px'
  const chNom  = chauffeurNom(course)

  return (
    <div style={{
      position: 'absolute', top, left, width,
      minHeight: 44, zIndex: 2,
      background: `${color}15`,
      border: `1.5px solid ${unassigned ? 'rgba(201,168,76,.6)' : color+'40'}`,
      borderLeft: `3px solid ${color}`,
      borderRadius: 6,
      overflow: 'hidden',
      boxShadow: unassigned ? '0 0 0 2px rgba(201,168,76,.15)' : 'none',
      animation: unassigned ? 'pulse-border 2s infinite' : 'none',
    }}>
      <a href={`/admin/courses/${course.id}`} style={{
        display: 'block', padding: '4px 6px 2px',
        textDecoration: 'none',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, lineHeight: 1 }}>
          <span style={{
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 10, fontWeight: 700, color,
          }}>
            {date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
          </span>
          {course.nb_passagers && course.nb_passagers > 0 && (
            <span style={{
              fontSize: 8, padding: '1px 4px', borderRadius: 3,
              background: `${color}20`, color, fontWeight: 600,
            }}>
              {course.nb_passagers}p
            </span>
          )}
        </div>
        {clientNom(course) !== '—' && (
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--gold)', marginTop: 2, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {clientNom(course)}
          </div>
        )}
        <div style={{ fontSize: 9, color: 'var(--t1)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
          {course.adresse_depart.split(',')[0]}
        </div>
        <div style={{ fontSize: 9, color: 'var(--t2)', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          → {course.adresse_arrivee.split(',')[0]}
        </div>
      </a>
      <div style={{ padding: '2px 6px 4px' }} onClick={e => e.stopPropagation()}>
        <DispatchRapideButton
          courseId={course.id}
          chauffeurs={chauffeurs}
          currentChauffeurId={course.chauffeur_id}
          currentChauffeurNom={chNom}
        />
      </div>
    </div>
  )
}

// ── Vue Semaine ───────────────────────────────────────────────────────────────
function VueSemaine({ days, courses, chauffeurs, today }: {
  days: Date[]; courses: CourseItem[]; chauffeurs: ChauffeurItem[]; today: Date
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!scrollRef.current) return
    const nowMinutes = (new Date().getHours()-START_H)*60 + new Date().getMinutes()
    const scrollTo = (nowMinutes/60)*HOUR_H - 120
    scrollRef.current.scrollTop = Math.max(0, scrollTo)
  }, [])

  const now = new Date()
  const isCurrentWeek = days.some(d => sameDay(d, now))
  const nowTop = isCurrentWeek ? topPx(now) : -1

  // Grouper les courses par jour
  const byDay = new Map<string, CourseItem[]>()
  for (const c of courses) {
    const key = dk(parseAsLocal(c.date_prevue))
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(c)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1 }}>
      {/* En-têtes jours */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(7,1fr)', borderBottom: '1px solid rgba(201,168,76,.1)', flexShrink: 0 }}>
        <div />
        {days.map((day, i) => {
          const isToday = sameDay(day, today)
          const cnt = byDay.get(dk(day))?.length ?? 0
          return (
            <div key={i} style={{
              padding: '8px 4px', textAlign: 'center',
              borderLeft: '1px solid rgba(201,168,76,.06)',
              background: isToday ? 'rgba(201,168,76,.04)' : 'transparent',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--t3)' }}>{DAY_NAMES[i]}</div>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', margin: '4px auto 0',
                background: isToday ? 'var(--gold)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 13, fontWeight: 700,
                color: isToday ? 'var(--base)' : 'var(--t1)',
              }}>
                {day.getDate()}
              </div>
              {cnt > 0 && (
                <div style={{ fontSize: 9, color: isToday ? 'var(--gold)' : 'var(--t3)', marginTop: 2 }}>
                  {cnt} course{cnt>1?'s':''}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grille horaire */}
      <div ref={scrollRef} style={{ overflowY: 'auto', flex: 1 }}>
        <div style={{
          display: 'grid', gridTemplateColumns: '44px repeat(7,1fr)',
          height: `${(END_H-START_H+1)*HOUR_H}px`, position: 'relative',
        }}>
          {/* Colonne heure */}
          <div style={{ position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={{
                position: 'absolute', top: (h-START_H)*HOUR_H - 7,
                right: 8, fontSize: 9, color: 'var(--t3)',
                fontFamily: 'var(--font-jetbrains), monospace',
              }}>
                {String(h).padStart(2,'0')}
              </div>
            ))}
          </div>

          {/* Colonnes jours */}
          {days.map((day, i) => {
            const key   = dk(day)
            const dCourses = byDay.get(key) ?? []
            const tracks = assignTracks(dCourses)
            const isToday = sameDay(day, today)
            return (
              <div key={i} style={{
                position: 'relative',
                borderLeft: '1px solid rgba(201,168,76,.06)',
                background: isToday ? 'rgba(201,168,76,.02)' : 'transparent',
              }}>
                {/* Lignes heure */}
                {HOURS.map(h => (
                  <div key={h} style={{
                    position: 'absolute', top: (h-START_H)*HOUR_H, left: 0, right: 0,
                    borderTop: h === START_H ? 'none' : '1px solid rgba(201,168,76,.05)',
                    height: HOUR_H,
                  }}/>
                ))}

                {/* Ligne "maintenant" */}
                {isCurrentWeek && isToday && nowTop >= 0 && (
                  <div style={{
                    position: 'absolute', top: nowTop, left: 0, right: 0, zIndex: 10,
                    borderTop: '2px solid var(--red)', pointerEvents: 'none',
                  }}>
                    <div style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: 'var(--red)', marginTop: -5, marginLeft: -4,
                    }}/>
                  </div>
                )}

                {/* Courses */}
                {dCourses.map(c => {
                  const info = tracks.get(c.id)!
                  return (
                    <SemaineCourseCard
                      key={c.id}
                      course={c}
                      chauffeurs={chauffeurs}
                      track={info.track}
                      total={info.total}
                    />
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Vue Mois ──────────────────────────────────────────────────────────────────
function VueMois({ date, courses, today, chauffeurs }: {
  date: Date; courses: CourseItem[]; today: Date; chauffeurs: ChauffeurItem[]
}) {
  const [expandedDay, setExpandedDay] = useState<string|null>(null)
  const grid = monthGrid(date)
  const month = date.getMonth()

  const byDay = new Map<string, CourseItem[]>()
  for (const c of courses) {
    const key = dk(parseAsLocal(c.date_prevue))
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(c)
  }

  return (
    <div style={{ padding: '0 0 24px', flex: 1, overflow: 'auto' }}>
      {/* En-têtes jours */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 4 }}>
        {DAY_NAMES.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', padding: '8px 0' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {grid.map((day, i) => {
          const key      = dk(day)
          const dCourses = byDay.get(key) ?? []
          const inMonth  = day.getMonth() === month
          const isToday  = sameDay(day, today)
          const expanded = expandedDay === key
          const unassigned = dCourses.filter(c => !c.chauffeur_id && !['terminee','annulee'].includes(c.statut)).length

          return (
            <div key={i}>
              <div
                onClick={() => setExpandedDay(expanded ? null : key)}
                style={{
                  minHeight: 72, padding: '6px 8px', borderRadius: 8, cursor: dCourses.length>0 ? 'pointer' : 'default',
                  background: isToday ? 'rgba(201,168,76,.08)' : expanded ? 'var(--elevated)' : 'var(--surface)',
                  border: `1px solid ${isToday ? 'rgba(201,168,76,.3)' : 'rgba(201,168,76,.07)'}`,
                  opacity: inMonth ? 1 : 0.4,
                  transition: 'background .12s',
                }}
              >
                <div style={{
                  width: 24, height: 24, borderRadius: '50%',
                  background: isToday ? 'var(--gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 12, fontWeight: 700,
                  color: isToday ? 'var(--base)' : inMonth ? 'var(--t1)' : 'var(--t3)',
                  marginBottom: 4,
                }}>
                  {day.getDate()}
                </div>

                {/* Badges courses */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {dCourses.slice(0, 3).map(c => {
                    const color = STATUT_COURSE_COLOR[c.statut as keyof typeof STATUT_COURSE_COLOR] ?? 'var(--t3)'
                    const time  = parseAsLocal(c.date_prevue).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
                    const nom   = clientNom(c)
                    return (
                      <div key={c.id} style={{
                        padding: '3px 5px', borderRadius: 4,
                        background: `${color}18`, border: `1px solid ${color}35`,
                        overflow: 'hidden',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 3 }}>
                          <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 9, fontWeight: 700, color }}>{time}</span>
                          {c.nb_passagers && c.nb_passagers > 0 && (
                            <span style={{ fontSize: 8, color, fontWeight: 700 }}>{c.nb_passagers}p</span>
                          )}
                        </div>
                        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--gold)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>
                          {nom !== '—' ? nom : c.adresse_depart.split(',')[0]}
                        </div>
                      </div>
                    )
                  })}
                  {dCourses.length > 3 && (
                    <div style={{ fontSize: 9, color: 'var(--t3)', paddingLeft: 5 }}>
                      +{dCourses.length-3} autre{dCourses.length-3>1?'s':''}
                    </div>
                  )}
                  {unassigned > 0 && dCourses.length <= 3 && (
                    <div style={{ fontSize: 9, color: 'var(--gold)', paddingLeft: 5, fontWeight: 600 }}>
                      ⚠ {unassigned} sans chauffeur
                    </div>
                  )}
                </div>
              </div>

              {/* Détail jour expansé */}
              {expanded && dCourses.length > 0 && (
                <div style={{
                  gridColumn: '1 / -1',
                  background: 'var(--elevated)', borderRadius: 8, padding: '12px',
                  marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6,
                }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--t2)', marginBottom: 4 }}>
                    {day.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </div>
                  {dCourses.map(c => {
                    const color = STATUT_COURSE_COLOR[c.statut as keyof typeof STATUT_COURSE_COLOR] ?? 'var(--t3)'
                    const time  = parseAsLocal(c.date_prevue).toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})
                    return (
                      <a key={c.id} href={`/admin/courses/${c.id}`} style={{
                        display: 'grid', gridTemplateColumns: '54px 1fr auto 130px',
                        padding: '8px 10px', borderRadius: 7, textDecoration: 'none',
                        background: 'var(--surface)', border: `1px solid ${color}30`,
                        alignItems: 'center', gap: 10,
                      }}>
                        <div style={{ fontFamily:'var(--font-jetbrains), monospace', fontSize:13, fontWeight:700, color }}>{time}</div>
                        <div>
                          {clientNom(c) !== '—' && (
                            <div style={{ fontSize:12, fontWeight:700, color:'var(--gold)', marginBottom: 2 }}>{clientNom(c)}</div>
                          )}
                          <div style={{ fontSize:10, color:'var(--t1)' }}>{c.adresse_depart.split(',')[0]}</div>
                          <div style={{ fontSize:10, color:'var(--t2)' }}>→ {c.adresse_arrivee.split(',')[0]}</div>
                        </div>
                        <div style={{ fontSize:10, color:'var(--t2)', textAlign:'center' }}>
                          {c.nb_passagers && c.nb_passagers > 0
                            ? <span style={{ padding:'2px 6px', borderRadius:4, background:'rgba(201,168,76,.1)', color:'var(--gold)', fontWeight:600, fontSize:9 }}>{c.nb_passagers} pax</span>
                            : null}
                        </div>
                        <div onClick={e => { e.preventDefault(); e.stopPropagation() }}>
                          {['terminee','annulee'].includes(c.statut) ? (
                            <span style={{ fontSize:10, color:'var(--t2)' }}>{chauffeurNom(c) ?? '—'}</span>
                          ) : (
                            <DispatchRapideButton
                              courseId={c.id}
                              chauffeurs={chauffeurs}
                              currentChauffeurId={c.chauffeur_id}
                              currentChauffeurNom={chauffeurNom(c)}
                            />
                          )}
                        </div>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Vue Liste ─────────────────────────────────────────────────────────────────
function VueListe({ courses, chauffeurs, today }: {
  courses: CourseItem[]; chauffeurs: ChauffeurItem[]; today: Date
}) {
  const byDay = new Map<string, CourseItem[]>()
  for (const c of courses) {
    const key = dk(parseAsLocal(c.date_prevue))
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key)!.push(c)
  }

  const sortedDays = Array.from(byDay.keys()).sort()

  if (sortedDays.length === 0) return (
    <div style={{ padding:'60px', textAlign:'center', color:'var(--t3)', fontSize:13 }}>
      Aucune course sur cette période
    </div>
  )

  return (
    <div style={{ padding:'0 0 24px', flex:1, overflow:'auto' }}>
      {sortedDays.map(dayKey => {
        const dayCourses = byDay.get(dayKey)!
        const dayDate    = new Date(dayKey+'T12:00:00')
        const isToday    = sameDay(dayDate, today)

        return (
          <div key={dayKey} style={{ marginBottom: 20 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, padding:'16px 0 8px' }}>
              <div style={{
                width:36, height:36, borderRadius:isToday?10:8, flexShrink:0,
                background: isToday?'var(--gold)':'var(--elevated)',
                border: isToday?'none':'1px solid var(--t3)',
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                <span style={{ fontFamily:'var(--font-jetbrains), monospace', fontSize:14, fontWeight:700, color:isToday?'var(--base)':'var(--t1)' }}>
                  {dayDate.getDate()}
                </span>
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:isToday?'var(--gold)':'var(--t1)', textTransform:'capitalize' }}>
                  {dayDate.toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'})}
                </div>
                <div style={{ fontSize:10, color:'var(--t3)' }}>{dayCourses.length} course{dayCourses.length>1?'s':''}</div>
              </div>
            </div>

            <div style={{ marginLeft:46, display:'flex', flexDirection:'column', gap:4 }}>
              {dayCourses.map((c:any) => {
                const date = parseAsLocal(c.date_prevue)
                const color = STATUT_COURSE_COLOR[c.statut as keyof typeof STATUT_COURSE_COLOR]
                const chNom = chauffeurNom(c)
                return (
                  <div key={c.id} style={{
                    display:'grid', gridTemplateColumns:'56px 1fr 180px 80px 170px 80px',
                    padding:'10px 14px', background:'var(--surface)',
                    border:`1px solid ${isToday?'rgba(201,168,76,.1)':'var(--gb)'}`,
                    borderRadius:9, alignItems:'center', gap:14,
                  }}>
                    <div style={{ fontFamily:'var(--font-jetbrains), monospace', fontSize:15, fontWeight:600, color:isToday?'var(--gold)':'var(--t1)' }}>
                      {date.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}
                    </div>
                    <a href={`/admin/courses/${c.id}`} style={{ textDecoration:'none' }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'var(--t1)', marginBottom:2 }}>{c.adresse_depart}</div>
                      <div style={{ fontSize:11, color:'var(--t2)' }}>→ {c.adresse_arrivee}</div>
                    </a>
                    <div style={{ fontSize:11, fontWeight:700, color:'var(--gold)' }}>{clientNom(c)}</div>
                    <div style={{ fontSize:11, color:'var(--t2)', textAlign:'center' }}>
                      {c.nb_passagers && c.nb_passagers > 0
                        ? <span style={{ padding:'2px 6px', borderRadius:4, background:'rgba(201,168,76,.1)', color:'var(--gold)', fontWeight:600, fontSize:10 }}>{c.nb_passagers} pax</span>
                        : <span style={{color:'var(--t3)'}}>—</span>}
                    </div>
                    <div onClick={e=>e.stopPropagation()}>
                      {['terminee','annulee'].includes(c.statut) ? (
                        <span style={{fontSize:11,color:'var(--t2)'}}>{chNom??'—'}</span>
                      ) : (
                        <DispatchRapideButton
                          courseId={c.id}
                          chauffeurs={chauffeurs}
                          currentChauffeurId={c.chauffeur_id}
                          currentChauffeurNom={chNom}
                        />
                      )}
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <span style={{ fontSize:9, padding:'3px 7px', borderRadius:4, fontWeight:500, color, background:`${color}18`, border:`1px solid ${color}30` }}>
                        {STATUT_COURSE_LABEL[c.statut as keyof typeof STATUT_COURSE_LABEL]}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── PlanningCalendar (main) ───────────────────────────────────────────────────
export default function PlanningCalendar({
  courses, chauffeurs, initialCourses,
}: {
  courses: CourseItem[]
  chauffeurs: ChauffeurItem[]
  initialCourses: CourseItem[]
}) {
  const today = new Date()
  const [view, setView]       = useState<View>('semaine')
  const [current, setCurrent] = useState(new Date())

  function prev() {
    setCurrent(d => {
      const n = new Date(d)
      if (view==='semaine') n.setDate(d.getDate()-7)
      else if (view==='mois') n.setMonth(d.getMonth()-1)
      return n
    })
  }
  function next() {
    setCurrent(d => {
      const n = new Date(d)
      if (view==='semaine') n.setDate(d.getDate()+7)
      else if (view==='mois') n.setMonth(d.getMonth()+1)
      return n
    })
  }
  function goToday() { setCurrent(new Date()) }

  // Filtrer les courses visibles selon la vue
  const visibleCourses = (() => {
    if (view === 'semaine') {
      const days = weekDays(current)
      const from = days[0]; const to = days[6]
      to.setHours(23,59,59,999)
      return courses.filter(c => {
        const d = parseAsLocal(c.date_prevue)
        return d >= from && d <= to
      })
    }
    if (view === 'mois') {
      const grid = monthGrid(current)
      const from = grid[0]; const to = grid[grid.length-1]
      to.setHours(23,59,59,999)
      return courses.filter(c => {
        const d = parseAsLocal(c.date_prevue)
        return d >= from && d <= to
      })
    }
    return courses // liste = tout
  })()

  const days     = weekDays(current)
  const unassigned = courses.filter(c => !c.chauffeur_id && !['terminee','annulee'].includes(c.statut)).length

  // Label de navigation
  const navLabel = (() => {
    if (view === 'semaine') {
      const days = weekDays(current)
      const s = days[0].toLocaleDateString('fr-FR',{day:'numeric',month:'short'})
      const e = days[6].toLocaleDateString('fr-FR',{day:'numeric',month:'short',year:'numeric'})
      return `${s} — ${e}`
    }
    return current.toLocaleDateString('fr-FR',{month:'long',year:'numeric'})
  })()

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: active ? 'var(--gold)' : 'var(--elevated)',
    color:      active ? 'var(--base)' : 'var(--t2)',
    border:     active ? 'none' : '1px solid var(--t3)',
    transition: 'all .12s',
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'calc(100vh - 60px)' }}>

      {/* Barre de contrôle */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 24px', borderBottom:'1px solid rgba(201,168,76,.08)',
        flexShrink: 0, gap: 12,
      }}>
        {/* Navigation */}
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <button onClick={prev} style={{ ...btnStyle(false), padding:'5px 10px', fontSize:14 }}>←</button>
          <button onClick={goToday} style={{ ...btnStyle(false), fontSize:10, letterSpacing:'.08em' }}>Aujourd&apos;hui</button>
          <button onClick={next} style={{ ...btnStyle(false), padding:'5px 10px', fontSize:14 }}>→</button>
          <span style={{ fontFamily:'var(--font-jetbrains), monospace', fontSize:12, color:'var(--t1)', marginLeft:8, minWidth:200 }}>
            {navLabel}
          </span>
        </div>

        {/* Stats + vue toggle */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          {unassigned > 0 && (
            <div style={{
              display:'flex', alignItems:'center', gap:6,
              padding:'4px 10px', borderRadius:16,
              background:'rgba(201,168,76,.1)', border:'1px solid rgba(201,168,76,.25)',
              fontSize:11, color:'var(--gold)', fontWeight:500,
            }}>
              <span style={{ width:6,height:6,borderRadius:'50%',background:'var(--gold)',display:'inline-block' }}/>
              {unassigned} sans chauffeur
            </div>
          )}
          <div style={{ display:'flex', gap:4 }}>
            {(['semaine','mois','liste'] as View[]).map(v => (
              <button key={v} onClick={()=>setView(v)} style={btnStyle(view===v)}>
                {v.charAt(0).toUpperCase()+v.slice(1)}
              </button>
            ))}
          </div>
          <Link href="/admin/courses/nouvelle" style={{
            ...btnStyle(false),
            background:'var(--gold)', color:'var(--base)', border:'none', textDecoration:'none',
            padding:'6px 14px',
          }}>
            + Nouvelle course
          </Link>
        </div>
      </div>

      {/* Vue active */}
      <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column', padding: view==='semaine' ? '0 12px' : '12px 24px' }}>
        {view==='semaine' && (
          <VueSemaine days={days} courses={visibleCourses} chauffeurs={chauffeurs} today={today} />
        )}
        {view==='mois' && (
          <VueMois date={current} courses={visibleCourses} today={today} chauffeurs={chauffeurs} />
        )}
        {view==='liste' && (
          <VueListe courses={visibleCourses} chauffeurs={chauffeurs} today={today} />
        )}
      </div>

      <style>{`
        @keyframes pulse-border {
          0%,100% { box-shadow: 0 0 0 2px rgba(201,168,76,.15); }
          50%      { box-shadow: 0 0 0 4px rgba(201,168,76,.3); }
        }
      `}</style>
    </div>
  )
}
