'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  updateProfile,
  updateVehicule,
  updateContrat,
  updateStatut,
  addDocument,
  deleteDocument,
  updateEmail,
} from './actions'
import {
  TYPE_VEHICULE_LABEL,
  type StatutChauffeur,
  type TypeContrat,
  type TypeVehicule,
  type TypeDocument,
} from '@/lib/types'

const TYPE_DOC_LABEL: Record<TypeDocument, string> = {
  carte_vtc:      'Carte VTC',
  assurance_rc:   'Assurance RC Pro',
  visite_medicale:'Visite médicale',
  permis:         'Permis de conduire',
}

const DOC_STATUT_STYLE: Record<string, { color: string; bg: string }> = {
  valide:          { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)' },
  bientot_expire:  { color: 'var(--amb)', bg: 'rgba(232,160,48,.12)' },
  expire:          { color: 'var(--red)', bg: 'rgba(217,80,80,.12)' },
}

const STATUT_STYLE: Record<StatutChauffeur, { color: string; bg: string; label: string }> = {
  disponible: { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', label: 'Disponible' },
  en_course:  { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', label: 'En course' },
  hors_ligne: { color: 'var(--t3)',  bg: 'var(--elevated)',      label: 'Hors ligne' },
}

interface Document {
  id: string
  type: TypeDocument
  date_expiration: string
  statut: string
}

interface Props {
  chauffeurId: string
  email?: string
  statut: StatutChauffeur
  profile: { nom: string; prenom: string; telephone: string }
  vehicule: {
    marque: string; modele: string; immatriculation: string; type: TypeVehicule
  }
  typeContrat: TypeContrat
  documents: Document[]
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--gb)',
      borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 16,
    }}>
      <div style={{
        fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
        color: 'var(--t2)', fontWeight: 500,
      }}>{title}</div>
      {children}
    </div>
  )
}

function SaveBtn({ pending, onClick }: { pending: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={pending}
      style={{
        marginTop: 4, padding: '8px 16px', borderRadius: 8,
        background: 'var(--gold)', color: 'var(--base)',
        fontSize: 12, fontWeight: 600, border: 'none', cursor: pending ? 'wait' : 'pointer',
        opacity: pending ? .6 : 1, fontFamily: 'var(--font-dm-sans), sans-serif',
      }}
    >
      {pending ? 'Enregistrement…' : 'Enregistrer'}
    </button>
  )
}

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

function EmailField({ chauffeurId, email }: { chauffeurId: string; email: string }) {
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
      const res = await updateEmail(chauffeurId, value)
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
          <input
            value={value}
            onChange={e => setValue(e.target.value)}
            type="email"
            autoFocus
            style={{
              background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.4)',
              borderRadius: 8, padding: '8px 12px', fontSize: 12, color: 'var(--t1)',
              outline: 'none', fontFamily: 'var(--font-jetbrains, monospace)',
              width: '100%', boxSizing: 'border-box' as const,
            }}
          />
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
            background: copied ? 'rgba(61,184,122,.12)' : 'transparent',
            border: 'none', borderRadius: 4, padding: '3px 6px', cursor: 'pointer',
            fontSize: 10, color: copied ? '#2E9E5E' : 'var(--t3)',
            flexShrink: 0, transition: 'all .15s',
          }}>
            {copied ? '✓' : <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2"/><path strokeLinecap="round" d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>}
          </button>
          <button onClick={() => setEditing(true)} title="Modifier" style={{
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
  fontFamily: 'var(--font-dm-sans), sans-serif',
  outline: 'none', width: '100%', boxSizing: 'border-box',
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: 'pointer',
  appearance: 'none',
}

export default function ChauffeurEditActions({
  chauffeurId,
  email,
  statut: initialStatut,
  profile: initialProfile,
  vehicule: initialVehicule,
  typeContrat: initialContrat,
  documents: initialDocs,
}: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  // Profile state
  const [profile, setProfile] = useState(initialProfile)

  // Vehicule state
  const [vehicule, setVehicule] = useState(initialVehicule)

  // Contrat state
  const [contrat, setContrat] = useState<TypeContrat>(initialContrat)

  // Statut state
  const [statut, setStatut] = useState<StatutChauffeur>(initialStatut)

  // Docs state
  const [docs, setDocs] = useState<Document[]>(initialDocs)
  const [addingDoc, setAddingDoc] = useState(false)
  const [newDoc, setNewDoc] = useState<{ type: TypeDocument; date_expiration: string }>({
    type: 'carte_vtc', date_expiration: '',
  })

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

  const s = STATUT_STYLE[statut]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Statut */}
      <Section title="Statut">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 20, fontWeight: 500,
            color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
          }}>{s.label}</span>
          <div style={{ display: 'flex', gap: 6 }}>
            {statut !== 'disponible' && (
              <button
                disabled={pending}
                onClick={() => {
                  setStatut('disponible')
                  save('statut', () => updateStatut(chauffeurId, 'disponible'))
                }}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                  background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.25)',
                  color: 'var(--grn)', cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >Activer</button>
            )}
            {statut !== 'hors_ligne' && (
              <button
                disabled={pending}
                onClick={() => {
                  setStatut('hors_ligne')
                  save('statut', () => updateStatut(chauffeurId, 'hors_ligne'))
                }}
                style={{
                  padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                  background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
                  color: 'var(--red)', cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >Suspendre</button>
            )}
          </div>
        </div>
        {saved === 'statut' && <div style={{ fontSize: 10, color: 'var(--grn)' }}>✓ Statut mis à jour</div>}
      </Section>

      {/* Informations personnelles */}
      <Section title="Informations personnelles">
        {email && <EmailField chauffeurId={chauffeurId} email={email} />}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Prénom">
            <input
              style={inputStyle}
              value={profile.prenom}
              onChange={e => setProfile(p => ({ ...p, prenom: e.target.value }))}
            />
          </Field>
          <Field label="Nom">
            <input
              style={inputStyle}
              value={profile.nom}
              onChange={e => setProfile(p => ({ ...p, nom: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Téléphone">
          <input
            style={inputStyle}
            value={profile.telephone}
            placeholder="+33 6 00 00 00 00"
            onChange={e => setProfile(p => ({ ...p, telephone: e.target.value }))}
          />
        </Field>
        <SaveBtn pending={pending} onClick={() => save('profile', () => updateProfile(chauffeurId, profile))} />
        {saved === 'profile' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
      </Section>

      {/* Véhicule */}
      <Section title="Véhicule">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Marque">
            <input
              style={inputStyle}
              value={vehicule.marque}
              onChange={e => setVehicule(v => ({ ...v, marque: e.target.value }))}
            />
          </Field>
          <Field label="Modèle">
            <input
              style={inputStyle}
              value={vehicule.modele}
              onChange={e => setVehicule(v => ({ ...v, modele: e.target.value }))}
            />
          </Field>
        </div>
        <Field label="Immatriculation">
          <input
            style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains), monospace', textTransform: 'uppercase' }}
            value={vehicule.immatriculation}
            onChange={e => setVehicule(v => ({ ...v, immatriculation: e.target.value.toUpperCase() }))}
          />
        </Field>
        <Field label="Type">
          <select
            style={selectStyle}
            value={vehicule.type}
            onChange={e => setVehicule(v => ({ ...v, type: e.target.value as TypeVehicule }))}
          >
            {(Object.entries(TYPE_VEHICULE_LABEL) as [TypeVehicule, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <SaveBtn pending={pending} onClick={() => save('vehicule', () => updateVehicule(chauffeurId, {
          vehicule_marque: vehicule.marque,
          vehicule_modele: vehicule.modele,
          vehicule_immatriculation: vehicule.immatriculation,
          type_vehicule: vehicule.type,
        }))} />
        {saved === 'vehicule' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
      </Section>

      {/* Contrat */}
      <Section title="Contrat">
        <Field label="Type de contrat">
          <select
            style={selectStyle}
            value={contrat}
            onChange={e => setContrat(e.target.value as TypeContrat)}
          >
            <option value="salarie">Salarié</option>
            <option value="sous_traitant">Sous-traitant</option>
          </select>
        </Field>
        <SaveBtn pending={pending} onClick={() => save('contrat', () => updateContrat(chauffeurId, contrat))} />
        {saved === 'contrat' && <div style={{ fontSize: 10, color: 'var(--grn)', marginTop: -8 }}>✓ Sauvegardé</div>}
      </Section>

      {/* Documents */}
      <Section title="Documents réglementaires">
        {docs.length === 0 && !addingDoc && (
          <div style={{ fontSize: 12, color: 'var(--t3)' }}>Aucun document enregistré</div>
        )}
        {docs.map(doc => {
          const ds = DOC_STATUT_STYLE[doc.statut] ?? DOC_STATUT_STYLE.valide
          const expiry = new Date(doc.date_expiration)
          return (
            <div key={doc.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 0', borderBottom: '1px solid rgba(201,168,76,.06)',
            }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>
                  {TYPE_DOC_LABEL[doc.type]}
                </div>
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>
                  Expire le {expiry.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{
                  fontSize: 9.5, padding: '2px 8px', borderRadius: 12,
                  color: ds.color, background: ds.bg,
                }}>
                  {doc.statut === 'valide' ? 'Valide' : doc.statut === 'bientot_expire' ? 'Bientôt expiré' : 'Expiré'}
                </span>
                <button
                  disabled={pending}
                  onClick={() => {
                    setDocs(d => d.filter(x => x.id !== doc.id))
                    startTransition(async () => {
                      await deleteDocument(chauffeurId, doc.id)
                      router.refresh()
                    })
                  }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--t3)', fontSize: 14, padding: '0 4px',
                  }}
                  title="Supprimer"
                >×</button>
              </div>
            </div>
          )
        })}

        {addingDoc ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 8 }}>
            <Field label="Type de document">
              <select
                style={selectStyle}
                value={newDoc.type}
                onChange={e => setNewDoc(d => ({ ...d, type: e.target.value as TypeDocument }))}
              >
                {(Object.entries(TYPE_DOC_LABEL) as [TypeDocument, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Date d'expiration">
              <input
                type="date"
                style={inputStyle}
                value={newDoc.date_expiration}
                onChange={e => setNewDoc(d => ({ ...d, date_expiration: e.target.value }))}
              />
            </Field>
            <div style={{ display: 'flex', gap: 8 }}>
              <SaveBtn pending={pending} onClick={() => {
                if (!newDoc.date_expiration) return
                startTransition(async () => {
                  await addDocument(chauffeurId, newDoc)
                  router.refresh()
                  setAddingDoc(false)
                  setNewDoc({ type: 'carte_vtc', date_expiration: '' })
                })
              }} />
              <button
                onClick={() => setAddingDoc(false)}
                style={{
                  marginTop: 4, padding: '8px 16px', borderRadius: 8,
                  background: 'var(--elevated)', color: 'var(--t2)',
                  fontSize: 12, border: '1px solid var(--t3)', cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >Annuler</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAddingDoc(true)}
            style={{
              padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 500,
              background: 'var(--elevated)', border: '1px solid var(--t3)',
              color: 'var(--t2)', cursor: 'pointer', alignSelf: 'flex-start',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >+ Ajouter un document</button>
        )}
      </Section>
    </div>
  )
}
