'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changerStatutFacture, envoyerLienPaiement } from './actions'
import PrintButton from '@/components/PrintButton'

export default function FactureActions({
  factureId,
  statut,
  stripePaymentLink,
}: {
  factureId: string
  statut: 'en_attente' | 'payee' | 'retard'
  stripePaymentLink: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sendMsg, setSendMsg] = useState<string | null>(null)

  function run(s: 'payee' | 'retard' | 'en_attente') {
    startTransition(async () => {
      await changerStatutFacture(factureId, s)
      router.refresh()
    })
  }

  function envoyerLien() {
    startTransition(async () => {
      const result = await envoyerLienPaiement(factureId)
      setSendMsg(result.error ?? 'Email envoyé !')
      setTimeout(() => setSendMsg(null), 4000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <PrintButton />

      {stripePaymentLink && statut !== 'payee' && (
        <button
          onClick={envoyerLien}
          disabled={pending}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 8,
            background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.25)',
            color: 'var(--gold)', fontSize: 12, fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1,
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Envoyer lien de paiement
        </button>
      )}

      {stripePaymentLink && (
        <a
          href={stripePaymentLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: '100%', padding: '8px',
            borderRadius: 8, textAlign: 'center',
            border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 11,
            textDecoration: 'none',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxSizing: 'border-box',
          }}
        >
          Voir lien Stripe ↗
        </a>
      )}

      {sendMsg && (
        <p style={{
          margin: 0, fontSize: 11, textAlign: 'center',
          color: sendMsg === 'Email envoyé !' ? 'var(--grn)' : 'var(--red)',
        }}>
          {sendMsg}
        </p>
      )}

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
