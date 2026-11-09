'use client'

import { useEffect } from 'react'

/**
 * Ce qu'on affiche quand une page d'administration ne peut pas se charger.
 *
 * Avant le 2026-11-09, il n'existait AUCUNE page d'erreur dans le projet :
 * Next.js affichait son écran noir « This page couldn't load — ERROR
 * 3521912467 ». L'exploitant a signalé, à juste titre, que ça n'apprend rien
 * et que ce n'est pas professionnel.
 *
 * Ce que cet écran doit faire, et rien de plus :
 *   1. dire en français que la panne est côté serveur, pas de son fait ;
 *   2. proposer de réessayer, parce qu'une panne passagère se règle là ;
 *   3. afficher le NUMÉRO DE RÉFÉRENCE bien en vue. C'est le seul lien entre
 *      ce que l'exploitant voit et la ligne correspondante dans les journaux
 *      Vercel : sans lui, on cherche à l'aveugle ;
 *   4. laisser une sortie vers le tableau de bord.
 *
 * Ce qu'il ne doit PAS faire : montrer le message technique brut. Il peut
 * contenir un identifiant, une adresse, un fragment de requête — et cet écran
 * s'affiche aussi sur un téléphone, parfois devant un client.
 */
export default function ErreurAdmin({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    /* Le détail part dans les journaux Vercel, pas à l'écran. On le préfixe
       comme `ErrorReporter`, pour pouvoir le retrouver d'une recherche. */
    console.error('[ERREUR PAGE ADMIN]', {
      message: error.message,
      digest: error.digest,
      stack: error.stack?.slice(0, 1200),
    })
  }, [error])

  const bouton = {
    padding: '10px 18px', borderRadius: 8, fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', border: '1px solid transparent',
  } as const

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '70vh', padding: 24, background: '#F8F6F1',
    }}>
      <div style={{
        maxWidth: 520, width: '100%', background: '#FFFFFF',
        border: '1.5px solid rgba(0,0,0,.08)', borderRadius: 14,
        padding: '30px 32px',
        boxShadow: '0 1px 2px rgba(10,10,10,.04), 0 12px 32px rgba(10,10,10,.06)',
      }}>
        <div style={{
          fontSize: 9.5, letterSpacing: '.16em', textTransform: 'uppercase',
          color: '#C9A84C', fontWeight: 600, marginBottom: 10,
        }}>
          Owise — administration
        </div>

        <h1 style={{
          fontFamily: 'Georgia, serif', fontSize: 23, color: '#0A0A0A',
          margin: '0 0 12px', lineHeight: 1.25,
        }}>
          Cette page n’a pas pu se charger
        </h1>

        <p style={{ fontSize: 13, lineHeight: 1.65, color: '#555', margin: '0 0 8px' }}>
          Le serveur a renvoyé une erreur. Ce n’est pas une mauvaise manipulation
          de votre part, et <strong>rien n’a été enregistré à moitié</strong> :
          une opération qui échoue est annulée en entier.
        </p>
        <p style={{ fontSize: 13, lineHeight: 1.65, color: '#555', margin: '0 0 20px' }}>
          Réessayez une première fois. Si l’erreur revient, communiquez le
          numéro ci-dessous — c’est lui qui permet de retrouver la cause exacte
          dans les journaux.
        </p>

        {error.digest && (
          <div style={{
            background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.28)',
            borderRadius: 9, padding: '12px 14px', marginBottom: 22,
          }}>
            <div style={{
              fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase',
              color: '#8A7B4E', fontWeight: 600, marginBottom: 5,
            }}>
              Numéro de référence
            </div>
            <div style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 15, color: '#0A0A0A', userSelect: 'all', letterSpacing: '.02em',
            }}>
              {error.digest}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={reset}
            style={{ ...bouton, background: '#C9A84C', color: '#FFFFFF' }}
          >
            Réessayer
          </button>
          <a
            href="/admin"
            style={{
              ...bouton, background: '#FFFFFF', color: '#555',
              border: '1px solid rgba(0,0,0,.12)', textDecoration: 'none',
              display: 'inline-block',
            }}
          >
            Revenir au tableau de bord
          </a>
        </div>
      </div>
    </div>
  )
}
