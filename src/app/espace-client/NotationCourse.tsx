'use client'

import { useState, useTransition } from 'react'
import { noterCourse } from './actions'

export default function NotationCourse({ courseId, chauffeurNom }: { courseId: string; chauffeurNom: string | null }) {
  const [hovered, setHovered]   = useState(0)
  const [selected, setSelected] = useState(0)
  const [done, setDone]         = useState(false)
  const [pending, start]        = useTransition()

  function pick(note: number) {
    if (done || pending) return
    setSelected(note)
    start(async () => {
      const res = await noterCourse(courseId, note)
      if (res.ok) setDone(true)
    })
  }

  if (done) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        <span style={{ fontSize: 13 }}>{'★'.repeat(selected)}</span>
        <span style={{ fontSize: 11, color: 'var(--grn)', fontWeight: 500 }}>Merci pour votre avis !</span>
      </div>
    )
  }

  const active = hovered || selected
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 4 }}>
        {chauffeurNom ? `Noter ${chauffeurNom}` : 'Noter cette course'}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => pick(n)}
            onMouseEnter={() => setHovered(n)}
            onMouseLeave={() => setHovered(0)}
            disabled={pending}
            style={{
              background: 'none', border: 'none', cursor: pending ? 'wait' : 'pointer',
              fontSize: 20, padding: '0 1px', lineHeight: 1,
              color: n <= active ? '#C9A84C' : 'var(--t3)',
              transition: 'color .1s, transform .1s',
              transform: n <= active ? 'scale(1.15)' : 'scale(1)',
            }}
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
    </div>
  )
}
