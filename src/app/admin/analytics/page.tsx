import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const PH_HOST    = 'https://eu.posthog.com'
const PH_PROJECT = '200343'

let phError: string | null = null

async function phQuery(query: string): Promise<unknown[][]> {
  const key = process.env.POSTHOG_PERSONAL_KEY
  if (!key) {
    phError = 'POSTHOG_PERSONAL_KEY manquante dans les variables Vercel'
    return []
  }
  try {
    const res = await fetch(`${PH_HOST}/api/projects/${PH_PROJECT}/query`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
      cache:   'no-store',
    })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      phError = `PostHog API ${res.status}: ${body.slice(0, 200)}`
      return []
    }
    const j = await res.json() as { results?: unknown[][] }
    return j.results ?? []
  } catch (e) {
    phError = `Erreur réseau PostHog: ${String(e)}`
    return []
  }
}

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0)
}
function str(v: unknown): string {
  return v == null || v === '' ? '—' : String(v)
}

export default async function AnalyticsPage() {
  // ── PostHog queries (parallèles) ───────────────────────────
  const [
    kpiRows,
    dailyRows,
    pagesRows,
    countriesRows,
    referrersRows,
    devicesRows,
    estCount,
  ] = await Promise.all([
    // KPIs globaux 30j
    phQuery(`
      SELECT
        count()                                       AS pageviews,
        count(distinct person_id)                     AS visitors,
        count(distinct properties.\`$session_id\`)    AS sessions
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - interval 30 day
    `),
    // Visiteurs par jour (14j)
    phQuery(`
      SELECT
        toDate(timestamp)              AS day,
        count(distinct person_id)      AS visitors,
        count()                        AS pageviews
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - interval 14 day
      GROUP BY day
      ORDER BY day ASC
    `),
    // Top 8 pages
    phQuery(`
      SELECT
        properties.\`$pathname\`  AS page,
        count()                   AS views,
        count(distinct person_id) AS visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - interval 30 day
      GROUP BY page
      ORDER BY views DESC
      LIMIT 8
    `),
    // Top pays
    phQuery(`
      SELECT
        properties.\`$geoip_country_name\` AS country,
        count(distinct person_id)          AS visitors,
        count()                            AS pageviews
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - interval 30 day
        AND country != ''
      GROUP BY country
      ORDER BY visitors DESC
      LIMIT 8
    `),
    // Référents
    phQuery(`
      SELECT
        properties.\`$referring_domain\` AS referrer,
        count(distinct person_id)        AS visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - interval 30 day
        AND referrer != ''
        AND referrer NOT LIKE '%owise%'
      GROUP BY referrer
      ORDER BY visitors DESC
      LIMIT 8
    `),
    // Appareils
    phQuery(`
      SELECT
        properties.\`$device_type\` AS device,
        count(distinct person_id)   AS visitors
      FROM events
      WHERE event = '$pageview'
        AND timestamp >= now() - interval 30 day
      GROUP BY device
      ORDER BY visitors DESC
    `),
    // Estimations depuis Supabase
    (async () => {
      try {
        const r = await createAdminClient()
          .from('estimations')
          .select('id', { count: 'exact', head: true })
        return r.count ?? 0
      } catch { return 0 }
    })(),
  ])

  const noData = kpiRows.length === 0

  const pageviews = num(kpiRows[0]?.[0])
  const visitors  = num(kpiRows[0]?.[1])
  const sessions  = num(kpiRows[0]?.[2])
  const pagesPerV = sessions > 0 ? (pageviews / sessions).toFixed(1) : '—'

  const maxVisitors = dailyRows.length > 0 ? Math.max(...dailyRows.map((r: unknown[]) => num(r[1])), 1) : 1

  const card = {
    background: '#FFFFFF',
    border: '1.5px solid rgba(0,0,0,.07)',
    borderRadius: 12,
    padding: '18px 22px',
  } as const

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500,
          color: '#0A0A0A', letterSpacing: '.02em', marginBottom: 6,
        }}>
          Analytics
        </h1>
        <p style={{ fontSize: 12, color: '#888' }}>
          Trafic owise.fr · 30 derniers jours · données PostHog
          {noData && phError && (
            <span style={{ color: '#D95454', marginLeft: 8 }}>
              — {phError}
            </span>
          )}
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Visiteurs uniques',  value: noData ? '—' : visitors.toLocaleString('fr-FR') },
          { label: 'Sessions',           value: noData ? '—' : sessions.toLocaleString('fr-FR') },
          { label: 'Pages vues',         value: noData ? '—' : pageviews.toLocaleString('fr-FR') },
          { label: 'Pages / session',    value: noData ? '—' : pagesPerV },
        ].map(kpi => (
          <div key={kpi.label} style={card}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 30, fontWeight: 600, color: '#C9A84C', lineHeight: 1 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Sparkline visiteurs 14j */}
      {dailyRows.length > 0 && (
        <div style={{ ...card, marginBottom: 28 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 18, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Visiteurs uniques · 14 derniers jours
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 80 }}>
            {dailyRows.map((row: unknown[], i: number) => {
              const day = str(row[0]).slice(5)
              const v   = num(row[1])
              const pct = maxVisitors > 0 ? (v / maxVisitors) * 100 : 0
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 9, color: '#C9A84C', fontFamily: 'monospace', fontWeight: 600, visibility: v > 0 ? 'visible' : 'hidden' }}>{v}</div>
                  <div style={{
                    width: '100%', borderRadius: '3px 3px 0 0',
                    height: `${Math.max(pct, 4)}%`,
                    background: pct > 60
                      ? 'linear-gradient(180deg, #DDB95A, #C9A84C)'
                      : 'rgba(201,168,76,.35)',
                    transition: 'height .3s',
                  }} />
                  <div style={{ fontSize: 9, color: '#bbb', fontFamily: 'monospace' }}>{day}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pages + Pays */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 20 }}>

        {/* Top pages */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Pages les plus visitées
          </div>
          {pagesRows.length === 0
            ? <div style={{ fontSize: 12, color: '#ccc' }}>Aucune donnée</div>
            : pagesRows.map((row: unknown[], i: number) => {
              const views = num(row[1])
              const pct   = pagesRows[0] ? (views / num(pagesRows[0][1])) * 100 : 0
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>
                      {str(row[0]) || '/'}
                    </span>
                    <span style={{ fontFamily: 'monospace', color: '#C9A84C', fontWeight: 600, flexShrink: 0 }}>{views}</span>
                  </div>
                  <div style={{ height: 3, background: '#F0EDE8', borderRadius: 2 }}>
                    <div style={{ height: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #C9A84C, #DDB95A)', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })
          }
        </div>

        {/* Pays */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Pays
          </div>
          {countriesRows.length === 0
            ? <div style={{ fontSize: 12, color: '#ccc' }}>Aucune donnée</div>
            : countriesRows.map((row: unknown[], i: number) => {
              const v   = num(row[1])
              const pct = countriesRows[0] ? (v / num(countriesRows[0][1])) * 100 : 0
              return (
                <div key={i} style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#333' }}>{str(row[0])}</span>
                    <span style={{ fontFamily: 'monospace', color: '#666', fontWeight: 600 }}>{v}</span>
                  </div>
                  <div style={{ height: 3, background: '#F0EDE8', borderRadius: 2 }}>
                    <div style={{ height: 3, width: `${pct}%`, background: 'rgba(201,168,76,.4)', borderRadius: 2 }} />
                  </div>
                </div>
              )
            })
          }
        </div>
      </div>

      {/* Référents + Appareils + Estimations */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 20 }}>

        {/* Référents */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Sources de trafic
          </div>
          {referrersRows.length === 0
            ? <div style={{ fontSize: 12, color: '#ccc' }}>Aucune donnée</div>
            : referrersRows.map((row: unknown[], i: number) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 11 }}>
                <span style={{ color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75%' }}>{str(row[0])}</span>
                <span style={{ fontFamily: 'monospace', color: '#C9A84C', fontWeight: 600, flexShrink: 0 }}>{num(row[1])}</span>
              </div>
            ))
          }
        </div>

        {/* Appareils */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Appareils
          </div>
          {devicesRows.length === 0
            ? <div style={{ fontSize: 12, color: '#ccc' }}>Aucune donnée</div>
            : devicesRows.map((row: unknown[], i: number) => {
              const v   = num(row[1])
              const tot = devicesRows.reduce((s: number, r: unknown[]) => s + num(r[1]), 0)
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)', fontSize: 12 }}>
                  <span style={{ color: '#444' }}>{str(row[0]) || 'Inconnu'}</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11, color: '#888' }}>
                    {v} <span style={{ color: '#ccc' }}>({tot ? Math.round(v/tot*100) : 0}%)</span>
                  </span>
                </div>
              )
            })
          }
        </div>

        {/* Estimations flash */}
        <div style={{ ...card, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 8, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Estimations prix
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 600, color: '#C9A84C', lineHeight: 1, marginBottom: 8 }}>
            {(estCount as number).toLocaleString('fr-FR')}
          </div>
          <div style={{ fontSize: 11, color: '#999', marginBottom: 16 }}>recherches de prix sans réservation</div>
          <Link href="/admin/estimations" style={{
            display: 'inline-block', fontSize: 11, color: '#C9A84C',
            textDecoration: 'none', fontWeight: 500,
            padding: '6px 12px', borderRadius: 7,
            border: '1px solid rgba(201,168,76,.3)',
            transition: 'background .12s',
          }}>
            Voir le détail →
          </Link>
        </div>
      </div>

    </div>
  )
}
