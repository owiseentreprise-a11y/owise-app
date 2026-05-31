import Link from 'next/link'

export default function PaiementMerciPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F6F1',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Logo */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 48,
        }}>
          <div style={{
            width: 36, height: 36,
            background: 'linear-gradient(135deg, #C9A84C, #8B6A1A)',
            borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', fontSize: 20, fontWeight: 600, color: '#09091A',
          }}>O</div>
          <span style={{
            fontFamily: 'Georgia, serif',
            fontSize: 22, fontWeight: 500, letterSpacing: '.12em',
            color: '#0A0A0A',
          }}>OWISE</span>
        </div>

        {/* Icône succès */}
        <div style={{
          width: 72, height: 72,
          background: 'rgba(61,184,122,.12)',
          border: '1px solid rgba(61,184,122,.25)',
          borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3DB87A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 style={{
          fontFamily: 'Georgia, serif',
          fontSize: 28, fontWeight: 500,
          color: '#0A0A0A',
          margin: '0 0 12px',
        }}>
          Paiement confirmé
        </h1>

        <p style={{
          fontSize: 14, color: '#555555',
          lineHeight: 1.7, margin: '0 0 40px',
        }}>
          Votre règlement a bien été reçu.<br />
          Un reçu vous a été envoyé par email.
        </p>

        <Link href="/espace-client" style={{
          display: 'inline-block',
          padding: '12px 28px',
          background: '#C9A84C',
          color: '#F8F6F1',
          borderRadius: 8,
          textDecoration: 'none',
          fontSize: 13, fontWeight: 600,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          Retour à mon espace
        </Link>
      </div>
    </div>
  )
}
