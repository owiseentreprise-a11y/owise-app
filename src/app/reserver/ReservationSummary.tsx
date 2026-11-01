'use client'

type ReservationSummaryProps = {
  departLabel: string
  arriveeLabel: string
  dateOnly: string
  timeOnly: string
  vehiculeLabel: string
  passagers: number
  prix: number | null
  allerRetour: boolean
}

function formatDateFr(dateOnly: string): string {
  if (!dateOnly) return ''
  const d = new Date(`${dateOnly}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ReservationSummary({
  departLabel, arriveeLabel, dateOnly, timeOnly, vehiculeLabel, passagers, prix, allerRetour,
}: ReservationSummaryProps) {
  const hasTrajet = departLabel.length > 2 && arriveeLabel.length > 2
  const dateAffichee = formatDateFr(dateOnly)

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
        Récapitulatif
      </div>

      <div className="reservation-summary-detail">
        {hasTrajet ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(var(--sur-fonce-rvb),.5)', marginBottom: 8 }}>Trajet</div>
            <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.6 }}>
              {departLabel.split(',')[0]}
              <div style={{ color: 'var(--gold)', fontSize: 11, margin: '2px 0' }}>↓{allerRetour ? ' aller-retour' : ''}</div>
              {arriveeLabel.split(',')[0]}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(var(--sur-fonce-rvb),.5)', marginBottom: 18 }}>
            Renseignez votre trajet pour voir le récapitulatif
          </div>
        )}

        {dateAffichee && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(var(--sur-fonce-rvb),.5)', marginBottom: 6 }}>Date &amp; heure</div>
            <div style={{ fontSize: 13, color: 'var(--t1)' }}>{dateAffichee} · {timeOnly}</div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(var(--sur-fonce-rvb),.5)', marginBottom: 6 }}>Véhicule</div>
          <div style={{ fontSize: 13, color: 'var(--t1)' }}>{vehiculeLabel} · {passagers} passager{passagers > 1 ? 's' : ''}</div>
        </div>
      </div>

      <div style={{ borderTop: '1px solid rgba(var(--or-rvb),.2)', paddingTop: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(var(--sur-fonce-rvb),.5)', marginBottom: 6 }}>Prix</div>
        <div style={{ fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 32, fontWeight: 700, color: 'var(--gold)' }}>
          {prix !== null ? `${Math.round(prix)} €` : '—'}
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: 'rgba(var(--sur-fonce-rvb),.5)', lineHeight: 1.6 }}>
        Paiement sécurisé par Stripe · SSL/TLS · Aucune donnée bancaire stockée
      </div>
    </div>
  )
}
