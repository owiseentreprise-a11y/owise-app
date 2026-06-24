'use client'

import { useState, useTransition } from 'react'
import { sauvegarderParametres } from './actions'

type Parametres = {
  societe_nom: string | null
  societe_siret: string | null
  societe_tva_numero: string | null
  societe_naf: string | null
  societe_adresse: string | null
  societe_code_postal: string | null
  societe_ville: string | null
  societe_telephone: string | null
  societe_email: string | null
  facture_prefixe: string | null
  facture_taux_tva: number | null
  facture_delai_paiement: number | null
  facture_mentions: string | null
  banque_iban: string | null
  banque_bic: string | null
  banque_nom: string | null
}

const input: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, color: 'var(--t1)', fontSize: 13,
  fontFamily: 'var(--font-dm-sans), sans-serif',
  outline: 'none', boxSizing: 'border-box',
}

const label: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '.14em',
  textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 6,
}

const section: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--gb)',
  borderRadius: 14, padding: '24px 28px',
}

const sectionTitle: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase',
  color: 'var(--t2)', fontWeight: 500, marginBottom: 20,
  paddingBottom: 12, borderBottom: '1px solid rgba(201,168,76,.07)',
}

function Field({ name, label: lbl, value, placeholder, mono }: {
  name: string; label: string; value: string | null; placeholder?: string; mono?: boolean
}) {
  return (
    <div>
      <label style={label}>{lbl}</label>
      <input
        name={name}
        defaultValue={value ?? ''}
        placeholder={placeholder}
        style={{ ...input, fontFamily: mono ? 'var(--font-jetbrains), monospace' : 'var(--font-dm-sans), sans-serif' }}
      />
    </div>
  )
}

export default function ParametresForm({ data }: { data: Parametres }) {
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaved(false)
    setError(null)
    const fd = new FormData(e.currentTarget)
    startTransition(async () => {
      const res = await sauvegarderParametres(fd)
      if (res.error) setError(res.error)
      else setSaved(true)
    })
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Société */}
      <div style={section}>
        <div style={sectionTitle}>Informations société</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <Field name="societe_nom" label="Nom de la société" value={data.societe_nom} placeholder="Owise" />
            <Field name="societe_email" label="Email" value={data.societe_email} placeholder="contact@owise.fr" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <Field name="societe_siret" label="SIRET" value={data.societe_siret} placeholder="123 456 789 00012" mono />
            <Field name="societe_tva_numero" label="N° TVA intracommunautaire" value={data.societe_tva_numero} placeholder="FR 12 345678901" mono />
            <Field name="societe_naf" label="Code NAF / APE" value={data.societe_naf} placeholder="4932Z" mono />
          </div>
          <Field name="societe_adresse" label="Adresse" value={data.societe_adresse} placeholder="15 rue de la Paix" />
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 14 }}>
            <Field name="societe_code_postal" label="Code postal" value={data.societe_code_postal} placeholder="75001" mono />
            <Field name="societe_ville" label="Ville" value={data.societe_ville} placeholder="Paris" />
          </div>
          <Field name="societe_telephone" label="Téléphone" value={data.societe_telephone} placeholder="+33 1 23 45 67 89" mono />
        </div>
      </div>

      {/* Facturation */}
      <div style={section}>
        <div style={sectionTitle}>Paramètres de facturation</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '160px 160px 1fr', gap: 14 }}>
            <div>
              <label style={label}>Préfixe facture</label>
              <input
                name="facture_prefixe"
                defaultValue={data.facture_prefixe ?? 'OW-'}
                placeholder="OW-"
                style={{ ...input, fontFamily: 'var(--font-jetbrains), monospace' }}
              />
            </div>
            <div>
              <label style={label}>Taux TVA</label>
              <select
                name="facture_taux_tva"
                defaultValue={String(data.facture_taux_tva ?? 0)}
                style={{ ...input, fontFamily: 'var(--font-jetbrains), monospace' }}
              >
                <option value="0">0% — Franchise en base (auto-entrepreneur)</option>
                <option value="10">10%</option>
                <option value="20">20%</option>
              </select>
            </div>
            <div>
              <label style={label}>Délai de paiement (jours)</label>
              <input
                name="facture_delai_paiement"
                type="number"
                min={0}
                defaultValue={data.facture_delai_paiement ?? 30}
                style={{ ...input, fontFamily: 'var(--font-jetbrains), monospace' }}
              />
            </div>
          </div>
          <div>
            <label style={label}>Mentions légales (bas de facture)</label>
            <textarea
              name="facture_mentions"
              defaultValue={data.facture_mentions ?? ''}
              rows={4}
              placeholder="En cas de retard de paiement, une pénalité de 3 fois le taux légal sera appliquée..."
              style={{
                ...input, resize: 'vertical', height: 'auto',
                paddingTop: 10, paddingBottom: 10, lineHeight: 1.5,
              }}
            />
          </div>
        </div>
      </div>

      {/* Banque */}
      <div style={section}>
        <div style={sectionTitle}>Coordonnées bancaires</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field name="banque_nom" label="Banque" value={data.banque_nom} placeholder="BNP Paribas" />
          <Field name="banque_iban" label="IBAN" value={data.banque_iban} placeholder="FR76 3000 4028 3700 0100 0000 943" mono />
          <Field name="banque_bic" label="BIC / SWIFT" value={data.banque_bic} placeholder="BNPAFRPPXXX" mono />
        </div>
      </div>

      {/* Feedback + submit */}
      {error && (
        <div style={{
          padding: '10px 16px', borderRadius: 8,
          background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.2)',
          color: 'var(--red)', fontSize: 12,
        }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{
          padding: '10px 16px', borderRadius: 8,
          background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.2)',
          color: 'var(--grn)', fontSize: 12,
        }}>
          ✓ Paramètres sauvegardés
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending}
          style={{
            padding: '12px 28px', borderRadius: 10,
            background: 'var(--gold)', border: 'none',
            color: 'var(--base)', fontSize: 13, fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxShadow: '0 4px 16px rgba(201,168,76,.25)',
          }}
        >
          {pending ? 'Sauvegarde…' : 'Sauvegarder'}
        </button>
      </div>
    </form>
  )
}
