'use client'

import { useState, useTransition } from 'react'
import { triggerBackupAction } from './actions'

export function TriggerButton() {
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  function handleClick() {
    setMsg(null)
    startTransition(async () => {
      const res = await triggerBackupAction()
      if (res.ok) {
        setMsg({ ok: true, text: `Backup créé : ${res.filename}` })
      } else {
        setMsg({ ok: false, text: res.error ?? 'Erreur inconnue' })
      }
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <button
        onClick={handleClick}
        disabled={pending}
        style={{
          padding: '9px 20px',
          borderRadius: 8,
          border: '1px solid rgba(201,168,76,.35)',
          background: pending ? 'rgba(201,168,76,.08)' : 'rgba(201,168,76,.12)',
          color: '#C9A84C',
          fontSize: 12,
          fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          transition: 'background .12s',
          letterSpacing: '.04em',
        }}
      >
        {pending ? '⏳ En cours…' : '+ Créer un backup maintenant'}
      </button>
      {msg && (
        <span style={{ fontSize: 11, color: msg.ok ? '#3DB87A' : '#D95454' }}>
          {msg.text}
        </span>
      )}
    </div>
  )
}
