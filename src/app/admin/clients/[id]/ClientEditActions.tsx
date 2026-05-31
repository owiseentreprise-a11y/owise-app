'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile, updateCompte, updateTarifClient } from './actions'

interface Props {
  clientId: string
  profile: { nom: string; prenom: string; telephone: string }
  compte: { type_compte: string; entreprise_nom: string; adresse_facturation: string }
  tarif: { coef_tarifaire: number; paiement_differe: boolean }
}

const inputStyle: React.CSSProperties = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '8px 12px',
  fontSize: 13, color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box', outline: 'none',
  fontFamily: 'var(--font-dm-sans), sans-serif',
}

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer', appearance: 'none' }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 500 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--gb)',
      borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

export default function ClientEditActions({ clientId, profile: initProfile, compte: initCompte, tarif: initTarif }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [profile, setProfile] = useState(initProfile)
  const [compte, setCompte] = useState(initCompte)
  const [tarif, setTarif] = useState(initTarif)
  const [saved, setSaved] = useState<string | null>(null)

  function flash(key: string) {
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  function save(key: string, fn: () => Promise<void>) {
    startTransition(async () => {
      await fn()
      router.refresh()
      flash(key)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Informations personnelles */}
      <Section title="Informations personnelles">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Prénom">
            <input style={inputStyle} value={profile.prenom}
              onChange={e => setProfile(p => ({ ...p, prenom: e.target.value }))} />
          </Field>
          <Field label="Nom">
            <input style={inputStyle} value={profile.nom}
              onChange={e => setProfile(p => ({ ...p, nom: e.target.value }))} />
          </Field>
        </div>
        <Field label="Téléphone">
          <input style={inputStyle} value={profile.telephone} placeholder="+33 6 00 00 00 00"
            onChange={e => setProfile(p => ({ ...p, telephone: e.target.value }))} />
        </Field>
        <button
          disabled={pending}
          onClick={() => save('profile', () => updateProfile(clientId, profile))}
          style={{
            marginTop: 2, padding: '8px 16px', borderRadius: 8,
            background: 'var(--gold)', color: 'var(--base)',
            fontSize: 12, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1, fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {saved === 'profile' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
      </Section>

      {/* Compte */}
      <Section title="Compte">
        <Field label="Type de compte">
          <select style={selectStyle} value={compte.type_compte}
            onChange={e => setCompte(c => ({ ...c, type_compte: e.target.value }))}>
            <option value="particulier">Particulier</option>
            <option value="entreprise">Entreprise</option>
          </select>
        </Field>
        {compte.type_compte === 'entreprise' && (
          <Field label="Nom de l'entreprise">
            <input style={inputStyle} value={compte.entreprise_nom}
              onChange={e => setCompte(c => ({ ...c, entreprise_nom: e.target.value }))} />
          </Field>
        )}
        <Field label="Adresse de facturation">
          <input style={inputStyle} value={compte.adresse_facturation}
            placeholder="15 rue de la Paix, 75001 Paris"
            onChange={e => setCompte(c => ({ ...c, adresse_facturation: e.target.value }))} />
        </Field>
        <button
          disabled={pending}
          onClick={() => save('compte', () => updateCompte(clientId, compte))}
          style={{
            marginTop: 2, padding: '8px 16px', borderRadius: 8,
            background: 'var(--gold)', color: 'var(--base)',
            fontSize: 12, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1, fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {saved === 'compte' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
      </Section>

      {/* Tarification */}
      <Section title="Tarification">
        <Field label="Coefficient tarifaire">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="number" step="0.05" min="0.5" max="3"
              style={{ ...inputStyle, width: 90 }}
              value={tarif.coef_tarifaire}
              onChange={e => setTarif(t => ({ ...t, coef_tarifaire: parseFloat(e.target.value) || 1 }))}
            />
            <span style={{ fontSize: 11, color: 'var(--t3)' }}>
              {tarif.coef_tarifaire === 1 ? 'tarif standard' : tarif.coef_tarifaire < 1
                ? `−${Math.round((1 - tarif.coef_tarifaire) * 100)} %`
                : `+${Math.round((tarif.coef_tarifaire - 1) * 100)} %`}
            </span>
          </div>
        </Field>
        <Field label="Paiement différé">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => setTarif(t => ({ ...t, paiement_differe: !t.paiement_differe }))}
              style={{
                width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                background: tarif.paiement_differe ? 'var(--grn)' : 'var(--elevated)',
                transition: 'background .2s', position: 'relative', flexShrink: 0,
              }}
            >
              <span style={{
                position: 'absolute', top: 3,
                left: tarif.paiement_differe ? 23 : 3,
                width: 18, height: 18, borderRadius: '50%',
                background: tarif.paiement_differe ? '#fff' : 'var(--t3)',
                transition: 'left .2s',
              }} />
            </button>
            <span style={{ fontSize: 12, color: tarif.paiement_differe ? 'var(--grn)' : 'var(--t3)' }}>
              {tarif.paiement_differe ? 'Autorisé (cash / chèque / virement)' : 'Paiement en ligne uniquement'}
            </span>
          </div>
        </Field>
        <button
          disabled={pending}
          onClick={() => save('tarif', () => updateTarifClient(clientId, tarif))}
          style={{
            marginTop: 2, padding: '8px 16px', borderRadius: 8,
            background: 'var(--gold)', color: 'var(--base)',
            fontSize: 12, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1, fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
        {saved === 'tarif' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
      </Section>
    </div>
  )
}
