'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { creerDevis } from './actions'

export default function NouveauBouton() {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [erreur, setErreur] = useState('')

  return (
    <div>
      <button
        type="button"
        disabled={enCours}
        onClick={() => demarrer(async () => {
          setErreur('')
          try {
            const id = await creerDevis()
            router.push(`/admin/devis-clients/${id}`)
          } catch (e) {
            setErreur(e instanceof Error ? e.message : 'Création impossible.')
          }
        })}
        style={{
          background: 'var(--gold)', color: 'var(--base)', border: 'none', borderRadius: 9,
          padding: '12px 20px', fontSize: 13.5, fontWeight: 600, cursor: enCours ? 'wait' : 'pointer',
          fontFamily: 'inherit', opacity: enCours ? .65 : 1,
          transition: 'opacity .15s, transform .1s',
        }}
      >
        {enCours ? 'Création…' : '+ Nouveau devis'}
      </button>
      {erreur && (
        <div style={{ fontSize: 12, color: 'var(--red-txt)', marginTop: 6, maxWidth: 220 }}>{erreur}</div>
      )}
    </div>
  )
}
