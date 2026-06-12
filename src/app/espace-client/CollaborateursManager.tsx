'use client'

import { useState, useTransition } from 'react'
import { ajouterCollaborateur, modifierCollaborateur, supprimerCollaborateur } from './actions-collabs'

type Collab = {
  id: string
  nom: string | null
  prenom: string | null
  tel: string | null
  email: string | null
  poste: string | null
  adresse: string | null
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--elevated)', border: '1px solid var(--gb)',
  borderRadius: 8, color: 'var(--t1)', fontSize: 12,
  fontFamily: 'var(--font-dm-sans), sans-serif',
  outline: 'none', boxSizing: 'border-box',
}
const lbl: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'var(--t3)', display: 'block', marginBottom: 5,
}

function CollabForm({
  initial,
  onSave,
  onCancel,
  pending,
  label,
}: {
  initial?: Partial<Collab>
  onSave: (fd: FormData) => void
  onCancel: () => void
  pending: boolean
  label: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lbl}>Prénom *</label>
          <input name="prenom" required defaultValue={initial?.prenom ?? ''} placeholder="Jean" style={inp} />
        </div>
        <div>
          <label style={lbl}>Nom *</label>
          <input name="nom" required defaultValue={initial?.nom ?? ''} placeholder="Dupont" style={inp} />
        </div>
        <div>
          <label style={lbl}>Téléphone</label>
          <input name="tel" type="tel" defaultValue={initial?.tel ?? ''} placeholder="06 00 00 00 00" style={inp} />
        </div>
        <div>
          <label style={lbl}>Email</label>
          <input name="email" type="email" defaultValue={initial?.email ?? ''} placeholder="jean@entreprise.fr" style={inp} />
        </div>
        <div>
          <label style={lbl}>Poste / fonction</label>
          <input name="poste" defaultValue={initial?.poste ?? ''} placeholder="Directeur commercial" style={inp} />
        </div>
        <div>
          <label style={lbl}>Adresse personnelle</label>
          <input name="adresse" defaultValue={initial?.adresse ?? ''} placeholder="12 rue des Lilas, Paris" style={inp} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button type="button" onClick={onCancel} style={{
          padding: '7px 14px', borderRadius: 8, border: '1px solid var(--gb)',
          background: 'transparent', color: 'var(--t2)', fontSize: 12, cursor: 'pointer',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>Annuler</button>
        <button type="submit" disabled={pending} style={{
          padding: '7px 16px', borderRadius: 8, border: 'none',
          background: 'var(--gold)', color: '#0A0A0A',
          fontSize: 12, fontWeight: 600, cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? .6 : 1,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>{pending ? '...' : label}</button>
      </div>
    </div>
  )
}

export default function CollaborateursManager({ collaborateurs }: { collaborateurs: Collab[] }) {
  const [showAdd, setShowAdd]   = useState(false)
  const [editId, setEditId]     = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleAjouter(fd: FormData) {
    startTransition(async () => {
      await ajouterCollaborateur(fd)
      setShowAdd(false)
    })
  }

  function handleModifier(id: string, fd: FormData) {
    startTransition(async () => {
      await modifierCollaborateur(id, fd)
      setEditId(null)
    })
  }

  function handleSupprimer(id: string) {
    if (!confirm('Supprimer ce collaborateur ?')) return
    startTransition(async () => { await supprimerCollaborateur(id) })
  }

  const nomComplet = (c: Collab) => `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || '—'
  const initiales  = (c: Collab) => `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase() || '?'

  return (
    <div>
      {/* En-tête */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
          Mon équipe
        </div>
        <button onClick={() => { setShowAdd(v => !v); setEditId(null) }} style={{
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '5px 12px', borderRadius: 7,
          border: '1px solid rgba(201,168,76,.3)',
          background: showAdd ? 'rgba(201,168,76,.08)' : 'transparent',
          color: 'var(--gold)', fontSize: 11, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}>
          <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            {showAdd
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              : <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
            }
          </svg>
          {showAdd ? 'Annuler' : 'Ajouter'}
        </button>
      </div>

      {/* Formulaire d'ajout */}
      {showAdd && (
        <div style={{
          background: 'var(--surface)', border: '1px solid rgba(201,168,76,.18)',
          borderRadius: 12, padding: '18px 20px', marginBottom: 10,
        }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--t1)', marginBottom: 14 }}>Nouveau collaborateur</div>
          <form action={handleAjouter}>
            <CollabForm onSave={() => {}} onCancel={() => setShowAdd(false)} pending={pending} label="Enregistrer" />
          </form>
        </div>
      )}

      {/* Liste vide */}
      {collaborateurs.length === 0 && !showAdd && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--gb)',
          borderRadius: 12, padding: '28px 20px', textAlign: 'center',
        }}>
          <div style={{ fontSize: 12, color: 'var(--t3)', marginBottom: 4 }}>Aucun collaborateur enregistré.</div>
          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
            Ajoutez les contacts de votre équipe pour les identifier rapidement lors d&apos;une réservation.
          </div>
        </div>
      )}

      {/* Cartes collaborateurs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {collaborateurs.map(c => (
          <div key={c.id} style={{
            background: 'var(--surface)', border: `1px solid ${editId === c.id ? 'rgba(201,168,76,.25)' : 'var(--gb)'}`,
            borderRadius: 12, overflow: 'hidden',
          }}>
            {/* Ligne résumé */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr auto',
              alignItems: 'center', gap: 12, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-cormorant), serif',
                  fontSize: 15, fontWeight: 600, color: 'var(--gold)',
                }}>{initiales(c)}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>
                    {nomComplet(c)}
                    {c.poste && <span style={{ fontSize: 10, color: 'var(--t3)', fontWeight: 400, marginLeft: 8 }}>{c.poste}</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 12, marginTop: 2, flexWrap: 'wrap' }}>
                    {c.tel && <a href={`tel:${c.tel}`} style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none' }}>{c.tel}</a>}
                    {c.email && <span style={{ fontSize: 11, color: 'var(--t2)' }}>{c.email}</span>}
                    {c.adresse && <span style={{ fontSize: 11, color: 'var(--t3)' }}>{c.adresse}</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setEditId(editId === c.id ? null : c.id)} title="Modifier" style={{
                  width: 30, height: 30, borderRadius: 7,
                  background: editId === c.id ? 'rgba(201,168,76,.08)' : 'transparent',
                  border: `1px solid ${editId === c.id ? 'rgba(201,168,76,.3)' : 'var(--gb)'}`,
                  color: editId === c.id ? 'var(--gold)' : 'var(--t3)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"/>
                  </svg>
                </button>
                <button onClick={() => handleSupprimer(c.id)} disabled={pending} title="Supprimer" style={{
                  width: 30, height: 30, borderRadius: 7, border: '1px solid var(--gb)',
                  background: 'transparent', color: 'var(--t3)',
                  cursor: pending ? 'wait' : 'pointer', opacity: pending ? .5 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                  </svg>
                </button>
              </div>
            </div>

            {/* Formulaire d'édition inline */}
            {editId === c.id && (
              <div style={{
                borderTop: '1px solid rgba(201,168,76,.1)',
                padding: '16px 18px',
                background: 'rgba(201,168,76,.02)',
              }}>
                <form action={(fd) => handleModifier(c.id, fd)}>
                  <CollabForm
                    initial={c}
                    onSave={() => {}}
                    onCancel={() => setEditId(null)}
                    pending={pending}
                    label="Sauvegarder"
                  />
                </form>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
