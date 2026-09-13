import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import MarquerPayeeButton from './MarquerPayeeButton'

export const dynamic = 'force-dynamic'

export default async function FacturationSousTraitantsPage() {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('factures_sous_traitants')
    .select('*, sous_traitants(nom, telephone, email, contact_nom)')
    .order('statut', { ascending: true })
    .order('created_at', { ascending: true })

  const factures = data ?? []
  const enAttente = factures.filter(f => f.statut === 'en_attente')
  const payees    = factures.filter(f => f.statut === 'payee')

  const totalDu = enAttente.reduce((s, f) => s + Number(f.montant_ht), 0)
  const now = Date.now()
  const joursAttente = (f: any) => Math.floor((now - new Date(f.created_at).getTime()) / 86400000)
  const plusAncienne = enAttente.reduce((max, f) => Math.max(max, joursAttente(f)), 0)

  const fmt = (n: number) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <Link href="/admin/facturation" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Facturation
        </Link>
        <div style={{ width: 1, height: 16, background: 'var(--t3)' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Sous-traitants à payer</div>
      </div>

      <div style={{ padding: '28px 32px' }}>
        {/* KPI */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3,1fr)',
          gap: 14, marginBottom: 28,
        }}>
          {[
            { label: 'Total à payer', value: `${fmt(totalDu)} €`, color: 'var(--amb)' },
            { label: 'Factures en attente', value: String(enAttente.length), color: 'var(--t1)' },
            { label: 'La plus ancienne', value: enAttente.length > 0 ? `${plusAncienne} j` : '—', color: plusAncienne > 14 ? 'var(--red)' : 'var(--t1)' },
          ].map(kpi => (
            <div key={kpi.label} style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '18px 20px',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 10 }}>
                {kpi.label}
              </div>
              <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 26, fontWeight: 500, color: kpi.color }}>
                {kpi.value}
              </div>
            </div>
          ))}
        </div>

        {/* En attente */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden', marginBottom: 20,
        }}>
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 150px 110px 100px 130px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>Sous-traitant</div>
            <div>Période</div>
            <div>Créée le</div>
            <div style={{ textAlign: 'right' }}>Montant HT</div>
            <div style={{ textAlign: 'right' }}>Action</div>
          </div>

          {enAttente.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Rien en attente — tous les sous-traitants sont à jour.
            </div>
          ) : enAttente.map(f => {
            const st = (f as any).sous_traitants
            const jours = joursAttente(f)
            return (
              <div key={f.id} style={{
                display: 'grid', gridTemplateColumns: '1fr 150px 110px 100px 130px',
                padding: '13px 20px', alignItems: 'center',
                borderBottom: '1px solid rgba(201,168,76,.04)',
              }}>
                <div>
                  <Link href={`/admin/sous-traitants/${f.sous_traitant_id}`} style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', textDecoration: 'none' }}>
                    {st?.nom ?? '—'}
                  </Link>
                  {f.notes && <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{f.notes}</div>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t2)' }}>{f.periode}</div>
                <div style={{ fontSize: 11, color: jours > 14 ? 'var(--red)' : 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                  {jours === 0 ? 'aujourd\'hui' : `il y a ${jours} j`}
                </div>
                <div style={{ textAlign: 'right', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>
                  {fmt(Number(f.montant_ht))} €
                </div>
                <div style={{ textAlign: 'right' }}>
                  <MarquerPayeeButton factureId={f.id} />
                </div>
              </div>
            )
          })}
        </div>

        {/* Historique payées */}
        {payees.length > 0 && (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '13px 20px', fontSize: 11, fontWeight: 500, color: 'var(--t2)',
              borderBottom: '1px solid rgba(201,168,76,.07)',
            }}>
              Historique payées ({payees.length})
            </div>
            {payees.slice(0, 20).map(f => {
              const st = (f as any).sous_traitants
              return (
                <div key={f.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 150px 110px 100px',
                  padding: '11px 20px', alignItems: 'center',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                }}>
                  <div style={{ fontSize: 12, color: 'var(--t2)' }}>{st?.nom ?? '—'}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{f.periode}</div>
                  <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {f.date_paiement ? new Date(f.date_paiement).toLocaleDateString('fr-FR') : '—'}
                  </div>
                  <div style={{ textAlign: 'right', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--t2)' }}>
                    {fmt(Number(f.montant_ht))} €
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
