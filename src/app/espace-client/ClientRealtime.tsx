'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { soundConfirmation, soundTerminee, soundAlert, resumeAudioCtx } from '@/lib/sound'

const STATUT_MSG: Record<string, string> = {
  acceptee:        '✓ Votre course a été acceptée',
  en_route:        '🚗 Votre chauffeur est en route',
  prise_en_charge: '👋 Votre chauffeur est arrivé',
  terminee:        '✅ Course terminée',
  annulee:         '❌ Course annulée',
}

export default function ClientRealtime({ userId }: { userId: string }) {
  const router = useRouter()
  const [toast, setToast] = useState<string | null>(null)
  const prevStatuts = useRef<Record<string, string>>({})
  const toastTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const handler = () => resumeAudioCtx()
    document.addEventListener('click', handler, { once: true })
    document.addEventListener('touchstart', handler, { once: true })
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 5000)
  }

  useEffect(() => {
    const supabase = createClient()
    const channel  = supabase
      .channel(`client-courses-${userId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'courses',
        filter: `client_id=eq.${userId}`,
      }, (payload) => {
        const { new: next, old: prev } = payload as any
        const ancien = prevStatuts.current[next.id] ?? prev?.statut
        if (next.statut && next.statut !== ancien) {
          prevStatuts.current[next.id] = next.statut
          const msg = STATUT_MSG[next.statut]
          if (msg) {
            showToast(msg)
            if (next.statut === 'terminee')        soundTerminee()
            else if (next.statut === 'annulee')    soundAlert()
            else                                   soundConfirmation()
          }
          router.refresh()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, router])

  if (!toast) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999,
      background: '#09091A', border: '1px solid rgba(201,168,76,.3)',
      borderRadius: 12, padding: '13px 20px',
      fontSize: 13, fontWeight: 500, color: '#EDE8DF',
      boxShadow: '0 8px 32px rgba(0,0,0,.35)',
      display: 'flex', alignItems: 'center', gap: 10,
      animation: 'slideUp .25s ease',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', flexShrink: 0 }} />
      {toast}
      <button onClick={() => setToast(null)} style={{
        background: 'none', border: 'none', color: 'rgba(237,232,223,.4)',
        cursor: 'pointer', fontSize: 14, lineHeight: 1, marginLeft: 4,
      }}>×</button>
      <style>{`@keyframes slideUp { from { opacity:0; transform:translateX(-50%) translateY(12px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }`}</style>
    </div>
  )
}
