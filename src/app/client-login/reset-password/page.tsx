import type { Metadata } from 'next'
import Link from 'next/link'
import { clientResetPasswordAction } from '@/app/client-login/actions'

export const metadata: Metadata = { robots: { index: false, follow: false } }

const L = {
  bg: '#F8F6F1', card: '#FFFFFF', border: 'rgba(0,0,0,.1)',
  t1: '#0A0A0A', t2: '#555555', t3: '#AAAAAA',
  input: '#F3F0EB', gold: '#C9A84C', grn: '#3CC47C', red: '#D95050',
}

export default async function ClientResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const sp      = await searchParams
  const success = sp.success === '1'
  const errorMessages: Record<string, string> = {
    'email-requis': 'Veuillez saisir votre adresse e-mail.',
    'envoi-echoue': 'Envoi échoué. Vérifiez l\'adresse et réessayez.',
  }
  const errorMsg = sp.error ? (errorMessages[sp.error] ?? 'Une erreur est survenue.') : null

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
          <Link href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 48, height: 48,
              background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
              borderRadius: 12, margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 600, color: '#fff', fontFamily: 'Georgia, serif',
              boxShadow: '0 8px 24px rgba(201,168,76,.25)',
            }}>O</div>
          </Link>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500, letterSpacing: '.1em', color: L.t1 }}>OWISE</div>
          <div style={{ fontSize: 11, color: L.t2, marginTop: 4 }}>Réinitialisation du mot de passe</div>
        </div>

        {success ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: 52, height: 52, borderRadius: '50%', margin: '0 auto 16px',
              background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: L.grn,
            }}>✓</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: L.t1, marginBottom: 10 }}>E-mail envoyé</div>
            <div style={{ fontSize: 13, color: L.t2, lineHeight: 1.7, marginBottom: 28 }}>
              Consultez votre boîte mail et cliquez sur le lien pour définir un nouveau mot de passe.
            </div>
            <Link href="/client-login" style={{ fontSize: 13, color: L.gold, textDecoration: 'none', fontWeight: 500 }}>
              ← Retour à la connexion
            </Link>
          </div>
        ) : (
          <>
            {errorMsg && (
              <div style={{
                background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
                borderRadius: 9, padding: '11px 14px', marginBottom: 16,
                fontSize: 13, color: L.red,
              }}>{errorMsg}</div>
            )}
            <p style={{ fontSize: 13, color: L.t2, marginBottom: 20, lineHeight: 1.6 }}>
              Saisissez votre adresse e-mail. Vous recevrez un lien pour créer un nouveau mot de passe.
            </p>
            <form action={clientResetPasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
                  Adresse e-mail
                </label>
                <input name="email" type="email" required placeholder="vous@email.com" style={{
                  background: L.input, border: `1px solid ${L.border}`,
                  borderRadius: 9, padding: '13px 16px',
                  color: L.t1, fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%',
                }} />
              </div>
              <button type="submit" style={{
                background: L.gold, color: '#fff', border: 'none',
                borderRadius: 9, padding: '14px',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>
                Envoyer le lien
              </button>
            </form>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
              <Link href="/client-login" style={{ fontSize: 12, color: L.t3, textDecoration: 'none' }}>
                ← Retour à la connexion
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
