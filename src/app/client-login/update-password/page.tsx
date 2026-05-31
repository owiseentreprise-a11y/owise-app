import { updatePasswordAction } from '@/app/login/actions'

const L = {
  bg: '#F8F6F1', card: '#FFFFFF', border: 'rgba(0,0,0,.1)',
  t1: '#0A0A0A', t2: '#555555', input: '#F3F0EB',
  gold: '#C9A84C', red: '#D95050',
}

const ERRORS: Record<string, string> = {
  'mot-de-passe-court':       'Le mot de passe doit contenir au moins 6 caractères.',
  'mots-de-passe-differents': 'Les mots de passe ne correspondent pas.',
  'mise-a-jour-echouee':      'Le lien a expiré. Refaites une demande de réinitialisation.',
}

export default async function ClientUpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp     = await searchParams
  const errMsg = sp.error ? (ERRORS[sp.error] ?? 'Une erreur est survenue.') : null

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
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
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
          <div style={{ fontSize: 11, color: L.t2, marginTop: 4 }}>Nouveau mot de passe</div>
        </div>

        {errMsg && (
          <div style={{
            background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
            borderRadius: 9, padding: '11px 14px', marginBottom: 16,
            fontSize: 13, color: L.red,
          }}>{errMsg}</div>
        )}

        <form action={updatePasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
              Nouveau mot de passe
            </label>
            <input name="password" type="password" required minLength={6} placeholder="min. 6 caractères" style={{
              background: L.input, border: `1px solid ${L.border}`,
              borderRadius: 9, padding: '13px 16px',
              color: L.t1, fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%',
            }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: L.t2, fontWeight: 500 }}>
              Confirmer le mot de passe
            </label>
            <input name="confirm" type="password" required minLength={6} placeholder="••••••••" style={{
              background: L.input, border: `1px solid ${L.border}`,
              borderRadius: 9, padding: '13px 16px',
              color: L.t1, fontFamily: 'inherit', fontSize: 14, outline: 'none', width: '100%',
            }} />
          </div>
          <button type="submit" style={{
            marginTop: 4, background: L.gold, color: '#fff',
            border: 'none', borderRadius: 9, padding: '14px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            Enregistrer le nouveau mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}
