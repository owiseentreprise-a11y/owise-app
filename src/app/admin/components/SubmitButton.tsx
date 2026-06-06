'use client'

import { useFormStatus } from 'react-dom'

export default function SubmitButton({
  label = 'Enregistrer',
  pendingLabel = 'Enregistrement…',
  style,
}: {
  label?: string
  pendingLabel?: string
  style?: React.CSSProperties
}) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      style={{
        background: pending ? 'rgba(201,168,76,.5)' : 'var(--gold)',
        color: 'var(--base)',
        border: 'none',
        borderRadius: 9,
        padding: '12px 24px',
        fontSize: 13,
        fontWeight: 600,
        cursor: pending ? 'wait' : 'pointer',
        fontFamily: 'var(--font-dm-sans), sans-serif',
        opacity: pending ? 0.7 : 1,
        transition: 'opacity .15s',
        ...style,
      }}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}
