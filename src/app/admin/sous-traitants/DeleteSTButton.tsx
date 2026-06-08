'use client'

import { useState, useTransition } from 'react'
import { toggleActifSTAction, supprimerSTAction, verifierSTAction } from './actions'

type WarnData = { chauffeursCount: number; chauffeursNoms: string[]; coursesActiveCount: number }

export default function DeleteSTButton({
  id, nom, actif,
}: { id: string; nom: string; actif: boolean }) {
  const [step, setStep]     = useState<'idle' | 'confirm-toggle' | 'warn' | 'confirm-delete'>('idle')
  const [warnData, setWarn] = useState<WarnData | null>(null)
  const [err,  setErr]      = useState('')
  const [pending, start]    = useTransition()

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

  if (step === 'warn' && warnData) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 280 }}>
      {/* Chauffeurs attachés */}
      {warnData.chauffeursCount > 0 && (
        <div style={{
          padding: '8px 10px', borderRadius: 7,
          background: 'rgba(232,160,48,.1)', border: '1px solid rgba(232,160,48,.25)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--amb)', marginBottom: 3 }}>
            ⚠ {warnData.chauffeursCount} chauffeur{warnData.chauffeursCount > 1 ? 's' : ''} rattaché{warnData.chauffeursCount > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t2)', lineHeight: 1.5 }}>
            {warnData.chauffeursNoms.join(', ')}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 3 }}>
            Leurs comptes seront conservés mais dissociés de ce ST.
          </div>
        </div>
      )}
      {/* Courses actives */}
      {warnData.coursesActiveCount > 0 && (
        <div style={{
          padding: '8px 10px', borderRadius: 7,
          background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)',
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--red)', marginBottom: 2 }}>
            ✕ {warnData.coursesActiveCount} course{warnData.coursesActiveCount > 1 ? 's' : ''} active{warnData.coursesActiveCount > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)' }}>Remises en attente sans sous-traitant.</div>
        </div>
      )}
      {warnData.chauffeursCount === 0 && warnData.coursesActiveCount === 0 && (
        <div style={{ fontSize: 10, color: 'var(--t2)' }}>Aucun chauffeur ni course active — suppression sans impact.</div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          disabled={pending}
          onClick={() => start(async () => {
            const { error } = await supprimerSTAction(id)
            if (error) { setErr(error); setStep('idle') }
            else setStep('idle')
          })}
          style={{ flex: 1, padding: '5px 10px', borderRadius: 6, border: 'none', background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 600, cursor: pending ? 'wait' : 'pointer' }}
        >
          {pending ? '…' : 'Supprimer quand même'}
        </button>
        <button onClick={() => { setStep('idle'); setWarn(null) }} style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid var(--gb)', background: 'transparent', color: 'var(--t2)', fontSize: 10, cursor: 'pointer' }}>
          Annuler
        </button>
      </div>
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
          disabled={pending}
          onClick={() => start(async () => {
            const data = await verifierSTAction(id)
            setWarn(data)
            setStep('warn')
          })}
          style={{
            padding: '4px 10px', borderRadius: 6, fontSize: 10, fontWeight: 500, cursor: pending ? 'wait' : 'pointer',
            background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)', color: 'var(--red)',
          }}
        >
          {pending ? '…' : 'Supprimer'}
        </button>
      </div>
    </div>
  )
}
