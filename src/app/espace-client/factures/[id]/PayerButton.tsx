'use client'

import { useTransition } from 'react'
import { payerFactureAction } from './actions'

export default function PayerButton({ factureId }: { factureId: string }) {
  const [pending, startTransition] = useTransition()

  return (
    <form
      action={() => startTransition(async () => { await payerFactureAction(factureId) })}
      style={{ display: 'inline' }}
    >
      <button
        type="submit"
        disabled={pending}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '10px 20px', borderRadius: 10,
          background: pending ? 'var(--gold-muted)' : 'var(--gold)',
          color: pending ? 'var(--gold)' : '#09091A',
          border: '1px solid transparent',
          fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-dm), sans-serif',
          cursor: pending ? 'not-allowed' : 'pointer',
          transition: 'opacity 0.15s, transform 0.15s',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              style={{ animation: 'spin 0.8s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            Redirection…
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"/>
              <line x1="1" y1="10" x2="23" y2="10"/>
            </svg>
            Payer en ligne
          </>
        )}
      </button>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </form>
  )
}
