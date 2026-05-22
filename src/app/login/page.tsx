import { loginAction } from './actions'

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--base)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Cercles décoratifs */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 600, height: 600,
        border: '1px solid rgba(201,168,76,.06)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 420, height: 420,
        border: '1px dashed rgba(201,168,76,.08)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%,-50%)',
        width: 240, height: 240,
        border: '1px solid rgba(201,168,76,.1)',
        borderRadius: '50%',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)',
        border: '1px solid var(--gb)',
        borderRadius: 18,
        padding: '40px 36px',
        position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(201,168,76,.06)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
            borderRadius: 12,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 24, fontWeight: 600, color: 'var(--base)',
            margin: '0 auto 12px',
            boxShadow: '0 8px 24px rgba(201,168,76,.3)',
          }}>O</div>
          <div style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 26, fontWeight: 500,
            letterSpacing: '.1em', color: 'var(--t1)',
          }}>OWISE</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 4, letterSpacing: '.08em' }}>
            Espace d'administration
          </div>
        </div>

        {/* Erreur */}
        <ErrorBanner searchParams={searchParams} />

        {/* Formulaire */}
        <form action={loginAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 10, letterSpacing: '.14em',
              textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500,
            }}>
              Adresse e-mail
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="admin@owise.fr"
              style={{
                background: 'var(--elevated)',
                border: '1px solid rgba(201,168,76,.18)',
                borderRadius: 9, padding: '13px 16px',
                color: 'var(--t1)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{
              fontSize: 10, letterSpacing: '.14em',
              textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500,
            }}>
              Mot de passe
            </label>
            <input
              name="password"
              type="password"
              required
              placeholder="••••••••"
              style={{
                background: 'var(--elevated)',
                border: '1px solid rgba(201,168,76,.18)',
                borderRadius: 9, padding: '13px 16px',
                color: 'var(--t1)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: 14, outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            style={{
              marginTop: 8,
              background: 'var(--gold)',
              color: 'var(--base)',
              border: 'none',
              borderRadius: 9,
              padding: '14px',
              fontSize: 14, fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              letterSpacing: '.04em',
            }}
          >
            Se connecter
          </button>
        </form>

        {/* Footer */}
        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid rgba(201,168,76,.08)',
          textAlign: 'center',
          fontSize: 11, color: 'var(--t3)',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: 'var(--grn)',
              display: 'inline-block',
            }} />
            Systèmes opérationnels
          </span>
        </div>
      </div>
    </div>
  )
}

// Composant async pour lire les searchParams
async function ErrorBanner({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  if (!params.error) return null

  const messages: Record<string, string> = {
    'identifiants-incorrects': 'Email ou mot de passe incorrect.',
    'connexion-echouee': 'Erreur de connexion. Réessayez.',
  }

  return (
    <div style={{
      background: 'rgba(217,80,80,.1)',
      border: '1px solid rgba(217,80,80,.25)',
      borderRadius: 9,
      padding: '11px 14px',
      marginBottom: 16,
      fontSize: 13,
      color: '#e88080',
    }}>
      {messages[params.error] ?? 'Une erreur est survenue.'}
    </div>
  )
}
