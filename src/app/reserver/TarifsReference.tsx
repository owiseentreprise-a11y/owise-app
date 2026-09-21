/**
 * Forfaits de référence, sous le formulaire de réservation.
 *
 * Deux raisons d'être, dans cet ordre :
 *
 * 1. Le visiteur. La page ne montrait aucun prix tant qu'il n'avait pas saisi
 *    deux adresses : il devait donner son trajet pour savoir s'il en avait les
 *    moyens. Ces montants le rassurent avant l'effort de saisie.
 * 2. Les assistants IA. Une IA ne cite qu'un chiffre précis ; « devis sur
 *    demande » n'est jamais repris. /reserver ne portait aucun prix citable.
 *
 * Les montants viennent de `grilles_tarifaires` via la page serveur, jamais
 * d'une liste écrite ici — un prix en dur finirait par diverger de ce que
 * l'application facture.
 */

export type ForfaitReference = { depart: string; arrivee: string; prix: number }

const OR = '#C9A84C'
const CREME = '#F8F6F1'
const ENCRE = '#09091A'
const ENCRE_2 = '#6B6B7B'

export default function TarifsReference({ forfaits }: { forfaits: ForfaitReference[] }) {
  if (forfaits.length === 0) return null

  return (
    <section
      aria-labelledby="titre-forfaits"
      style={{
        background: CREME,
        borderTop: '1px solid rgba(201,168,76,.18)',
        padding: '56px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>
        <div style={{
          fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
          color: OR, fontWeight: 600, marginBottom: 10,
        }}>
          Tarifs fixes garantis
        </div>

        <h2
          id="titre-forfaits"
          style={{
            fontFamily: 'var(--font-cormorant), Georgia, serif',
            fontSize: 34, lineHeight: 1.15, color: ENCRE,
            fontWeight: 500, margin: '0 0 10px',
          }}
        >
          Nos forfaits les plus demandés
        </h2>

        <p style={{ fontSize: 14, lineHeight: 1.65, color: ENCRE_2, margin: '0 0 28px', maxWidth: 620 }}>
          Prix TTC par véhicule, pour une berline, péages et accueil compris. Le montant
          est fixé à la réservation et ne bouge pas, quels que soient le trafic ou
          l&apos;attente à l&apos;aéroport. Saisissez vos adresses ci-dessus pour le tarif exact
          de votre trajet.
        </p>

        <ul style={{
          listStyle: 'none', margin: 0, padding: 0,
          display: 'grid', gap: 10,
          gridTemplateColumns: 'repeat(auto-fill, minmax(268px, 1fr))',
        }}>
          {forfaits.map((f, i) => (
            <li
              key={i}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 14, padding: '14px 16px', borderRadius: 11,
                background: '#FFFDF9',
                border: '1px solid rgba(201,168,76,.16)',
                boxShadow: '0 1px 2px rgba(9,9,26,.04)',
              }}
            >
              <span style={{ fontSize: 13, lineHeight: 1.45, color: ENCRE, minWidth: 0 }}>
                {f.depart}
                <span style={{ color: OR, padding: '0 6px' }}>→</span>
                {f.arrivee}
              </span>
              <span style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 17, fontWeight: 500, color: ENCRE, whiteSpace: 'nowrap',
              }}>
                {f.prix} €
              </span>
            </li>
          ))}
        </ul>

        <p style={{ fontSize: 12, lineHeight: 1.6, color: ENCRE_2, margin: '22px 0 0' }}>
          Un arrêt en chemin ajoute les kilomètres du détour et des frais fixes. Les
          trajets hors forfait sont calculés à la distance réelle, annoncée avant
          paiement.
        </p>
      </div>
    </section>
  )
}
