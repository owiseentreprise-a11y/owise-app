'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { soundNouvelleCourse, soundAlert, resumeAudioCtx } from '@/lib/sound'

type ToastItem = { id: number; msg: string; color: string }

export default function AdminRealtime({ intervalMs = 30000 }: { intervalMs?: number }) {
  const router = useRouter()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)

  useEffect(() => {
    const handler = () => resumeAudioCtx()
    document.addEventListener('click', handler, { once: true })
  }, [])

  function addToast(msg: string, color: string) {
    const id = ++counter.current
    setToasts(t => [...t.slice(-3), { id, msg, color }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 6000)
  }

  useEffect(() => {
    const supabase = createClient()

    // Nouvelles courses
    const coursesCh = supabase
      .channel('admin-courses-rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'courses',
      }, () => {
        soundNouvelleCourse()
        addToast('🚗 Nouvelle course reçue', '#C9A84C')
        router.refresh()
      })
      .subscribe()

    // Nouveaux devis
    const devisCh = supabase
      .channel('admin-devis-rt')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'devis',
      }, () => {
        soundAlert()
        addToast('📋 Nouveau devis soumis', '#4D8ED4')
        router.refresh()
      })
      .subscribe()

    // Fallback polling
    const fallback = setInterval(() => router.refresh(), intervalMs)

    return () => {
      supabase.removeChannel(coursesCh)
      supabase.removeChannel(devisCh)
      clearInterval(fallback)
    }
  }, [router, intervalMs])

  if (toasts.length === 0) return null

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          background: '#111128', border: `1px solid ${t.color}40`,
          borderLeft: `3px solid ${t.color}`,
          borderRadius: 10, padding: '11px 16px',
          fontSize: 12, fontWeight: 500, color: '#EDE8DF',
          boxShadow: '0 4px 20px rgba(0,0,0,.4)',
          display: 'flex', alignItems: 'center', gap: 8,
          animation: 'fadeIn .2s ease',
          minWidth: 220,
        }}>
          {t.msg}
          <button onClick={() => setToasts(ts => ts.filter(x => x.id !== t.id))}
            style={{ background: 'none', border: 'none', color: 'rgba(237,232,223,.35)', cursor: 'pointer', fontSize: 14, marginLeft: 'auto', lineHeight: 1 }}>×</button>
        </div>
      ))}
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>
    </div>
  )
}
