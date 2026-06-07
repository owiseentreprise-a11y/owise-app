'use client'

import { useActionState, useState } from 'react'
import { createChauffeur } from './actions'
import { TYPE_VEHICULE_LABEL } from '@/lib/types'

const inp: React.CSSProperties = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '10px 14px',
  fontSize: 13, color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box',
  outline: 'none', fontFamily: 'var(--font-dm-sans), sans-serif',
}
const sel: React.CSSProperties = {
  ...inp, appearance: 'none', cursor: 'pointer',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%23848499' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
}
const lbl: React.CSSProperties = {
  fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'var(--t3)', fontWeight: 500, marginBottom: 6, display: 'block',
}

export default function NouveauChauffeurForm({
  sousTraitants,
}: {
  sousTraitants: Array<{ id: string; nom: string }>
}) {
  const [state, formAction, pending] = useActionState(createChauffeur, null)
  const [typeContrat, setTypeContrat] = useState('salarie')

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
        <a href="/admin/chauffeurs" style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Chauffeurs
        </a>
        <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>Nouveau chauffeur</span>
      </div>

      <div style={{ padding: '32px', maxWidth: 720 }}>
        <form action={formAction} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {state?.error && (
            <div style={{
              padding: '12px 16px', borderRadius: 10,
              background: 'rgba(217,84,84,.12)', border: '1px solid rgba(217,84,84,.25)',
              color: '#D95454', fontSize: 13, fontWeight: 500,
            }}>
              ⚠️ {state.error}
            </div>
          )}

          {/* Compte */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 18, fontWeight: 500 }}>
              Compte
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Email</label>
                <input name="email" type="email" required style={inp} placeholder="chauffeur@email.com" />
              </div>
              <div>
                <label style={lbl}>Mot de passe initial</label>
                <input name="password" type="text" required minLength={6} style={inp} placeholder="min. 6 caractères" />
              </div>
            </div>
          </div>

          {/* Identité */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 18, fontWeight: 500 }}>
              Informations personnelles
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Prénom</label>
                <input name="prenom" required style={inp} placeholder="Jean" />
              </div>
              <div>
                <label style={lbl}>Nom</label>
                <input name="nom" required style={inp} placeholder="Dupont" />
              </div>
            </div>
            <div style={{ marginTop: 16 }}>
              <label style={lbl}>Téléphone</label>
              <input name="telephone" style={inp} placeholder="+33 6 00 00 00 00" />
            </div>
          </div>

          {/* Véhicule */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 18, fontWeight: 500 }}>
              Véhicule
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Marque</label>
                <input name="vehicule_marque" style={inp} placeholder="Mercedes" />
              </div>
              <div>
                <label style={lbl}>Modèle</label>
                <input name="vehicule_modele" style={inp} placeholder="Classe E" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label style={lbl}>Immatriculation</label>
                <input
                  name="vehicule_immatriculation"
                  style={{ ...inp, fontFamily: 'var(--font-jetbrains), monospace', textTransform: 'uppercase' }}
                  placeholder="AB-123-CD"
                />
              </div>
              <div>
                <label style={lbl}>Type de véhicule</label>
                <select name="type_vehicule" required style={sel}>
                  {(Object.entries(TYPE_VEHICULE_LABEL) as [string, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Contrat */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 18, fontWeight: 500 }}>
              Contrat
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: typeContrat === 'sous_traitant' ? '1fr 1fr' : '1fr', gap: 16 }}>
              <div>
                <label style={lbl}>Type de contrat</label>
                <select
                  name="type_contrat" required style={sel}
                  value={typeContrat}
                  onChange={e => setTypeContrat(e.target.value)}
                >
                  <option value="salarie">Salarié</option>
                  <option value="sous_traitant">Sous-traitant</option>
                </select>
              </div>

              {typeContrat === 'sous_traitant' && (
                <div>
                  <label style={lbl}>Société sous-traitante</label>
                  {sousTraitants.length > 0 ? (
                    <select name="sous_traitant_id" style={sel}>
                      <option value="">— Non rattaché —</option>
                      {sousTraitants.map(st => (
                        <option key={st.id} value={st.id}>{st.nom}</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: 'rgba(232,160,48,.06)', border: '1px solid rgba(232,160,48,.2)',
                      fontSize: 12, color: 'var(--amb)',
                    }}>
                      Aucune société enregistrée —{' '}
                      <a href="/admin/sous-traitants/nouveau" style={{ color: 'var(--gold)', textDecoration: 'none' }}>
                        Créer une société
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {typeContrat === 'sous_traitant' && (
              <div style={{
                marginTop: 14, padding: '10px 14px', borderRadius: 8,
                background: 'rgba(77,142,212,.06)', border: '1px solid rgba(77,142,212,.2)',
                fontSize: 11, color: 'var(--blue)', lineHeight: 1.5,
              }}>
                Ce chauffeur sera rattaché à la société sélectionnée. Il apparaîtra dans la liste de ses chauffeurs et ses courses seront incluses dans les factures de la société.
              </div>
            )}
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="submit" disabled={pending}
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: pending ? 'var(--elevated)' : 'var(--gold)',
                color: pending ? 'var(--t2)' : 'var(--base)',
                fontSize: 13, fontWeight: 600, border: 'none',
                cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              {pending ? 'Création en cours…' : 'Créer le compte chauffeur'}
            </button>
            <a href="/admin/chauffeurs" style={{
              padding: '12px 20px', borderRadius: 10,
              background: 'var(--elevated)', color: 'var(--t2)',
              fontSize: 13, border: '1px solid var(--t3)',
              textDecoration: 'none', display: 'flex', alignItems: 'center',
            }}>Annuler</a>
          </div>
        </form>
      </div>
    </>
  )
}
