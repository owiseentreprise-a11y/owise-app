import Link from 'next/link'
import { loginAction } from './actions'

const L = {
  bg:      '#F8F6F1',
  card:    '#FFFFFF',
  border:  'rgba(0,0,0,.1)',
  t1:      '#0A0A0A',
  t2:      '#555555',
  t3:      '#AAAAAA',
  input:   '#F3F0EB',
  gold:    '#C9A84C',
  grn:     '#3CC47C',
  red:     '#D95050',
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: L.bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cercles décoratifs */}
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, border: '1px solid rgba(201,168,76,.1)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 420, height: 420, border: '1px dashed rgba(201,168,76,.12)', borderRadius: '50%', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 240, height: 240, border: '1px solid rgba(201,168,76,.15)', borderRadius: '50%', pointerEvents: 'none' }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: L.card,
        border: `1px solid ${L.border}`,
        borderRadius: 18,
        padding: '40px 36px',
        position: 'relative',
        boxShadow: '0 8px 40px rgba(0,0,0,.08), 0 0 0 1px rgba(201,168,76,.06)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif',
            fontSize: 24, fontWeight: 600, color: '#fff',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px rgba(201,168,76,.25)',
          }}>O</div>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, letterSpacing: '.1em', color: L.t1 }}>OWISE</div>
          <div style={{ fontSize: 11, color: L.t2, marginTop: 4, letterSpacing: '.08em' }}>Espace d&apos;administration</div>
        </div>

        {/* Bannières */}
        <StatusBanner searchParams={searchParams} />

        {/* Formulaire */}
        <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <Link href="/login/reset-password" style={{ fontSize: 12, color: L.t3, textDecoration: 'none' }}>
            Mot de passe oublié ?
          </Link>
        </div>

        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: `1px solid ${L.border}`,
          textAlign: 'center',
          fontSize: 11, color: L.t3,
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: L.grn, display: 'inline-block' }} />
            Systèmes opérationnels
          </span>
        </div>
      </div>
    </div>
  )
}

async function StatusBanner({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams
  if (params.success === 'mot-de-passe-mis-a-jour') {
    return (
      <div style={{ background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.25)', borderRadius: 9, padding: '11px 14px', marginBottom: 16, fontSize: 13, color: '#1a8a4a' }}>
        ✓ Mot de passe mis à jour. Connectez-vous.
      </div>
    )
  }
  if (!params.error) return null
  const messages: Record<string, string> = {
    'identifiants-incorrects': 'Email ou mot de passe incorrect.',
    'connexion-echouee': 'Erreur de connexion. Réessayez.',
  }
  return (
    <div style={{ background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)', borderRadius: 9, padding: '11px 14px', marginBottom: 16, fontSize: 13, color: '#c03030' }}>
      {messages[params.error] ?? 'Une erreur est survenue.'}
    </div>
  )
}
