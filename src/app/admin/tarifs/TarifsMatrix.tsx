'use client'

import { useState, useTransition } from 'react'
import { updatePrixGrille } from './actions'

type Zone = { id: string; nom: string; code: string; type: string }
type Grille = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }

function PrixCell({
  depart, arrivee, prix, coefPremium, coefVan,
}: {
  depart: string; arrivee: string; prix: number; coefPremium: number; coefVan: number
}) {
  const [val, setVal] = useState(String(prix))
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [, startTransition] = useTransition()

  const save = () => {
    const n = parseFloat(val)
    if (isNaN(n) || n < 0) { setVal(String(prix)); setEditing(false); return }
    setSaving(true)
    startTransition(async () => {
      await updatePrixGrille(depart, arrivee, n)
      setSaving(false)
      setEditing(false)
    })
  }

  if (depart === arrivee) {
    return (
      <td style={{ padding: '10px 14px', textAlign: 'center', color: 'var(--t3)', fontSize: 11 }}>
        —
      </td>
    )
  }

  const berline = parseFloat(val) || 0

  return (
    <td style={{ padding: '8px 12px', verticalAlign: 'middle' }}>
      {editing ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            autoFocus
            type="number"
            value={val}
            onChange={e => setVal(e.target.value)}
            onBlur={save}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') { setVal(String(prix)); setEditing(false) } }}
            style={{
              width: 70, padding: '4px 8px',
              background: 'var(--elevated)', border: '1px solid var(--gold)',
              borderRadius: 6, color: 'var(--t1)', fontSize: 13,
              fontFamily: 'var(--font-jetbrains), monospace',
              outline: 'none',
            }}
          />
          <span style={{ fontSize: 11, color: 'var(--t3)' }}>€</span>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '4px 8px', borderRadius: 6,
            transition: 'background .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(201,168,76,.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 13, fontWeight: 600, color: saving ? 'var(--t3)' : 'var(--gold)' }}>
            {berline.toFixed(0)} €
          </div>
          <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: 2 }}>
            P: {(berline * coefPremium).toFixed(0)}€ · V: {(berline * coefVan).toFixed(0)}€
          </div>
        </button>
      )}
    </td>
  )
}

export default function TarifsMatrix({
  zones, grille, coefPremium, coefVan,
}: {
  zones: Zone[]; grille: Grille[]; coefPremium: number; coefVan: number
}) {
  const activeZones = zones.filter(z => z.code !== 'HORS')

  const getCell = (dep: string, arr: string) =>
    grille.find(g => g.zone_depart_id === dep && g.zone_arrivee_id === arr)

  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 10, letterSpacing: '.08em' }}>
        CLIQUEZ SUR UN PRIX POUR LE MODIFIER — B: berline · P: premium · V: van
      </div>
      <table style={{ borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{
              padding: '8px 14px', fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--t3)', fontWeight: 500, textAlign: 'left',
              borderBottom: '1px solid rgba(201,168,76,.1)',
            }}>
              DÉPART → ARRIVÉE
            </th>
            {activeZones.map(z => (
              <th key={z.id} style={{
                padding: '8px 12px', fontSize: 10, color: 'var(--t2)', fontWeight: 500,
                textAlign: 'center', borderBottom: '1px solid rgba(201,168,76,.1)',
                whiteSpace: 'nowrap',
              }}>
                <div>{z.nom}</div>
                <div style={{ fontSize: 8, color: 'var(--t3)', letterSpacing: '.08em' }}>{z.code}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {activeZones.map((dep, i) => (
            <tr key={dep.id} style={{ borderBottom: '1px solid rgba(201,168,76,.04)' }}>
              <td style={{
                padding: '10px 14px', fontSize: 11, fontWeight: 500, color: 'var(--t1)',
                whiteSpace: 'nowrap',
              }}>
                <div>{dep.nom}</div>
                <div style={{ fontSize: 9, color: 'var(--t3)' }}>{dep.code}</div>
              </td>
              {activeZones.map(arr => {
                const cell = getCell(dep.id, arr.id)
                return (
                  <PrixCell
                    key={arr.id}
                    depart={dep.id}
                    arrivee={arr.id}
                    prix={cell?.prix_berline ?? 0}
                    coefPremium={coefPremium}
                    coefVan={coefVan}
                  />
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
