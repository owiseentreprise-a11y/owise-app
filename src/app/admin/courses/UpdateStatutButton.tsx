'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { STATUT_COURSE_LABEL, STATUT_TRANSITIONS, type StatutCourse } from '@/lib/types'
import { changerStatut } from './[id]/actions'

const style = (statut: StatutCourse) => {
  const map: Record<string, { color: string; background: string; borderColor: string }> = {
    en_attente:      { color: 'var(--amb)', background: 'rgba(232,160,48,.1)', borderColor: 'rgba(232,160,48,.2)' },
    acceptee:        { color: 'var(--blu)', background: 'rgba(74,142,208,.1)', borderColor: 'rgba(74,142,208,.2)' },
    en_route:        { color: 'var(--blu)', background: 'rgba(74,142,208,.1)', borderColor: 'rgba(74,142,208,.2)' },
    prise_en_charge: { color: 'var(--grn)', background: 'rgba(60,196,124,.1)', borderColor: 'rgba(60,196,124,.2)' },
    terminee:        { color: 'var(--t2)', background: 'var(--elevated)', borderColor: 'var(--t3)' },
    annulee:         { color: 'var(--red)', background: 'rgba(217,80,80,.1)', borderColor: 'rgba(217,80,80,.2)' },
  }
  return map[statut] ?? map.en_attente
}

export default function UpdateStatutButton({
  courseId,
  statut,
  chauffeurId,
}: {
  courseId: string
  statut: StatutCourse
  chauffeurId?: string | null
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  // 1er élément = étape "normale" suivante (les autres, annulation/retour
  // arrière, restent réservés à la fiche course, plus complète).
  const nextStatut = STATUT_TRANSITIONS[statut][0] ?? null

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!nextStatut) return
    startTransition(async () => {
      await changerStatut(courseId, nextStatut, chauffeurId ?? null)
      router.refresh()
    })
  }

  const s = style(statut)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        fontSize: 9.5, padding: '3px 8px', borderRadius: 4, fontWeight: 500,
        border: '1px solid', ...s,
      }}>
        {STATUT_COURSE_LABEL[statut]}
      </span>
      {nextStatut && (
        <button
          onClick={handleClick as any}
          disabled={pending}
          title={`→ ${STATUT_COURSE_LABEL[nextStatut]}`}
          style={{
            fontSize: 9, padding: '2px 6px', borderRadius: 4,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .5 : 1,
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          →
        </button>
      )}
    </div>
  )
}
