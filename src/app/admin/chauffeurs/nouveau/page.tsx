'use client'

import { useActionState } from 'react'
import { createChauffeur } from './actions'
import { TYPE_VEHICULE_LABEL } from '@/lib/types'

const inputStyle = {
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, padding: '10px 14px',
  fontSize: 13, color: 'var(--t1)',
  width: '100%', boxSizing: 'border-box' as const,
  outline: 'none',
}

const labelStyle = {
  fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase' as const,
  color: 'var(--t3)', fontWeight: 500, marginBottom: 6, display: 'block',
}

export default function NouveauChauffeurPage() {
  const [state, formAction, pending] = useActionState(createChauffeur, null)

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

          {/* Erreur */}
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
                <label style={labelStyle} htmlFor="email">Email</label>
                <input id="email" name="email" type="email" required style={inputStyle} placeholder="chauffeur@email.com" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="password">Mot de passe initial</label>
                <input id="password" name="password" type="text" required minLength={6} style={inputStyle} placeholder="min. 6 caractères" />
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
                <label style={labelStyle} htmlFor="prenom">Prénom</label>
                <input id="prenom" name="prenom" required style={inputStyle} placeholder="Jean" />
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

          {/* Véhicule */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: 24 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 18, fontWeight: 500 }}>
              Véhicule
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="vehicule_marque">Marque</label>
                <input id="vehicule_marque" name="vehicule_marque" style={inputStyle} placeholder="Mercedes" />
              </div>
              <div>
                <label style={labelStyle} htmlFor="vehicule_modele">Modèle</label>
                <input id="vehicule_modele" name="vehicule_modele" style={inputStyle} placeholder="Classe E" />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
              <div>
                <label style={labelStyle} htmlFor="vehicule_immatriculation">Immatriculation</label>
                <input
                  id="vehicule_immatriculation" name="vehicule_immatriculation"
                  style={{ ...inputStyle, fontFamily: 'var(--font-jetbrains), monospace', textTransform: 'uppercase' }}
                  placeholder="AB-123-CD"
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="type_vehicule">Type de véhicule</label>
                <select
                  id="type_vehicule" name="type_vehicule" required
                  style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as any }}
                >
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
            <div>
              <label style={labelStyle} htmlFor="type_contrat">Type de contrat</label>
              <select
                id="type_contrat" name="type_contrat" required
                style={{ ...inputStyle, cursor: 'pointer', appearance: 'none' as any, maxWidth: 280 }}
              >
                <option value="salarie">Salarié</option>
                <option value="sous_traitant">Sous-traitant</option>
              </select>
            </div>
          </div>

          {/* Submit */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button
              type="submit"
              disabled={pending}
              style={{
                padding: '12px 28px', borderRadius: 10,
                background: pending ? 'var(--elevated)' : 'var(--gold)',
                color: pending ? 'var(--t2)' : 'var(--base)',
                fontSize: 13, fontWeight: 600, border: 'none',
                cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                transition: 'background .15s',
              }}
            >
              {pending ? 'Création en cours…' : 'Créer le compte chauffeur'}
            </button>
            <a
              href="/admin/chauffeurs"
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
