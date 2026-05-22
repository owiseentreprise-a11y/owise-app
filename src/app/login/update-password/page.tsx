import { updatePasswordAction } from '../actions'

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams

  const errorMessages: Record<string, string> = {
    'mot-de-passe-court':      'Le mot de passe doit contenir au moins 6 caractères.',
    'mots-de-passe-differents':'Les mots de passe ne correspondent pas.',
    'mise-a-jour-echouee':     'La mise à jour a échoué. Le lien est peut-être expiré.',
  }
  const errorMsg = sp.error ? (errorMessages[sp.error] ?? 'Une erreur est survenue.') : null

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--base)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px', position: 'relative', overflow: 'hidden',
    }}>
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
            Nouveau mot de passe
          </div>
        </div>

        {errorMsg && (
          <div style={{
            background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.25)',
            borderRadius: 9, padding: '11px 14px', marginBottom: 16,
            fontSize: 13, color: '#e88080',
          }}>
            {errorMsg}
          </div>
        )}

        <form action={updatePasswordAction} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
              Nouveau mot de passe
            </label>
            <input
              name="password" type="password" required minLength={6}
              placeholder="min. 6 caractères"
              style={{
                background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.18)',
                borderRadius: 9, padding: '13px 16px',
                color: 'var(--t1)', fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: 14, outline: 'none',
              }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
              Confirmer le mot de passe
            </label>
            <input
              name="confirm" type="password" required minLength={6}
              placeholder="••••••••"
              style={{
                background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.18)',
                borderRadius: 9, padding: '13px 16px',
                color: 'var(--t1)', fontFamily: 'var(--font-dm-sans), sans-serif',
                fontSize: 14, outline: 'none',
              }}
            />
          </div>
          <button type="submit" style={{
            marginTop: 4,
            background: 'var(--gold)', color: 'var(--base)', border: 'none',
            borderRadius: 9, padding: '14px',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}>
            Enregistrer le nouveau mot de passe
          </button>
        </form>
      </div>
    </div>
  )
}
