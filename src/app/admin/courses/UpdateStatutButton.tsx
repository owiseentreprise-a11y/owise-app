'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STATUT_COURSE_LABEL, type StatutCourse } from '@/lib/types'

const PROGRESSION: Record<StatutCourse, StatutCourse | null> = {
  en_attente:      'acceptee',
  acceptee:        'en_route',
  en_route:        'prise_en_charge',
  prise_en_charge: 'terminee',
  terminee:        null,
  annulee:         null,
}

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
}: {
  courseId: string
  statut: StatutCourse
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const nextStatut = PROGRESSION[statut]

  async function handleClick() {
    if (!nextStatut) return
    startTransition(async () => {
      const supabase = createClient()
      await supabase
        .from('courses')
        .update({ statut: nextStatut })
        .eq('id', courseId)
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
          onClick={handleClick}
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
