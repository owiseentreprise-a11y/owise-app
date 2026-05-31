'use client'

import { useState, useRef, useCallback, useEffect, useTransition } from 'react'
import { demanderCourse } from './actions'

// ── Autocomplete adresse ───────────────────────────────────────────────────────
type Suggestion = { label: string; postcode: string; city: string }

function AddressInput({ name, placeholder, value, onChange }: {
  name: string
  placeholder: string
  value: string
  onChange: (val: string) => void
}) {
  const [query, setQuery]         = useState(value)
  const [suggestions, setSugg]    = useState<Suggestion[]>([])
  const [open, setOpen]           = useState(false)
  const [focused, setFocused]     = useState(-1)
  const wrapRef = useRef<HTMLDivElement>(null)
  const timer   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSugg([]); setOpen(false); return }
    try {
      const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`)
      const json = await res.json()
      const items: Suggestion[] = (json.features ?? []).map((f: any) => ({
        label: f.properties.label,
        postcode: f.properties.postcode ?? '',
        city: f.properties.city ?? '',
      }))
      setSugg(items)
      setOpen(items.length > 0)
    } catch { setSugg([]) }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    onChange(q)
    setFocused(-1)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(q), 280)
  }

  function pick(s: Suggestion) {
    setQuery(s.label)
    onChange(s.label)
    setSugg([])
    setOpen(false)
    setFocused(-1)
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); pick(suggestions[focused]) }
    if (e.key === 'Escape') { setOpen(false); setFocused(-1) }
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        name={name}
        value={query}
        onChange={handleChange}
        onKeyDown={handleKey}
        onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        required
        style={{
          width: '100%', boxSizing: 'border-box',
          background: 'var(--elevated)', border: '1px solid var(--gb)',
          borderRadius: open && suggestions.length > 0 ? '8px 8px 0 0' : 8,
          padding: '10px 14px', fontSize: 13, color: 'var(--t1)',
          outline: 'none', fontFamily: 'inherit',
        }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#fff', border: '1px solid rgba(0,0,0,.12)',
          borderTop: 'none', borderRadius: '0 0 8px 8px',
          boxShadow: '0 4px 16px rgba(0,0,0,.12)', overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => pick(s)} style={{
              display: 'block', width: '100%', textAlign: 'left',
              padding: '9px 14px', background: i === focused ? '#F8F6F1' : '#fff',
              border: 'none', cursor: 'pointer', fontSize: 13, color: '#0A0A0A',
              borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,.06)' : 'none',
            }}
              onMouseEnter={() => setFocused(i)}
              onMouseLeave={() => setFocused(-1)}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Formulaire principal ───────────────────────────────────────────────────────
const VEHICULES = [
  { value: 'berline',         label: 'Berline',         places: '1–4' },
  { value: 'berline_premium', label: 'Berline Premium', places: '1–4' },
  { value: 'van',             label: 'Van',             places: '1–7' },
]

export default function DemanderCourseClient({
  success, error, isEntreprise = false, peutPayerAbord = false
}: {
  success?: boolean; error?: boolean; isEntreprise?: boolean; peutPayerAbord?: boolean
}) {
  const [depart,   setDepart]   = useState('')
  const [arrivee,  setArrivee]  = useState('')
  const [vehicule, setVehicule] = useState('berline')
  const [passagers, setPass]    = useState(1)
  const [date, setDate]         = useState('')
  const [pending, startTransition] = useTransition()

  // Particulier sans autorisation → redirige vers /reserver pour payer
  const doitPayer = !isEntreprise && !peutPayerAbord

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (doitPayer) {
      // Rediriger vers le formulaire de paiement avec les adresses pré-remplies
      const params = new URLSearchParams()
      if (depart)  params.set('depart', depart)
      if (arrivee) params.set('arrivee', arrivee)
      if (date) {
        const d = new Date(date)
        params.set('date', d.toISOString().split('T')[0])
        params.set('time', d.toTimeString().slice(0, 5))
      }
      params.set('pax', String(passagers))
      window.location.href = `/reserver?${params.toString()}`
      return
    }
    const form = e.currentTarget
    const data = new FormData(form)
    data.set('depart', depart)
    data.set('arrivee', arrivee)
    startTransition(() => demanderCourse(data))
  }

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--gb)',
      borderRadius: 16, padding: 28,
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 18 }}>
        Réserver un transfert
      </div>

      {success && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.2)', fontSize: 12, color: '#2E9E5E' }}>
          ✓ Demande envoyée — notre équipe vous contactera pour confirmer.
        </div>
      )}
      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 8, background: 'rgba(217,84,84,.1)', border: '1px solid rgba(217,84,84,.2)', fontSize: 12, color: '#C03030' }}>
          Veuillez renseigner le départ, l'arrivée et la date.
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Adresses */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Adresse de départ</label>
            <AddressInput name="depart" placeholder="15 rue de la Paix, Paris" value={depart} onChange={setDepart} />
          </div>
          <div>
            <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Adresse d'arrivée</label>
            <AddressInput name="arrivee" placeholder="Aéroport CDG, Terminal 2E" value={arrivee} onChange={setArrivee} />
          </div>
        </div>

        {/* Date + note */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Date et heure</label>
            <input name="date" type="datetime-local" required value={date}
              onChange={e => setDate(e.target.value)}
              style={{
                background: 'var(--elevated)', border: '1px solid var(--gb)',
                borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--t1)',
                width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
                colorScheme: 'light',
              }} />
          </div>
          <div>
            <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Commentaire (optionnel)</label>
            <input name="note" placeholder="Vol AF123, bagages..." style={{
              background: 'var(--elevated)', border: '1px solid var(--gb)',
              borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--t1)',
              width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
            }} />
          </div>
        </div>

        {/* Véhicule + passagers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end' }}>
          <div>
            <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', display: 'block', marginBottom: 6 }}>Véhicule</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {VEHICULES.map(v => (
                <button key={v.value} type="button" onClick={() => setVehicule(v.value)}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${vehicule === v.value ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                    background: vehicule === v.value ? 'rgba(201,168,76,.08)' : 'var(--elevated)',
                    fontSize: 11, fontWeight: vehicule === v.value ? 600 : 400,
                    color: vehicule === v.value ? '#C9A84C' : 'var(--t2)',
                    fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3,
                  }}>
                  <div>{v.label}</div>
                  <div style={{ fontSize: 9, opacity: .7 }}>{v.places} pass.</div>
                </button>
              ))}
            </div>
            <input type="hidden" name="vehicule" value={vehicule} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)' }}>Passagers</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" onClick={() => setPass(p => Math.max(1, p - 1))}
                style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--elevated)', border: '1px solid var(--gb)', color: '#C9A84C', fontSize: 18, cursor: 'pointer' }}>−</button>
              <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, color: 'var(--t1)', minWidth: 20, textAlign: 'center' }}>{passagers}</span>
              <button type="button" onClick={() => setPass(p => Math.min(vehicule === 'van' ? 7 : 4, p + 1))}
                style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--elevated)', border: '1px solid var(--gb)', color: '#C9A84C', fontSize: 18, cursor: 'pointer' }}>+</button>
              <input type="hidden" name="passagers" value={passagers} />
            </div>
          </div>
        </div>

        {doitPayer && (
          <div style={{ fontSize: 11, color: 'var(--t2)', background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)', borderRadius: 8, padding: '8px 12px' }}>
            💳 Particulier — le paiement en ligne sera demandé à l'étape suivante.
          </div>
        )}

        <button type="submit" disabled={pending} style={{
          background: pending ? 'rgba(201,168,76,.5)' : '#C9A84C',
          color: '#0A0A0A', border: 'none', borderRadius: 8,
          padding: '11px 20px', fontSize: 13, fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
          alignSelf: 'flex-end',
        }}>
          {pending ? 'Envoi…' : doitPayer ? '→ Réserver et payer' : '+ Demander'}
        </button>
      </form>
    </div>
  )
}
