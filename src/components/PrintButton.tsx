'use client'

export default function PrintButton({ label = 'Imprimer / PDF' }: { label?: string }) {
  return (
    <button
      onClick={() => window.print()}
      className="no-print"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '9px 16px', borderRadius: 9,
        background: 'var(--elevated)', border: '1px solid var(--t3)',
        color: 'var(--t2)', fontSize: 12, fontWeight: 500,
        cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif',
      }}
    >
      <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h4m-4 4h4"/>
      </svg>
      {label}
    </button>
  )
}
