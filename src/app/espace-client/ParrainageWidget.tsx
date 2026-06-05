'use client'

import { useState } from 'react'

type Credit = { montant: number; statut: string; created_at: string }

export default function ParrainageWidget({
  code,
  nbFilleuls,
  credits,
  totalDispo,
}: {
  code: string | null
  nbFilleuls: number
  credits: Credit[]
  totalDispo: number
}) {
  const [copied, setCopied] = useState(false)

  function copy() {
    if (!code) return
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const lien = `https://owise.fr?ref=${code}`

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 16, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '18px 22px', borderBottom: '1px solid var(--gb)',
        background: 'rgba(201,168,76,.04)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
            Programme parrainage
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)', marginTop: 2 }}>
            Parrainez vos proches, gagnez des crédits
          </div>
        </div>
        {totalDispo > 0 && (
          <div style={{
            background: 'rgba(61,184,122,.12)', border: '1px solid rgba(61,184,122,.25)',
            borderRadius: 10, padding: '6px 14px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 16, fontWeight: 700, color: 'var(--grn)' }}>
              {totalDispo.toFixed(0)} €
            </div>
            <div style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '.08em' }}>CRÉDIT DISPO</div>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Comment ça marche */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { num: '1', text: 'Partagez votre code à un proche' },
            { num: '2', text: 'Il réserve avec -10% sur sa 1ère course' },
            { num: '3', text: 'Vous recevez 10€ de crédit' },
          ].map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 140px' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(201,168,76,.12)', border: '1px solid rgba(201,168,76,.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 700, color: 'var(--gold)',
              }}>{s.num}</div>
              <div style={{ fontSize: 11.5, color: 'var(--t2)', lineHeight: 1.4 }}>{s.text}</div>
            </div>
          ))}
        </div>

        {/* Code */}
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
            Votre code personnel
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{
              fontFamily: 'var(--font-jetbrains), monospace', fontSize: 22, fontWeight: 700,
              color: 'var(--gold)', letterSpacing: '.15em',
              background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)',
              borderRadius: 10, padding: '10px 20px', flex: 1, textAlign: 'center',
            }}>
              {code ?? '…'}
            </div>
            <button onClick={copy} style={{
              padding: '10px 18px', borderRadius: 10, cursor: 'pointer', border: 'none',
              background: copied ? 'rgba(61,184,122,.15)' : 'rgba(201,168,76,.12)',
              color: copied ? 'var(--grn)' : 'var(--gold)',
              fontSize: 12, fontWeight: 600, transition: 'all .2s', flexShrink: 0,
            }}>
              {copied ? '✓ Copié' : 'Copier'}
            </button>
          </div>
          <button onClick={() => {
            if (!code) return
            navigator.share?.({ title: 'Owise VTC', text: `Réservez votre VTC avec mon code ${code} pour -10% sur votre première course !`, url: lien })
              .catch(() => navigator.clipboard.writeText(lien).then(() => setCopied(true)))
          }} style={{
            marginTop: 8, width: '100%', padding: '8px', borderRadius: 8,
            background: 'transparent', border: '1px solid var(--gb)',
            color: 'var(--t2)', fontSize: 11, cursor: 'pointer',
            transition: 'border-color .15s, color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,168,76,.3)'; e.currentTarget.style.color = 'var(--gold)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--gb)'; e.currentTarget.style.color = 'var(--t2)' }}
          >
            Partager le lien
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, background: 'var(--elevated)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>{nbFilleuls}</div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>filleul{nbFilleuls > 1 ? 's' : ''} parrainé{nbFilleuls > 1 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--elevated)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 20, fontWeight: 700, color: totalDispo > 0 ? 'var(--grn)' : 'var(--t1)' }}>
              {totalDispo.toFixed(0)} €
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>crédit{totalDispo > 0 ? 's' : ''} disponible{totalDispo > 0 ? 's' : ''}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--elevated)', borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-jetbrains)', fontSize: 20, fontWeight: 700, color: 'var(--t1)' }}>
              {credits.filter(c => c.statut === 'utilise').reduce((s, c) => s + Number(c.montant), 0).toFixed(0)} €
            </div>
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 2 }}>crédits utilisés</div>
          </div>
        </div>

        {/* Historique crédits */}
        {credits.length > 0 && (
          <div>
            <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
              Historique des crédits
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {credits.slice(0, 5).map((c, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', background: 'var(--elevated)', borderRadius: 8,
                  fontSize: 12,
                }}>
                  <div style={{ color: 'var(--t2)' }}>
                    Parrainage · {new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 4,
                      color: c.statut === 'disponible' ? 'var(--grn)' : 'var(--t3)',
                      background: c.statut === 'disponible' ? 'rgba(61,184,122,.1)' : 'rgba(132,132,153,.1)',
                    }}>
                      {c.statut === 'disponible' ? 'Disponible' : 'Utilisé'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-jetbrains)', fontWeight: 700, color: 'var(--gold)' }}>
                      +{Number(c.montant).toFixed(0)} €
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
