import { creerSousTraitantAction } from '../actions'

export default async function NouveauSousTraitantPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const sp = await searchParams
  const errorMessages: Record<string, string> = {
    'nom-requis':        'Le nom de la société est requis.',
    'creation-echouee':  'La création a échoué. Réessayez.',
  }
  const errorMsg = sp.error ? (errorMessages[sp.error] ?? 'Une erreur est survenue.') : null

  const inputStyle = {
    background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.18)',
    borderRadius: 9, padding: '11px 14px',
    color: 'var(--t1)', fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' as const,
    color: 'var(--t2)', fontWeight: 500, display: 'block', marginBottom: 6,
  }

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin/sous-traitants" style={{ color: 'var(--t3)', textDecoration: 'none', fontSize: 13 }}>
            ← Sous-traitants
          </a>
          <span style={{ color: 'var(--t3)' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--t1)' }}>Nouveau</span>
        </div>
      </div>

      <div style={{ padding: '32px', maxWidth: 600 }}>
        {errorMsg && (
          <div style={{
            background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.25)',
            borderRadius: 9, padding: '11px 14px', marginBottom: 20,
            fontSize: 13, color: '#e88080',
          }}>
            {errorMsg}
          </div>
        )}

        <form action={creerSousTraitantAction} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div>
            <label style={labelStyle}>Société *</label>
            <input name="nom" type="text" required placeholder="VTC Express Paris" style={inputStyle} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Contact</label>
              <input name="contact_nom" type="text" placeholder="Jean Dupont" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Téléphone</label>
              <input name="telephone" type="tel" placeholder="+33 6 00 00 00 00" style={inputStyle} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Email</label>
              <input name="email" type="email" placeholder="contact@vtc.fr" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>SIRET</label>
              <input name="siret" type="text" placeholder="000 000 000 00000" style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Adresse</label>
            <input name="adresse" type="text" placeholder="12 rue de la Paix, 75001 Paris" style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Mode de paiement</label>
            <select name="mode_paiement" defaultValue="mensuel" style={inputStyle}>
              <option value="immediat">Immédiat — à la fin de chaque course</option>
              <option value="hebdomadaire">Hebdomadaire — fin de semaine</option>
              <option value="mensuel">Mensuel — fin de mois</option>
            </select>
          </div>

          <div>
            <label style={labelStyle}>Notes internes</label>
            <textarea
              name="notes"
              rows={3}
              placeholder="Spécialité véhicules de luxe, disponible week-end..."
              style={{ ...inputStyle, resize: 'vertical' as const }}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
            <button type="submit" style={{
              background: 'var(--gold)', color: 'var(--base)', border: 'none',
              borderRadius: 9, padding: '12px 24px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>
              Créer le sous-traitant
            </button>
            <a href="/admin/sous-traitants" style={{
              display: 'flex', alignItems: 'center',
              padding: '12px 20px', borderRadius: 9,
              background: 'var(--elevated)', border: '1px solid var(--t3)',
              fontSize: 13, color: 'var(--t2)', textDecoration: 'none',
            }}>
              Annuler
            </a>
          </div>
        </form>
      </div>
    </>
  )
}
