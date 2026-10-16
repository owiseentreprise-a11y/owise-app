'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { changerStatutFacture, envoyerLienPaiement, envoyerFactureParEmail } from './actions'
import Link from 'next/link'

export default function FactureActions({
  factureId,
  statut,
  stripePaymentLink,
}: {
  factureId: string
  statut: 'en_attente' | 'payee' | 'retard'
  stripePaymentLink: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sendMsg, setSendMsg] = useState<string | null>(null)
  // Couleur pilotee par un drapeau, jamais par le texte : comparer le libelle
  // faisait passer tout nouveau message de succes pour une erreur.
  const [sendOk, setSendOk]   = useState(false)

  function run(s: 'payee' | 'retard' | 'en_attente') {
    startTransition(async () => {
      await changerStatutFacture(factureId, s)
      router.refresh()
    })
  }

  function envoyerFacture() {
    startTransition(async () => {
      const r = await envoyerFactureParEmail(factureId)
      setSendOk(!r.error)
      setSendMsg(r.error ?? `Facture envoyée à ${r.envoyeA}`)
      setTimeout(() => setSendMsg(null), 8000)
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
      <button
        onClick={envoyerFacture}
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
        Envoyer la facture par e-mail
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
    </div>
  )
}
