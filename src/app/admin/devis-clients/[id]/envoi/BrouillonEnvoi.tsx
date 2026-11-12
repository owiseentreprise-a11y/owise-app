'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { envoyerDevisAction, telechargerDevisPdfAction } from '../../actions'

const carte: React.CSSProperties = {
  background: 'var(--surface)', border: '1px solid rgba(201,168,76,.12)',
  borderRadius: 12, padding: '18px 20px', marginBottom: 16,
}
const etiquette: React.CSSProperties = {
  fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase',
  color: 'var(--t3)', fontWeight: 600,
}

type Route = 'owise' | 'gmail'

type Props = {
  id: string
  numero: string
  client: string
  statut: string
  destinataire: string | null
  sujet: string
  html: string
  texte: string
  reponseHtml: string
  reponseTexte: string
  piece: string
  expediteur: string
  repondreA: string
  trou: string | null
  aucuneLigne: boolean
}

export default function BrouillonEnvoi(p: Props) {
  const router = useRouter()
  const [enCours, demarrer] = useTransition()
  const [route, setRoute] = useState<Route>('gmail')
  const [message, setMessage] = useState('')
  const [erreur, setErreur] = useState('')
  const [copie, setCopie] = useState('')

  /* Les trois raisons de ne pas laisser partir le message. Elles ne valent
     que pour l'envoi par Owise : copier-coller dans Gmail reste possible
     sans adresse en base, puisque c'est Gmail qui connaît le destinataire. */
  const obstacles = [
    !p.destinataire && "Ce devis n'a pas d'adresse e-mail client.",
    p.trou && `Le message contient encore « ${p.trou} » — un reste de modèle à corriger.`,
    p.aucuneLigne && 'Ce devis ne comporte aucune prestation.',
  ].filter(Boolean) as string[]

  const bloquants = route === 'owise'
    ? obstacles
    : obstacles.filter(o => !o.startsWith('Ce devis n\'a pas d\'adresse'))

  function envoyer(aQui: 'client' | 'moi' = 'client') {
    demarrer(async () => {
      setErreur(''); setMessage('')
      try {
        const a = await envoyerDevisAction(p.id, aQui)
        setMessage(aQui === 'moi'
          ? `Exemplaire envoyé à ${a} — le client n’a rien reçu, et le devis reste en brouillon.`
          : `Devis envoyé à ${a}.`)
        router.refresh()
      } catch (e) {
        setErreur(e instanceof Error ? e.message : "L'envoi a échoué.")
      }
    })
  }

  /**
   * Copie la réponse en texte RICHE, par deux chemins.
   *
   * Pourquoi deux : du texte brut collé dans Gmail perd tout alignement — les
   * colonnes du résumé et du détail s'écroulent. Il faut donc du HTML dans le
   * presse-papier.
   *
   *  1. `navigator.clipboard.write` : la voie moderne, deux écritures d'un
   *     coup (HTML pour Gmail, texte pour un champ qui ne sait pas le lire).
   *     Elle réclame la permission « clipboard-write », qu'un navigateur
   *     refuse dans plus de cas qu'on ne croit — mesuré le 2026-11-02 :
   *     Chrome sans fenêtre la refuse, `writeText` comprise.
   *  2. La sélection d'un bloc caché + `execCommand('copy')` : la vieille
   *     méthode. Elle ne demande aucune permission, parce qu'elle imite ce
   *     que fait un Ctrl+C humain, et elle copie le HTML tel quel.
   */
  async function copierReponse() {
    setErreur(''); setCopie('')

    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({
          'text/html':  new Blob([p.reponseHtml],  { type: 'text/html' }),
          'text/plain': new Blob([p.reponseTexte], { type: 'text/plain' }),
        })])
        setCopie('Réponse copiée — collez-la dans votre réponse (Ctrl+V)')
        setTimeout(() => setCopie(''), 6000)
        return
      }
    } catch { /* permission refusée : on passe à la méthode suivante */ }

    if (copierParSelection(p.reponseHtml)) {
      setCopie('Réponse copiée — collez-la dans votre réponse (Ctrl+V)')
      setTimeout(() => setCopie(''), 6000)
      return
    }

    try {
      await navigator.clipboard.writeText(p.reponseTexte)
      setCopie('Copié, mais en texte simple : la mise en forme sera perdue au collage.')
      setTimeout(() => setCopie(''), 8000)
    } catch {
      setErreur('Copie impossible. Ouvrez « Voir le texte brut » ci-dessous et sélectionnez-le à la main.')
    }
  }

  function telecharger() {
    demarrer(async () => {
      setErreur('')
      try {
        const { nom, base64 } = await telechargerDevisPdfAction(p.id)
        const octets = Uint8Array.from(atob(base64), c => c.charCodeAt(0))
        const url = URL.createObjectURL(new Blob([octets], { type: 'application/pdf' }))
        const a = document.createElement('a')
        a.href = url; a.download = nom
        document.body.appendChild(a); a.click(); a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 4000)
      } catch (e) {
        setErreur(e instanceof Error ? e.message : 'Téléchargement impossible.')
      }
    })
  }

  const onglet = (r: Route, titre: string, sous: string) => (
    <button
      type="button" onClick={() => { setRoute(r); setMessage(''); setErreur(''); setCopie('') }}
      aria-pressed={route === r}
      style={{
        flex: 1, minWidth: 240, textAlign: 'left', cursor: 'pointer',
        padding: '14px 16px', borderRadius: 11, fontFamily: 'inherit',
        background: route === r ? 'rgba(201,168,76,.10)' : '#FFFFFF',
        border: route === r ? '1.5px solid #C9A84C' : '1.5px solid rgba(201,168,76,.12)',
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--t1)', marginBottom: 4 }}>{titre}</div>
      <div style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.55 }}>{sous}</div>
    </button>
  )

  return (
    <div style={{ padding: '24px 28px 70px', maxWidth: 860 }}>
      <style>{`
        @media (max-width: 760px) {
          .env-page    { padding: 16px 14px 60px !important; }
          .env-champ   { grid-template-columns: 1fr !important; gap: 2px !important; }
          .env-actes   { flex-direction: column; align-items: stretch !important; }
          .env-actes > button { width: 100%; }
          .env-onglets { flex-direction: column; }
        }
      `}</style>

      <div className="env-page">
        <Link href={`/admin/devis-clients/${p.id}`}
              style={{ fontSize: 12.5, color: '#C9A84C', textDecoration: 'none' }}>
          ← Retour au devis
        </Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 25, fontWeight: 500, color: 'var(--t1)', margin: '8px 0 2px' }}>
          Envoyer le devis
        </h1>
        <div style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#C9A84C', marginBottom: 20 }}>
          {p.numero} · {p.client || 'client sans nom'}
        </div>

        {/* ── Le choix de la route, avant tout le reste ────────── */}
        <div className="env-onglets" style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
          {onglet('gmail', 'Je réponds depuis ma messagerie',
            'Le client vous a écrit par e-mail. Sa demande et votre réponse restent dans le même fil.')}
          {onglet('owise', 'Owise envoie',
            'Le client est venu par WhatsApp ou par téléphone. Aucune conversation à respecter.')}
        </div>

        {bloquants.map((o, i) => (
          <div key={i} style={{
            ...carte, background: 'rgba(217,84,84,.06)', border: '1px solid rgba(217,84,84,.28)',
            color: 'var(--red-txt)', fontSize: 13.5, lineHeight: 1.6, marginBottom: 12,
          }}>
            {o}{' '}
            <Link href={`/admin/devis-clients/${p.id}`} style={{ color: 'var(--red-txt)', fontWeight: 600 }}>
              Corriger le devis
            </Link>
          </div>
        ))}

        {route === 'owise' ? (
          <>
            <div style={carte}>
              <div style={{ ...etiquette, marginBottom: 14 }}>Ce qui va partir</div>
              {([
                ['De',            p.expediteur],
                ['Réponses vers', p.repondreA],
                ['À',             p.destinataire ?? '— aucune adresse —'],
                ['Objet',         p.sujet],
                ['Pièce jointe',  p.piece],
              ] as [string, string][]).map(([l, v]) => (
                <div key={l} className="env-champ" style={{
                  display: 'grid', gridTemplateColumns: '130px 1fr', gap: 12,
                  padding: '7px 0', borderTop: '1px solid #F2EFE9', alignItems: 'baseline',
                }}>
                  <div style={etiquette}>{l}</div>
                  <div style={{
                    fontSize: 13.5, color: v.startsWith('—') ? 'var(--red-txt)' : '#1a1a2e',
                    wordBreak: 'break-word',
                  }}>{v}</div>
                </div>
              ))}
            </div>

            <div style={{ ...carte, padding: 0, overflow: 'hidden' }}>
              <div style={{ ...etiquette, padding: '16px 20px 12px' }}>Aperçu du message</div>
              {/* Dans un cadre isolé : les styles de l'e-mail ne doivent pas
                  déteindre sur l'administration, ni l'inverse. */}
              <iframe
                title="Aperçu du message"
                srcDoc={p.html}
                sandbox=""
                style={{ width: '100%', height: 540, border: 'none', borderTop: '1px solid #F2EFE9', display: 'block' }}
              />
            </div>

            <div className="env-actes" style={{
              display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
              marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(201,168,76,.12)',
            }}>
              {/* Relire dans sa propre boite avant d envoyer au client.
                  Le devis reste en brouillon : voir envoyerDevisAction. */}
              <button type="button" onClick={() => envoyer('moi')} disabled={enCours}
                      style={{
                        background: 'none', border: '1px solid rgba(201,168,76,.45)',
                        color: 'var(--gold)', borderRadius: 9, padding: '12px 18px',
                        fontSize: 13, fontWeight: 600, cursor: enCours ? 'wait' : 'pointer',
                        fontFamily: 'inherit', marginRight: 10,
                      }}>
                M’envoyer un exemplaire
              </button>
              <button type="button" onClick={() => envoyer('client')} disabled={enCours || bloquants.length > 0}
                      title={bloquants[0] ?? undefined}
                      style={{
                        background: bloquants.length ? 'rgba(201,168,76,.12)' : '#C9A84C',
                        color: bloquants.length ? 'var(--t3)' : 'var(--t1)',
                        border: 'none', borderRadius: 9, padding: '13px 24px',
                        fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                        cursor: bloquants.length ? 'not-allowed' : enCours ? 'wait' : 'pointer',
                      }}>
                {enCours ? 'Envoi…' : 'Envoyer au client'}
              </button>
              <span style={{ fontSize: 12.5, color: 'var(--t3)' }}>
                Le devis passera en « envoyé ».
              </span>
            </div>
          </>
        ) : (
          <>
            <ol style={{
              ...carte, margin: '0 0 16px', paddingLeft: 38, fontSize: 13.5,
              color: 'var(--t2)', lineHeight: 1.9,
            }}>
              <li><strong>Copier la réponse</strong> ci-dessous, puis <strong>Télécharger le PDF</strong>.</li>
              <li>Dans votre messagerie, ouvrir le message du client et cliquer <strong>Répondre</strong>.</li>
              <li>Coller (Ctrl+V), joindre le PDF, envoyer.</li>
              <li>De retour ici, passer le devis en « Envoyé » depuis la page du devis.</li>
            </ol>

            {/* Le bloc copié s'arrête volontairement à « Bien à vous » : la
                messagerie ajoute la signature réglée dans ses paramètres, et
                deux signatures l'une sur l'autre font négligé. */}
            <p style={{
              fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.65,
              margin: '-4px 0 16px', paddingLeft: 2,
            }}>
              Le bloc s&apos;arrête à « Bien à vous » : votre signature de messagerie
              se placera automatiquement en dessous.
            </p>

            <div style={{ ...carte, padding: 0, overflow: 'hidden' }}>
              <div style={{ ...etiquette, padding: '16px 20px 12px' }}>
                Ce que verra le client, une fois collé
              </div>
              <iframe
                title="Aperçu de la réponse"
                srcDoc={`<body style="margin:0;padding:22px 20px;background:#fff;">${p.reponseHtml}</body>`}
                sandbox=""
                style={{ width: '100%', height: 540, border: 'none', borderTop: '1px solid #F2EFE9', display: 'block' }}
              />
            </div>

            <div className="env-actes" style={{
              display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
              marginTop: 20, paddingTop: 18, borderTop: '1px solid rgba(201,168,76,.12)',
            }}>
              <button type="button" onClick={copierReponse} disabled={enCours || bloquants.length > 0}
                      style={{
                        background: bloquants.length ? 'rgba(201,168,76,.12)' : '#C9A84C',
                        color: bloquants.length ? 'var(--t3)' : 'var(--t1)',
                        border: 'none', borderRadius: 9, padding: '13px 24px',
                        fontSize: 13.5, fontWeight: 700, fontFamily: 'inherit',
                        cursor: bloquants.length ? 'not-allowed' : 'pointer',
                      }}>
                Copier la réponse
              </button>
              <button type="button" onClick={telecharger} disabled={enCours}
                      style={{
                        background: 'none', border: '1px solid rgba(201,168,76,.12)', color: 'var(--t1)',
                        borderRadius: 9, padding: '12px 18px', fontSize: 13, fontWeight: 600,
                        cursor: enCours ? 'wait' : 'pointer', fontFamily: 'inherit',
                      }}>
                Télécharger le PDF
              </button>
            </div>
          </>
        )}

        {copie   && <p style={{ fontSize: 13.5, color: 'var(--grn)', marginTop: 14 }}>{copie}</p>}
        {message && <p style={{ fontSize: 13.5, color: 'var(--grn)', marginTop: 14 }}>{message}</p>}
        {erreur  && <p style={{ fontSize: 13.5, color: 'var(--red-txt)', marginTop: 14 }}>{erreur}</p>}

        {/* Repli si le presse-papier est refusé par le navigateur. */}
        <details style={{ marginTop: 22 }}>
          <summary style={{ ...etiquette, cursor: 'pointer' }}>Voir le texte brut</summary>
          <pre style={{
            marginTop: 10, padding: '14px 16px', background: 'var(--surface)',
            border: '1px solid rgba(201,168,76,.12)', borderRadius: 10,
            fontSize: 12.5, lineHeight: 1.75, color: '#1a1a2e',
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit',
          }}>{route === 'owise' ? p.texte : p.reponseTexte}</pre>
        </details>
      </div>
    </div>
  )
}

/**
 * Copie du HTML en imitant un Ctrl+C : on pose le contenu dans un bloc hors
 * de l'écran, on le sélectionne, on copie, on retire tout.
 *
 * Aucune permission demandée — c'est le navigateur qui copie une sélection,
 * ce qu'il a toujours su faire. Rend `true` si la copie a eu lieu.
 *
 * Le bloc est placé hors du cadre visible plutôt que masqué : un élément en
 * `display:none` n'est pas sélectionnable, et rien ne serait copié.
 */
function copierParSelection(html: string): boolean {
  if (typeof document === 'undefined') return false
  const boite = document.createElement('div')
  boite.innerHTML = html
  boite.setAttribute('contenteditable', 'true')
  Object.assign(boite.style, {
    position: 'fixed', left: '-10000px', top: '0',
    width: '640px', opacity: '0', pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>)
  document.body.appendChild(boite)

  try {
    const selection = window.getSelection()
    if (!selection) return false
    const plage = document.createRange()
    plage.selectNodeContents(boite)
    selection.removeAllRanges()
    selection.addRange(plage)
    const fait = document.execCommand('copy')
    selection.removeAllRanges()
    return fait
  } catch {
    return false
  } finally {
    boite.remove()
  }
}
