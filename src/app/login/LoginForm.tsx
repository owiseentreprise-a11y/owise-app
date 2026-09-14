'use client'

import { useActionState, useEffect } from 'react'
import { loginAction } from './actions'

const L = {
  border: 'rgba(0,0,0,.1)',
  t1:     '#0A0A0A',
  t2:     '#555555',
  input:  '#F3F0EB',
  gold:   '#C9A84C',
}

type State = { error?: string; redirectTo?: string }

async function submit(_prev: State, formData: FormData): Promise<State> {
  return loginAction(formData)
}

export default function LoginForm() {
  const [state, formAction] = useActionState<State, FormData>(submit, {})

  // Navigation complète (pas de transition React) : le navigateur recharge
  // tout le CSS/JS depuis zéro, comme un rafraîchissement manuel — évite le
  // sidebar mal rendu qui n'apparaissait qu'après une transition côté client.
  useEffect(() => {
    if (state.redirectTo) window.location.href = state.redirectTo
    else if (state.error) window.location.href = `/login?error=${state.error}`
  }, [state])

  return (
    <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
          Adresse e-mail
        </label>
        <input
          name="email"
          type="email"
          required
          placeholder="admin@owise.fr"
          style={{
            background: L.input,
            border: `1px solid ${L.border}`,
            borderRadius: 9, padding: '13px 16px',
            color: L.t1,
            fontFamily: 'inherit',
            fontSize: 14, outline: 'none',
            width: '100%',
          }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
          Mot de passe
        </label>
        <input
          name="password"
          type="password"
          required
          placeholder="••••••••"
          style={{
            background: L.input,
            border: `1px solid ${L.border}`,
            borderRadius: 9, padding: '13px 16px',
            color: L.t1,
            fontFamily: 'inherit',
            fontSize: 14, outline: 'none',
            width: '100%',
          }}
        />
      </div>

      <button
        type="submit"
        style={{
          marginTop: 8,
          background: L.gold,
          color: '#fff',
          border: 'none',
          borderRadius: 9,
          padding: '14px',
          fontSize: 14, fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '.04em',
        }}
      >
        Se connecter
      </button>
    </form>
  )
}
