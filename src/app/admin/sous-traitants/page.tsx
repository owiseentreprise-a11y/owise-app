import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export default async function SousTraitantsPage() {
  const supabase = createAdminClient()

  const { data: sousTraitants } = await supabase
    .from('sous_traitants')
    .select('*')
    .order('nom', { ascending: true })

  const list = sousTraitants ?? []
  const actifs   = list.filter(s => s.actif).length
  const inactifs = list.filter(s => !s.actif).length

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Sous-traitants</div>
          <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
          <div style={{ fontSize: 11, color: 'var(--t2)', display: 'flex', gap: 12 }}>
            <span>
              <span style={{ color: 'var(--grn)', fontFamily: 'var(--font-jetbrains), monospace' }}>{actifs}</span>
              {' '}actifs
            </span>
            {inactifs > 0 && (
              <span>
                <span style={{ color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>{inactifs}</span>
                {' '}inactifs
              </span>
            )}
          </div>
        </div>
        <a href="/admin/sous-traitants/nouveau" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: 'var(--gold)', color: 'var(--base)',
          padding: '7px 14px', borderRadius: 8,
          fontSize: 11, fontWeight: 600, textDecoration: 'none',
        }}>
          + Nouveau
        </a>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {list.length === 0 ? (
          <div style={{
            padding: '60px', textAlign: 'center',
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, color: 'var(--t3)', fontSize: 13,
          }}>
            Aucun sous-traitant enregistré
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 160px 160px 120px 80px',
              padding: '8px 16px',
              fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--t3)', fontWeight: 500,
            }}>
              <span>Société</span>
              <span>Contact</span>
              <span>Téléphone</span>
              <span>SIRET</span>
              <span style={{ textAlign: 'right' }}>Statut</span>
            </div>

            {list.map(st => (
              <a
                key={st.id}
                href={`/admin/sous-traitants/${st.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 160px 120px 80px',
                  padding: '14px 16px',
                  background: 'var(--surface)',
                  border: '1px solid var(--gb)',
                  borderRadius: 9,
                  alignItems: 'center', gap: 14,
                  textDecoration: 'none',
                }}
              >
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{st.nom}</div>
                  {st.email && (
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>{st.email}</div>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--t2)' }}>{st.contact_nom ?? '—'}</div>
                <div style={{ fontSize: 12, color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                  {st.telephone ?? '—'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                  {st.siret ?? '—'}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{
                    fontSize: 9, padding: '3px 8px', borderRadius: 4, fontWeight: 500,
                    color:       st.actif ? 'var(--grn)' : 'var(--t3)',
                    background:  st.actif ? 'rgba(61,184,122,.1)' : 'var(--elevated)',
                    border:      st.actif ? '1px solid rgba(61,184,122,.2)' : '1px solid var(--t3)',
                  }}>
                    {st.actif ? 'Actif' : 'Inactif'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
