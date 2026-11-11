'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  changerStatutFacture, envoyerFactureParEmail, envoyerLienPaiement, supprimerFacture,
} from './actions'
import Link from 'next/link'

export default function FactureActions({
  factureId,
  numero,
  statut,
  stripePaymentLink,
}: {
  factureId: string
  /** Sert de mot de passe a la suppression : on le retape pour confirmer. */
  numero: string
  statut: 'en_attente' | 'payee' | 'retard'
  stripePaymentLink: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sendMsg, setSendMsg] = useState<string | null>(null)
  // Couleur pilotee par un drapeau, jamais par le texte : comparer le libelle
  // faisait passer tout nouveau message de succes pour une erreur.
  const [sendOk, setSendOk]   = useState(false)
  const [ouvertSuppr, setOuvertSuppr] = useState(false)
  const [saisie, setSaisie]   = useState('')
  const [errSuppr, setErrSuppr] = useState<string | null>(null)

  function run(s: 'payee' | 'retard' | 'en_attente') {
    startTransition(async () => {
      await changerStatutFacture(factureId, s)
      router.refresh()
    })
  }

  function envoyerFacture(destinataire: 'client' | 'moi' = 'client') {
    startTransition(async () => {
      const r = await envoyerFactureParEmail(factureId, destinataire)
      setSendOk(!r.error)
      setSendMsg(r.error ?? (
        destinataire === 'moi'
          ? `Exemplaire envoyé à ${r.envoyeA} — le client n’a rien reçu`
          : `Facture envoyée à ${r.envoyeA}`
      ))
      setTimeout(() => setSendMsg(null), 10000)
    })
  }

  function envoyerLien() {
    startTransition(async () => {
      const result = await envoyerLienPaiement(factureId)
      setSendOk(!result.error)
      setSendMsg(result.error ?? 'Email envoyé !')
      setTimeout(() => setSendMsg(null), 8000)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Menait a window.print() sur CET ecran : on imprimait le tableau de
          bord — barre laterale, boutons, bandeau cookies — et pas la facture.
          Le document se trouve sur sa propre page, mis en forme pour le
          papier. Signale par l'exploitant le 2026-10-16. */}
      <Link
        href={`/admin/facturation/${factureId}/document`}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '9px 16px', borderRadius: 9,
          background: 'var(--elevated)', border: '1px solid var(--t3)',
          color: 'var(--t2)', fontSize: 12, fontWeight: 500,
          textDecoration: 'none', fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h4m-4 4h4"/>
        </svg>
        Voir la facture / PDF
      </Link>

      {/* Toujours disponible, réglée ou non : c'est le document que le client
          attend. Le lien de paiement, lui, n'a de sens que si elle est impayée. */}
      {/* RELIRE AVANT D ENVOYER.

          L'exploitant, le 2026-11-09 : « pouvoir les envoyer vers une
          messagerie avant, la messagerie de l'entreprise, pour les checker
          avant de les envoyer au client ». Le devis avait un écran de
          brouillon depuis le 2026-11-02 ; la facture, elle, partait au client
          dès le premier clic, sans rien montrer.

          L'exemplaire est le message EXACT que le client recevrait, pièce
          jointe comprise : seul le sujet est préfixé. Valider un message et
          en expédier un autre n'aurait servi à rien. */}
      <button
        onClick={() => envoyerFacture('moi')}
        disabled={pending}
        style={{
          width: '100%', padding: '11px',
          borderRadius: 8,
          background: 'var(--gm)', border: '1px solid var(--gb)',
          color: 'var(--gold)', fontSize: 12, fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? .6 : 1,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        M’envoyer un exemplaire pour relecture
      </button>

      <button
        onClick={() => envoyerFacture('client')}
        disabled={pending}
        style={{
          width: '100%', padding: '12px',
          borderRadius: 8,
          background: 'var(--gold)', border: 'none',
          color: 'var(--base)', fontSize: 12, fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          opacity: pending ? .6 : 1,
          fontFamily: 'var(--font-dm-sans), sans-serif',
        }}
      >
        Envoyer la facture au client
      </button>

      {stripePaymentLink && statut !== 'payee' && (
        <button
          onClick={envoyerLien}
          disabled={pending}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 8,
            background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.25)',
            color: 'var(--gold)', fontSize: 12, fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1,
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Envoyer lien de paiement
        </button>
      )}

      {stripePaymentLink && (
        <a
          href={stripePaymentLink}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'block', width: '100%', padding: '8px',
            borderRadius: 8, textAlign: 'center',
            border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 11,
            textDecoration: 'none',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxSizing: 'border-box',
          }}
        >
          Voir lien Stripe ↗
        </a>
      )}

      {sendMsg && (
        <p style={{
          margin: 0, fontSize: 11, textAlign: 'center',
          color: sendOk ? 'var(--grn)' : 'var(--red)',
        }}>
          {sendMsg}
        </p>
      )}

      {statut !== 'payee' && (
        <button
          onClick={() => run('payee')}
          disabled={pending}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 8, border: 'none',
            background: 'var(--grn)', color: 'var(--base)',
            fontSize: 12, fontWeight: 600,
            cursor: pending ? 'wait' : 'pointer',
            opacity: pending ? .6 : 1,
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          ✓ Marquer payée
        </button>
      )}
      {statut === 'payee' && (
        <button
          onClick={() => run('en_attente')}
          disabled={pending}
          style={{
            width: '100%', padding: '12px',
            borderRadius: 8,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 12, fontWeight: 500,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Remettre en attente
        </button>
      )}
      {statut === 'en_attente' && (
        <button
          onClick={() => run('retard')}
          disabled={pending}
          style={{
            width: '100%', padding: '10px',
            borderRadius: 8,
            background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
            color: 'var(--red)', fontSize: 11,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Marquer en retard
        </button>
      )}
      {statut === 'retard' && (
        <button
          onClick={() => run('en_attente')}
          disabled={pending}
          style={{
            width: '100%', padding: '10px',
            borderRadius: 8,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 11,
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          Remettre en attente
        </button>
      )}

      {/* ── SUPPRIMER UNE FACTURE CREEE PAR ERREUR ───────────────────

          On ne supprime pas une facture emise : on emet un avoir. C'est
          pour cela que ce bouton n'existait pas, et c'etait un bon
          reflexe. Mais des factures se creent par erreur, et le
          2026-11-09 trois factures d essai plus un doublon pose sur le
          dossier d un VRAI client ne pouvaient s enlever par aucun chemin
          de l application.

          L'action refuse toute facture qui couvre des courses. Le numero
          se retape, comme pour la suppression d un client. */}
      <div style={{ marginTop: 6, paddingTop: 10, borderTop: '1px solid var(--gb)' }}>
        {!ouvertSuppr ? (
          <button
            onClick={() => { setOuvertSuppr(true); setErrSuppr(null) }}
            disabled={pending}
            style={{
              width: '100%', padding: '9px', borderRadius: 8,
              background: 'transparent', border: '1px solid rgba(217,84,84,.25)',
              color: 'var(--red)', fontSize: 11,
              cursor: pending ? 'wait' : 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Supprimer cette facture
          </button>
        ) : (
          <div>
            <div style={{ fontSize: 11, color: 'var(--t2)', lineHeight: 1.6, marginBottom: 8 }}>
              À réserver aux factures créées par erreur et jamais transmises.
              La numérotation gardera un trou.
            </div>
            <div style={{ fontSize: 10.5, color: 'var(--t3)', marginBottom: 6 }}>
              Tapez{' '}
              <span style={{ color: 'var(--red)', fontFamily: 'var(--font-jetbrains), monospace' }}>{numero}</span>
              {' '}pour confirmer
            </div>
            <input
              autoFocus
              value={saisie}
              onChange={e => setSaisie(e.target.value)}
              placeholder={numero}
              style={{
                width: '100%', boxSizing: 'border-box', background: 'var(--elevated)',
                border: '1px solid var(--t3)', borderRadius: 8, padding: '8px 11px',
                fontSize: 12, color: 'var(--t1)', outline: 'none', marginBottom: 8,
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                disabled={saisie !== numero || pending}
                onClick={() => startTransition(async () => {
                  const r = await supprimerFacture(factureId)
                  if (r.error) { setErrSuppr(r.error); return }
                  router.push('/admin/facturation')
                })}
                style={{
                  flex: 1, padding: '9px', borderRadius: 8, border: 'none',
                  background: saisie === numero ? 'var(--red)' : 'rgba(217,84,84,.15)',
                  color: saisie === numero ? '#fff' : 'rgba(217,84,84,.4)',
                  fontSize: 11, fontWeight: 600,
                  cursor: saisie === numero && !pending ? 'pointer' : 'not-allowed',
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >
                {pending ? 'Suppression…' : 'Supprimer'}
              </button>
              <button
                onClick={() => { setOuvertSuppr(false); setSaisie(''); setErrSuppr(null) }}
                style={{
                  padding: '9px 12px', borderRadius: 8, border: '1px solid var(--gb)',
                  background: 'transparent', color: 'var(--t2)', fontSize: 11,
                  cursor: 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >
                Annuler
              </button>
            </div>
            {errSuppr && (
              <div style={{ marginTop: 8, fontSize: 11, color: 'var(--red)', lineHeight: 1.5 }}>
                {errSuppr}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
