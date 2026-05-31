import { clientLoginAction, clientRegisterAction } from './actions'

const L = {
  bg: '#F8F6F1', card: '#FFFFFF', border: 'rgba(0,0,0,.1)',
  t1: '#0A0A0A', t2: '#555555', t3: '#AAAAAA',
  input: '#F3F0EB', gold: '#C9A84C', grn: '#3CC47C', red: '#D95050',
}

const ERRORS: Record<string, string> = {
  'identifiants-incorrects': 'Email ou mot de passe incorrect.',
  'champs-manquants':        'Tous les champs sont obligatoires.',
  'mot-de-passe-court':      'Le mot de passe doit contenir au moins 8 caractères.',
  'email-deja-utilise':      'Un compte existe déjà avec cet email.',
  'erreur-creation':         'Erreur lors de la création du compte. Réessayez.',
}

export default async function ClientLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; error?: string; success?: string }>
}) {
  const params = await searchParams
  const tab    = params.tab === 'register' ? 'register' : 'login'
  const error  = params.error ? (ERRORS[params.error] ?? 'Une erreur est survenue.') : null

  return (
    <div style={{
      minHeight: '100vh', background: L.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
      {/* Cercles décoratifs */}
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
        width: '100%', maxWidth: 420,
        background: L.card, border: `1px solid ${L.border}`,
        borderRadius: 18, padding: '40px 36px',
        boxShadow: '0 8px 40px rgba(0,0,0,.08), 0 0 0 1px rgba(201,168,76,.06)',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <a href="/" style={{ textDecoration: 'none' }}>
            <div style={{
              width: 48, height: 48,
              background: 'linear-gradient(135deg,#C9A84C,#8B6A1A)',
              borderRadius: 12, margin: '0 auto 12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 600, color: '#fff', fontFamily: 'Georgia, serif',
              boxShadow: '0 8px 24px rgba(201,168,76,.25)',
            }}>O</div>
          </a>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 24, fontWeight: 500, letterSpacing: '.1em', color: L.t1 }}>OWISE</div>
          <div style={{ fontSize: 11, color: L.t2, marginTop: 4, letterSpacing: '.06em' }}>Espace client</div>
        </div>

        {/* Onglets */}
        <div style={{
          display: 'flex', gap: 0,
          background: L.input, borderRadius: 10, padding: 4,
          marginBottom: 24,
        }}>
          {[
            { key: 'login', label: 'Se connecter' },
            { key: 'register', label: 'Créer un compte' },
          ].map(t => (
            <a key={t.key} href={`/client-login?tab=${t.key}`} style={{
              flex: 1, textAlign: 'center', padding: '9px 0',
              borderRadius: 8, fontSize: 13, fontWeight: 500,
              textDecoration: 'none',
              background: tab === t.key ? '#fff' : 'transparent',
              color: tab === t.key ? L.t1 : L.t3,
              boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.08)' : 'none',
              transition: 'all .15s',
            }}>{t.label}</a>
          ))}
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
            borderRadius: 9, padding: '11px 14px', marginBottom: 16,
            fontSize: 13, color: L.red,
          }}>{error}</div>
        )}

        {/* Succès */}
        {params.success === '1' && (
          <div style={{
            background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.25)',
            borderRadius: 9, padding: '11px 14px', marginBottom: 16,
            fontSize: 13, color: '#1a8a4a',
          }}>✓ Compte créé. Vous êtes connecté.</div>
        )}

        {/* ── CONNEXION ── */}
        {tab === 'login' && (
          <form action={clientLoginAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <Field label="Adresse e-mail" name="email" type="email" placeholder="vous@email.com" />
            <Field label="Mot de passe" name="password" type="password" placeholder="••••••••" />
            <Btn>Se connecter</Btn>
            <div style={{ textAlign: 'center', marginTop: 4 }}>
              <a href="/client-login/reset-password" style={{ fontSize: 12, color: L.t3, textDecoration: 'none' }}>
                Mot de passe oublié ?
              </a>
            </div>
          </form>
        )}

        {/* ── INSCRIPTION ── */}
        {tab === 'register' && (
          <form action={clientRegisterAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="Prénom" name="prenom" type="text" placeholder="Jean" />
              <Field label="Nom" name="nom" type="text" placeholder="Dupont" />
            </div>
            <Field label="Adresse e-mail" name="email" type="email" placeholder="vous@email.com" />
            <Field label="Mot de passe" name="password" type="password" placeholder="8 caractères minimum" />
            <Btn>Créer mon compte</Btn>
            <p style={{ margin: '8px 0 0', fontSize: 11, color: L.t3, textAlign: 'center' }}>
              En créant un compte vous acceptez nos{' '}
              <a href="/mentions-legales" style={{ color: L.gold, textDecoration: 'none' }}>CGU</a>.
            </p>
          </form>
        )}

        {/* Lien vers admin */}
        <div style={{
          marginTop: 24, paddingTop: 20,
          borderTop: `1px solid ${L.border}`,
          textAlign: 'center', fontSize: 11, color: L.t3,
        }}>
          <a href="/login" style={{ color: L.t3, textDecoration: 'none' }}>Accès administration →</a>
        </div>
      </div>
    </div>
  )
}

function Field({ label, name, type, placeholder }: { label: string; name: string; type: string; placeholder: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#555', fontWeight: 500 }}>
        {label}
      </label>
      <input name={name} type={type} required placeholder={placeholder} style={{
        background: '#F3F0EB', border: '1px solid rgba(0,0,0,.1)',
        borderRadius: 9, padding: '13px 16px',
        color: '#0A0A0A', fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%',
      }} />
    </div>
  )
}

function Btn({ children }: { children: React.ReactNode }) {
  return (
    <button type="submit" style={{
      marginTop: 4, background: '#C9A84C', color: '#fff',
      border: 'none', borderRadius: 9, padding: '14px',
      fontSize: 14, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'inherit', letterSpacing: '.04em', width: '100%',
    }}>
      {children}
    </button>
  )
}
