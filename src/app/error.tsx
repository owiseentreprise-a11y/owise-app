'use client'

import { useEffect } from 'react'
import { IDENTITE_OWISE } from '@/lib/identite-owise'
import { telephoneLisible } from '@/lib/devis-et-tarifs'

/**
 * Ce qu'un VISITEUR voit quand une page du site ne se charge pas.
 *
 * Avant le 2026-11-09, il n'existait aucune page d'erreur : Next.js affichait
 * son écran noir anglophone « This page couldn't load — A server error
 * occurred », avec un numéro et rien d'autre. Pour un client qui cherche un
 * chauffeur, c'est une réservation perdue et une mauvaise impression.
 *
 * Trois choses, et pas une de plus :
 *   1. le dire en français, sans jargon, sans accuser le visiteur ;
 *   2. proposer de réessayer, puis de revenir à l'accueil ;
 *   3. donner le TÉLÉPHONE et l'E-MAIL. C'est le point qui compte : une page
 *      cassée ne doit pas couper le seul lien commercial. Un client qui
 *      appelle vaut mieux qu'un client qui s'en va.
 *
 * Le numéro de référence est affiché discrètement : il ne sert qu'au dépannage
 * et n'a aucun sens pour un visiteur.
 *
 * En public, Owise ne se présente qu'avec : Owise, l'e-mail, le téléphone et
 * le SIRET. Ni nom d'exploitant, ni adresse — voir `identite-owise.ts`.
 */
export default function ErreurPublique({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ERREUR PAGE PUBLIQUE]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.slice(0, 1200),
    })
  }, [error])

  const bouton = {
    padding: '12px 22px', borderRadius: 10, fontSize: 13.5, fontWeight: 600,
    cursor: 'pointer', textDecoration: 'none', display: 'inline-block',
    border: '1px solid transparent',
  } as const

  return (
    <main style={{
      minHeight: '100dvh', background: '#07071a', color: '#EDE8DF',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{ maxWidth: 520, width: '100%', textAlign: 'center' }}>
        <div style={{
          fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
          color: '#C9A84C', fontWeight: 600, marginBottom: 18,
        }}>
          Owise · Chauffeur privé
        </div>

        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 30, lineHeight: 1.2,
          margin: '0 0 16px', color: '#EDE8DF', fontWeight: 400,
        }}>
          Cette page n’a pas pu s’afficher
        </h1>

        <p style={{ fontSize: 14.5, lineHeight: 1.7, color: '#9A9AB4', margin: '0 0 28px' }}>
          Une panne momentanée de notre côté — rien à voir avec vous.
          Réessayez dans un instant.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginBottom: 32 }}>
          <button onClick={reset} style={{ ...bouton, background: '#C9A84C', color: '#07071a' }}>
            Réessayer
          </button>
          <a href="/" style={{ ...bouton, background: 'transparent', color: '#EDE8DF', border: '1px solid rgba(201,168,76,.3)' }}>
            Retour à l’accueil
          </a>
        </div>

        {/* Le lien commercial, qui ne doit jamais être coupé par une panne. */}
        <div style={{
          borderTop: '1px solid rgba(201,168,76,.16)', paddingTop: 22,
          fontSize: 13.5, lineHeight: 2, color: '#9A9AB4',
        }}>
          Besoin d’une course maintenant ?
          <br />
          {/* Le telephone et l'e-mail viennent d'`identite-owise.ts`, JAMAIS
              ecrits a la main : un numero invente est deja parti a une vraie
              cliente une fois. */}
          <a href={`tel:${IDENTITE_OWISE.telephone}`} style={{ color: '#C9A84C', textDecoration: 'none', fontWeight: 600, fontSize: 16 }}>
            {telephoneLisible(IDENTITE_OWISE.telephone)}
          </a>
          <br />
          <a href={`mailto:${IDENTITE_OWISE.email}`} style={{ color: '#9A9AB4', textDecoration: 'none', fontSize: 12.5 }}>
            {IDENTITE_OWISE.email}
          </a>
        </div>

        {error.digest && (
          <div style={{ marginTop: 26, fontSize: 10.5, color: '#38385A', fontFamily: 'ui-monospace, monospace' }}>
            réf. {error.digest}
          </div>
        )}
      </div>
    </main>
  )
}
