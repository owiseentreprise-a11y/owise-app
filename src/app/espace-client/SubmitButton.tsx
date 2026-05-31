'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton() {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '10px 20px', borderRadius: 8,
        background: pending ? 'var(--t3)' : 'var(--gold)',
        color: 'var(--base)',
        fontSize: 13, fontWeight: 600, border: 'none',
        cursor: pending ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        opacity: pending ? 0.7 : 1,
        transition: 'opacity 0.15s, background 0.15s',
      }}
    >
      {pending ? (
        <>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
          </svg>
          Envoi...
        </>
      ) : (
        <>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Demander
        </>
      )}
    </button>
  )
}
