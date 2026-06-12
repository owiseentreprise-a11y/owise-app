import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type Estimation = {
  id: string
  adresse_depart: string
  adresse_arrivee: string
  vehicule: string | null
  prix: number | null
  source: string
  created_at: string
}

const VH_LABEL: Record<string, string> = {
  berline: 'Berline',
  berline_premium: 'Berline Premium',
  van: 'Van 7 pl.',
  grand_van: 'Grand Van',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit', timeZone: 'Europe/Paris' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

function shortAddr(addr: string) {
  return addr.split(',')[0]?.trim().slice(0, 40) ?? addr.slice(0, 40)
}

export default async function EstimationsPage() {
  const supabase = createAdminClient()

  const { data: rows, error } = await supabase
    .from('estimations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)

  if (error?.code === '42P01') {
    // Table n'existe pas encore
    return (
      <div style={{ padding: 40, maxWidth: 700 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0A0A0A', marginBottom: 16 }}>
          Estimations anonymes
        </h1>
        <div style={{
          background: 'rgba(201,168,76,.06)', border: '1.5px solid rgba(201,168,76,.25)',
          borderRadius: 12, padding: '24px 28px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#C9A84C' }}>Table non créée</div>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 16, lineHeight: 1.6 }}>
            Exécutez la migration SQL dans le Dashboard Supabase pour activer le suivi des estimations.
          </p>
          <a
            href="https://supabase.com/dashboard/project/fbawdscnczdpjsbvyhfe/sql/new"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', padding: '9px 18px', borderRadius: 8,
              background: 'linear-gradient(135deg, #C9A84C, #DDB95A)',
              color: '#fff', fontSize: 12, fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Ouvrir SQL Editor →
          </a>
          <p style={{ fontSize: 11, color: '#999', marginTop: 16 }}>
            Fichier : <code>owise-app/supabase/migrations/20260612000000_estimations.sql</code>
          </p>
        </div>
      </div>
    )
  }

  const estimations: Estimation[] = rows ?? []

  // ── Stats ───────────────────────────────────────────────
  const total      = estimations.length
  const nbVitrine  = estimations.filter(e => e.source === 'vitrine').length
  const nbResa     = estimations.filter(e => e.source === 'reservation').length
  const avgPrix    = total > 0
    ? estimations.reduce((s, e) => s + (e.prix ?? 0), 0) / total
    : 0

  // Top routes (départ → arrivée)
  const routeMap: Record<string, number> = {}
  for (const e of estimations) {
    const key = `${shortAddr(e.adresse_depart)} → ${shortAddr(e.adresse_arrivee)}`
    routeMap[key] = (routeMap[key] ?? 0) + 1
  }
  const topRoutes = Object.entries(routeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  // Top zones départ
  const depMap: Record<string, number> = {}
  for (const e of estimations) {
    const key = shortAddr(e.adresse_depart)
    depMap[key] = (depMap[key] ?? 0) + 1
  }
  const topDep = Object.entries(depMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  // Répartition véhicule
  const vhMap: Record<string, number> = {}
  for (const e of estimations) {
    const k = e.vehicule ?? 'inconnu'
    vhMap[k] = (vhMap[k] ?? 0) + 1
  }

  // ── Render ──────────────────────────────────────────────
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
          color: '#0A0A0A', letterSpacing: '.02em', lineHeight: 1.2, marginBottom: 6,
        }}>
          Estimations anonymes
        </h1>
        <p style={{ fontSize: 12, color: '#888' }}>
          Recherches de prix sans saisie d&apos;informations personnelles — widget vitrine & page réservation
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Total estimations', value: total, suffix: '' },
          { label: 'Depuis la vitrine',  value: nbVitrine, suffix: ` (${total ? Math.round(nbVitrine / total * 100) : 0}%)` },
          { label: 'Page réservation',  value: nbResa,    suffix: ` (${total ? Math.round(nbResa / total * 100) : 0}%)` },
          { label: 'Prix moyen estimé', value: Math.round(avgPrix), suffix: ' €' },
        ].map(kpi => (
          <div key={kpi.label} style={card}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{
              fontFamily: 'monospace', fontSize: 28, fontWeight: 600, color: '#C9A84C', lineHeight: 1,
            }}>
              {kpi.value}<span style={{ fontSize: 14, color: '#999' }}>{kpi.suffix}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Top routes + Véhicules */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, marginBottom: 28 }}>

        {/* Top routes */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Trajets les plus demandés
          </div>
          {topRoutes.length === 0 ? (
            <div style={{ fontSize: 12, color: '#bbb' }}>Aucune donnée</div>
          ) : topRoutes.map(([route, count], i) => {
            const pct = topRoutes[0][1] > 0 ? (count / topRoutes[0][1]) * 100 : 0
            return (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#333', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{route}</span>
                  <span style={{ fontFamily: 'monospace', color: '#C9A84C', fontWeight: 600, flexShrink: 0 }}>{count}×</span>
                </div>
                <div style={{ height: 3, background: '#F0EDE8', borderRadius: 2 }}>
                  <div style={{ height: 3, width: `${pct}%`, background: 'linear-gradient(90deg, #C9A84C, #DDB95A)', borderRadius: 2 }} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Répartition véhicule */}
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Par véhicule
          </div>
          {Object.entries(vhMap).length === 0 ? (
            <div style={{ fontSize: 12, color: '#bbb' }}>Aucune donnée</div>
          ) : Object.entries(vhMap)
              .sort((a, b) => b[1] - a[1])
              .map(([vh, count]) => (
            <div key={vh} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 12, color: '#444' }}>{VH_LABEL[vh] ?? vh}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#C9A84C', fontWeight: 600 }}>
                {count} <span style={{ color: '#bbb', fontWeight: 400 }}>({total ? Math.round(count / total * 100) : 0}%)</span>
              </span>
            </div>
          ))}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(0,0,0,.06)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 10, letterSpacing: '.08em', textTransform: 'uppercase' }}>
              Zones départ fréquentes
            </div>
            {topDep.map(([zone, count]) => (
              <div key={zone} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 6 }}>
                <span style={{ color: '#555', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 8 }}>{zone}</span>
                <span style={{ fontFamily: 'monospace', color: '#666', flexShrink: 0 }}>{count}×</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Table des estimations récentes */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 22px', borderBottom: '1px solid rgba(0,0,0,.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>
            Dernières estimations
          </span>
          <span style={{ fontSize: 11, color: '#bbb' }}>{total} enregistrement{total !== 1 ? 's' : ''}</span>
        </div>

        {/* Thead */}
        <div style={{
          display: 'grid', gridTemplateColumns: '130px 1fr 1fr 100px 80px 80px',
          padding: '7px 22px', fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase',
          color: '#ccc', fontWeight: 600, borderBottom: '1px solid rgba(0,0,0,.05)',
        }}>
          <div>Date</div>
          <div>Départ</div>
          <div>Arrivée</div>
          <div>Véhicule</div>
          <div>Prix</div>
          <div>Source</div>
        </div>

        {estimations.length === 0 ? (
          <div style={{ padding: '32px 22px', color: '#ccc', fontSize: 12, textAlign: 'center' }}>
            Aucune estimation enregistrée
          </div>
        ) : estimations.slice(0, 100).map((e, i) => (
          <div key={e.id} style={{
            display: 'grid', gridTemplateColumns: '130px 1fr 1fr 100px 80px 80px',
            padding: '10px 22px', alignItems: 'center',
            borderBottom: i < 99 ? '1px solid rgba(0,0,0,.04)' : 'none',
            fontSize: 11,
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#999' }}>{formatDate(e.created_at)}</div>
            <div style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
              {shortAddr(e.adresse_depart)}
            </div>
            <div style={{ color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', paddingRight: 12 }}>
              {shortAddr(e.adresse_arrivee)}
            </div>
            <div style={{ color: '#666' }}>{e.vehicule ? (VH_LABEL[e.vehicule] ?? e.vehicule) : '—'}</div>
            <div style={{ fontFamily: 'monospace', fontWeight: 600, color: e.prix ? '#C9A84C' : '#ccc' }}>
              {e.prix ? `${e.prix} €` : '—'}
            </div>
            <div>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
                padding: '2px 7px', borderRadius: 4,
                background: e.source === 'reservation' ? 'rgba(77,142,212,.12)' : 'rgba(201,168,76,.10)',
                color: e.source === 'reservation' ? '#4D8ED4' : '#C9A84C',
              }}>
                {e.source === 'reservation' ? 'Résa' : 'Vitrine'}
              </span>
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
