'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import { assignerChauffeur } from './[id]/actions'

type Chauffeur = {
  id: string
  statut: string
  profiles: { prenom: string; nom: string } | null
}

export default function DispatchRapideButton({
  courseId,
  chauffeurs,
  currentChauffeurId,
  currentChauffeurNom,
}: {
  courseId: string
  chauffeurs: Chauffeur[]
  currentChauffeurId: string | null
  currentChauffeurNom: string | null
}) {
  const [open, setOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const [pos, setPos] = useState({ top: 0, right: 0 })
  const [hovered, setHovered] = useState<string | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  function handleOpen(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const rect = btnRef.current?.getBoundingClientRect()
    if (rect) setPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right })
    setOpen(v => !v)
  }

  function handleSelect(e: React.MouseEvent, chauffeurId: string | null) {
    e.stopPropagation()
    setOpen(false)
    startTransition(() => assignerChauffeur(courseId, chauffeurId))
  }

  useEffect(() => {
    if (!open) return
    const close = () => setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const isAssigned = !!currentChauffeurId
  const label = pending ? '…' : (currentChauffeurNom ?? 'Non assigné')

  return (
    <>
      <button
        ref={btnRef}
        onClick={handleOpen}
        onMouseDown={e => e.stopPropagation()}
        disabled={pending}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 8px', borderRadius: 6, maxWidth: 136,
          background: open ? 'rgba(201,168,76,.06)' : 'transparent',
          border: `1px solid ${isAssigned ? 'rgba(201,168,76,.18)' : 'rgba(232,160,48,.28)'}`,
          color: isAssigned ? 'var(--t2)' : 'var(--amber)',
          fontSize: 11, fontWeight: isAssigned ? 400 : 500,
          cursor: pending ? 'default' : 'pointer',
          transition: 'background .12s, border-color .12s',
          opacity: pending ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
          {label}
        </span>
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} style={{ flexShrink: 0, opacity: .7 }}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, right: pos.right,
            zIndex: 9999, minWidth: 210,
            background: '#FFFFFF',
            border: '1px solid rgba(0,0,0,.1)',
            borderRadius: 10,
            boxShadow: '0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06)',
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '9px 13px 6px',
            fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase',
            color: '#999', fontWeight: 500, borderBottom: '1px solid rgba(0,0,0,.07)',
          }}>
            Assigner un chauffeur
          </div>

          {chauffeurs.length === 0 ? (
            <div style={{ padding: '10px 13px 12px', fontSize: 11, color: 'var(--t3)' }}>
              Aucun chauffeur disponible
            </div>
          ) : (
            <div style={{ maxHeight: 260, overflowY: 'auto' }}>
              {chauffeurs.map(c => {
                const nom = c.profiles ? `${c.profiles.prenom} ${c.profiles.nom}` : '—'
                const isCurrent = c.id === currentChauffeurId
                const isHov = hovered === c.id
                return (
                  <button
                    key={c.id}
                    onClick={e => handleSelect(e, c.id)}
                    onMouseEnter={() => setHovered(c.id)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      width: '100%', padding: '9px 13px',
                      background: isCurrent ? 'rgba(201,168,76,.08)' : isHov ? 'rgba(0,0,0,.04)' : 'transparent',
                      border: 'none', cursor: 'pointer',
                      color: isCurrent ? '#C9A84C' : '#0A0A0A',
                      fontSize: 12, textAlign: 'left',
                      transition: 'background .08s',
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: c.statut === 'disponible' ? 'var(--green)' : 'var(--t3)',
                      boxShadow: c.statut === 'disponible' ? '0 0 4px rgba(61,184,122,.5)' : 'none',
                    }}/>
                    <span style={{ flex: 1 }}>{nom}</span>
                    {isCurrent && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2.5}>
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                    {!isCurrent && (
                      <span style={{
                        fontSize: 9, color: c.statut === 'disponible' ? '#3DB87A' : '#999',
                        letterSpacing: '.06em',
                      }}>
                        {c.statut === 'disponible' ? 'Dispo' : 'Hors ligne'}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}

          {currentChauffeurId && (
            <>
              <div style={{ height: 1, background: 'rgba(201,168,76,.07)' }}/>
              <button
                onClick={e => handleSelect(e, null)}
                onMouseEnter={() => setHovered('__unassign__')}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '9px 13px 11px',
                  background: hovered === '__unassign__' ? 'rgba(217,84,84,.06)' : 'transparent',
                  border: 'none', cursor: 'pointer', color: '#D95454',
                  fontSize: 11, textAlign: 'left', transition: 'background .08s',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
                Désassigner
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
