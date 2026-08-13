'use client'

import { useEffect, useState } from 'react'

const STORAGE_KEY = 'owise_cookie_consent'
const FB_PIXEL_ID = '1688600002292509'

type FbqWindow = { fbq?: (...args: unknown[]) => void; _fbq?: unknown }

function initPixel() {
  if (typeof window === 'undefined') return
  const w = window as unknown as FbqWindow
  if (w.fbq) return

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fbq: any = function (...args: unknown[]) {
    fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args)
  }
  if (!w._fbq) w._fbq = fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  w.fbq = fbq

  const script = document.createElement('script')
  script.async = true
  script.src = 'https://connect.facebook.net/en_US/fbevents.js'
  document.head.appendChild(script)

  w.fbq!('init', FB_PIXEL_ID)
  w.fbq!('track', 'PageView')
}

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'accepted') {
      initPixel()
    } else if (!stored) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
    initPixel()
  }

  function refuse() {
    localStorage.setItem(STORAGE_KEY, 'refused')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: '#09091A',
      borderTop: '1px solid rgba(201,168,76,.2)',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
      boxShadow: '0 -4px 32px rgba(0,0,0,.3)',
    }}>
      <p style={{ fontSize: 13, color: 'rgba(237,232,223,.7)', margin: 0, maxWidth: 700, lineHeight: 1.6 }}>
        Nous utilisons des cookies pour mesurer l&apos;audience et améliorer nos services (Meta Pixel).
        En continuant, vous acceptez leur utilisation.{' '}
        <a href="/mentions-legales" style={{ color: '#C9A84C', textDecoration: 'none' }}>
          En savoir plus
        </a>
      </p>
      <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
        <button onClick={refuse} style={{
          padding: '9px 18px', borderRadius: 8, border: '1px solid rgba(237,232,223,.2)',
          background: 'transparent', color: 'rgba(237,232,223,.6)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Refuser
        </button>
        <button onClick={accept} style={{
          padding: '9px 18px', borderRadius: 8, border: 'none',
          background: '#C9A84C', color: '#09091A',
          fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Accepter
        </button>
      </div>
    </div>
  )
}
