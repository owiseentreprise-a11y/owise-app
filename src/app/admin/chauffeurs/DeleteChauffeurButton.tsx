'use client'

import { useState, useTransition } from 'react'
import { desactiverChauffeurAction, reactiverChauffeurAction, supprimerChauffeurAction } from './actions'

export default function DeleteChauffeurButton({
  id, nom, actif,
}: { id: string; nom: string; actif: boolean }) {
  const [step, setStep]   = useState<'idle' | 'confirm-deactivate' | 'confirm-delete'>('idle')
  const [err,  setErr]    = useState('')
  const [pending, start]  = useTransition()

  if (step === 'confirm-deactivate') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, color: 'var(--t2)' }}>Désactiver {nom} ?</span>
      <button
        disabled={pending}
        onClick={() => start(async () => {
          const { error } = await desactiverChauffeurAction(id)
          if (error) { setErr(error); setStep('idle') }
          else setStep('idle')
        })}
        style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--amb)', color: '#fff', fontSize: 10, fontWeight: 600, cursor: 'pointer' }}
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
          const { error } = await supprimerChauffeurAction(id)
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
        {actif ? (
          <button
            onClick={() => setStep('confirm-deactivate')}
            title="Désactiver"
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
              background: 'rgba(232,160,48,.1)', border: '1px solid rgba(232,160,48,.25)', color: 'var(--amb)',
              transition: 'background .15s',
            }}
          >
            Désactiver
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() => start(async () => {
              const { error } = await reactiverChauffeurAction(id)
              if (error) setErr(error)
            })}
            title="Réactiver"
            style={{
              padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: pending ? 'wait' : 'pointer',
              background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.25)', color: 'var(--grn)',
              transition: 'background .15s',
            }}
          >
            {pending ? '…' : 'Réactiver'}
          </button>
        )}
        <button
          onClick={() => setStep('confirm-delete')}
          title="Supprimer définitivement"
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: 'pointer',
            background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)', color: 'var(--red)',
            transition: 'background .15s',
          }}
        >
          Supprimer
        </button>
      </div>
    </div>
  )
}
