import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Désinscription — Owise',
  description: 'Gérez vos préférences de communication avec Owise.',
  robots: 'noindex',
}

export default async function DesinscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>
}) {
  const { ok, err } = await searchParams
  const success = ok === '1'
  const invalid = err === 'invalid'

  return (
    <main style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#F8F6F1', fontFamily: "'DM Sans', Arial, sans-serif", padding: '24px',
    }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '48px 40px', maxWidth: 480,
        width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,.06)', textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 32,
        }}>
          <div style={{
            width: 36, height: 36, background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600, color: '#09091A',
          }}>O</div>
          <span style={{ fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 500, letterSpacing: '.1em', color: '#09091A' }}>
            OWISE
          </span>
        </div>

        {success ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#09091A', margin: '0 0 12px' }}>
              Désinscription confirmée
            </h1>
            <p style={{ fontSize: 14, color: '#848499', lineHeight: 1.7, margin: '0 0 32px' }}>
              Votre adresse email a bien été retirée de notre liste de relances commerciales.
              Vous ne recevrez plus de messages de suivi de notre part.
            </p>
            <p style={{ fontSize: 13, color: '#aaa', margin: '0 0 32px' }}>
              Vous pouvez toujours nous contacter directement par téléphone ou WhatsApp
              si vous avez besoin d'un VTC.
            </p>
          </>
        ) : invalid ? (
          <>
            <div style={{ fontSize: 40, marginBottom: 16 }}>⚠</div>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#09091A', margin: '0 0 12px' }}>
              Lien invalide
            </h1>
            <p style={{ fontSize: 14, color: '#848499', lineHeight: 1.7, margin: '0 0 32px' }}>
              Le lien de désinscription est invalide ou expiré.
              Contactez-nous directement pour vous désinscrire.
            </p>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: '#09091A', margin: '0 0 12px' }}>
              Désinscription
            </h1>
            <p style={{ fontSize: 14, color: '#848499', lineHeight: 1.7, margin: '0 0 32px' }}>
              Pour vous désinscrire de nos relances commerciales, utilisez le lien
              de désinscription présent dans l'email que vous avez reçu.
            </p>
          </>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="https://wa.me/33619106356"
            style={{
              display: 'inline-block', background: '#25D366', color: '#fff',
              textDecoration: 'none', padding: '11px 22px', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
            }}
          >
            WhatsApp →
          </a>
          <Link
            href="/"
            style={{
              display: 'inline-block', background: '#09091A', color: '#EDE8DF',
              textDecoration: 'none', padding: '11px 22px', borderRadius: 8,
              fontSize: 13, fontWeight: 600,
            }}
          >
            Retour à l'accueil
          </Link>
        </div>
      </div>
    </main>
  )
}
