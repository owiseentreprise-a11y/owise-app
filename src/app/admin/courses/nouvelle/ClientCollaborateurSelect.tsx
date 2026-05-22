'use client'

import { useState } from 'react'

type ClientOption = {
  id: string
  type_compte: string
  entreprise_nom: string | null
  profiles: { prenom: string; nom: string } | null
}
type CollabOption = {
  id: string
  client_id: string
  poste: string | null
  profiles: { prenom: string; nom: string } | null
}

const inputBase: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--elevated)',
  border: '1px solid var(--t3)',
  borderRadius: 8, color: 'var(--t1)',
  fontSize: 13, outline: 'none',
  fontFamily: 'var(--font-dm-sans), sans-serif',
  boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputBase,
  appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%23848499' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 14px center',
  paddingRight: 36,
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
  color: 'var(--t2)', fontWeight: 500, marginBottom: 7,
}

export default function ClientCollaborateurSelect({
  clients,
  collabs,
}: {
  clients: ClientOption[]
  collabs: CollabOption[]
}) {
  const [clientId, setClientId] = useState('')

  const selectedClient = clients.find(c => c.id === clientId)
  const isEntreprise = selectedClient?.type_compte === 'entreprise'
  const filteredCollabs = collabs.filter(c => c.client_id === clientId)

  return (
    <>
      <div>
        <label style={labelStyle}>Client</label>
        <select
          name="client_id"
          value={clientId}
          onChange={e => setClientId(e.target.value)}
          style={selectStyle}
        >
          <option value="">— Non assigné —</option>
          {clients.map(c => {
            const nom = c.type_compte === 'entreprise'
              ? (c.entreprise_nom ?? '—')
              : `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
            return <option key={c.id} value={c.id}>{nom}</option>
          })}
        </select>
      </div>

      {isEntreprise && filteredCollabs.length > 0 && (
        <div>
          <label style={labelStyle}>Collaborateur voyageur (optionnel)</label>
          <select name="collaborateur_id" style={selectStyle}>
            <option value="">— Aucun collaborateur —</option>
            {filteredCollabs.map(c => {
              const nom = c.profiles ? `${c.profiles.prenom} ${c.profiles.nom}` : '—'
              const poste = c.poste ? ` — ${c.poste}` : ''
              return <option key={c.id} value={c.id}>{nom}{poste}</option>
            })}
          </select>
        </div>
      )}
    </>
  )
}
