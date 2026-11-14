'use client'

import { textes, type Langue } from '@/lib/langue'

type ReservationSummaryProps = {
  departLabel: string
  arriveeLabel: string
  dateOnly: string
  timeOnly: string
  vehiculeLabel: string
  passagers: number
  langue?: Langue
  prix: number | null
  allerRetour: boolean
}

/**
 * LA COULEUR DES MENTIONS DISCRÈTES DU RÉCAPITULATIF, ÉCRITE UNE FOIS.
 *
 * Les six libellés secondaires de ce panneau — « Trajet », « Date et
 * heure », « Véhicule », « Prix », la ligne de trajet et la mention
 * Stripe — portaient tous le même littéral recopié six fois :
 * `rgba(var(--sur-fonce-rvb),.5)`. Mesuré en production le 2026-11-14,
 * sur le fond réel du panneau (`--papier`, #2E241B, grain compris) :
 * **4,37** pour 4,5 exigés. Six textes, un seul défaut, recopié.
 *
 * À .62 le contraste monte à 5,8 — la marge tient même si le grain du
 * fond éclaircit un peu la surface. Le panneau garde sa hiérarchie : les
 * VALEURS restent à `--sur-fonce` pleine, seules les étiquettes sont
 * atténuées.
 *
 * Une constante, six emplois : la prochaine retouche se fait ici, et pas
 * dans cinq endroits dont un qu'on oublie.
 */
const MENTION = 'rgba(var(--sur-fonce-rvb),.62)'

/**
 * « sam. 18 mars » en français, « Sat 18 Mar » en anglais.
 *
 * La locale suit la langue de la page : laisser `fr-FR` en dur affichait un
 * mois français au milieu d'un récapitulatif anglais. Ce n'est PAS une
 * lecture d'instant — `dateOnly` est une date civile saisie par le visiteur,
 * sans heure et sans fuseau, et le `T00:00:00` la garde telle quelle. Les
 * heures de course, elles, passent par `src/lib/heure.ts`.
 */
function formatDateCivile(dateOnly: string, langue: Langue): string {
  if (!dateOnly) return ''
  const d = new Date(`${dateOnly}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(langue === 'en' ? 'en-GB' : 'fr-FR',
    { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ReservationSummary({
  departLabel, arriveeLabel, dateOnly, timeOnly, vehiculeLabel, passagers, prix, allerRetour, langue = 'fr',
}: ReservationSummaryProps) {
  const L = textes(langue)
  const hasTrajet = departLabel.length > 2 && arriveeLabel.length > 2
  const dateAffichee = formatDateCivile(dateOnly, langue)

  return (
    <div className="reservation-summary-panel" style={{
      background: 'var(--papier)',
      borderRadius: 16,
      padding: '28px 24px',
      color: 'var(--t1)',
      position: 'sticky',
      top: 24,
      fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    }}>
      <div style={{
        fontFamily: 'var(--font-cormorant, Georgia), serif',
        fontSize: 18, fontWeight: 600, letterSpacing: '.08em',
        color: 'var(--t1)', marginBottom: 20,
      }}>
        {L.recapitulatif}
      </div>

      <div className="reservation-summary-detail">
        {hasTrajet ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: MENTION, marginBottom: 8 }}>{L.trajet}</div>
            <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6 }}>
              {departLabel.split(',')[0]}
              <div style={{ color: 'var(--gold)', fontSize: 11, margin: '2px 0' }}>↓{allerRetour ? ` ${L.aller_retour_mention}` : ''}</div>
              {arriveeLabel.split(',')[0]}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: MENTION, marginBottom: 18 }}>
            {L.recap_vide}
          </div>
        )}

        {dateAffichee && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: MENTION, marginBottom: 6 }}>{L.date_et_heure}</div>
            <div style={{ fontSize: 13, color: 'var(--t1)' }}>{dateAffichee} · {timeOnly}</div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: MENTION, marginBottom: 6 }}>{L.vehicule}</div>
          <div style={{ fontSize: 13, color: 'var(--t1)' }}>{vehiculeLabel} · {passagers} {passagers > 1 ? L.passagers : L.passager}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(var(--or-rvb),.2)', paddingTop: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: MENTION, marginBottom: 6 }}>{L.prix}</div>
        <div style={{ fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 32, fontWeight: 700, color: 'var(--gold)' }}>
          {prix !== null ? `${Math.round(prix)} €` : '—'}
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: MENTION, lineHeight: 1.6 }}>
        {L.paiement_securise}
      </div>
    </div>
  )
}
