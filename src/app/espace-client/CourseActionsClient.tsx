'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { annulerCourseClient, modifierReservationClient } from './actions'

const sty = {
  inp: {
    width: '100%', padding: '8px 10px', boxSizing: 'border-box' as const,
    background: 'var(--elevated)', border: '1px solid var(--t3)',
    borderRadius: 7, color: 'var(--t1)', fontSize: 12, outline: 'none',
    fontFamily: 'var(--font-dm-sans), sans-serif',
  },
  lbl: {
    display: 'block', fontSize: 9, letterSpacing: '.1em',
    textTransform: 'uppercase' as const, color: 'var(--t3)', marginBottom: 4,
  },
}

export default function CourseActionsClient({
  courseId,
  datePrevue,
  nbPassagers,
}: {
  courseId: string
  datePrevue: string
  nbPassagers: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [modifOpen, setModifOpen] = useState(false)
  const [newDate, setNewDate] = useState(datePrevue.slice(0, 16))
  const [newPax, setNewPax] = useState(String(nbPassagers))
  const [error, setError] = useState<string | null>(null)
  const [confirmCancel, setConfirmCancel] = useState(false)

  function handleAnnuler() {
    startTransition(async () => {
      const res = await annulerCourseClient(courseId)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  function handleModifier() {
    setError(null)
    startTransition(async () => {
      const res = await modifierReservationClient(courseId, {
        date_prevue: newDate,
        nb_passagers: parseInt(newPax) || 1,
      })
      if (res.error) { setError(res.error); return }
      setModifOpen(false)
      router.refresh()
    })
  }

  return (
    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {error && (
        <div style={{ fontSize: 11, color: 'var(--red)', padding: '5px 8px', borderRadius: 6, background: 'rgba(217,84,84,.1)' }}>
          {error}
        </div>
      )}

      {/* Boutons principaux */}
      {!modifOpen && !confirmCancel && (
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setModifOpen(true)}
            disabled={pending}
            style={{
              flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer',
              background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)',
              color: 'var(--gold)', fontSize: 11, fontWeight: 500,
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Modifier
          </button>
          <button
            onClick={() => setConfirmCancel(true)}
            disabled={pending}
            style={{
              flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer',
              background: 'rgba(217,84,84,.06)', border: '1px solid rgba(217,84,84,.2)',
              color: 'var(--red)', fontSize: 11, fontWeight: 500,
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Annuler la course
          </button>
        </div>
      )}

      {/* Confirmation annulation */}
      {confirmCancel && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>Confirmer l&apos;annulation de cette course ?</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAnnuler}
              disabled={pending}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, cursor: pending ? 'wait' : 'pointer',
                background: 'var(--red)', border: 'none',
                color: '#fff', fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                opacity: pending ? .6 : 1,
              }}
            >
              {pending ? 'Annulation…' : 'Confirmer'}
            </button>
            <button
              onClick={() => setConfirmCancel(false)}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer',
                background: 'var(--elevated)', border: '1px solid var(--t3)',
                color: 'var(--t2)', fontSize: 11,
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* Formulaire modification */}
      {modifOpen && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '10px', borderRadius: 8, background: 'var(--elevated)', border: '1px solid var(--t3)' }}>
          <div>
            <label style={sty.lbl}>Nouvelle date & heure</label>
            <input
              type="datetime-local"
              value={newDate}
              onChange={e => setNewDate(e.target.value)}
              style={{ ...sty.inp, colorScheme: 'dark' }}
            />
          </div>
          <div>
            <label style={sty.lbl}>Nombre de passagers</label>
            <input
              type="number" min={1} max={7}
              value={newPax}
              onChange={e => setNewPax(e.target.value)}
              style={sty.inp}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleModifier}
              disabled={pending}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, cursor: pending ? 'wait' : 'pointer',
                background: 'var(--gold)', border: 'none',
                color: 'var(--base)', fontSize: 11, fontWeight: 600,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                opacity: pending ? .6 : 1,
              }}
            >
              {pending ? 'Sauvegarde…' : 'Sauvegarder'}
            </button>
            <button
              onClick={() => { setModifOpen(false); setError(null) }}
              style={{
                flex: 1, padding: '8px', borderRadius: 7, cursor: 'pointer',
                background: 'transparent', border: '1px solid var(--t3)',
                color: 'var(--t2)', fontSize: 11,
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
