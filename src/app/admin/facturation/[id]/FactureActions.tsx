'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changerStatutFacture } from './actions'
import PrintButton from '@/components/PrintButton'

export default function FactureActions({
  factureId,
  statut,
}: {
  factureId: string
  statut: 'en_attente' | 'payee' | 'retard'
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  function run(s: 'payee' | 'retard' | 'en_attente') {
    startTransition(async () => {
      await changerStatutFacture(factureId, s)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PrintButton />
      {statut !== 'payee' && (
        <button
          onClick={() => run('payee')}
          disabled={pending}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 8, border: 'none',
            background: 'var(--grn)', color: 'var(--base)',
            fontSize: 12, fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1,
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          ✓ Marquer payée
        </button>
      )}
      {statut === 'payee' && (
        <button
          onClick={() => run('en_attente')}
          disabled={pending}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 8,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 12, fontWeight: 500,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Remettre en attente
        </button>
      )}
      {statut === 'en_attente' && (
        <button
          onClick={() => run('retard')}
          disabled={pending}
          style={{
            width: '100%', padding: '10px',
            borderRadius: 8,
            background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
            color: 'var(--red)', fontSize: 11,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Marquer en retard
        </button>
      )}
      {statut === 'retard' && (
        <button
          onClick={() => run('en_attente')}
          disabled={pending}
          style={{
            width: '100%', padding: '10px',
            borderRadius: 8,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 11,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Remettre en attente
        </button>
      )}
    </div>
  )
}
