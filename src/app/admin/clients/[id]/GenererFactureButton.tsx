'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { genererFactureGroupee } from './actions'

export default function GenererFactureButton({
  clientId,
  nbCoursesNonFacturees,
  montantNonFacture,
}: {
  clientId: string
  nbCoursesNonFacturees: number
  montantNonFacture: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<{ type: 'error' | 'ok'; text: string } | null>(null)

  if (nbCoursesNonFacturees === 0) return null

  function handleClick() {
    setMsg(null)
    startTransition(async () => {
      const res = await genererFactureGroupee(clientId)
      if (res.error) {
        setMsg({ type: 'error', text: res.error })
      } else {
        router.push(`/admin/facturation/${res.factureId}`)
      }
    })
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 20px' }}>
      <div style={{
        fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase',
        color: 'var(--t2)', fontWeight: 500, marginBottom: 12,
      }}>
        Facturation groupée
      </div>

      <div style={{
        background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.14)',
        borderRadius: 8, padding: '10px 13px', marginBottom: 12,
      }}>
        <div style={{ fontSize: 11, color: 'var(--t2)', marginBottom: 3 }}>
          {nbCoursesNonFacturees} course{nbCoursesNonFacturees > 1 ? 's' : ''} non facturée{nbCoursesNonFacturees > 1 ? 's' : ''}
        </div>
        <div style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 18, fontWeight: 500, color: 'var(--gold)',
        }}>
          {montantNonFacture.toFixed(0)} €
        </div>
      </div>

      <button
        onClick={handleClick}
        disabled={pending}
        style={{
          width: '100%', padding: '9px 0', borderRadius: 8,
          background: pending ? 'var(--elevated)' : 'var(--gold)',
          color: pending ? 'var(--t2)' : 'var(--base)',
          border: 'none', cursor: pending ? 'default' : 'pointer',
          fontSize: 12, fontWeight: 600,
          transition: 'background .15s, opacity .15s',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending ? 'Génération…' : 'Générer la facture'}
      </button>

      {msg && (
        <div style={{
          marginTop: 8, fontSize: 11, padding: '7px 10px', borderRadius: 6,
          color: msg.type === 'error' ? 'var(--red)' : 'var(--green)',
          background: msg.type === 'error' ? 'rgba(217,84,84,.08)' : 'rgba(61,184,122,.08)',
          border: `1px solid ${msg.type === 'error' ? 'rgba(217,84,84,.2)' : 'rgba(61,184,122,.2)'}`,
        }}>
          {msg.text}
        </div>
      )}
    </div>
  )
}
