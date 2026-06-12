'use client'

import { useState, useRef } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────
type MonthData = {
  key: string; label: string
  count: number; ca: number; annulees: number; panierMoyen: number
}
type Props = {
  months12: MonthData[]
  topChauffeurs: { nom: string; count: number; ca: number }[]
  topClients:    { nom: string; count: number; ca: number }[]
  vehiculeList:  { label: string; count: number; ca: number }[]
  geoData:       { label: string; count: number; ca: number }[]
  heuresData:    { heure: number; count: number }[]
  noteGlobale:   number | null
  nbChauffeursNotes: number
  nbClientsTotal: number
  nouveauxClientsActuel: number
  caEntreprise12: number
  caParticulier12: number
}

type Period = '3' | '6' | '12'

// ── SVG Line/Area Chart ───────────────────────────────────────────────────────
function AreaChart({ data, color, label }: { data: { label: string; value: number }[]; color: string; label: string }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; val: number; lab: string } | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const max  = Math.max(...data.map(d => d.value), 1)
  const W    = 500
  const H    = 100
  const PAD  = { top: 10, right: 16, bottom: 20, left: 40 }
  const iW   = W - PAD.left - PAD.right
  const iH   = H - PAD.top - PAD.bottom
  const step = data.length > 1 ? iW / (data.length - 1) : iW

  const pts = data.map((d, i) => ({
    x: PAD.left + i * step,
    y: PAD.top + iH - (d.value / max) * iH,
    val: d.value,
    lab: d.label,
  }))

  const pathD = pts.length > 0
    ? `M ${pts.map(p => `${p.x},${p.y}`).join(' L ')}`
    : ''
  const areaD = pts.length > 0
    ? `M ${pts[0].x},${PAD.top + iH} L ${pts.map(p => `${p.x},${p.y}`).join(' L ')} L ${pts[pts.length-1].x},${PAD.top+iH} Z`
    : ''

  // Lignes horizontales de repère
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD.top + iH - f * iH,
    val: Math.round(max * f),
  }))

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const mx = ((e.clientX - rect.left) / rect.width) * W
    let closest = pts[0]; let minDist = Infinity
    for (const p of pts) {
      const d = Math.abs(p.x - mx)
      if (d < minDist) { minDist = d; closest = p }
    }
    setTooltip({ x: closest.x, y: closest.y, val: closest.val, lab: closest.lab })
  }

  return (
    <div style={{ position: 'relative' }}>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 120, overflow: 'visible' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setTooltip(null)}
      >
        <defs>
          <linearGradient id={`grad-${label}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25"/>
            <stop offset="100%" stopColor={color} stopOpacity="0.02"/>
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={t.y} x2={W-PAD.right} y2={t.y} stroke="rgba(201,168,76,.06)" strokeWidth={1}/>
            <text x={PAD.left-4} y={t.y+4} textAnchor="end" fontSize="7" fill="rgba(132,132,153,.6)">
              {t.val > 999 ? `${(t.val/1000).toFixed(0)}k` : t.val}
            </text>
          </g>
        ))}

        {/* Area fill */}
        <path d={areaD} fill={`url(#grad-${label})`}/>

        {/* Line */}
        <path d={pathD} fill="none" stroke={color} strokeWidth={1.8} strokeLinejoin="round"/>

        {/* Points + labels X */}
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r={tooltip?.lab === p.lab ? 4 : 2.5} fill={color} opacity={tooltip?.lab === p.lab ? 1 : 0.7}/>
            <text x={p.x} y={H-2} textAnchor="middle" fontSize="7.5" fill="rgba(132,132,153,.7)">{p.lab}</text>
          </g>
        ))}

        {/* Tooltip line */}
        {tooltip && (
          <line x1={tooltip.x} y1={PAD.top} x2={tooltip.x} y2={PAD.top+iH} stroke={color} strokeWidth={1} strokeDasharray="3 2" opacity={0.5}/>
        )}
      </svg>

      {/* Tooltip bubble */}
      {tooltip && (
        <div style={{
          position: 'absolute',
          top: 4, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--floating)', border: `1px solid ${color}40`,
          borderRadius: 8, padding: '6px 12px',
          fontSize: 11, color: 'var(--t1)', fontWeight: 600, whiteSpace: 'nowrap',
          pointerEvents: 'none', zIndex: 10,
          fontFamily: 'var(--font-jetbrains), monospace',
          boxShadow: '0 4px 20px rgba(0,0,0,.3)',
        }}>
          <span style={{ color: 'var(--t3)', fontWeight: 400, fontSize: 9, marginRight: 6 }}>{tooltip.lab}</span>
          {label === 'ca' ? `${tooltip.val.toFixed(0)} €` : tooltip.val}
        </div>
      )}
    </div>
  )
}

// ── Bar Chart horizontal ──────────────────────────────────────────────────────
function HBarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 10, color: 'var(--t2)', width: 60, flexShrink: 0, textAlign: 'right' }}>{d.label}</div>
          <div style={{ flex: 1, height: 20, background: 'var(--elevated)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${(d.value / max) * 100}%`,
              background: `linear-gradient(90deg, ${color}, ${color}88)`,
              borderRadius: 4, transition: 'width .5s',
              display: 'flex', alignItems: 'center', justifyContent: 'flex-end', paddingRight: 6,
            }}>
              {d.value > 0 && (
                <span style={{ fontSize: 9, fontFamily: 'var(--font-jetbrains), monospace', color: '#fff', fontWeight: 700 }}>
                  {d.value}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, color, evo }: {
  label: string; value: string; sub?: string
  color?: string; evo?: { text: string; pos: boolean } | null
}) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{
        fontFamily: 'var(--font-jetbrains), monospace',
        fontSize: 26, fontWeight: 600, lineHeight: 1,
        color: color ?? 'var(--t1)',
      }}>
        {value}
      </div>
      {evo && (
        <div style={{ fontSize: 10, color: evo.pos ? 'var(--grn)' : 'var(--red)', marginTop: 5 }}>
          {evo.text} vs période précédente
        </div>
      )}
      {sub && <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function StatsClient({
  months12, topChauffeurs, topClients, vehiculeList, geoData,
  heuresData, noteGlobale, nbChauffeursNotes, nbClientsTotal,
  nouveauxClientsActuel, caEntreprise12, caParticulier12,
}: Props) {
  const [period, setPeriod] = useState<Period>('6')

  const months = months12.slice(-Number(period))
  const prevMonths = months12.slice(-Number(period)*2, -Number(period))

  // KPIs de la période
  const caTotal     = months.reduce((s, m) => s + m.ca, 0)
  const caPrev      = prevMonths.reduce((s, m) => s + m.ca, 0)
  const countTotal  = months.reduce((s, m) => s + m.count, 0)
  const countPrev   = prevMonths.reduce((s, m) => s + m.count, 0)
  const annulTotal  = months.reduce((s, m) => s + m.annulees, 0)
  const panierMoy   = countTotal > 0 ? caTotal / countTotal : 0
  const txAnn       = (countTotal + annulTotal) > 0 ? (annulTotal / (countTotal + annulTotal)) * 100 : 0

  const evo = (cur: number, prev: number) => {
    if (prev <= 0) return null
    const p = ((cur - prev) / prev) * 100
    return { text: `${p >= 0 ? '+' : ''}${p.toFixed(0)}%`, pos: p >= 0 }
  }

  const caArea   = months.map(m => ({ label: m.label, value: m.ca }))
  const cntArea  = months.map(m => ({ label: m.label, value: m.count }))

  // Heures de pointe — afficher 05h→23h
  const HOURS = Array.from({ length: 19 }, (_, i) => i + 5)
  const heureBarData = HOURS.map(h => ({
    label: `${String(h).padStart(2,'0')}h`,
    value: heuresData.find(d => d.heure === h)?.count ?? 0,
  }))
  const maxHeure = Math.max(...heureBarData.map(d => d.value), 1)

  const btnP = (p: Period): React.CSSProperties => ({
    padding: '5px 14px', borderRadius: 7, fontSize: 11, fontWeight: 500, cursor: 'pointer',
    background: period === p ? 'var(--gold)' : 'var(--elevated)',
    color:      period === p ? 'var(--base)' : 'var(--t2)',
    border:     period === p ? 'none' : '1px solid var(--t3)',
    transition: 'all .12s',
  })

  return (
    <div style={{ padding: '20px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Sélecteur période */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
          {months[0]?.label} → {months[months.length-1]?.label}
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['3','6','12'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)} style={btnP(p)}>
              {p} mois
            </button>
          ))}
        </div>
      </div>

      {/* KPIs ligne 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard label={`CA ${period} mois`} value={`${caTotal.toFixed(0)} €`} color="var(--gold)" evo={evo(caTotal, caPrev)} />
        <KpiCard label="Courses terminées" value={String(countTotal)} evo={evo(countTotal, countPrev)} sub={`${annulTotal} annulée${annulTotal>1?'s':''}`} />
        <KpiCard label="Panier moyen" value={panierMoy > 0 ? `${panierMoy.toFixed(0)} €` : '—'} color="var(--t1)" />
        <KpiCard label="Taux d'annulation" value={`${txAnn.toFixed(0)} %`} color={txAnn > 15 ? 'var(--red)' : 'var(--grn)'} />
      </div>

      {/* Graphiques CA + Volume */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
            Chiffre d&apos;affaires
          </div>
          <AreaChart data={caArea} color="var(--gold)" label="ca" />
        </div>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
            Volume de courses
          </div>
          <AreaChart data={cntArea} color="var(--blu)" label="cnt" />
        </div>
      </div>

      {/* KPIs ligne 2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <KpiCard label="Nouveaux clients (mois)" value={String(nouveauxClientsActuel)} sub={`${nbClientsTotal} clients total`} />
        <KpiCard
          label="Note moyenne chauffeurs"
          value={noteGlobale !== null ? `★ ${noteGlobale.toFixed(1)}` : '—'}
          color={noteGlobale !== null ? 'var(--gold)' : undefined}
          sub={`${nbChauffeursNotes} chauffeur${nbChauffeursNotes>1?'s':''} noté${nbChauffeursNotes>1?'s':''}`}
        />
        <KpiCard
          label="CA entreprises (12m)"
          value={`${caEntreprise12.toFixed(0)} €`}
          color="var(--gold)"
          sub={(caEntreprise12+caParticulier12) > 0 ? `${Math.round(caEntreprise12/(caEntreprise12+caParticulier12)*100)} % du CA` : undefined}
        />
        <KpiCard
          label="CA particuliers (12m)"
          value={`${caParticulier12.toFixed(0)} €`}
          sub={(caEntreprise12+caParticulier12) > 0 ? `${Math.round(caParticulier12/(caEntreprise12+caParticulier12)*100)} % du CA` : undefined}
        />
      </div>

      {/* Heures de pointe + Répartition géo */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Heures de pointe */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
            Heures de pointe
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
            {heureBarData.map((h, i) => {
              const pct = (h.value / maxHeure) * 100
              const isHot = h.value === Math.max(...heureBarData.map(d => d.value))
              return (
                <div key={i} title={`${h.label} : ${h.value} course${h.value>1?'s':''}`}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'default' }}>
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{
                      width: '100%', height: `${Math.max(pct, h.value > 0 ? 5 : 0)}%`,
                      background: isHot ? 'var(--gold)' : 'rgba(201,168,76,.3)',
                      borderRadius: '2px 2px 0 0',
                      transition: 'height .4s',
                    }}/>
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            {[5, 9, 13, 17, 21].map(h => (
              <div key={h} style={{ fontSize: 8, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                {String(h).padStart(2,'0')}h
              </div>
            ))}
          </div>
        </div>

        {/* Répartition géographique */}
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
            Répartition géographique
          </div>
          {geoData.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--t3)', textAlign: 'center', padding: '20px 0' }}>Aucune donnée</div>
          ) : (
            <HBarChart data={geoData.map(g => ({ label: g.label, value: g.count }))} color="var(--gold)" />
          )}
        </div>
      </div>

      {/* Répartition véhicules */}
      {vehiculeList.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '20px 24px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
            Répartition par véhicule
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {vehiculeList.map((v, i) => {
              const maxC = Math.max(...vehiculeList.map(x => x.count), 1)
              return (
                <div key={i}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{v.label}</span>
                    <div style={{ display: 'flex', gap: 16 }}>
                      <span style={{ fontSize: 11, color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                        {v.count} course{v.count > 1 ? 's' : ''}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--gold)', fontFamily: 'var(--font-jetbrains), monospace', minWidth: 60, textAlign: 'right' }}>
                        {v.ca.toFixed(0)} €
                      </span>
                    </div>
                  </div>
                  <div style={{ height: 5, background: 'var(--elevated)', borderRadius: 3 }}>
                    <div style={{
                      height: '100%', width: `${(v.count / maxC) * 100}%`, borderRadius: 3,
                      background: i === 0 ? 'linear-gradient(90deg,var(--gold),rgba(201,168,76,.5))' : `rgba(201,168,76,${0.35-i*0.08})`,
                    }}/>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Top chauffeurs + Top clients */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {[
          { title: 'Top chauffeurs', data: topChauffeurs },
          { title: 'Top clients',    data: topClients    },
        ].map(({ title, data }) => (
          <div key={title} style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,.07)', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
              {title}
            </div>
            {data.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>Aucune donnée</div>
            ) : data.map((d, i) => {
              const pct = data[0].ca > 0 ? (d.ca / data[0].ca * 100) : 0
              return (
                <div key={i} style={{ padding: '12px 20px', borderBottom: i < data.length-1 ? '1px solid rgba(201,168,76,.04)' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                        background: i===0 ? 'linear-gradient(135deg,var(--gold),#8B6A1A)' : 'var(--elevated)',
                        border: i===0 ? 'none' : '1px solid var(--t3)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 700, color: i===0 ? 'var(--base)' : 'var(--t3)',
                      }}>{i+1}</div>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{d.nom}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, fontWeight: 600, color: 'var(--gold)' }}>{d.ca.toFixed(0)} €</div>
                      <div style={{ fontSize: 9, color: 'var(--t3)' }}>{d.count} courses</div>
                    </div>
                  </div>
                  <div style={{ height: 3, background: 'var(--elevated)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: i===0 ? 'var(--gold)' : 'rgba(201,168,76,.35)', borderRadius: 2 }}/>
                  </div>
                </div>
              )
            })}
          </div>
        ))}
      </div>

    </div>
  )
}
