import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function fmtDateCourse(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

const VEHICULE_LABEL: Record<string, string> = {
  'Berline': 'Berline',
  'Berline Premium': 'Premium',
  'Van 7 places': 'Van 7',
  'Grand Van': 'Grand Van',
}

export default async function AdminDevisPage() {
  const supabase = createAdminClient()
  const { data: devis } = await supabase
    .from('devis')
    .select('*')
    .order('created_at', { ascending: false })

  const total = devis?.length ?? 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, color: '#0A0A0A', margin: 0 }}>
            Devis en ligne
          </h1>
          <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            Formulaires soumis depuis owise.fr
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,168,76,.12), rgba(201,168,76,.06))',
          border: '1px solid rgba(201,168,76,.25)',
          borderRadius: 10, padding: '10px 20px',
          textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#C9A84C' }}>{total}</div>
          <div style={{ fontSize: 10, color: '#999', letterSpacing: '.08em', textTransform: 'uppercase' }}>Devis reçus</div>
        </div>
      </div>

      {/* Table */}
      {!devis || devis.length === 0 ? (
        <div style={{
          background: '#FAFAF8', border: '1px solid rgba(0,0,0,.07)',
          borderRadius: 12, padding: '60px 32px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: '#999' }}>Aucun devis reçu pour le moment.</div>
        </div>
      ) : (
        <div style={{
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,.07)',
          borderRadius: 12, overflow: 'hidden',
          boxShadow: '0 1px 8px rgba(0,0,0,.04)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F6F1', borderBottom: '1px solid rgba(0,0,0,.07)' }}>
                {['Date', 'Client', 'Téléphone', 'Email', 'Trajet', 'Véhicule', 'Prix estimé', 'Pax', 'Date course'].map(h => (
                  <th key={h} style={{
                    padding: '11px 14px', textAlign: 'left',
                    fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
                    color: '#999', fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {devis.map((d: any, i: number) => (
                <tr key={d.id} style={{
                  borderBottom: i < devis.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
                  transition: 'background .1s',
                }}>
                  {/* Date */}
                  <td style={{ padding: '13px 14px', fontSize: 11, color: '#999', whiteSpace: 'nowrap' }}>
                    {fmtDate(d.created_at)}
                  </td>
                  {/* Client */}
                  <td style={{ padding: '13px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0A0A' }}>{d.nom || '—'}</div>
                    {d.societe && <div style={{ fontSize: 10, color: '#C9A84C', marginTop: 2 }}>{d.societe}</div>}
                  </td>
                  {/* Téléphone */}
                  <td style={{ padding: '13px 14px' }}>
                    {d.tel ? (
                      <a href={`tel:${d.tel}`} style={{
                        fontSize: 12, color: '#0A0A0A', textDecoration: 'none', fontFamily: 'monospace',
                        display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="#3DB87A" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        {d.tel}
                      </a>
                    ) : '—'}
                  </td>
                  {/* Email */}
                  <td style={{ padding: '13px 14px' }}>
                    {d.email ? (
                      <a href={`mailto:${d.email}`} style={{
                        fontSize: 11, color: '#4D8ED4', textDecoration: 'none',
                        maxWidth: 160, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {d.email}
                      </a>
                    ) : '—'}
                  </td>
                  {/* Trajet */}
                  <td style={{ padding: '13px 14px', maxWidth: 200 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#3DB87A', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                          {d.origin || '—'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }} />
                        <span style={{ fontSize: 11, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 170 }}>
                          {d.destination || '—'}
                        </span>
                      </div>
                    </div>
                  </td>
                  {/* Véhicule */}
                  <td style={{ padding: '13px 14px' }}>
                    <span style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 6, fontWeight: 500,
                      background: 'rgba(201,168,76,.1)', color: '#C9A84C',
                      border: '1px solid rgba(201,168,76,.2)',
                    }}>
                      {VEHICULE_LABEL[d.vehicle] ?? d.vehicle ?? '—'}
                    </span>
                  </td>
                  {/* Prix */}
                  <td style={{ padding: '13px 14px' }}>
                    {d.price ? (
                      <span style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: '#0A0A0A' }}>
                        {d.price} €
                      </span>
                    ) : '—'}
                  </td>
                  {/* Pax */}
                  <td style={{ padding: '13px 14px', fontSize: 12, color: '#666', textAlign: 'center' }}>
                    {d.pax ?? '—'}
                  </td>
                  {/* Date course */}
                  <td style={{ padding: '13px 14px', fontSize: 11, color: '#666', whiteSpace: 'nowrap' }}>
                    {fmtDateCourse(d.date_course)}
                    {d.heure && <span style={{ color: '#999', marginLeft: 4 }}>{d.heure}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
