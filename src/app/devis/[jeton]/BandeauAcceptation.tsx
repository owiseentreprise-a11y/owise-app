'use client'

/**
 * Le bandeau par lequel le client accepte son devis.
 *
 * Il est posé AU-DESSUS du document, pas en dessous : le client doit voir
 * tout de suite ce qu'on attend de lui, sans faire défiler une page entière
 * dont il ne connaît pas la longueur.
 *
 * Trois états, et un seul message à la fois :
 *   · à accepter    — le bouton, et ce qui se passera après ;
 *   · déjà accepté  — on le remercie et on ne redemande rien ;
 *   · expiré        — on le dit sans l'envoyer dans un mur : il peut appeler.
 *
 * CE QUE LE BOUTON PROMET, il le tient. Quand la carte est demandée, on écrit
 * « retenue, pas débitée » — parce que c'est exactement ce que fait Stripe
 * (autorisation sans capture) et que l'exploitant encaisse seulement après
 * avoir confirmé le véhicule. Promettre autre chose serait mentir sur un
 * écran de paiement.
 */
import { useState, useTransition } from 'react'
import { accepterDevisAction } from './actions'
import { formaterMontant } from '@/lib/montant'

export default function BandeauAcceptation({
  jeton,
  numero,
  montant,
  carteRequise,
  dejaAccepte,
  expire,
  valableJusquau,
}: {
  jeton: string
  numero: string
  montant: number
  carteRequise: boolean
  dejaAccepte: boolean
  expire: boolean
  valableJusquau: string | null
}) {
  const [pending, start] = useTransition()
  const [erreur, setErreur] = useState<string | null>(null)

  const cadre: React.CSSProperties = {
    maxWidth: 760,
    margin: '24px auto 0',
    padding: '18px 22px',
    borderRadius: 12,
    /* LE FOND, EXPLICITEMENT.

       Le bandeau était écrit pour un fond clair et posé sur une page du
       site, qui est bleu nuit : texte sombre sur fond sombre, illisible.
       Vu sur la capture du 2026-11-11. Il porte donc son propre papier,
       le même crème que le document juste en dessous. */
    background: '#F8F6F1',
    fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
  }

  if (dejaAccepte) {
    return (
      <div style={{ ...cadre, background: '#EFF7F1', border: '1px solid rgba(61,184,122,.38)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#2E8A58', marginBottom: 5 }}>
          Votre réservation est enregistrée
        </div>
        <div style={{ fontSize: 13.5, color: '#3A4A40', lineHeight: 1.65 }}>
          Merci. Nous vous confirmons votre chauffeur par e-mail. Le détail de la
          prestation figure ci-dessous.
        </div>
      </div>
    )
  }

  if (expire) {
    return (
      <div style={{ ...cadre, background: '#F2F1EC', border: '1px solid rgba(9,9,26,.14)' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#3A3A30', marginBottom: 5 }}>
          Ce devis a dépassé sa date de validité
        </div>
        <div style={{ fontSize: 13.5, color: '#5A5A48', lineHeight: 1.65 }}>
          Il était valable jusqu’au {valableJusquau}. Les prix ont pu changer —
          appelez-nous et nous le refaisons en quelques minutes.
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...cadre, background: '#FBF7EA', border: '1px solid rgba(201,168,76,.42)' }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#3A3A30', marginBottom: 6 }}>
        Nous avons accepté votre demande
      </div>
      <div style={{ fontSize: 13.5, color: '#5A5A48', lineHeight: 1.7, marginBottom: 16 }}>
        {carteRequise ? (
          <>
            Pour bloquer le véhicule, confirmez ci-dessous avec votre carte.
            Le montant de <b>{formaterMontant(montant)}</b> est{' '}
            <b>retenu sur votre carte, pas débité</b> : nous l’encaissons
            seulement une fois le chauffeur confirmé. Si nous ne pouvons pas
            assurer la course, la retenue est libérée et vous n’avez rien payé.
          </>
        ) : (
          <>
            Pour bloquer le véhicule, il suffit de confirmer ci-dessous.
            Le règlement de <b>{formaterMontant(montant)}</b> se fera comme
            convenu, sans rien à avancer aujourd’hui.
          </>
        )}
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          setErreur(null)
          const r = await accepterDevisAction(jeton)
          if (r.error) { setErreur(r.error); return }
          /* Un paiement part vers Stripe ; sans carte, la page se recharge et
             montre la confirmation. */
          if (r.url) window.location.href = r.url
          else window.location.reload()
        })}
        style={{
          width: '100%', padding: '15px 20px', borderRadius: 10, border: 'none',
          background: pending ? 'rgba(9,9,26,.5)' : '#09091A',
          color: '#F8F6F1', fontSize: 14.5, fontWeight: 600,
          cursor: pending ? 'wait' : 'pointer',
          fontFamily: 'inherit',
          /* La charte interdit `transition: all`. */
          transition: 'background-color .15s',
        }}
      >
        {pending
          ? 'Un instant…'
          : carteRequise
            ? `Confirmer ma réservation — ${formaterMontant(montant)}`
            : 'Confirmer ma réservation'}
      </button>

      {erreur && (
        <div style={{ marginTop: 12, fontSize: 13, color: '#B14343', lineHeight: 1.6 }}>
          {erreur}
        </div>
      )}

      <div style={{ marginTop: 12, fontSize: 11.5, color: '#8A8A7A', textAlign: 'center' }}>
        Devis {numero}
        {valableJusquau ? ` · valable jusqu’au ${valableJusquau}` : ''}
      </div>
    </div>
  )
}
