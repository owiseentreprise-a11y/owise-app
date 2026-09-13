'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { marquerFactureSTPayeeDepuisListe } from '../../sous-traitants/actions'

export default function MarquerPayeeButton({ factureId }: { factureId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(async () => {
        await marquerFactureSTPayeeDepuisListe(factureId)
        router.refresh()
      })}
      disabled={pending}
      style={{
        padding: '5px 12px', borderRadius: 6, fontSize: 10.5, fontWeight: 500,
        background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)',
        color: 'var(--grn)', cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? .6 : 1,
        fontFamily: 'var(--font-dm-sans), sans-serif',
      }}
    >
      {pending ? '…' : 'Marquer payée'}
    </button>
  )
}
