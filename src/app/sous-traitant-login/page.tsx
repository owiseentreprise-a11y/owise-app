'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { reportAuthFailureIfAbnormal } from '@/lib/authMonitoring'

export default function SousTraitantLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      reportAuthFailureIfAbnormal(error, 'login sous-traitant')
      setError('Email ou mot de passe incorrect.')
      setLoading(false)
    } else {
      router.push('/sous-traitant')
    }
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '12px 14px', borderRadius: 10,
    background: '#F3F0EB', border: '1px solid rgba(0,0,0,.1)',
    color: '#0A0A0A', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    fontFamily: 'DM Sans, sans-serif',
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F6F1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'DM Sans, sans-serif',
    }}>
      <div style={{
        background: '#FFFFFF', borderRadius: 18, padding: '40px 36px',
        width: '100%', maxWidth: 400,
        boxShadow: '0 8px 40px rgba(0,0,0,.08)',
        border: '1px solid rgba(0,0,0,.07)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 9,
            background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 600, color: '#fff',
          }}>O</div>
          <div>
            <div style={{ fontFamily: 'Georgia, serif', fontSize: 17, letterSpacing: '.1em', color: '#0A0A0A' }}>OWISE</div>
            <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#999', marginTop: 1 }}>Espace partenaire</div>
          </div>
        </div>

        <div style={{ fontSize: 20, fontWeight: 600, color: '#0A0A0A', marginBottom: 6 }}>Connexion</div>
        <div style={{ fontSize: 12, color: '#777', marginBottom: 24 }}>Accédez à votre espace sous-traitant</div>

        {error && (
          <div style={{
            background: 'rgba(217,84,84,.1)', border: '1px solid rgba(217,84,84,.25)',
            borderRadius: 8, padding: '10px 14px', marginBottom: 16,
            fontSize: 12, color: '#D95454',
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Email</label>
            <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="contact@vtc.fr" style={inp} />
          </div>
          <div>
            <label style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 6 }}>Mot de passe</label>
            <input type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={inp} />
          </div>
          <button
            type="submit"
            disabled={loading}
            style={{
              marginTop: 6, padding: '13px', borderRadius: 10, border: 'none',
              background: loading ? 'rgba(201,168,76,.5)' : '#C9A84C',
              color: '#09091A', fontSize: 14, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'DM Sans, sans-serif',
            }}
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  )
}
