'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateProfile, updateCompte, updateTarifClient, updateEmail, updateFacturationMode } from './actions'

interface Props {
  clientId: string
  email?: string
  profile: { nom: string; prenom: string; telephone: string }
  compte: { type_compte: string; entreprise_nom: string; adresse_facturation: string }
  tarif: { coef_tarifaire: number; paiement_differe: boolean }
  facturationMode: 'mensuelle' | 'par_prestation'
}

function EmailField({ clientId, email }: { clientId: string; email: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue]     = useState(email)
  const [saved, setSaved]     = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const [pending, start]      = useTransition()
  const router                = useRouter()
  const [copied, setCopied]   = useState(false)

  function copy() {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
  }
  function save() {
    if (!value.trim() || !value.includes('@')) { setErr('Email invalide'); return }
    setErr(null)
    start(async () => {
      const res = await updateEmail(clientId, value)
      if (res?.error) { setErr(res.error); return }
      setSaved(true); setEditing(false)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 500 }}>
        Email de connexion
      </div>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={value} onChange={e => setValue(e.target.value)} type="email" autoFocus
            style={{
              background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.4)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t1)',
              outline: 'none', fontFamily: 'var(--font-jetbrains, monospace)',
              width: '100%', boxSizing: 'border-box' as const,
            }} />
          {err && <div style={{ fontSize: 11, color: 'var(--red)' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={save} disabled={pending} style={{
              flex: 1, padding: '7px', borderRadius: 7, border: 'none', cursor: pending ? 'wait' : 'pointer',
              background: '#C9A84C', color: '#09091A', fontSize: 11, fontWeight: 600,
              fontFamily: 'var(--font-dm-sans), sans-serif', opacity: pending ? .6 : 1,
            }}>{pending ? 'Mise à jour…' : 'Enregistrer'}</button>
            <button onClick={() => { setEditing(false); setValue(email); setErr(null) }} style={{
              padding: '7px 12px', borderRadius: 7, border: '1px solid var(--t3)',
              background: 'var(--elevated)', color: 'var(--t2)', fontSize: 11,
              cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>Annuler</button>
          </div>
        </div>
      ) : (
        <div style={{
          display: 'flex', alignItems: 'center',
          background: saved ? 'rgba(61,184,122,.05)' : 'rgba(201,168,76,.05)',
          border: `1px solid ${saved ? 'rgba(61,184,122,.2)' : 'rgba(201,168,76,.18)'}`,
          borderRadius: 8, padding: '8px 10px 8px 12px', gap: 8, transition: 'all .3s',
        }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke={saved ? '#3DB87A' : '#C9A84C'} strokeWidth={1.8} style={{ flexShrink: 0 }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/>
          </svg>
          <span style={{
            flex: 1, fontSize: 12, color: 'var(--t1)', fontFamily: 'var(--font-jetbrains, monospace)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{value}</span>
          {saved && <span style={{ fontSize: 10, color: '#3DB87A', fontWeight: 600, flexShrink: 0 }}>✓ Mis à jour</span>}
          <button onClick={copy} title="Copier" style={{
            background: 'transparent', border: 'none', borderRadius: 4,
            padding: '3px 6px', cursor: 'pointer', fontSize: 10,
            color: copied ? '#2E9E5E' : 'var(--t3)', flexShrink: 0, transition: 'color .15s',
          }}>
            {copied ? '✓' : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path strokeLinecap="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
          </button>
          <button onClick={() => setEditing(true)} style={{
            background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)',
            borderRadius: 5, padding: '3px 8px', cursor: 'pointer',
            fontSize: 10, fontWeight: 600, color: '#C9A84C',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3,
          }}>
            <svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            Modifier
          </button>
        </div>
      )}
    </div>
  )
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

export default function ClientEditActions({ clientId, email, profile: initProfile, compte: initCompte, tarif: initTarif, facturationMode: initFactMode }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()
  const [profile, setProfile] = useState(initProfile)
  const [compte, setCompte] = useState(initCompte)
  const [tarif, setTarif] = useState(initTarif)
  const [factMode, setFactMode] = useState<'mensuelle' | 'par_prestation'>(initFactMode)
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
        {email && <EmailField clientId={clientId} email={email} />}
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

      {/* Facturation — entreprise uniquement */}
      {compte.type_compte === 'entreprise' && (
        <Section title="Facturation">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['mensuelle', 'par_prestation'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setFactMode(mode)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
                  border: `1.5px solid ${factMode === mode ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                  background: factMode === mode ? 'rgba(201,168,76,.06)' : 'transparent',
                  textAlign: 'left', fontFamily: 'var(--font-dm-sans), sans-serif',
                  transition: 'all .15s',
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                  border: `2px solid ${factMode === mode ? 'var(--gold)' : 'var(--t3)'}`,
                  background: factMode === mode ? 'var(--gold)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {factMode === mode && <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--base)' }} />}
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: factMode === mode ? 'var(--gold)' : 'var(--t1)', marginBottom: 2 }}>
                    {mode === 'mensuelle' ? 'Facture mensuelle' : 'Facture par prestation'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.5 }}>
                    {mode === 'mensuelle'
                      ? 'Une facture groupée envoyée le 1er de chaque mois pour toutes les courses du mois précédent.'
                      : 'Une facture générée automatiquement à la fin de chaque course.'}
                  </div>
                </div>
              </button>
            ))}
          </div>
          <button
            disabled={pending}
            onClick={() => save('facturation', () => updateFacturationMode(clientId, factMode))}
            style={{
              marginTop: 2, padding: '8px 16px', borderRadius: 8,
              background: 'var(--gold)', color: 'var(--base)',
              fontSize: 12, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? .6 : 1, fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >{pending ? 'Enregistrement…' : 'Enregistrer'}</button>
          {saved === 'facturation' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
        </Section>
      )}
    </div>
  )
}
