'use client'

import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const L = {
  bg: '#F8F6F1', card: '#FFFFFF', border: 'rgba(0,0,0,.1)',
  t1: '#0A0A0A', t2: '#555555', input: '#F3F0EB',
  gold: '#C9A84C', red: '#D95050', grn: '#3CC47C',
}

export default function ClientUpdatePasswordPage() {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'success'>('loading')
  const [errMsg, setErrMsg]   = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [pending, setPending]   = useState(false)

  useEffect(() => {
    const hash   = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const access_token  = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    const type          = params.get('type')

    if (!access_token || !refresh_token) {
      setStatus('error')
      setErrMsg('Lien invalide ou déjà utilisé. Refaites une demande.')
      return
    }

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    supabase.auth.setSession({ access_token, refresh_token }).then(({ error }) => {
      if (error) {
        setStatus('error')
        setErrMsg('Lien expiré. Refaites une demande de réinitialisation.')
      } else {
        setStatus('ready')
        history.replaceState(null, '', window.location.pathname)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrMsg('')
    if (password.length < 6) return setErrMsg('Le mot de passe doit contenir au moins 6 caractères.')
    if (password !== confirm) return setErrMsg('Les mots de passe ne correspondent pas.')

    setPending(true)
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    const { error } = await supabase.auth.updateUser({ password })
    setPending(false)

    if (error) {
      setErrMsg('Erreur : ' + error.message)
    } else {
      setStatus('success')
      setTimeout(() => { window.location.href = '/client-login?success=mot-de-passe-mis-a-jour' }, 2000)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: L.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      {[600, 420, 240].map(s => (
        <div key={s} style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%,-50%)',
          width: s, height: s,
          border: `1px ${s === 420 ? 'dashed' : 'solid'} rgba(201,168,76,${s === 600 ? '.1' : s === 420 ? '.12' : '.15'})`,
          borderRadius: '50%', pointerEvents: 'none',
        }} />
      ))}

      <div style={{
        width: '100%', maxWidth: 400,
        background: L.card, border: `1px solid ${L.border}`,
        borderRadius: 18, padding: '40px 36px',
        boxShadow: '0 8px 40px rgba(0,0,0,.08), 0 0 0 1px rgba(201,168,76,.06)',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
            borderRadius: 12, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 600, color: '#fff', fontFamily: 'Georgia, serif',
            boxShadow: '0 8px 24px rgba(201,168,76,.25)',
          }}>O</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500, letterSpacing: '.1em', color: L.t1 }}>OWISE</div>
          <div style={{ fontSize: 11, color: L.t2, marginTop: 4 }}>Nouveau mot de passe</div>
        </div>

        {status === 'loading' && (
          <div style={{ textAlign: 'center', padding: '24px 0', color: L.t2, fontSize: 13 }}>
            Vérification du lien…
          </div>
        )}

        {status === 'error' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
              borderRadius: 9, padding: '14px', marginBottom: 20,
              fontSize: 13, color: L.red,
            }}>{errMsg}</div>
            <a href="/client-login/reset-password" style={{
              display: 'inline-block', background: L.gold, color: '#fff',
              textDecoration: 'none', padding: '12px 24px', borderRadius: 9,
              fontSize: 13, fontWeight: 600,
            }}>Refaire une demande</a>
          </div>
        )}

        {status === 'success' && (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: L.grn,
            }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: L.t1, marginBottom: 8 }}>Mot de passe mis à jour !</div>
            <div style={{ fontSize: 13, color: L.t2 }}>Redirection vers la connexion…</div>
          </div>
        )}

        {status === 'ready' && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {errMsg && (
              <div style={{
                background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
                borderRadius: 9, padding: '11px 14px',
                fontSize: 13, color: L.red,
              }}>{errMsg}</div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
                Nouveau mot de passe
              </label>
              <input type="password" required minLength={6} placeholder="min. 6 caractères"
                value={password} onChange={e => setPassword(e.target.value)}
                style={{ background: L.input, border: `1px solid ${L.border}`, borderRadius: 9, padding: '13px 16px', color: L.t1, fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%' }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
                Confirmer le mot de passe
              </label>
              <input type="password" required minLength={6} placeholder="••••••••"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                style={{ background: L.input, border: `1px solid ${L.border}`, borderRadius: 9, padding: '13px 16px', color: L.t1, fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%' }}
              />
            </div>
            <button type="submit" disabled={pending} style={{
              marginTop: 4, background: pending ? 'rgba(201,168,76,.5)' : L.gold,
              color: '#fff', border: 'none', borderRadius: 9, padding: '14px',
              fontSize: 14, fontWeight: 600, cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
            }}>
              {pending ? 'Enregistrement…' : 'Enregistrer le nouveau mot de passe'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
