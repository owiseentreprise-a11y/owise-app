'use client'

import { useState, useTransition } from 'react'
import { toggleActifSTAction, supprimerSTAction } from './actions'

export default function DeleteSTButton({
  id, nom, actif,
}: { id: string; nom: string; actif: boolean }) {
  const [step, setStep]  = useState<'idle' | 'confirm-toggle' | 'confirm-delete'>('idle')
  const [err,  setErr]   = useState('')
  const [pending, start] = useTransition()

  if (step === 'confirm-toggle') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--t2)' }}>{actif ? 'Désactiver' : 'Réactiver'} {nom} ?</span>
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const { error } = await toggleActifSTAction(id, !actif)
          if (error) { setErr(error); setStep('idle') }
          else setStep('idle')
        })}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: actif ? 'var(--amb)' : 'var(--grn)', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
      >
        {pending ? '…' : 'Confirmer'}
      </button>
      <button onClick={() => setStep('idle')} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gb)', background: 'transparent', color: 'var(--t2)', fontSize: 10, cursor: 'pointer' }}>
        Annuler
      </button>
    </div>
  )

  if (step === 'confirm-delete') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--red)' }}>⚠️ Supprimer définitivement ?</span>
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const { error } = await supprimerSTAction(id)
          if (error) { setErr(error); setStep('idle') }
          else setStep('idle')
        })}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
      >
        {pending ? '…' : 'Supprimer'}
      </button>
      <button onClick={() => setStep('idle')} style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--gb)', background: 'transparent', color: 'var(--t2)', fontSize: 10, cursor: 'pointer' }}>
        Annuler
      </button>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
      {err && <div style={{ fontSize: 9, color: 'var(--red)', maxWidth: 200, textAlign: 'right' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 5 }}>
        <button
          onClick={() => setStep('confirm-toggle')}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
            background: actif ? 'rgba(232,160,48,.1)' : 'rgba(61,184,122,.1)',
            border: actif ? '1px solid rgba(232,160,48,.25)' : '1px solid rgba(61,184,122,.25)',
            color: actif ? 'var(--amb)' : 'var(--grn)',
          }}
        >
          {actif ? 'Désactiver' : 'Réactiver'}
        </button>
        <button
          onClick={() => setStep('confirm-delete')}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)', color: 'var(--red)',
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  )
}
