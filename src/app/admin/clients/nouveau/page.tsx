import { createClientAccount } from './actions'

export default function NouveauClientPage() {
  const inputStyle = {
    background: 'var(--elevated)', border: '1px solid var(--t3)',
    borderRadius: 8, padding: '10px 14px',
    fontSize: 13, color: 'var(--t1)',
    width: '100%', boxSizing: 'border-box' as const,
    outline: 'none', fontFamily: 'var(--font-dm-sans), sans-serif',
  }

  const labelStyle = {
    fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' as const,
    color: 'var(--t3)', fontWeight: 500, marginBottom: 6, display: 'block',
  }

  const sectionStyle = {
    background: 'var(--surface)', border: '1px solid var(--gb)',
    borderRadius: 12, padding: 24,
  }

  const sectionTitleStyle = {
    fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase' as const,
    color: 'var(--t2)', marginBottom: 18, fontWeight: 500,
  }

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <a href="/admin/clients" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Clients
        </a>
        <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Nouveau client</span>
      </div>

      <div style={{ padding: '32px', maxWidth: 720 }}>
        <form action={createClientAccount} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Compte */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Compte</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required style={inputStyle} placeholder="client@email.com" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="password">Mot de passe initial</label>
                <input id="password" name="password" type="text" required minLength={6} style={inputStyle} placeholder="min. 6 caractères" />
              </div>
            </div>
          </div>

          {/* Identité */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Informations personnelles</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="prenom">Prénom</label>
                <input id="prenom" name="prenom" required style={inputStyle} placeholder="Marie" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="nom">Nom</label>
                <input id="nom" name="nom" required style={inputStyle} placeholder="Dupont" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle} htmlFor="telephone">Téléphone</label>
              <input id="telephone" name="telephone" style={inputStyle} placeholder="+33 6 00 00 00 00" />
            </div>
          </div>

          {/* Compte client */}
          <div style={sectionStyle}>
            <div style={sectionTitleStyle}>Type de compte</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="type_compte">Type</label>
                <select
                  id="type_compte" name="type_compte"
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as any }}
                >
                  <option value="particulier">Particulier</option>
                  <option value="entreprise">Entreprise</option>
                </select>
              </div>
              <div>
                <label style={labelStyle} htmlFor="entreprise_nom">Nom de l'entreprise</label>
                <input id="entreprise_nom" name="entreprise_nom" style={inputStyle} placeholder="ACME SAS" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={labelStyle} htmlFor="adresse_facturation">Adresse de facturation</label>
              <input
                id="adresse_facturation" name="adresse_facturation"
                style={inputStyle}
                placeholder="15 rue de la Paix, 75001 Paris"
              />
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              type="submit"
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: 'var(--gold)', color: 'var(--base)',
                fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              Créer le compte client
            </button>
            <a
              href="/admin/clients"
              style={{
                padding: '12px 20px', borderRadius: 10,
                background: 'var(--elevated)', color: 'var(--t2)',
                fontSize: 13, border: '1px solid var(--t3)',
                textDecoration: 'none', display: 'flex', alignItems: 'center',
              }}
            >Annuler</a>
          </div>
        </form>
      </div>
    </>
  )
}
