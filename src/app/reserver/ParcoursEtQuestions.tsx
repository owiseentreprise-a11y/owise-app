/**
 * Ce qui se passe après « Continuer », et les cinq questions qu'on se pose
 * avant de payer.
 *
 * Pourquoi ce bloc existe
 * ───────────────────────
 * /reserver demandait un paiement sans jamais dire ce qui se passait ensuite :
 * ni le déroulé, ni les conditions d'annulation, ni le moyen de paiement, ni
 * ce qu'on reçoit après. Le visiteur devait ouvrir les mentions légales pour
 * le savoir — ou renoncer. Les assistants IA, eux, ne lisaient aucune réponse
 * citable sur la page la plus importante du site.
 *
 * La règle qu'on s'est donnée en l'écrivant
 * ─────────────────────────────────────────
 * Chaque phrase ci-dessous est vérifiable dans le code ou dans les mentions
 * légales. Rien n'y est ajouté « parce que ça rassure ».
 *
 *   · « par carte bancaire » et rien d'autre : `reserver/actions.ts` ouvre la
 *     session Stripe avec `payment_method_types[]=card`. Apple Pay et Google
 *     Pay sont cités dans les mentions légales mais ne sont pas prouvés par
 *     le code — ils ne sont donc pas promis ici.
 *   · « la course n'est enregistrée qu'une fois le paiement confirmé » : la
 *     réservation est créée par le webhook Stripe, jamais avant.
 *   · « vous recevez un e-mail » et JAMAIS « et un SMS » : le projet n'a
 *     qu'un seul canal d'envoi, Resend, qui envoie des e-mails. Aucune
 *     dépendance, aucune variable d'environnement, aucune route n'envoie de
 *     SMS.
 *   · les frais d'annulation, les 48 heures et les 5 à 10 jours ouvrés sont
 *     lus dans les sections 4 et 5 des mentions légales.
 *   · aucune capacité chiffrée n'est répétée ici : les fiches véhicules de la
 *     page les portent déjà, et les redire ailleurs est exactement ce qui a
 *     produit cinq politiques d'annulation différentes.
 *
 * Les questions sont exportées : `page.tsx` construit la fiche FAQPage à
 * partir de CE tableau. Deux écritures du même texte finiraient par diverger.
 */

import Link from 'next/link'
import { ANNULATION_PHRASE, ANNULATION_PHRASE_EN } from '@/lib/conditions'
import { textes, type Langue } from '@/lib/langue'

/**
 * Une question, dans les DEUX langues.
 *
 * Les deux colonnes vivent dans la même entrée, et non dans deux tableaux
 * parallèles : une question ajoutée en français montre alors tout de suite
 * qu'il lui manque sa version anglaise, et `tsc` le refuse. Deux listes
 * séparées auraient fini par diverger en silence — c'est déjà arrivé sur
 * les politiques d'annulation, où cinq versions coexistaient.
 */
export type Question = { q: string; r: string; qEn: string; rEn: string }

const OR = 'var(--gold)'
const CREME = 'var(--elevated)'
const ENCRE = 'var(--t1)'
const ENCRE_2 = 'var(--t2)'

const ETAPES = [
  {
    titre: 'Votre trajet et votre heure',
    titreEn: 'Your journey and your time',
    texte: 'Vous indiquez le départ, la destination, la date et l\'heure. Le prix s\'affiche avant que vous ayez donné la moindre coordonnée : il est calculé à partir de notre grille tarifaire, pas estimé à la louche.',
    texteEn: 'You enter the pick-up point, the destination, the date and the time. The price appears before you have given a single contact detail: it is calculated from our fare table, not guessed at.',
  },
  {
    titre: 'Votre véhicule et vos coordonnées',
    titreEn: 'Your vehicle and your details',
    texte: 'Vous choisissez le véhicule et le nombre de passagers, puis vous renseignez vos coordonnées. Si vous partez d\'un aéroport ou d\'une gare, votre numéro de vol ou de train vous est demandé.',
    texteEn: 'You choose the vehicle and the number of passengers, then enter your contact details. If you are leaving from an airport or a station, we ask for your flight or train number.',
  },
  {
    titre: 'Le paiement',
    titreEn: 'Payment',
    texte: 'Le règlement se fait par carte bancaire, sur une page hébergée par Stripe. La course n\'est enregistrée qu\'une fois le paiement confirmé, et vous recevez alors un e-mail de confirmation.',
    texteEn: 'Payment is by card, on a page hosted by Stripe. The booking is only recorded once payment is confirmed, and you then receive a confirmation email.',
  },
]

export const QUESTIONS: Question[] = [
  {
    q: 'Le prix affiché est-il celui que je paierai ?',
    qEn: 'Is the price shown the price I will pay?',
    r: 'Oui. Le montant affiché avant le paiement est celui qui est débité. Il est calculé à partir de notre grille tarifaire et comprend déjà les éventuels suppléments de nuit, de week-end ou d\'étape intermédiaire. Il n\'y a pas de compteur, et aucune majoration n\'est appliquée en fonction du trafic.',
    rEn: 'Yes. The amount shown before payment is the amount charged. It is calculated from our fare table and already includes any night, weekend or stop-over supplement. There is no meter, and no surcharge is applied for traffic.',
  },
  {
    q: 'Quels moyens de paiement acceptez-vous ?',
    qEn: 'Which payment methods do you accept?',
    r: 'Le paiement se fait par carte bancaire, sur une page hébergée par Stripe. Owise ne voit ni ne conserve vos données de carte. Les entreprises disposant d\'un compte peuvent être facturées mensuellement, sur accord préalable.',
    rEn: 'Payment is by card, on a page hosted by Stripe. Owise neither sees nor stores your card details. Companies holding an account can be invoiced monthly, by prior arrangement.',
  },
  {
    q: 'Puis-je annuler ma réservation ?',
    qEn: 'Can I cancel my booking?',
    r: ANNULATION_PHRASE,
    /* La version anglaise vient de la MÊME source : voir conditions.ts. */
    rEn: ANNULATION_PHRASE_EN,
  },
  {
    q: 'Combien de passagers puis-je emmener ?',
    qEn: 'How many passengers can I bring?',
    r: 'Le nombre de passagers se choisit à la deuxième étape, après avoir renseigné le trajet : chaque véhicule indique sa capacité sur sa fiche. Au-delà de 7 passagers, le véhicule dépend de la disponibilité de nos chauffeurs partenaires — nous établissons alors un devis avant toute réservation.',
    rEn: 'The number of passengers is chosen at the second step, once the journey is entered: each vehicle shows its capacity on its card. Above 7 passengers the vehicle depends on our partner chauffeurs’ availability — we then issue a quote before any booking.',
  },
  {
    q: 'Que se passe-t-il après le paiement ?',
    qEn: 'What happens after payment?',
    r: 'Vous recevez un e-mail de confirmation reprenant le trajet, la date et le montant, et votre course apparaît dans votre espace client. Toute demande de remboursement doit être signalée dans les 48 heures suivant la course ; les remboursements validés sont versés sous 5 à 10 jours ouvrés.',
    rEn: 'You receive a confirmation email repeating the journey, the date and the amount, and your booking appears in your client area. Any refund request must be raised within 48 hours of the journey; approved refunds are paid within 5 to 10 working days.',
  },
]

export default function ParcoursEtQuestions({ langue = 'fr' }: { langue?: Langue } = {}) {
  const L = textes(langue)
  const en = langue === 'en'
  return (
    <section
      aria-labelledby="titre-parcours"
      style={{
        background: 'var(--papier)',
        borderTop: '1px solid rgba(var(--or-rvb),.18)',
        padding: '56px 20px 64px',
      }}
    >
      <div style={{ maxWidth: 1080, margin: '0 auto' }}>

        {/* ── Le déroulé ─────────────────────────────────────────────── */}
        <div style={{
          fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
          color: OR, fontWeight: 600, marginBottom: 10,
        }}>
          {L.parcours_surtitre}
        </div>

        <h2
          id="titre-parcours"
          style={{
            fontFamily: 'var(--font-cormorant), Georgia, serif',
            fontSize: 34, lineHeight: 1.15, color: ENCRE,
            fontWeight: 500, margin: '0 0 10px',
          }}
        >
          {L.parcours_titre}
        </h2>

        <p style={{ fontSize: 14, lineHeight: 1.65, color: ENCRE_2, margin: '0 0 32px', maxWidth: 620 }}>
          {L.parcours_sous_titre}
        </p>

        {/* La numérotation porte une information : ces étapes se suivent
            vraiment dans cet ordre, on ne peut pas payer avant d'avoir
            renseigné le trajet. */}
        <ol style={{
          listStyle: 'none', margin: '0 0 56px', padding: 0,
          display: 'grid', gap: 20,
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        }}>
          {ETAPES.map((e, i) => (
            <li key={e.titre} style={{
              background: CREME,
              border: '1px solid rgba(var(--or-rvb),.16)',
              borderRadius: 12,
              padding: '22px 22px 24px',
            }}>
              <div style={{
                fontFamily: 'var(--font-jetbrains), ui-monospace, monospace',
                fontSize: 12, fontWeight: 500, color: OR,
                letterSpacing: '.08em', marginBottom: 12,
              }}>
                {String(i + 1).padStart(2, '0')}
              </div>
              <h3 style={{
                fontSize: 15, fontWeight: 600, color: ENCRE,
                margin: '0 0 8px', lineHeight: 1.3,
              }}>
                {en ? e.titreEn : e.titre}
              </h3>
              <p style={{ fontSize: 13.5, lineHeight: 1.65, color: ENCRE_2, margin: 0 }}>
                {en ? e.texteEn : e.texte}
              </p>
            </li>
          ))}
        </ol>

        {/* ── Les questions ──────────────────────────────────────────── */}
        <div style={{
          fontSize: 10, letterSpacing: '.16em', textTransform: 'uppercase',
          color: OR, fontWeight: 600, marginBottom: 10,
        }}>
          {L.questions_surtitre}
        </div>

        <h2
          id="titre-questions"
          style={{
            fontFamily: 'var(--font-cormorant), Georgia, serif',
            fontSize: 34, lineHeight: 1.15, color: ENCRE,
            fontWeight: 500, margin: '0 0 28px',
          }}
        >
          {L.questions_titre}
        </h2>

        <div style={{ display: 'grid', gap: 2, maxWidth: 820 }}>
          {QUESTIONS.map(({ q, r, qEn, rEn }) => (
            <details
              key={q}
              name="questions-reserver"
              style={{
                borderBottom: '1px solid rgba(var(--contraste-rvb),.1)',
                padding: '4px 0',
              }}
            >
              <summary style={{
                cursor: 'pointer', listStyle: 'none',
                fontSize: 14.5, fontWeight: 600, color: ENCRE,
                padding: '16px 28px 16px 0', position: 'relative',
                lineHeight: 1.4,
              }}>
                {en ? qEn : q}
                <span aria-hidden="true" className="q-chevron" style={{
                  position: 'absolute', right: 2, top: '50%',
                  marginTop: -5, width: 9, height: 9,
                  borderRight: `1.5px solid ${OR}`, borderBottom: `1.5px solid ${OR}`,
                  transform: 'rotate(45deg)',
                  transition: 'transform .18s ease',
                }} />
              </summary>
              <p style={{
                fontSize: 13.5, lineHeight: 1.7, color: ENCRE_2,
                margin: '0 0 18px', maxWidth: 680,
              }}>
                {en ? rEn : r}
              </p>
            </details>
          ))}
        </div>

        <p style={{ fontSize: 12.5, lineHeight: 1.7, color: ENCRE_2, margin: '26px 0 0' }}>
          {L.conditions_phrase}{' '}
          <Link
            href="/mentions-legales"
            className="lien-conditions"
            style={{ color: OR, textDecoration: 'none', fontWeight: 600 }}
          >
            {L.mentions_legales}
          </Link>.
        </p>
      </div>

      {/* Un élément cliquable sans état visible au survol, au focus clavier
          et à l'activation n'est pas fini. Le chevron tourne à l'ouverture :
          c'est `transform`, jamais une propriété qui force une mise en page. */}
      <style>{`
        .q-chevron { transform-origin: center; }
        details[open] > summary .q-chevron { transform: rotate(-135deg); }
        details > summary::-webkit-details-marker { display: none; }
        details > summary:hover { color: ${OR}; }
        details > summary:focus-visible {
          outline: 2px solid ${OR};
          outline-offset: 3px;
          border-radius: 3px;
        }
        .lien-conditions:hover { color: var(--gold-bright); text-decoration: underline; }
        .lien-conditions:focus-visible {
          outline: 2px solid ${OR};
          outline-offset: 3px;
          border-radius: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          .q-chevron { transition: none; }
        }
      `}</style>
    </section>
  )
}
