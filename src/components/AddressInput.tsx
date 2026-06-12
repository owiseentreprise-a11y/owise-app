'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { searchAddresses, getSuggestionIcon, type AddressSuggestion } from '@/lib/addressSearch'

type Suggestion = AddressSuggestion & { sublabel?: string }

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

  // eslint-disable-next-line react-hooks/set-state-in-effect
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
    const all = await searchAddresses(q)
    setSugg(all)
    setOpen(all.length > 0)
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
                {getSuggestionIcon(s)}
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
