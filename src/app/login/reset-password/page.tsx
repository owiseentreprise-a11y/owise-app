import Link from 'next/link'
import { resetPasswordAction } from '../actions'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const sp = await searchParams
  const success = sp.success === '1'

  const errorMessages: Record<string, string> = {
    'email-requis': 'Veuillez saisir votre adresse e-mail.',
    'envoi-echoue': 'L\'envoi a échoué. Vérifiez l\'adresse et réessayez.',
  }
  const errorMsg = sp.error ? (errorMessages[sp.error] ?? 'Une erreur est survenue.') : null

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Cercles décoratifs */}
      {[600, 420, 240].map(size => (
        <div key={size} style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%,-50%)',
          width: size, height: size,
          border: `1px ${size === 420 ? 'dashed' : 'solid'} rgba(201,168,76,${size === 240 ? '.1' : '.06'})`,
          borderRadius: '50%', pointerEvents: 'none',
        }} />
      ))}

      <div style={{
        width: '100%', maxWidth: 400,
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 18, padding: '40px 36px', position: 'relative',
        boxShadow: '0 24px 80px rgba(0,0,0,.5), 0 0 0 1px rgba(201,168,76,.06)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48,
            background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
            borderRadius: 12, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 24, fontWeight: 600, color: 'var(--base)',
            boxShadow: '0 8px 24px rgba(201,168,76,.3)',
          }}>O</div>
          <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 26, fontWeight: 500, letterSpacing: '.1em', color: 'var(--t1)' }}>
            OWISE
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 6 }}>
            Réinitialisation du mot de passe
          </div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(60,196,124,.12)', border: '1px solid rgba(60,196,124,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: 'var(--grn)',
            }}>✓</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 8 }}>
              E-mail envoyé
            </div>
            <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 24 }}>
              Consultez votre boîte mail et cliquez sur le lien pour définir un nouveau mot de passe.
            </div>
            <Link href="/login" style={{
              display: 'block', textAlign: 'center',
              fontSize: 12, color: 'var(--t2)', textDecoration: 'none',
            }}>
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div style={{
                background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.25)',
                borderRadius: 9, padding: '11px 14px', marginBottom: 16,
                fontSize: 13, color: '#e88080',
              }}>
                {errorMsg}
              </div>
            )}

            <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 20, lineHeight: 1.6 }}>
              Saisissez votre adresse e-mail. Vous recevrez un lien pour créer un nouveau mot de passe.
            </div>

            <form action={resetPasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
                  Adresse e-mail
                </label>
                <input
                  name="email" type="email" required
                  placeholder="votre@email.com"
                  style={{
                    background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.18)',
                    borderRadius: 9, padding: '13px 16px',
                    color: 'var(--t1)', fontFamily: 'var(--font-dm-sans), sans-serif',
                    fontSize: 14, outline: 'none',
                  }}
                />
              </div>
              <button type="submit" style={{
                background: 'var(--gold)', color: 'var(--base)', border: 'none',
                borderRadius: 9, padding: '14px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}>
                Envoyer le lien
              </button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href="/login" style={{ fontSize: 12, color: 'var(--t3)', textDecoration: 'none' }}>
                ← Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
