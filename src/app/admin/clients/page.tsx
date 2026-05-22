import { createClient } from '@/lib/supabase/server'
import type { Client } from '@/lib/types'

export const revalidate = 0

export default async function ClientsPage() {
  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*, profiles(*)')
    .order('created_at', { ascending: false })

  const list: Client[] = clients ?? []
  const entreprises = list.filter(c => c.type_compte === 'entreprise').length
  const particuliers = list.filter(c => c.type_compte === 'particulier').length

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
          Clients{' '}
          <span style={{ color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12 }}>
            ({list.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 16, fontSize: 11 }}>
            <span style={{ color: 'var(--t2)' }}>
              <span style={{ color: 'var(--gold)' }}>{entreprises}</span> entreprise{entreprises > 1 ? 's' : ''}
            </span>
            <span style={{ color: 'var(--t2)' }}>
              <span style={{ color: 'var(--t1)' }}>{particuliers}</span> particulier{particuliers > 1 ? 's' : ''}
            </span>
          </div>
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 1fr 130px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>Client</div>
            <div>Type</div>
            <div>Adresse facturation</div>
            <div style={{ textAlign: 'right' }}>Membre depuis</div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Aucun client enregistré
            </div>
          ) : list.map(client => {
            const p = (client as any).profiles
            const isEntreprise = client.type_compte === 'entreprise'
            const nomAffiche = isEntreprise
              ? (client.entreprise_nom ?? '—')
              : `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim() || '—'
            const initials = isEntreprise
              ? (client.entreprise_nom?.[0] ?? 'E').toUpperCase()
              : `${p?.prenom?.[0] ?? ''}${p?.nom?.[0] ?? ''}`.toUpperCase()
            const dateInscrit = new Date(client.created_at)

            return (
              <div
                key={client.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 1fr 130px',
                  padding: '13px 20px',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: isEntreprise ? 6 : '50%', flexShrink: 0,
                    background: isEntreprise
                      ? 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))'
                      : 'var(--elevated)',
                    border: isEntreprise ? '1px solid rgba(201,168,76,.2)' : '1px solid var(--t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: isEntreprise ? 'var(--font-cormorant), serif' : 'var(--font-dm-sans), sans-serif',
                    fontSize: isEntreprise ? 13 : 11, fontWeight: 600,
                    color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
                  }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{nomAffiche}</div>
                    <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{p?.telephone ?? '—'}</div>
                  </div>
                </div>

                <div>
                  <span style={{
                    fontSize: 9.5, padding: '3px 9px', borderRadius: 20,
                    fontWeight: 500,
                    color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
                    background: isEntreprise ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
                    border: `1px solid ${isEntreprise ? 'rgba(201,168,76,.2)' : 'var(--t3)'}`,
                  }}>
                    {isEntreprise ? 'Entreprise' : 'Particulier'}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                  {client.adresse_facturation ?? '—'}
                </div>

                <div style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 11, color: 'var(--t3)',
                }}>
                  {dateInscrit.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
