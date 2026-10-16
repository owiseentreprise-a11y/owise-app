/**
 * Première page en anglais du site — un test, pas une traduction du site.
 *
 * POURQUOI CETTE PAGE ET PAS UNE AUTRE
 *
 * Search Console, 13 juillet → 10 octobre 2026 : cinq requêtes en anglais
 * seulement, dont deux qui portent tout le volume et désignent le même trajet :
 *
 *     « chantilly to charles de gaulle airport »   22 impressions, position 31,3
 *     « charles de gaulle airport to chantilly »   14 impressions, position 43,4
 *
 * 36 impressions, zéro clic. Le site n'a aucune page en anglais : il apparaît
 * malgré lui, en page 4, sur une intention qu'il sait pourtant servir. C'est le
 * seul endroit du site où une page anglaise a une demande mesurée derrière elle,
 * et c'est pour ça qu'on commence ici, par une page, plutôt que par la
 * traduction d'un site de 38 pages et 138 articles sur une hypothèse.
 *
 * Ce qu'on attend : la position passe de 31 à la première page, et des clics
 * apparaissent. Si rien ne bouge en quelques semaines, l'hypothèse est fausse et
 * on aura dépensé une page.
 *
 * AUCUN PRIX N'EST ÉCRIT ICI
 *
 * `audit-tarifs.mjs` ne relit qu'un seul fichier, `[destination]/page.tsx` : un
 * prix écrit dans cette page-ci serait hors de tout contrôle, et dériverait sans
 * que personne le voie — c'est exactement le défaut qui a fait facturer
 * `supplement_etape` 10 € pendant des mois. Les trois prix affichés sortent donc
 * de `calculerPrix()`, la même fonction que /reserver et la vitrine, nourrie par
 * la grille en base. Si la lecture échoue, la page n'annonce aucun montant
 * plutôt qu'un montant faux.
 */
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculerPrix } from '@/lib/calcPrix'
import { IDENTITE_OWISE, BASE_OWISE, ficheAvis, lireAvis } from '@/lib/identite-owise'

/* Même cadence que les 38 pages villes, la vitrine et le blog : la page est
 * reconstruite au plus une fois par heure. Sans ça elle serait figée au
 * moment de la compilation, et un tarif modifié dans /admin/tarifs
 * n'apparaîtrait qu'au déploiement suivant — une page publique annonçant un
 * prix que le site ne facture plus. */
export const revalidate = 3600

const CHEMIN    = '/en/chantilly-to-charles-de-gaulle-airport'
const URL_EN    = `${BASE_OWISE}${CHEMIN}`
const URL_FR    = `${BASE_OWISE}/vtc-chantilly-cdg`
const TITRE     = 'Chantilly to Charles de Gaulle Airport — Fixed-Price Transfer'

/* Le trajet, mesuré : 26 km, 27 à 33 minutes selon l'heure, via l'A1 ou la N16.
 * Repris de la page française du même trajet, qui porte déjà ces chiffres. */
const KM      = 26
const MINUTES = '27–33 min'

export const metadata: Metadata = {
  title:       `${TITRE} | Owise`,
  description: 'Private car from Chantilly to Paris-CDG airport and back. Fixed price confirmed before departure, door-to-door pickup, no night or weekend surcharge. English-speaking booking by phone or email.',
  keywords: [
    'chantilly to charles de gaulle airport',
    'charles de gaulle airport to chantilly',
    'chantilly cdg transfer',
    'cdg to chantilly taxi',
    'private transfer chantilly airport',
    'chantilly airport transfer price',
  ],
  alternates: {
    canonical: URL_EN,
    /* Réciproque obligatoire : la page française pointe vers celle-ci, et
     * celle-ci vers elle. Un hreflang qui n'est pas rendu dans les deux sens
     * est ignoré par Google. `x-default` désigne la version servie par défaut
     * aux langues non couvertes — le site est français, donc la française. */
    languages: {
      'en':        URL_EN,
      'fr-FR':     URL_FR,
      'x-default': URL_FR,
    },
  },
  openGraph: {
    title:       TITRE,
    description: 'Fixed-price private transfer between Chantilly and Paris-CDG airport.',
    url:         URL_EN,
    locale:      'en_GB',
    siteName:    'Owise',
    images: [{ url: `${BASE_OWISE}/brand_assets/hero-paris-night.webp`, width: 1920, height: 1080, alt: TITRE }],
  },
}

/* ------------------------------------------------------------------ */

type Prix = { cle: string; nom: string; places: string; montant: number | null }

async function lirePrix() {
  const admin = createAdminClient()

  /* Les colonnes sont listées une par une, comme partout ailleurs : une
   * colonne oubliée ici ferait silencieusement retomber calculerPrix sur ses
   * valeurs de repli, et la page afficherait un prix qui n'est pas celui que
   * le client paiera. */
  const [{ data: zones }, { data: grille }, { data: tarifs }, { data: params }] = await Promise.all([
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code', 'HORS').eq('active', true),
    admin.from('grilles_tarifaires').select('zone_depart_id,zone_arrivee_id,prix_berline'),
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec,supplement_panneau_actif,supplement_panneau_prix,supplement_siege_enfant_actif,supplement_siege_enfant_prix,supplement_bagages_actif,supplement_bagages_prix,supplement_animaux_actif,supplement_animaux_prix,supplement_etape').single(),
  ])
  const avis = await lireAvis(admin)

  const cha = (zones ?? []).find(z => z.code === 'CHA')
  const cdg = (zones ?? []).find(z => z.code === 'CDG')

  const VEHICULES: { cle: string; nom: string; places: string }[] = [
    { cle: 'berline',         nom: 'Sedan',         places: 'up to 3 passengers · 3 bags' },
    { cle: 'berline_premium', nom: 'Premium sedan', places: 'up to 3 passengers · 3 bags' },
    { cle: 'van',             nom: 'Van',           places: 'up to 7 passengers · 7 bags' },
  ]

  const prix: Prix[] = VEHICULES.map(v => {
    /* Date-heure vide : `appliquerSupplements` rend alors le prix inchangé.
     * C'est bien le tarif de base qu'on affiche, pas celui d'un créneau
     * particulier. */
    const brut = (cha && cdg)
      ? calculerPrix(cha.id, cdg.id, v.cle, '', grille ?? [], tarifs ?? [], zones ?? [], params)
      : null

    /* Arrondi à l'euro, comme partout ailleurs sur le site : le widget de la
     * vitrine affiche `Math.round(Number(prix))` et /api/estimations
     * enregistre `Math.round(prix)`. Sans lui, cette page annoncerait
     * « 88,5 € » et « 100,3 € » pour la berline premium et le van — deux
     * montants que personne n'a jamais payés. Les deux seules courses
     * réellement vendues sur ce trajet en berline premium (6 et 7 octobre
     * 2026) l'ont été à 89 €, ce que donne bien Math.round(59 × 1,5).
     *
     * L'arrondi est un choix d'affichage, pas un calcul de prix : le prix
     * lui-même reste produit par calculerPrix(), jamais recalculé ici. */
    return { ...v, montant: brut === null ? null : Math.round(brut) }
  })

  return { prix, params, avis }
}

/* ------------------------------------------------------------------ */

const FAQ = (base: string | null) => [
  {
    q: 'How much is a transfer from Chantilly to Charles de Gaulle airport?',
    a: base
      ? `€${base} in a sedan, for the whole car rather than per passenger. The price is confirmed before departure and does not change with traffic or waiting time at the airport.`
      : 'The price is a fixed amount for the whole car, confirmed in writing before departure. It does not change with traffic or waiting time at the airport.',
  },
  {
    q: 'How long does the drive take?',
    a: `${KM} km, ${MINUTES} depending on the time of day, via the A1 motorway or the N16. Chantilly joins the A1 without crossing any dense urban area, so the gap between the quietest and busiest hours stays small. Your driver works back from your check-in time.`,
  },
  {
    q: 'What happens if my flight is delayed?',
    a: 'We ask for your flight number, terminal and landing time when you book, and your driver adjusts the pickup time to the flight. A delay costs you nothing extra.',
  },
  {
    q: 'Is there a surcharge at night or at the weekend?',
    a: 'No. There is no night surcharge and no weekend surcharge — a 4 a.m. pickup on a Sunday costs the same as a Tuesday afternoon.',
  },
  {
    q: 'Which towns are covered by this price?',
    a: 'Chantilly, Gouvieux, Lamorlaye, Coye-la-Forêt and anywhere within about 5 km of Chantilly. Pickup is at your address, not at a meeting point.',
  },
  {
    q: 'Can I book in English?',
    a: 'Yes. The online booking form is in French for now, so if you would rather deal in English, send us an email or a WhatsApp message and we will confirm everything in English.',
  },
]

/* ------------------------------------------------------------------ */

export default async function ChantillyCdgEnPage() {
  const { prix, params, avis } = await lirePrix()

  const berline = prix.find(p => p.cle === 'berline')?.montant ?? null
  const base    = berline !== null ? String(berline) : null

  /* Ce qui se paie en plus. Lu dans les réglages, et seulement si l'option est
   * active : annoncer « tout compris » quand quatre suppléments existent est un
   * mensonge que le client découvre au moment de payer. */
  const extras = [
    params?.supplement_panneau_actif      && { quoi: 'Name-board welcome inside the terminal', prix: params.supplement_panneau_prix },
    params?.supplement_siege_enfant_actif && { quoi: 'Child seat',                             prix: params.supplement_siege_enfant_prix },
    params?.supplement_bagages_actif      && { quoi: 'Extra luggage beyond the car’s capacity', prix: params.supplement_bagages_prix },
    params?.supplement_animaux_actif      && { quoi: 'Travelling with a pet',                   prix: params.supplement_animaux_prix },
    params?.supplement_etape              && { quoi: 'Each additional stop',                    prix: params.supplement_etape },
  ].filter(Boolean) as { quoi: string; prix: number }[]

  const ficheLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'TaxiService'],
    ...IDENTITE_OWISE,
    name: 'Owise — Private Chauffeur Service',
    description: 'Fixed-price private transfers between Chantilly and Paris-Charles de Gaulle airport.',
    url: URL_EN,
    areaServed: [
      { '@type': 'City', name: 'Chantilly', postalCode: '60500' },
      { '@type': 'Airport', name: 'Paris-Charles de Gaulle Airport', iataCode: 'CDG' },
    ],
    makesOffer: prix
      .filter(p => p.montant !== null)
      .map(p => ({
        '@type': 'Offer',
        name: `Chantilly ↔ CDG — ${p.nom}`,
        priceCurrency: 'EUR',
        price: String(p.montant),
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: String(p.montant),
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: true,
        },
      })),
    potentialAction: {
      '@type': 'ReserveAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE_OWISE}/reserver` },
    },
    aggregateRating: ficheAvis(avis.nombre, avis.note),
  }

  const filAriane = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Owise', item: BASE_OWISE },
      { '@type': 'ListItem', position: 2, name: 'Chantilly to CDG airport', item: URL_EN },
    ],
  }

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ(base).map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  const tel = IDENTITE_OWISE.telephone
  const telLisible = '+33 6 19 10 63 56'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(filAriane) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* `lang` sur le contenu : la balise <html> du site est en français et
          n'est rendue que par la mise en page racine. Déclarer la langue sur ce
          sous-arbre est la façon correcte de signaler un îlot anglais sans
          refondre toute l'application. */}
      <main lang="en" style={{ background: '#09091A', minHeight: '100vh', fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>

        {/* ---- en-tête ------------------------------------------------ */}
        <header style={{
          borderBottom: '1px solid rgba(201,168,76,.16)', padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <Link href="/" style={{ color: '#C9A84C', textDecoration: 'none', fontSize: 17, fontWeight: 600, letterSpacing: '.14em' }}>
            OWISE
          </Link>
          <Link
            href="/vtc-chantilly-cdg"
            hrefLang="fr"
            style={{ color: 'rgba(237,232,223,.55)', textDecoration: 'none', fontSize: 12.5, letterSpacing: '.04em' }}
          >
            Version française →
          </Link>
        </header>

        {/* ---- bandeau principal -------------------------------------- */}
        <section style={{ padding: '64px 20px 56px', maxWidth: 940, margin: '0 auto' }}>
          <p style={{
            fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase',
            color: 'rgba(201,168,76,.85)', marginBottom: 18,
          }}>
            Private transfer · Oise &amp; Paris region
          </p>
          <h1 style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: 'clamp(34px, 6vw, 60px)', fontWeight: 500, lineHeight: 1.08,
            color: '#EDE8DF', margin: '0 0 22px', textWrap: 'balance',
          }}>
            Chantilly to Charles de Gaulle airport, at a price fixed before you leave
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.75, color: 'rgba(237,232,223,.72)', maxWidth: 620, margin: '0 0 36px' }}>
            Door-to-door, {KM} km, {MINUTES}. One car, one price, agreed in writing
            before departure — it does not move with the traffic, with the meter, or
            with how long your flight keeps us waiting. The same price applies in
            both directions, Chantilly to the airport and airport to Chantilly.
          </p>

          {/* ---- les trois prix réels -------------------------------- */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: 12, marginBottom: 32,
          }}>
            {prix.map(p => (
              <div key={p.cle} style={{
                background: '#181832', border: '1px solid rgba(201,168,76,.16)',
                borderRadius: 12, padding: '20px 18px',
              }}>
                <div style={{ fontSize: 9.5, letterSpacing: '.2em', textTransform: 'uppercase', color: '#848499', marginBottom: 10 }}>
                  {p.nom}
                </div>
                <div style={{
                  fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace",
                  fontSize: 27, fontWeight: 500, color: '#C9A84C', marginBottom: 8,
                }}>
                  {p.montant !== null ? `€${p.montant}` : '—'}
                </div>
                <div style={{ fontSize: 12.5, color: 'rgba(237,232,223,.55)', lineHeight: 1.5 }}>
                  {p.places}
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: '#848499', margin: '0 0 36px', lineHeight: 1.65 }}>
            Price per car, not per passenger. No night surcharge, no weekend
            surcharge. Covers Chantilly, Gouvieux, Lamorlaye and Coye-la-Forêt.
          </p>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link href="/reserver" style={{
              display: 'inline-flex', alignItems: 'center', padding: '14px 28px',
              background: '#C9A84C', color: '#09091A', borderRadius: 9,
              fontSize: 14, fontWeight: 600, textDecoration: 'none', letterSpacing: '.01em',
            }}>
              Book this transfer
            </Link>
            <a href={`tel:${tel}`} style={{
              display: 'inline-flex', alignItems: 'center', padding: '14px 28px',
              background: 'transparent', color: '#EDE8DF', borderRadius: 9,
              border: '1px solid rgba(201,168,76,.3)',
              fontSize: 14, fontWeight: 500, textDecoration: 'none',
            }}>
              {telLisible}
            </a>
          </div>
          <p style={{ fontSize: 12.5, color: '#848499', marginTop: 16, lineHeight: 1.65, maxWidth: 560 }}>
            The online form is in French for the moment. If you would rather book
            in English, call or write to{' '}
            <a href={`mailto:${IDENTITE_OWISE.email}`} style={{ color: '#C9A84C' }}>{IDENTITE_OWISE.email}</a>{' '}
            and we will confirm everything in English.
          </p>
        </section>

        {/* ---- ce qui est inclus, et ce qui ne l'est pas -------------- */}
        <section style={{ background: '#F8F6F1', padding: '56px 20px' }}>
          <div style={{ maxWidth: 940, margin: '0 auto' }}>
            <h2 style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 500, color: '#0A0A0A',
              margin: '0 0 28px', textWrap: 'balance',
            }}>
              What the price includes — and what it does not
            </h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 28 }}>
              <div>
                <h3 style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#3DB87A', margin: '0 0 14px' }}>
                  Included
                </h3>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14.5, lineHeight: 1.9, color: '#4A4A4A' }}>
                  <li>Pickup at your address, not at a meeting point</li>
                  <li>Your flight followed — a delay costs nothing</li>
                  <li>Waiting time at the airport</li>
                  <li>Tolls and fuel</li>
                  <li>Price confirmed in writing before departure</li>
                </ul>
              </div>

              <div>
                <h3 style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#E8A030', margin: '0 0 14px' }}>
                  Charged separately
                </h3>
                {extras.length > 0 ? (
                  <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 14.5, lineHeight: 1.9, color: '#4A4A4A' }}>
                    {extras.map((e, i) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid rgba(0,0,0,.07)', padding: '3px 0' }}>
                        <span>{e.quoi}</span>
                        <span style={{ fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace", color: '#0A0A0A', whiteSpace: 'nowrap' }}>
                          +€{e.prix}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p style={{ fontSize: 14.5, color: '#4A4A4A' }}>Nothing is charged on top.</p>
                )}
                <p style={{ fontSize: 12.5, color: '#6B6B6B', marginTop: 14, lineHeight: 1.6 }}>
                  We would rather list these here than let you find them at the end.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ---- questions --------------------------------------------- */}
        <section style={{ background: '#fff', padding: '56px 20px' }}>
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <h2 style={{
              fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
              fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 500, color: '#0A0A0A', margin: '0 0 30px',
            }}>
              Questions travellers ask us
            </h2>
            {FAQ(base).map((f, i) => (
              <div key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,.08)', padding: '20px 0' }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#0A0A0A', margin: '0 0 8px', lineHeight: 1.4 }}>
                  {f.q}
                </h3>
                <p style={{ fontSize: 14.5, color: '#5A5A5A', lineHeight: 1.75, margin: 0 }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- pied -------------------------------------------------- */}
        <footer style={{ background: '#09091A', borderTop: '1px solid rgba(201,168,76,.14)', padding: '40px 20px' }}>
          <div style={{ maxWidth: 940, margin: '0 auto', fontSize: 13, color: '#848499', lineHeight: 1.8 }}>
            <p style={{ margin: '0 0 10px', color: '#EDE8DF' }}>
              Owise — Houna Hassan, sole trader
            </p>
            <p style={{ margin: '0 0 10px' }}>
              14 rue du Vieux Moulin, 60740 Saint-Maximin, France · SIRET 477 534 135 00041
            </p>
            <p style={{ margin: '0 0 16px' }}>
              <a href={`tel:${tel}`} style={{ color: '#C9A84C', textDecoration: 'none' }}>{telLisible}</a>
              {' · '}
              <a href={`mailto:${IDENTITE_OWISE.email}`} style={{ color: '#C9A84C', textDecoration: 'none' }}>{IDENTITE_OWISE.email}</a>
            </p>
            <p style={{ margin: 0 }}>
              <Link href="/vtc-chantilly-cdg" hrefLang="fr" style={{ color: 'rgba(237,232,223,.6)', textDecoration: 'none' }}>
                Cette page en français
              </Link>
              {' · '}
              <Link href="/mentions-legales" style={{ color: 'rgba(237,232,223,.6)', textDecoration: 'none' }}>
                Legal notice
              </Link>
            </p>
          </div>
        </footer>
      </main>
    </>
  )
}
