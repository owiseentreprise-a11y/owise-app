'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

// ── Lieux connus (aéroports, gares, landmarks) ────────────────────────────────
const LIEUX_CONNUS = [
  // Aéroports
  { label: 'Aéroport Paris-Charles de Gaulle (CDG)', sublabel: 'Terminal 1, 2, 3 · 95700 Roissy-en-France', keywords: ['cdg', 'roissy', 'charles de gaulle', 'charles degaulle', 'aeroport cdg', 'aéroport cdg'] },
  { label: 'Aéroport de Paris-Orly (ORY)', sublabel: 'Terminal 1, 2, 3, 4 · 94390 Orly', keywords: ['orly', 'ory', 'aeroport orly', 'aéroport orly'] },
  { label: 'Aéroport Paris-Beauvais Tillé (BVA)', sublabel: '60550 Tillé (Beauvais)', keywords: ['beauvais', 'bva', 'tillé', 'tille', 'aeroport beauvais'] },
  { label: 'Aéroport Paris-Le Bourget', sublabel: '93350 Le Bourget', keywords: ['le bourget', 'bourget', 'aeroport bourget'] },
  // Gares Paris
  { label: 'Gare du Nord', sublabel: '18 Rue de Dunkerque, 75010 Paris', keywords: ['gare du nord', 'nord', 'eurostar', 'thalys'] },
  { label: 'Gare de Lyon', sublabel: 'Place Louis Armand, 75012 Paris', keywords: ['gare de lyon', 'lyon', 'gare lyon'] },
  { label: 'Gare Montparnasse', sublabel: 'Place Raoul Dautry, 75015 Paris', keywords: ['montparnasse', 'gare montparnasse'] },
  { label: 'Gare Saint-Lazare', sublabel: "Place du Havre, 75009 Paris", keywords: ['saint lazare', 'saint-lazare', 'lazare', 'gare saint'] },
  { label: "Gare de l'Est", sublabel: "Place du 11 Novembre 1918, 75010 Paris", keywords: ["gare de l'est", 'gare est', "l'est"] },
  { label: "Gare d'Austerlitz", sublabel: "55 Quai d'Austerlitz, 75013 Paris", keywords: ['austerlitz', "gare d'austerlitz"] },
  { label: 'Gare de Bercy', sublabel: '48 Boulevard de Bercy, 75012 Paris', keywords: ['bercy', 'gare bercy'] },
  { label: 'Gare Massy-TGV', sublabel: 'Massy, 91300', keywords: ['massy', 'massy tgv'] },
  { label: 'Gare de Versailles-Chantiers', sublabel: 'Versailles, 78000', keywords: ['versailles chantiers', 'versailles tgv'] },
  // Autres
  { label: 'Disneyland Paris', sublabel: 'Allée de la Belle au Bois Dormant, 77700 Chessy', keywords: ['disneyland', 'disney', 'chessy'] },
  { label: 'Stade de France', sublabel: 'ZAC du Cornillon Nord, 93216 Saint-Denis', keywords: ['stade de france', 'stade france'] },
  { label: 'Palais des Congrès de Paris', sublabel: '2 Place de la Porte Maillot, 75017 Paris', keywords: ['palais des congres', 'palais des congrès', 'porte maillot', 'congres'] },
  { label: 'Paris Expo Porte de Versailles', sublabel: '1 Place de la Porte de Versailles, 75015 Paris', keywords: ['porte de versailles', 'expo versailles', 'parc des expositions'] },
  { label: 'Le Bourget Parc des Expositions', sublabel: '93420 Villepinte', keywords: ['villepinte', 'parc villepinte', 'nord villepinte'] },
]

type Suggestion = { label: string; sublabel?: string; isLieu?: boolean }

function searchLieux(q: string): Suggestion[] {
  const lower = q.toLowerCase().trim()
  if (lower.length < 2) return []
  return LIEUX_CONNUS
    .filter(l => (l.keywords ?? []).some(k => k.includes(lower) || lower.includes(k.substring(0, 3))))
    .map(l => ({ label: l.label, sublabel: l.sublabel, isLieu: true }))
    .slice(0, 3)
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  name: string
  placeholder: string
  value?: string
  onChange?: (val: string) => void
  theme?: 'light' | 'dark'
}

export default function AddressInput({ name, placeholder, value = '', onChange, theme = 'light' }: Props) {
  const [query, setQuery]     = useState(value)
  const [suggestions, setSugg] = useState<Suggestion[]>([])
  const [open, setOpen]       = useState(false)
  const [focused, setFocused] = useState(-1)
  const wrapRef  = useRef<HTMLDivElement>(null)
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null)

  const isDark = theme === 'dark'
  const inputBg     = isDark ? 'rgba(255,255,255,.95)' : '#F3F0EB'
  const inputBorder = isDark ? 'rgba(10,10,10,.12)' : 'rgba(0,0,0,.1)'
  const inputColor  = '#09091A'
  const dropBg      = '#fff'
  const dropBorder  = isDark ? 'rgba(201,168,76,.25)' : 'rgba(0,0,0,.12)'

  useEffect(() => { setQuery(value) }, [value])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSugg([]); setOpen(false); return }

    // Lieux connus en premier
    const lieux = searchLieux(q)

    // API adresse pour compléter
    try {
      const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5&autocomplete=1`)
      const json = await res.json()
      const api: Suggestion[] = (json.features ?? []).map((f: any) => ({
        label: f.properties.label,
        sublabel: f.properties.context,
      }))
      const all = [...lieux, ...api].slice(0, 7)
      setSugg(all)
      setOpen(all.length > 0)
    } catch {
      setSugg(lieux)
      setOpen(lieux.length > 0)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    onChange?.(q)
    setFocused(-1)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => search(q), 250)
  }

  function pick(s: Suggestion) {
    setQuery(s.label)
    onChange?.(s.label)
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
          background: inputBg,
          border: `1px solid ${open && suggestions.length > 0 ? 'rgba(201,168,76,.5)' : inputBorder}`,
          borderRadius: open && suggestions.length > 0 ? '10px 10px 0 0' : 10,
          padding: '13px 16px',
          fontSize: 14, color: inputColor,
          outline: 'none', fontFamily: 'inherit',
          transition: 'border-color .15s',
        }}
      />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 300,
          background: dropBg,
          border: `1px solid ${dropBorder}`,
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,.12)', overflow: 'hidden',
        }}>
          {suggestions.map((s, i) => (
            <button key={i} type="button" onMouseDown={() => pick(s)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 10,
              width: '100%', textAlign: 'left',
              padding: '10px 14px', background: i === focused ? '#F8F6F1' : dropBg,
              border: 'none', cursor: 'pointer',
              borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
            }}
              onMouseEnter={() => setFocused(i)}
              onMouseLeave={() => setFocused(-1)}
            >
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                {s.isLieu ? '✈️' : '📍'}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: s.isLieu ? 500 : 400, color: '#09091A' }}>{s.label}</div>
                {s.sublabel && <div style={{ fontSize: 10, color: '#848499', marginTop: 1 }}>{s.sublabel}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
