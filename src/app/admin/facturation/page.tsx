import { createClient } from '@/lib/supabase/server'
import type { Facture } from '@/lib/types'

export const revalidate = 0

const statutBadge = (statut: string) => {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    en_attente: { color: 'var(--amb)', bg: 'rgba(232,160,48,.1)', label: 'En attente' },
    payee:      { color: 'var(--grn)', bg: 'rgba(60,196,124,.1)', label: 'Payée' },
    retard:     { color: 'var(--red)', bg: 'rgba(217,80,80,.1)',  label: 'En retard' },
  }
  return map[statut] ?? map.en_attente
}

export default async function FacturationPage() {
  const supabase = await createClient()

  const { data: factures } = await supabase
    .from('factures')
    .select('*, clients(*, profiles(*))')
    .order('date_emission', { ascending: false })

  const list: Facture[] = factures ?? []

  const caTotal   = list.filter(f => f.statut === 'payee').reduce((s, f) => s + f.montant_ttc, 0)
  const caAttente = list.filter(f => f.statut === 'en_attente').reduce((s, f) => s + f.montant_ttc, 0)
  const caRetard  = list.filter(f => f.statut === 'retard').reduce((s, f) => s + f.montant_ttc, 0)

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.9)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
          Facturation{' '}
          <span style={{ color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12 }}>
            ({list.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <a href="/admin/facturation/export" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--elevated)', color: 'var(--t2)',
          border: '1px solid var(--t3)',
          padding: '7px 14px', borderRadius: 8,
          fontSize: 11, fontWeight: 500, textDecoration: 'none',
        }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
          </svg>
          Export CSV
        </a>
        <a href="/admin/facturation/nouvelle" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--gold)', color: 'var(--base)',
          padding: '8px 16px', borderRadius: 8,
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
        }}>
          + Nouvelle facture
        </a>
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>
        {/* KPI */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 14, marginBottom: 28,
        }}>
          {[
            { label: 'Encaissé', value: `${fmt(caTotal)} €`, color: 'var(--grn)' },
            { label: 'En attente', value: `${fmt(caAttente)} €`, color: 'var(--amb)' },
            { label: 'En retard', value: `${fmt(caRetard)} €`, color: 'var(--red)' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--surface)',
              border: '1px solid var(--gb)',
              borderRadius: 12, padding: '18px 20px',
            }}>
              <div style={{
                fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
                color: 'var(--t2)', marginBottom: 10,
              }}>{kpi.label}</div>
              <div style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 26, fontWeight: 500, color: kpi.color,
              }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '120px 1fr 130px 120px 120px 100px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>N° Facture</div>
            <div>Client</div>
            <div>Émission</div>
            <div>Échéance</div>
            <div style={{ textAlign: 'right' }}>Montant TTC</div>
            <div style={{ textAlign: 'right' }}>Statut</div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Aucune facture enregistrée
            </div>
          ) : list.map(facture => {
            const client = (facture as any).clients
            const p = client?.profiles
            const isEntreprise = client?.type_compte === 'entreprise'
            const nomClient = isEntreprise
              ? (client?.entreprise_nom ?? '—')
              : `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim() || '—'
            const emission = new Date(facture.date_emission)
            const echeance = facture.date_echeance ? new Date(facture.date_echeance) : null
            const s = statutBadge(facture.statut)

            const isOverdue = echeance && echeance < new Date() && facture.statut !== 'payee'

            return (
              <a
                key={facture.id}
                href={`/admin/facturation/${facture.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '120px 1fr 130px 120px 120px 100px',
                  padding: '13px 20px',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                  alignItems: 'center',
                  textDecoration: 'none',
                  cursor: 'pointer',
                }}
              >
                <div style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 11, fontWeight: 500, color: 'var(--gold)',
                  letterSpacing: '.06em',
                }}>
                  {facture.numero}
                </div>

                <div style={{ fontSize: 12, color: 'var(--t1)' }}>{nomClient}</div>

                <div style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 11, color: 'var(--t2)',
                }}>
                  {emission.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>

                <div style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 11,
                  color: isOverdue ? 'var(--red)' : 'var(--t2)',
                }}>
                  {echeance
                    ? echeance.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                    : '—'}
                </div>

                <div style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 14, color: 'var(--t1)',
                }}>
                  {facture.montant_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: 9.5, padding: '3px 9px', borderRadius: 4, fontWeight: 500,
                    border: '1px solid',
                    color: s.color, background: s.bg,
                    borderColor: `${s.color}30`,
                  }}>{s.label}</span>
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </>
  )
}
