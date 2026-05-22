'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addCollaborateur, deleteCollaborateur } from './actions'

interface Collab {
  id: string
  poste: string | null
  profiles: { nom: string; prenom: string; telephone: string | null } | null
}

const inputStyle: React.CSSProperties = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '8px 12px',
  fontSize: 12, color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box', outline: 'none',
  fontFamily: 'var(--font-dm-sans), sans-serif',
}

const labelStyle: React.CSSProperties = {
  fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'var(--t3)', fontWeight: 500, marginBottom: 4, display: 'block',
}

export default function CollaborateursSection({
  clientId,
  collaborateurs: init,
}: {
  clientId: string
  collaborateurs: Collab[]
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ email: '', password: '', prenom: '', nom: '', telephone: '', poste: '' })
  const [error, setError] = useState<string | null>(null)

  function submit() {
    if (!form.email || !form.password || !form.nom || !form.prenom) {
      setError('Email, mot de passe, prénom et nom sont obligatoires')
      return
    }
    setError(null)
    startTransition(async () => {
      try {
        await addCollaborateur(clientId, form)
        setForm({ email: '', password: '', prenom: '', nom: '', telephone: '', poste: '' })
        setOpen(false)
        router.refresh()
      } catch (e: any) {
        setError(e.message)
      }
    })
  }

  function remove(collabId: string) {
    if (!confirm('Supprimer ce collaborateur ?')) return
    startTransition(async () => {
      await deleteCollaborateur(clientId, collabId)
      router.refresh()
    })
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--gb)',
      borderRadius: 12, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: init.length > 0 || open ? '1px solid rgba(201,168,76,.07)' : 'none',
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
          Collaborateurs
          <span style={{ marginLeft: 8, fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--t3)', fontSize: 10 }}>
            {init.length}
          </span>
        </div>
        <button
          onClick={() => { setOpen(o => !o); setError(null) }}
          style={{
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px', borderRadius: 6,
            background: open ? 'var(--elevated)' : 'rgba(201,168,76,.1)',
            border: `1px solid ${open ? 'var(--t3)' : 'rgba(201,168,76,.2)'}`,
            color: open ? 'var(--t2)' : 'var(--gold)',
            fontSize: 11, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {open
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            }
          </svg>
          {open ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {/* Formulaire ajout */}
      {open && (
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,.07)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Prénom *</label>
              <input style={inputStyle} value={form.prenom} placeholder="Jean"
                onChange={e => setForm(f => ({ ...f, prenom: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Nom *</label>
              <input style={inputStyle} value={form.nom} placeholder="Martin"
                onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Email *</label>
              <input style={inputStyle} type="email" value={form.email} placeholder="jean.martin@entreprise.fr"
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Mot de passe *</label>
              <input style={inputStyle} value={form.password} placeholder="min. 6 caractères"
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input style={inputStyle} value={form.telephone} placeholder="+33 6 00 00 00 00"
                onChange={e => setForm(f => ({ ...f, telephone: e.target.value }))} />
            </div>
            <div>
              <label style={labelStyle}>Poste / Fonction</label>
              <input style={inputStyle} value={form.poste} placeholder="Directeur commercial"
                onChange={e => setForm(f => ({ ...f, poste: e.target.value }))} />
            </div>
          </div>
          {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>{error}</div>}
          <button
            onClick={submit}
            disabled={pending}
            style={{
              alignSelf: 'flex-start', padding: '8px 16px', borderRadius: 8,
              background: 'var(--gold)', color: 'var(--base)',
              fontSize: 12, fontWeight: 600, border: 'none',
              cursor: pending ? 'wait' : 'pointer', opacity: pending ? .6 : 1,
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            {pending ? 'Création…' : 'Créer le compte'}
          </button>
        </div>
      )}

      {/* Liste */}
      {init.length === 0 && !open ? (
        <div style={{ padding: '20px', textAlign: 'center', fontSize: 11, color: 'var(--t3)' }}>
          Aucun collaborateur — cliquez sur Ajouter
        </div>
      ) : (
        init.map(c => {
          const nom = c.profiles ? `${c.profiles.prenom} ${c.profiles.nom}` : '—'
          return (
            <div key={c.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 20px', borderBottom: '1px solid rgba(201,168,76,.04)',
            }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{nom}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 2 }}>
                  {c.poste && (
                    <span style={{ fontSize: 10, color: 'var(--t3)' }}>{c.poste}</span>
                  )}
                  {c.profiles?.telephone && (
                    <a href={`tel:${c.profiles.telephone}`} style={{ fontSize: 10, color: 'var(--gold)', textDecoration: 'none' }}>
                      {c.profiles.telephone}
                    </a>
                  )}
                </div>
              </div>
              <button
                onClick={() => remove(c.id)}
                disabled={pending}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--t3)', padding: 4, borderRadius: 4,
                }}
                title="Supprimer"
              >
                <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
