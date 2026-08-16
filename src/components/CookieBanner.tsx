'use client'

import { useEffect, useState } from 'react'
import { COOKIE_KEY, initFbPixel } from '@/lib/pixel'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(COOKIE_KEY)
    if (stored === 'accepted') {
      initFbPixel()
    } else if (!stored) {
      setVisible(true)
    }
  }, [])

  function accept() {
    localStorage.setItem(COOKIE_KEY, 'accepted')
    setVisible(false)
    initFbPixel()
  }

  function refuse() {
    localStorage.setItem(COOKIE_KEY, 'refused')
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
