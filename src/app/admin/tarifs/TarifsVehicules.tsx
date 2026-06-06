'use client'

import { useState, useTransition } from 'react'
import { updateTarifVehicule } from './actions'

type Tarif = {
  id: string
  vehicule: string
  prise_en_charge: number
  prix_km: number
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 500 }}>
        {label}
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="number"
          step="0.01"
          defaultValue={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          style={{
            flex: 1, background: 'var(--elevated)', border: '1px solid var(--gb)',
            borderRadius: 7, padding: '8px 10px', fontSize: 13,
            color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace',
            outline: 'none', width: '100%', boxSizing: 'border-box' as const,
          }}
        />
        <span style={{ fontSize: 11, color: 'var(--t3)', flexShrink: 0 }}>€</span>
      </div>
    </div>
  )
}

function VehiculeCard({ tarif }: { tarif: Tarif }) {
  const [data, setData] = useState({ ...tarif })
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const ICONS: Record<string, string> = {
    'Berline': '🚘',
    'Berline Premium': '🚙',
    'Van 7 places': '🚐',
  }

  function save() {
    setSaved(false); setError(null)
    startTransition(async () => {
      const res = await updateTarifVehicule(tarif.id, {
        prise_en_charge: data.prise_en_charge,
        prix_km:         data.prix_km,
      })
      if (res.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <div style={{
      background: 'var(--elevated)', border: '1px solid var(--gb)',
      borderRadius: 12, padding: '20px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 22 }}>{ICONS[tarif.vehicule] ?? '🚗'}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>{tarif.vehicule}</div>
          <div style={{ fontSize: 10, color: 'var(--t3)' }}>Prix = prise en charge + distance × prix/km</div>
        </div>
      </div>

      {/* Champs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <NumField label="Prise en charge (€)" value={data.prise_en_charge}
          onChange={v => setData(d => ({ ...d, prise_en_charge: v }))} />
        <NumField label="Prix / km (€)" value={data.prix_km}
          onChange={v => setData(d => ({ ...d, prix_km: v }))} />
      </div>

      {/* Simulation */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 8, padding: '10px 14px', fontSize: 10, color: 'var(--t2)',
        fontFamily: 'var(--font-jetbrains), monospace', display: 'flex', gap: 16, flexWrap: 'wrap',
      }}>
        <span>CDG → Paris (~32km) : <strong style={{ color: 'var(--gold)' }}>{(data.prise_en_charge + 32 * data.prix_km).toFixed(0)} €</strong></span>
        <span>Orly → Paris (~22km) : <strong style={{ color: 'var(--gold)' }}>{(data.prise_en_charge + 22 * data.prix_km).toFixed(0)} €</strong></span>
        <span>Creil → CDG (~35km) : <strong style={{ color: 'var(--gold)' }}>{(data.prise_en_charge + 35 * data.prix_km).toFixed(0)} €</strong></span>
        <span>Compiègne → CDG (~80km) : <strong style={{ color: 'var(--gold)' }}>{(data.prise_en_charge + 80 * data.prix_km).toFixed(0)} €</strong></span>
      </div>

      {/* Feedback */}
      {error && <div style={{ fontSize: 11, color: 'var(--red)' }}>Erreur : {error}</div>}
      {saved && <div style={{ fontSize: 11, color: 'var(--grn)' }}>✓ Enregistré</div>}

      {/* Save */}
      <button
        onClick={save}
        disabled={pending}
        style={{
          padding: '9px 18px', borderRadius: 8,
          background: pending ? 'var(--elevated)' : 'var(--gold)',
          color: pending ? 'var(--t2)' : '#fff',
          fontSize: 12, fontWeight: 600, border: 'none',
          cursor: pending ? 'wait' : 'pointer',
          transition: 'background .15s', alignSelf: 'flex-end',
        }}
      >
        {pending ? 'Enregistrement…' : '✓ Enregistrer les modifications'}
      </button>
    </div>
  )
}

export default function TarifsVehicules({ tarifs }: { tarifs: Tarif[] }) {
  const order = ['Berline', 'Berline Premium', 'Van 7 places']
  const sorted = [...tarifs].sort((a, b) => order.indexOf(a.vehicule) - order.indexOf(b.vehicule))

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
      {sorted.map(t => <VehiculeCard key={t.id} tarif={t} />)}
    </div>
  )
}
