'use client'

import { useState, useTransition } from 'react'
import { updateParametresTarifs } from './actions'

const inputStyle: React.CSSProperties = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '9px 12px', fontSize: 13, color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box', outline: 'none',
  fontFamily: 'var(--font-jetbrains), monospace',
}

function Field({ label, name, value, isBoolean }: {
  label: string; name: string; value: string | number | boolean; isBoolean?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)' }}>
        {label}
      </label>
      {isBoolean ? (
        <select name={name} defaultValue={String(value)} style={inputStyle}>
          <option value="true">Activé</option>
          <option value="false">Désactivé</option>
        </select>
      ) : (
        <input name={name} type="number" step="0.01" defaultValue={String(value ?? 0)} style={inputStyle} />
      )}
    </div>
  )
}

export default function GlobalParamsForm({ p }: { p: any }) {
  const [pending, startTransition] = useTransition()
  const [saved,   setSaved]        = useState(false)
  const [error,   setError]        = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await updateParametresTarifs(fd)
      if (res.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20 }}>

        <div style={{ gridColumn: '1/-1', fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', paddingTop: 4 }}>
          Frais de prise en charge
        </div>
        <Field label="tarif_pec_actif"      name="tarif_pec_actif"      value={p?.tarif_pec_actif ?? true}  isBoolean />
        <Field label="tarif_frais_pec"      name="tarif_frais_pec"      value={p?.tarif_frais_pec ?? 15} />

        <div style={{ gridColumn: '1/-1', fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', paddingTop: 8, borderTop: '1px solid rgba(201,168,76,.07)' }}>
          Particuliers — tarif au km
        </div>
        <Field label="tarif_base_particulier" name="tarif_base_particulier" value={p?.tarif_base_particulier ?? 15} />
        <Field label="tarif_km_particulier"   name="tarif_km_particulier"   value={p?.tarif_km_particulier ?? 2} />

        <div style={{ gridColumn: '1/-1', fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', paddingTop: 8, borderTop: '1px solid rgba(201,168,76,.07)' }}>
          Suppléments (%)
        </div>
        <Field label="supplement_nuit"    name="supplement_nuit"    value={p?.supplement_nuit ?? 20} />
        <Field label="supplement_weekend" name="supplement_weekend" value={p?.supplement_weekend ?? 15} />
        <Field label="supplement_ferie"   name="supplement_ferie"   value={p?.supplement_ferie ?? 25} />

        <div style={{ gridColumn: '1/-1', fontSize: 10, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', paddingTop: 8, borderTop: '1px solid rgba(201,168,76,.07)' }}>
          Coefficients véhicules (× berline)
        </div>
        <Field label="coef_berline"         name="coef_berline"         value={p?.coef_berline ?? 1} />
        <Field label="coef_berline_premium" name="coef_berline_premium" value={p?.coef_berline_premium ?? 1.25} />
        <Field label="coef_van"             name="coef_van"             value={p?.coef_van ?? 1.5} />
      </div>

      {error && (
        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 8,
          background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.2)',
          color: 'var(--red)', fontSize: 12,
        }}>
          Erreur : {error}
        </div>
      )}

      {saved && (
        <div style={{
          marginTop: 16, padding: '10px 16px', borderRadius: 8,
          background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.2)',
          color: 'var(--green)', fontSize: 12,
        }}>
          ✓ Paramètres enregistrés
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="save-btn"
        style={{
          marginTop: 24, padding: '10px 24px', borderRadius: 8,
          background: pending ? 'var(--elevated)' : 'var(--gold)',
          color: pending ? 'var(--t2)' : 'var(--base)',
          fontSize: 12, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
          transition: 'background .15s',
        }}
      >
        {pending ? 'Enregistrement…' : 'Enregistrer les paramètres'}
      </button>
    </form>
  )
}
