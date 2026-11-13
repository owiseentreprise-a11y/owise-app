/**
 * Deuxième page en anglais du site — « private chauffeur paris ».
 *
 * POURQUOI CELLE-CI
 *
 * La première page anglaise visait une demande mesurée dans Search Console.
 * Celle-ci part d'un constat différent, et il faut le dire honnêtement : les
 * clients étrangers d'Owise arrivent en « direct », jamais par Google. Cette
 * page n'est donc pas un pari sur le référencement anglais — c'est la version
 * lisible de l'offre pour quelqu'un qui arrive déjà, par un hôtel, par une
 * recommandation ou par un assistant conversationnel.
 *
 * AUCUN PRIX N'EST ÉCRIT ICI
 *
 * Même règle que la page Chantilly → CDG, et pour la même raison :
 * `audit-tarifs.mjs` ne relit que `[destination]/page.tsx`. Un montant écrit
 * dans ce fichier-ci serait hors de tout contrôle et dériverait sans que
 * personne le voie. Tous les prix affichés sortent de `calculerPrix()`, la
 * même fonction que /reserver et la vitrine, nourrie par la grille en base.
 * Si la lecture échoue, la page n'annonce aucun montant plutôt qu'un montant
 * faux.
 *
 * CE QU'ELLE NE PROMET PAS
 *
 * Le formulaire de réservation est en français. La page le dit, et propose
 * l'e-mail comme solution — sans affirmer que le tarif affiché s'appliquera
 * à une demande par e-mail, puisque celle-ci ne passe pas par le calculateur.
 */
import type { Metadata } from 'next'
import type React from 'react'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { calculerPrix, COLONNES_GRILLE } from '@/lib/calcPrix'
import { IDENTITE_OWISE, BASE_OWISE, ficheAvis, lireAvis } from '@/lib/identite-owise'
import { presentationVehicule } from '@/lib/presentation-vehicules'
import { lienDevis, EMAIL_DEVIS, telephoneLisible } from '@/lib/devis-et-tarifs'
/* La route anglaise de la réservation ne se recopie pas : elle vit dans
   `langue.ts`, avec son jumeau français. Cette page a dit pendant trois
   semaines que le formulaire n'existait qu'en français, et son bouton
   « Book now » menait au formulaire FRANÇAIS — y compris dans sa fiche
   structurée, c'est-à-dire dans la phrase qu'un assistant recopie. */
import { JUMEAU_RESERVATION } from '@/lib/langue'
/* La mise a disposition : les mots dans `mise-a-disposition.ts`, les prix
   dans la table `tarifs`, le calcul dans `calcPrix.ts`. Cette page ne fait
   que les montrer — elle n'ecrit ni prix ni regle. */
import { GAMME } from '@/lib/gamme'
import { formaterMontant } from '@/lib/montant'
import {
  MENTION_TARIFS_EN, DEFINITION_EN, USAGES_EN, FRAIS_EN_SUS_EN,
} from '@/lib/mise-a-disposition'
import { KM_PAR_HEURE_MAD, DUREE_MIN_MAD } from '@/lib/calcPrix'
import DemandeMiseADisposition, { type VehiculeMAD }
  from '@/app/mise-a-disposition/DemandeMiseADisposition'
import { chargerParametres } from '@/lib/tarification'

/* Même cadence que le reste du site : reconstruite au plus une fois par
 * heure, pour qu'un tarif modifié dans /admin/tarifs apparaisse sans
 * attendre un déploiement. */
export const revalidate = 3600

const CHEMIN = '/en/private-chauffeur-paris'
const URL_EN = `${BASE_OWISE}${CHEMIN}`
const URL_FR = `${BASE_OWISE}/vtc-paris`
const TITRE  = 'Private Chauffeur in Paris — Fixed Fares from €29'

export const metadata: Metadata = {
  title:       `${TITRE} | Owise`,
  description: 'Private chauffeur in Paris: CDG, Orly and Beauvais-Tillé airports, stations, long distance. Fixed price per car, confirmed before departure.',
  keywords: [
    'private chauffeur paris',
    'paris airport transfer price',
    'paris to cdg private car',
    'chauffeur hire paris day',
    'private driver paris',
    'paris le bourget transfer',
  ],
  alternates: {
    canonical: URL_EN,
    /* hreflang dans les DEUX sens : la page française déclare celle-ci via
     * JUMEAUX_EN, celle-ci renvoie vers elle. Un hreflang unilatéral est
     * ignoré par Google. `x-default` désigne le français, qui reste la
     * version servie par défaut. */
    languages: {
      'en':        URL_EN,
      'fr-FR':     URL_FR,
      'x-default': URL_FR,
    },
  },
  openGraph: {
    title: TITRE,
    description: 'Fixed-price private chauffeur service in Paris: airports, stations, long distance, hourly hire at a published rate per hour.',
    url: URL_EN,
    locale: 'en_GB',
    siteName: 'Owise',
    images: [{ url: `${BASE_OWISE}/brand_assets/hero-paris-night.webp`, width: 1920, height: 1080, alt: 'Private chauffeur in Paris' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITRE,
    description: 'Fixed-price private chauffeur service in Paris.',
    images: [`${BASE_OWISE}/brand_assets/hero-paris-night.webp`],
  },
}

type Prix = { cle: string; nom: string; places: string; montant: number | null }
type Liaison = { zone: string; libelle: string; montant: number | null }

/** Les liaisons affichées. Aucun montant ici : seulement les zones. */
const LIAISONS: { zone: string; libelle: string }[] = [
  { zone: 'Z1',   libelle: 'Within central Paris' },
  { zone: 'GARE', libelle: 'Paris railway stations (Nord, Lyon, Montparnasse…)' },
  { zone: 'ORY',  libelle: 'Orly airport (ORY)' },
  { zone: 'CDG',  libelle: 'Paris-Charles de Gaulle (CDG)' },
  { zone: 'CHA',  libelle: 'Chantilly and surroundings' },
  { zone: 'RPF',  libelle: 'Roissy Pays de France' },
  { zone: 'CRL',  libelle: 'Creil and surroundings' },
  { zone: 'BVA',  libelle: 'Beauvais-Tillé airport (BVA)' },
  { zone: 'LIL',  libelle: 'Lille and northern France' },
  { zone: 'BEL',  libelle: 'Belgium (Brussels, Charleroi)' },
]

const VEHICULES: { cle: string; nom: string; places: string }[] = [
  { cle: 'berline',         nom: 'Sedan',         places: 'up to 3 passengers · 3 bags' },
  { cle: 'berline_premium', nom: 'Premium sedan', places: 'up to 4 passengers · 3 bags' },
  { cle: 'van',             nom: 'Van',           places: 'up to 7 passengers · 7 bags' },
]

/**
 * Le nom anglais d'un vehicule, pour l'affichage SEULEMENT.
 *
 * `gamme.ts` reste la seule source du nom qui compte — celui qui relie un
 * vehicule a sa ligne de la table `tarifs`, et qui ne doit jamais etre
 * traduit. Ici on ne traduit que ce que le lecteur voit : ecrire
 * « Van 7 places » sur une page anglaise, au milieu de « Sedan » et
 * « Premium sedan », donnerait une page a moitie traduite.
 */
const NOM_EN: Record<string, string> = {
  berline: 'Sedan',
  berline_premium: 'Premium sedan',
  van: 'Van, 7 seats',
  grand_van: 'Large van, 8 seats',
}

async function lireDonnees() {
  const admin = createAdminClient()
  const [{ data: zones }, { data: grille }, { data: tarifs }, { data: params }] = await Promise.all([
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code', 'HORS').eq('active', true),
    admin.from('grilles_tarifaires').select(COLONNES_GRILLE),
    admin.from('tarifs').select('*')   /* '*' et pas une liste : voir la note dans tarification.ts */,
    chargerParametres(admin).then(d => ({ data: d })),
  ])
  const avis = await lireAvis(admin)

  const z1 = (zones ?? []).find(z => z.code === 'Z1')
  const cdg = (zones ?? []).find(z => z.code === 'CDG')

  /* Date-heure vide : `appliquerSupplements` rend alors le prix inchangé.
   * C'est le tarif de base qu'on affiche, pas celui d'un créneau donné. */
  const calc = (depart: string | undefined, arrivee: string | undefined, vehicule: string) =>
    (depart && arrivee)
      ? calculerPrix(depart, arrivee, vehicule, '', grille ?? [], tarifs ?? [], zones ?? [], params)
      : null

  /* Les trois catégories, sur la liaison phare Paris → CDG. Arrondi à l'euro,
   * comme partout ailleurs sur le site : sans lui on annoncerait « 103,5 € »,
   * un montant que personne n'a jamais payé. L'arrondi est un choix
   * d'affichage ; le prix reste produit par calculerPrix(). */
  const prix: Prix[] = VEHICULES.map(v => {
    const brut = calc(z1?.id, cdg?.id, v.cle)
    return { ...v, montant: brut === null ? null : Math.round(brut) }
  })

  const liaisons: Liaison[] = LIAISONS.map(l => {
    const z = (zones ?? []).find(x => x.code === l.zone)
    const brut = calc(z1?.id, z?.id, 'berline')
    return { ...l, montant: brut === null ? null : Math.round(brut) }
  }).filter(l => l.montant !== null)

  /* Les vehicules avec leur tarif horaire. L'ordre vient de GAMME, seule
     source des noms et de l'ordre d'affichage. Un vehicule sans
     `prix_heure` reste `null` : la page ecrit alors « on request » plutot
     qu'un prix invente. */
  const parHeure: VehiculeMAD[] = GAMME.map(v => {
    const ligne = (tarifs ?? []).find((t: { vehicule: string }) => t.vehicule === v.nomTarif)
    const brut = (ligne as { prix_heure?: number | null } | undefined)?.prix_heure
    const ph = brut == null ? null : Number(brut)
    return {
      cle: v.cle,
      nom: NOM_EN[v.cle] ?? v.nom,
      places: v.capaciteMin === v.capaciteMax
        ? `${v.capaciteMax} passengers`
        : `up to ${v.capaciteMax} passengers`,
      prixHeure: ph != null && Number.isFinite(ph) && ph > 0 ? ph : null,
      prixKmSup: (() => {
        const b = (ligne as { prix_km_sup?: number | null } | undefined)?.prix_km_sup
        const n = b == null ? null : Number(b)
        return n != null && Number.isFinite(n) && n > 0 ? n : null
      })(),
      /* Meme illustration que la page francaise et que la flotte de
         l'accueil : une image de vehicule n'a pas de langue. */
      image: presentationVehicule(v.cle)?.img ?? null,
    }
  })

  return { prix, liaisons, params, avis, parHeure }
}

const FAQ = (cdg: number | null) => [
  {
    q: 'How much is a private car from Paris to CDG airport?',
    a: cdg
      ? `€${cdg} in a sedan, for the whole car rather than per passenger. The price is confirmed before departure and does not change with traffic or waiting time at the airport.`
      : 'A fixed price for the whole car, confirmed before departure. It does not change with traffic or waiting time at the airport.',
  },
  {
    q: 'Is the price per person?',
    a: 'No. The fare is for the car. A sedan seats up to 4 passengers depending on the model, a van up to 7, and a larger van up to 8 on request.',
  },
  {
    q: 'What happens if my flight is delayed?',
    a: 'We ask for your flight number and landing time when you book, and your driver adjusts the pick-up time to the flight.',
  },
  {
    q: 'Do you serve Le Bourget airport?',
    a: 'Yes. Le Bourget has no flat rate: the price is calculated for your exact address and confirmed before departure, like any other journey.',
  },
  {
    q: 'Can I hire a chauffeur for a few hours or a full day?',
    a: 'Yes, on request. The price depends on the duration and the itinerary — write to us with the date, the start time, roughly how long you need the car and the pick-up point.',
  },
  {
    q: 'Can I book in English?',
    a: `Yes. The booking form is available in English at ${BASE_OWISE}${JUMEAU_RESERVATION.en} — you enter your addresses, see the price and confirm online. Hourly hire is also priced and requested on this page, lower down. Private tours are quoted case by case: write to ${EMAIL_DEVIS}.`,
  },
]

export default async function Page() {
  const { prix, liaisons, params, avis, parHeure } = await lireDonnees()
  const base = prix.find(p => p.cle === 'berline')?.montant ?? null

  const ficheLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'TaxiService'],
    ...IDENTITE_OWISE,
    name: 'Owise — Private Chauffeur Service',
    description: 'Fixed-price private chauffeur service in Paris: airport and station transfers, long-distance journeys, hourly hire at a published rate per hour.',
    url: URL_EN,
    areaServed: [
      { '@type': 'City', name: 'Paris', postalCode: '75000' },
      { '@type': 'Airport', name: 'Paris-Charles de Gaulle Airport', iataCode: 'CDG' },
      { '@type': 'Airport', name: 'Paris-Orly Airport', iataCode: 'ORY' },
      { '@type': 'Airport', name: 'Paris-Beauvais Airport', iataCode: 'BVA' },
      { '@type': 'Airport', name: 'Paris-Le Bourget Airport', iataCode: 'LBG' },
    ],
    makesOffer: [
      ...prix.filter(p => p.montant !== null).map(p => ({
        '@type': 'Offer',
        name: `Paris ↔ CDG — ${p.nom}`,
        priceCurrency: 'EUR',
        price: String(p.montant),
        priceSpecification: {
          '@type': 'PriceSpecification',
          price: String(p.montant),
          priceCurrency: 'EUR',
          valueAddedTaxIncluded: true,
        },
      })),
      /* Les prestations sur devis sont déclarées SANS prix. Une offre sans
       * montant est correcte en Schema.org ; inventer une fourchette ne le
       * serait pas. */
      /* Jusqu'au 2026-11-13 cette offre etait declaree SANS prix, faute
         d'en avoir un. Elle en a un maintenant, par vehicule et par heure :
         l'unite `HUR` evite qu'un moteur la lise comme un forfait. */
      ...parHeure.filter(v => v.prixHeure != null).map(v => ({
        '@type': 'Offer',
        name: `Hourly chauffeur hire in Paris \u2014 ${v.nom}`,
        priceCurrency: 'EUR',
        priceSpecification: {
          '@type': 'UnitPriceSpecification',
          price: String(v.prixHeure),
          priceCurrency: 'EUR',
          unitCode: 'HUR',
          unitText: 'hour',
          valueAddedTaxIncluded: true,
        },
        availability: 'https://schema.org/LimitedAvailability',
      })),
      { '@type': 'Offer', name: 'Private tours of Paris with a chauffeur',  availability: 'https://schema.org/InStock' },
      { '@type': 'Offer', name: 'Business travel and executive transport',  availability: 'https://schema.org/InStock' },
    ],
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
      { '@type': 'ListItem', position: 2, name: 'Private chauffeur in Paris', item: URL_EN },
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

  const or    = '#C9A84C'
  const creme = '#EDE8DF'
  const doux  = 'rgba(237,232,223,.72)'

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(filAriane) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />

      {/* `lang` sur le contenu : la balise <html> du site est en français.
          Déclarer la langue sur ce sous-arbre est la façon correcte de
          signaler un îlot anglais sans refondre l'application. */}
      <main lang="en" style={{ background: '#09091A', minHeight: '100vh', fontFamily: "var(--font-dm-sans), 'DM Sans', sans-serif" }}>

        {/* ---- en-tête ------------------------------------------------ */}
        <header style={{
          borderBottom: '1px solid rgba(201,168,76,.16)', padding: '14px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
        }}>
          <Link href="/" style={{ color: or, textDecoration: 'none', fontSize: 17, fontWeight: 600, letterSpacing: '.14em' }}>
            OWISE
          </Link>
          <Link href="/vtc-paris" hrefLang="fr" style={{ color: 'rgba(237,232,223,.55)', textDecoration: 'none', fontSize: 12.5, letterSpacing: '.04em' }}>
            Version française →
          </Link>
        </header>

        {/* ---- bandeau principal -------------------------------------- */}
        <section style={{ padding: '64px 20px 48px', maxWidth: 940, margin: '0 auto' }}>
          <p style={{ fontSize: 10.5, letterSpacing: '.22em', textTransform: 'uppercase', color: 'rgba(201,168,76,.85)', marginBottom: 18 }}>
            Private chauffeur · Paris &amp; Île-de-France
          </p>
          <h1 style={{
            fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
            fontSize: 'clamp(34px, 6vw, 60px)', fontWeight: 500, lineHeight: 1.08,
            color: creme, margin: '0 0 22px', textWrap: 'balance',
          }}>
            Private chauffeur in Paris — a fixed price, agreed before you travel
          </h1>
          <p style={{ fontSize: 16.5, lineHeight: 1.75, color: doux, maxWidth: 640, margin: '0 0 36px' }}>
            Owise drives you within Paris and from Paris: airport and railway station
            transfers, connections to the Oise region, long-distance journeys, and
            hourly hire or private tours on request. The price is agreed and confirmed
            before departure — it does not change with traffic, nor with waiting time
            at the airport. The fare is for the whole car, not per passenger.
          </p>

          {/* ---- les trois prix réels, Paris → CDG ------------------- */}
          <p style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(237,232,223,.60)', marginBottom: 12 }}>
            Paris → Charles de Gaulle airport
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 12, marginBottom: 32 }}>
            {prix.map(p => (
              <div key={p.cle} style={{
                border: '1px solid rgba(201,168,76,.18)', borderRadius: 12,
                padding: '18px 20px', background: 'rgba(201,168,76,.04)',
              }}>
                <div style={{ fontSize: 13, color: doux, marginBottom: 6 }}>{p.nom}</div>
                <div style={{ fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace", fontSize: 26, fontWeight: 500, color: or }}>
                  {p.montant !== null ? `€${p.montant}` : '—'}
                </div>
                <div style={{ fontSize: 11.5, color: 'rgba(237,232,223,.5)', marginTop: 6 }}>{p.places}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <Link href={JUMEAU_RESERVATION.en} style={{
              display: 'inline-block', background: or, color: '#09091A', textDecoration: 'none',
              padding: '13px 26px', borderRadius: 9, fontSize: 14.5, fontWeight: 600,
            }}>
              Book now — instant price
            </Link>
            <a href={`tel:${IDENTITE_OWISE.telephone}`} style={{ fontSize: 14, color: doux, textDecoration: 'none' }}>
              or call {telephoneLisible(IDENTITE_OWISE.telephone)}
            </a>
          </div>

          {/* ---- ce qui se réserve en ligne, et ce qui se devise ------
                 Cet encadré disait l'inverse jusqu'au 2026-11-06 : « notre
                 formulaire est en français, écrivez-nous ». C'était vrai
                 quand la page a été écrite. Ce qui reste vrai, et qui est le
                 seul avertissement encore utile : la mise à disposition et
                 les circuits ne se réservent pas en ligne. */}
          <p style={{
            marginTop: 20, padding: '14px 18px', borderRadius: 10,
            background: 'rgba(232,160,48,.08)', border: '1px solid rgba(232,160,48,.22)',
            fontSize: 13.5, lineHeight: 1.7, color: 'rgba(237,232,223,.8)', maxWidth: 640,
          }}>
            The booking form is available in English: you enter your addresses, see
            the price and confirm online. Hourly hire, private tours and business
            travel are not booked online — write to{' '}
            <a href={`mailto:${EMAIL_DEVIS}`} style={{ color: or, textDecoration: 'none', fontWeight: 600 }}>{EMAIL_DEVIS}</a>
            {' '}and we will quote your programme.
          </p>
        </section>

        {/* ---- tableau des tarifs ------------------------------------- */}
        {liaisons.length > 0 && (
          <section style={{ padding: '0 20px 56px', maxWidth: 940, margin: '0 auto' }}>
            <h2 style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: creme, margin: '0 0 8px' }}>
              Fixed fares from Paris
            </h2>
            <p style={{ fontSize: 14, color: doux, margin: '0 0 20px', maxWidth: 620, lineHeight: 1.7 }}>
              Price for the whole car, in both directions. Sedan; Premium and Van
              categories are shown at booking.
            </p>
            <div style={{ border: '1px solid rgba(201,168,76,.14)', borderRadius: 12, overflow: 'hidden' }}>
              {liaisons.map((l, i) => (
                <div key={l.zone} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                  padding: '13px 18px',
                  background: i % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(201,168,76,.08)',
                }}>
                  <span style={{ fontSize: 13.5, color: doux }}>{l.libelle}</span>
                  <span style={{ fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace", fontSize: 15, fontWeight: 500, color: or, whiteSpace: 'nowrap' }}>
                    €{l.montant}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 13, color: 'rgba(237,232,223,.55)', marginTop: 14, lineHeight: 1.7 }}>
              Any address not listed here? The price is calculated for your exact
              address on the booking page, before you commit to anything.
            </p>
          </section>
        )}

        {/* ---- aéroports ---------------------------------------------- */}
        <section style={{ padding: '0 20px 56px', maxWidth: 940, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: creme, margin: '0 0 20px' }}>
            Airport transfers from Paris
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
            {[
              { code: 'CDG', nom: 'Paris-Charles de Gaulle (CDG)', note: 'Your driver follows the flight number and meets you on arrival.' },
              { code: 'ORY', nom: 'Orly (ORY)', note: 'All terminals.' },
              { code: 'BVA', nom: 'Beauvais-Tillé (BVA)', note: 'Useful for low-cost flights, poorly served from Paris at early departure times.' },
              /* Pas de code : Le Bourget n'a aucun forfait en grille. On
                 l'écrit, plutôt que d'inventer un montant. */
              { code: null,  nom: 'Paris-Le Bourget', note: 'The business aviation terminal is served. It has no flat rate: the price is calculated for your exact address and confirmed before departure.' },
            ].map(a => {
              const montant = a.code ? liaisons.find(l => l.zone === a.code)?.montant ?? null : null
              return (
                <div key={a.nom} style={{ border: '1px solid rgba(201,168,76,.14)', borderRadius: 12, padding: '17px 19px' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: creme, marginBottom: 5 }}>{a.nom}</div>
                  <div style={montant !== null
                    ? { fontFamily: "var(--font-jetbrains), 'JetBrains Mono', monospace", fontSize: 15, color: or, marginBottom: 9 }
                    /* Sans forfait, ce n'est pas un montant : la police des
                       chiffres ferait passer une phrase pour un prix. */
                    : { fontSize: 13, fontStyle: 'italic', color: 'rgba(201,168,76,.75)', marginBottom: 9 }}>
                    {montant !== null ? `€${montant}` : 'price calculated for your journey'}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'rgba(237,232,223,.6)', lineHeight: 1.65 }}>{a.note}</div>
                </div>
              )
            })}
          </div>
          {params?.supplement_panneau_actif && params?.supplement_panneau_prix != null && (
            <p style={{ fontSize: 13, color: 'rgba(237,232,223,.55)', marginTop: 14, lineHeight: 1.7 }}>
              Meet and greet with a name sign: €{params.supplement_panneau_prix} option.
            </p>
          )}
        </section>

        {/* ---- sur devis ---------------------------------------------- */}
        <section style={{ padding: '0 20px 56px', maxWidth: 940, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: creme, margin: '0 0 8px' }}>
            Hourly hire — a chauffeur for a few hours or a full day
          </h2>
          <p style={{ fontSize: 14, color: doux, margin: '0 0 6px', maxWidth: 640, lineHeight: 1.7 }}>
            {DEFINITION_EN}
          </p>
          <p style={{ fontSize: 13, color: 'rgba(237,232,223,.60)', margin: '0 0 20px', maxWidth: 640, lineHeight: 1.7 }}>
            {MENTION_TARIFS_EN} {FRAIS_EN_SUS_EN} From {DUREE_MIN_MAD} hours.
          </p>

          {/* LES TARIFS HORAIRES, LUS EN BASE.
              Ajoutes le 2026-11-13. Jusque-la cette page disait d'ecrire un
              e-mail : la recherche « private chauffeur in paris for a full
              day, how much » la montrait 29 fois en huit semaines, en
              position 9,4, pour zero clic. */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, marginBottom: 22 }}>
            {parHeure.map(v => (
              <div key={v.cle} style={{ border: '1px solid rgba(201,168,76,.16)', borderRadius: 12, padding: '16px 18px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: creme, marginBottom: 3 }}>{v.nom}</div>
                <div style={{ fontSize: 11.5, color: 'rgba(237,232,223,.60)', marginBottom: 10 }}>{v.places}</div>
                <div style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 19, fontWeight: 600, color: v.prixHeure == null ? doux : or, lineHeight: 1.1,
                }}>
                  {v.prixHeure == null ? 'on request' : `${formaterMontant(v.prixHeure)} / h`}
                </div>
                {v.prixKmSup != null && (
                  <div style={{ fontSize: 11.5, color: 'rgba(237,232,223,.60)', marginTop: 8, lineHeight: 1.5 }}>
                    {KM_PAR_HEURE_MAD} km included per hour,<br />
                    then {formaterMontant(v.prixKmSup)} per extra km
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Le formulaire, en anglais : meme composant, meme calcul, deux
              dictionnaires. Cette page s'excusait d'envoyer un anglophone
              vers un formulaire francais ; elle n'a plus a le faire. */}
          {/* CETTE PAGE FOURNIT LES JETONS QUE LE COMPOSANT ATTEND.

              `DemandeMiseADisposition` est partage avec /mise-a-disposition,
              qui vit sous `.vt vt-palette-a` et y trouve toute la charte du
              site. Cette page-ci garde sa propre identite bleu nuit et n'est
              pas sous `.vt` : sans ces valeurs, le composant heritait du
              `--t2` de `globals.css` (#7A7A96), trop sombre sur ses cartes —
              dix lignes a 4,25 au lieu des 4,5 exiges, mesure le 2026-11-13.

              Les replis ecrits dans le composant couvrent l'absence totale
              d'un jeton ; ils ne peuvent rien contre un jeton PRESENT mais
              inadapte. D'ou cette declaration explicite, ici, a cote de la
              charte qu'elle sert. */}
          <div style={{
            background: 'rgba(237,232,223,.025)', border: '1px solid rgba(201,168,76,.18)',
            borderRadius: 16, padding: 'clamp(18px, 3.5vw, 28px)', marginBottom: 28,
            ...({
              '--t1': '#EDE8DF',
              '--t2': 'rgba(237,232,223,.72)',
              '--papier': 'rgba(237,232,223,.04)',
              '--nuit': '#0D0D20',
              '--sur-or': '#09091A',
              '--contraste-rvb': '237,232,223',
            } as React.CSSProperties),
          }}>
            <DemandeMiseADisposition vehicules={parHeure} langue="en" />
          </div>

          <h3 style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: 'rgba(237,232,223,.60)', margin: '0 0 12px', fontWeight: 500 }}>
            When this makes sense
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 26px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
            {USAGES_EN.map(u => (
              <li key={u} style={{
                fontSize: 13.5, color: doux, lineHeight: 1.6, padding: '12px 15px',
                borderRadius: 11, background: 'rgba(237,232,223,.03)', border: '1px solid rgba(201,168,76,.12)',
              }}>
                {u}
              </li>
            ))}
          </ul>

          <h3 style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: creme, margin: '0 0 8px' }}>
            Private tours and business travel
          </h3>
          <p style={{ fontSize: 14, color: doux, margin: '0 0 20px', maxWidth: 640, lineHeight: 1.7 }}>
            These depend on your programme, and the price is quoted case by case.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12, marginBottom: 22 }}>
            {[
              /* La carte « Hourly or daily hire » a disparu d'ici le
                 2026-11-13 : la section ci-dessus traite ce service, avec
                 ses prix et son formulaire. La laisser ici renverrait vers
                 un devis pour une prestation desormais chiffree. */
              { t: 'Private tours', d: 'Paris and its surroundings with a chauffeur, following the itinerary you choose.' },
              { t: 'Business travel', d: 'Successive meetings, welcoming a client or a partner, repeated journeys.' },
            ].map(p => (
              <div key={p.t} style={{ border: '1px solid rgba(201,168,76,.14)', borderRadius: 12, padding: '17px 19px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: creme, marginBottom: 6 }}>{p.t}</div>
                <div style={{ fontSize: 12.5, color: 'rgba(237,232,223,.6)', lineHeight: 1.65 }}>{p.d}</div>
              </div>
            ))}
          </div>
          <a href={lienDevis('en')} style={{
            display: 'inline-block', background: or, color: '#09091A', textDecoration: 'none',
            padding: '13px 26px', borderRadius: 9, fontSize: 14.5, fontWeight: 600,
          }}>
            Request a quote
          </a>
          <p style={{ fontSize: 13, color: 'rgba(237,232,223,.55)', marginTop: 14, lineHeight: 1.7, maxWidth: 640 }}>
            Tell us the date, the start time, roughly how long you need the car, the
            pick-up point, the number of passengers and what you would like to see.
          </p>
        </section>

        {/* ---- FAQ ----------------------------------------------------- */}
        <section style={{ padding: '0 20px 56px', maxWidth: 940, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: creme, margin: '0 0 20px' }}>
            Questions
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {FAQ(base).map(f => (
              <div key={f.q} style={{ border: '1px solid rgba(201,168,76,.12)', borderRadius: 11, padding: '16px 19px' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: creme, marginBottom: 6 }}>{f.q}</div>
                <div style={{ fontSize: 13, color: 'rgba(237,232,223,.62)', lineHeight: 1.7 }}>{f.a}</div>
              </div>
            ))}
          </div>
        </section>

        {/* ---- liens ---------------------------------------------------- */}
        <section style={{ padding: '0 20px 64px', maxWidth: 940, margin: '0 auto' }}>
          <p style={{ fontSize: 11, letterSpacing: '.16em', textTransform: 'uppercase', color: 'rgba(237,232,223,.60)', marginBottom: 12 }}>
            Also on Owise
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {[
              { h: '/vtc-paris',             t: 'VTC Paris (français)' },
              { h: '/vtc-aeroport-cdg',      t: 'VTC Aéroport CDG' },
              { h: '/vtc-aeroport-orly',     t: 'VTC Aéroport Orly' },
              { h: '/vtc-aeroport-beauvais', t: 'VTC Aéroport Beauvais-Tillé' },
              { h: '/vtc-chantilly',         t: 'VTC Chantilly' },
              { h: '/en/chantilly-to-charles-de-gaulle-airport', t: 'Chantilly → CDG (English)' },
            ].map(l => (
              <Link key={l.h} href={l.h} style={{
                fontSize: 12.5, color: doux, textDecoration: 'none',
                border: '1px solid rgba(201,168,76,.14)', borderRadius: 8, padding: '9px 15px',
              }}>
                {l.t} →
              </Link>
            ))}
          </div>
        </section>

        {/* ---- pied de page ------------------------------------------- */}
        <footer style={{ borderTop: '1px solid rgba(201,168,76,.12)', padding: '26px 20px 40px', textAlign: 'center' }}>
          <p style={{ fontSize: 12.5, color: 'rgba(237,232,223,.5)', margin: 0, lineHeight: 1.8 }}>
            Owise · <a href={`mailto:${EMAIL_DEVIS}`} style={{ color: or, textDecoration: 'none' }}>{EMAIL_DEVIS}</a>
            {' · '}
            <a href={`tel:${IDENTITE_OWISE.telephone}`} style={{ color: or, textDecoration: 'none' }}>{telephoneLisible(IDENTITE_OWISE.telephone)}</a>
          </p>
        </footer>
      </main>
    </>
  )
}
