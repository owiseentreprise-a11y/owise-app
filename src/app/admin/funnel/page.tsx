import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

type FunnelEvent = {
  id: string
  session_id: string
  step: string
  page: string | null
  meta: Record<string, unknown> | null
  created_at: string
}

const STEP_LABEL: Record<string, string> = {
  hero_widget_price_shown:      'Widget hero — prix affiché',
  hero_widget_confirm_click:    'Widget hero — clic "Confirmer"',
  devis_step2_enter:            'Devis — étape 2 (passagers)',
  devis_step3_enter:            'Devis — étape 3 (estimation)',
  devis_cta_payer_click:        'Devis — clic "Payer maintenant"',
  devis_cta_rappel_click:       'Devis — clic "Être rappelé"',
  devis_rappel_validation_error:'Devis — erreur validation rappel',
  devis_rappel_submitted:       'Devis — demande de rappel envoyée',
  devis_rappel_submit_error:    'Devis — erreur envoi rappel',
  reserver_page_view:           '/reserver — page vue',
  reserver_step2_view:          '/reserver — étape 2 (paiement)',
  reserver_step1_error:         '/reserver — erreur étape 1',
  reserver_payer_click:         '/reserver — clic "Payer"',
  reserver_checkout_created:    '/reserver — session Stripe créée',
  reserver_step2_error:         '/reserver — erreur étape 2',
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' })
    + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 100)}%`
}

function FunnelBar({ steps, counts }: { steps: string[]; counts: Record<string, number> }) {
  const max = Math.max(1, ...steps.map(s => counts[s] ?? 0))
  return (
    <div>
      {steps.map((step, i) => {
        const count = counts[step] ?? 0
        const prev  = i > 0 ? (counts[steps[i - 1]] ?? 0) : null
        const width = (count / max) * 100
        return (
          <div key={step} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
              <span style={{ fontSize: 12, color: '#333' }}>{STEP_LABEL[step] ?? step}</span>
              <span style={{ fontSize: 12 }}>
                <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C9A84C' }}>{count}</span>
                {prev !== null && (
                  <span style={{ fontFamily: 'monospace', fontSize: 10, color: '#999', marginLeft: 8 }}>
                    ({pct(count, prev)} de l&apos;étape précédente)
                  </span>
                )}
              </span>
            </div>
            <div style={{ height: 10, background: '#F0EDE8', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${Math.max(width, count > 0 ? 2 : 0)}%`,
                background: 'linear-gradient(90deg, #C9A84C, #DDB95A)', borderRadius: 5,
              }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default async function FunnelPage() {
  const supabase = createAdminClient()

  const since30 = new Date(Date.now() - 30 * 86400000).toISOString()

  const { data: rows, error } = await supabase
    .from('funnel_events')
    .select('*')
    .gte('created_at', since30)
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error?.code === '42P01') {
    return (
      <div style={{ padding: 40, maxWidth: 700 }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 22, color: '#0A0A0A', marginBottom: 16 }}>
          Tunnel de conversion
        </h1>
        <div style={{
          background: 'rgba(201,168,76,.06)', border: '1.5px solid rgba(201,168,76,.25)',
          borderRadius: 12, padding: '24px 28px',
        }}>
          <div style={{ fontWeight: 600, marginBottom: 8, color: '#C9A84C' }}>Table non créée</div>
          <p style={{ fontSize: 13, color: '#555', lineHeight: 1.6 }}>
            Exécutez la migration <code>20260912020000_funnel_events.sql</code> dans le SQL Editor Supabase.
          </p>
        </div>
      </div>
    )
  }

  const events: FunnelEvent[] = rows ?? []
  const total = events.length

  const counts: Record<string, number> = {}
  for (const e of events) counts[e.step] = (counts[e.step] ?? 0) + 1

  const heroSteps    = ['hero_widget_price_shown', 'hero_widget_confirm_click']
  const devisSteps   = ['devis_step2_enter', 'devis_step3_enter', 'devis_cta_payer_click']
  const reserverSteps = ['reserver_page_view', 'reserver_step2_view', 'reserver_payer_click', 'reserver_checkout_created']

  // Sessions distinctes ayant atteint le paiement Stripe (vrai signal de conversion)
  const checkoutSessions = new Set(events.filter(e => e.step === 'reserver_checkout_created').map(e => e.session_id))
  const sessionsTotal = new Set(events.map(e => e.session_id)).size

  // Raisons d'erreur (le plus utile pour localiser un blocage précis)
  const step1Errors: Record<string, number> = {}
  const step2Errors: Record<string, number> = {}
  for (const e of events) {
    if (e.step === 'reserver_step1_error') {
      const reason = String(e.meta?.reason ?? 'inconnue')
      step1Errors[reason] = (step1Errors[reason] ?? 0) + 1
    }
    if (e.step === 'reserver_step2_error') {
      const reason = String(e.meta?.reason ?? 'inconnue')
      step2Errors[reason] = (step2Errors[reason] ?? 0) + 1
    }
  }

  // Répartition par jour (14 derniers jours)
  const byDay: Record<string, number> = {}
  for (const e of events) {
    const day = e.created_at.slice(0, 10)
    byDay[day] = (byDay[day] ?? 0) + 1
  }
  const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
  const maxDay = Math.max(1, ...days.map(([, n]) => n))

  const card = {
    background: '#FFFFFF',
    border: '1.5px solid rgba(0,0,0,.07)',
    borderRadius: 12,
    padding: '18px 22px',
  } as const

  return (
    <div style={{ padding: '32px 36px', maxWidth: 1100 }}>

      <div style={{ marginBottom: 28 }}>
        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500,
          color: '#0A0A0A', letterSpacing: '.02em', lineHeight: 1.2, marginBottom: 6,
        }}>
          Tunnel de conversion
        </h1>
        <p style={{ fontSize: 12, color: '#888' }}>
          Chaque étape du parcours devis → réservation → paiement, sur les 30 derniers jours — pour voir où les visiteurs décrochent sans avoir à deviner.
        </p>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'Événements (30j)', value: total },
          { label: 'Sessions distinctes', value: sessionsTotal },
          { label: 'Paiements initiés (Stripe)', value: checkoutSessions.size },
          { label: 'Taux session → paiement', value: pct(checkoutSessions.size, sessionsTotal) },
        ].map(kpi => (
          <div key={kpi.label} style={card}>
            <div style={{ fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase', color: '#999', marginBottom: 8 }}>
              {kpi.label}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 600, color: '#C9A84C', lineHeight: 1 }}>
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* 3 tunnels côte à côte */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 16, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Widget hero (accueil)
          </div>
          <FunnelBar steps={heroSteps} counts={counts} />
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 16, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Widget devis
          </div>
          <FunnelBar steps={devisSteps} counts={counts} />
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(0,0,0,.05)', fontSize: 11, color: '#999' }}>
            + {counts['devis_cta_rappel_click'] ?? 0} clic(s) &quot;Être rappelé&quot; → {counts['devis_rappel_submitted'] ?? 0} envoyé(s)
          </div>
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 16, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Page /reserver
          </div>
          <FunnelBar steps={reserverSteps} counts={counts} />
        </div>
      </div>

      {/* Erreurs — le plus actionnable */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Erreurs étape 1 (trajet/adresses)
          </div>
          {Object.keys(step1Errors).length === 0 ? (
            <div style={{ fontSize: 12, color: '#bbb' }}>Aucune erreur enregistrée</div>
          ) : Object.entries(step1Errors).sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
            <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 12, color: '#D95454' }}>{reason}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#D95454' }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={card}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 14, letterSpacing: '.08em', textTransform: 'uppercase' }}>
            Erreurs étape 2 (paiement)
          </div>
          {Object.keys(step2Errors).length === 0 ? (
            <div style={{ fontSize: 12, color: '#bbb' }}>Aucune erreur enregistrée</div>
          ) : Object.entries(step2Errors).sort((a, b) => b[1] - a[1]).map(([reason, n]) => (
            <div key={reason} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(0,0,0,.04)' }}>
              <span style={{ fontSize: 12, color: '#D95454' }}>{reason}</span>
              <span style={{ fontFamily: 'monospace', fontSize: 12, fontWeight: 600, color: '#D95454' }}>{n}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activité par jour */}
      <div style={{ ...card, marginBottom: 28 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 16, letterSpacing: '.08em', textTransform: 'uppercase' }}>
          Activité par jour (14 derniers jours)
        </div>
        {days.length === 0 ? (
          <div style={{ fontSize: 12, color: '#bbb' }}>Aucune donnée</div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 100 }}>
            {days.map(([day, n]) => (
              <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#999' }}>{n}</span>
                <div style={{
                  width: '100%', height: Math.max(4, (n / maxDay) * 70),
                  background: 'linear-gradient(180deg, #DDB95A, #C9A84C)', borderRadius: '3px 3px 0 0',
                }} />
                <span style={{ fontSize: 9, color: '#bbb' }}>{day.slice(5).replace('-', '/')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Table événements récents */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 22px', borderBottom: '1px solid rgba(0,0,0,.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#333' }}>Derniers événements</span>
          <span style={{ fontSize: 11, color: '#bbb' }}>{total} sur 30 jours</span>
        </div>
        <div style={{
          display: 'grid', gridTemplateColumns: '100px 1fr 120px 1fr', padding: '7px 22px',
          fontSize: 9, letterSpacing: '.15em', textTransform: 'uppercase', color: '#ccc', fontWeight: 600,
          borderBottom: '1px solid rgba(0,0,0,.05)',
        }}>
          <div>Date</div>
          <div>Étape</div>
          <div>Page</div>
          <div>Détail</div>
        </div>
        {events.length === 0 ? (
          <div style={{ padding: '32px 22px', color: '#ccc', fontSize: 12, textAlign: 'center' }}>Aucun événement</div>
        ) : events.slice(0, 100).map((e, i) => (
          <div key={e.id} style={{
            display: 'grid', gridTemplateColumns: '100px 1fr 120px 1fr', padding: '9px 22px',
            alignItems: 'center', borderBottom: i < 99 ? '1px solid rgba(0,0,0,.04)' : 'none', fontSize: 11,
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#999' }}>{formatDate(e.created_at)}</div>
            <div style={{ color: '#333' }}>{STEP_LABEL[e.step] ?? e.step}</div>
            <div style={{ color: '#999', fontSize: 10 }}>{e.page ?? '—'}</div>
            <div style={{ color: '#999', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {e.meta ? JSON.stringify(e.meta) : ''}
            </div>
          </div>
        ))}
      </div>

    </div>
  )
}
