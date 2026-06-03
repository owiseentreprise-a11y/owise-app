import Link from 'next/link'
import PurchaseEvent from './PurchaseEvent'

export default function PaiementMerciPage() {
  return (
    <div>
      <PurchaseEvent />
    <div style={{
      minHeight: '100vh',
      background: '#F8F6F1',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    }}>

      <div style={{ position: 'relative', maxWidth: 460, width: '100%', textAlign: 'center' }}>

        {/* Logo */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, marginBottom: 48 }}>
          <img src="/brand_assets/logo.svg" alt="Owise" style={{ height: 30 }} />
          <div style={{ textAlign: 'left' }}>
            <div style={{
              fontFamily: 'var(--font-cormorant, Georgia), serif',
              fontSize: 22, fontWeight: 600, letterSpacing: '.18em',
              color: '#09091A', lineHeight: 1,
            }}>OWISE</div>
            <div style={{ fontSize: 8, letterSpacing: '.24em', textTransform: 'uppercase', color: '#9B9B9B', marginTop: 2 }}>
              Transport de prestige
            </div>
          </div>
        </div>

        {/* Carte principale */}
        <div style={{
          background: '#FFFFFF',
          border: '1px solid rgba(0,0,0,.08)',
          borderRadius: 20,
          padding: '40px 36px 36px',
          boxShadow: '0 4px 32px rgba(0,0,0,.08)',
          marginBottom: 24,
        }}>
          {/* Icône succès */}
          <div style={{
            width: 80, height: 80,
            background: 'radial-gradient(circle, rgba(61,184,122,.1) 0%, rgba(61,184,122,.03) 100%)',
            border: '1px solid rgba(61,184,122,.25)',
            borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 28px',
          }}>
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#3DB87A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          {/* Titre */}
          <h1 style={{
            fontFamily: 'var(--font-cormorant, Georgia), serif',
            fontSize: 34, fontWeight: 500,
            color: '#09091A',
            margin: '0 0 12px',
            letterSpacing: '.02em',
          }}>
            Paiement confirmé
          </h1>

          {/* Ligne dorée */}
          <div style={{
            width: 48, height: 2,
            background: 'linear-gradient(90deg, transparent, #C9A84C, transparent)',
            borderRadius: 1,
            margin: '0 auto 20px',
          }} />

          <p style={{ fontSize: 14, color: '#6B6B6B', lineHeight: 1.8, margin: '0 0 8px' }}>
            Votre règlement a bien été reçu.
          </p>
          <p style={{ fontSize: 13, color: '#9B9B9B', lineHeight: 1.7, margin: '0 0 32px' }}>
            Un reçu Stripe vous a été envoyé par email.<br />
            Notre équipe vous contactera pour confirmer les détails.
          </p>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 8,
            background: 'rgba(201,168,76,.07)',
            border: '1px solid rgba(201,168,76,.2)',
            marginBottom: 32,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C' }} />
            <span style={{ fontSize: 11, color: '#C9A84C', fontWeight: 600, letterSpacing: '.06em' }}>
              Course enregistrée — confirmation sous 30 min
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/espace-client" style={{
              display: 'block', padding: '14px 28px',
              background: '#09091A',
              color: '#FFFFFF',
              borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 600, letterSpacing: '.04em',
            }}>
              Voir mes réservations →
            </Link>
            <Link href="/" style={{
              display: 'block', padding: '11px 28px',
              background: 'transparent',
              color: '#6B6B6B',
              border: '1px solid rgba(0,0,0,.1)',
              borderRadius: 10, textDecoration: 'none',
              fontSize: 13, fontWeight: 400,
            }}>
              Retour à l'accueil
            </Link>
          </div>
        </div>

        {/* Sécurité Stripe */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
            <rect x=".5" y="5" width="10" height="7.5" rx="1.5" stroke="rgba(0,0,0,.25)"/>
            <path d="M2.5 5V3.5a3 3 0 1 1 6 0V5" stroke="rgba(0,0,0,.25)" strokeLinecap="round"/>
          </svg>
          <span style={{ fontSize: 11, color: '#9B9B9B' }}>
            Paiement sécurisé · Powered by{' '}
            <span style={{ color: '#635BFF', fontWeight: 600 }}>Stripe</span>
          </span>
        </div>
      </div>
    </div>
    </div>
  )
}
