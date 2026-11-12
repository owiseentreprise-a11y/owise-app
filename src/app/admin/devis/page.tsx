import { createAdminClient } from '@/lib/supabase/admin'
import DevisTable from './DevisTable'

export const dynamic = 'force-dynamic'

export default async function AdminDevisPage() {
  const supabase = createAdminClient()
  const { data: devis } = await supabase
    .from('devis')
    .select('*')
    .order('created_at', { ascending: false })

  const total = devis?.length ?? 0

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300 }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, color: 'var(--t1)', margin: 0 }}>
            Devis en ligne
          </h1>
          <p style={{ fontSize: 12, color: 'var(--t3)', marginTop: 4 }}>
            Formulaires soumis depuis owise.fr
          </p>
        </div>
        <div style={{
          background: 'linear-gradient(135deg, rgba(201,168,76,.12), rgba(201,168,76,.06))',
          border: '1px solid rgba(201,168,76,.25)',
          borderRadius: 10, padding: '10px 20px', textAlign: 'center',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#C9A84C' }}>{total}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase' }}>Devis reçus</div>
        </div>
      </div>

      {!devis || devis.length === 0 ? (
        <div style={{ background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 12, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 14, color: 'var(--t3)' }}>Aucun devis reçu pour le moment.</div>
        </div>
      ) : (
        <DevisTable devis={devis} />
      )}
    </div>
  )
}
