import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import VitrineBody from '@/components/VitrineBody'
import './vitrine.css'

const BASE = 'https://owise.fr'

export const metadata: Metadata = {
  metadataBase: new URL(BASE),
  title: 'Owise — Transport VTC de Prestige · Paris, IDF & Oise',
  description:
    'Chauffeurs VTC professionnels à Paris, Île-de-France et Oise. Transferts aéroport CDG, Orly, Beauvais. Tarif fixe garanti, disponible 24h/24. Réservation en ligne immédiate.',
  keywords: [
    'VTC Paris',
    'chauffeur privé Paris',
    'transfert aéroport CDG',
    'transfert aéroport Orly',
    'VTC Île-de-France',
    'VTC Oise',
    'taxi luxe Paris',
    'chauffeur entreprise Paris',
    'VTC Compiègne',
    'VTC Chantilly',
    'réservation VTC en ligne',
  ],
  robots: { index: true, follow: true },
  authors: [{ name: 'Owise', url: BASE }],
  alternates: { canonical: `${BASE}/` },
  openGraph: {
    type: 'website',
    url: `${BASE}/`,
    title: 'Owise — Transport VTC de Prestige · Paris & IDF',
    description:
      "Chauffeurs professionnels, tarif fixe garanti, disponible 24h/24. Réservez votre VTC à Paris, en IDF et dans l'Oise.",
    locale: 'fr_FR',
    siteName: 'Owise',
    images: [{ url: `${BASE}/brand_assets/hero-car.jpg`, width: 1672, height: 941, alt: 'Owise — Chauffeur privé Paris, IDF & Oise' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owise — Transport VTC de Prestige',
    description: 'VTC haut de gamme à Paris. Tarif fixe, chauffeurs certifiés, disponible 24h/24.',
    images: [`${BASE}/brand_assets/hero-car.jpg`],
  },
  icons: {
    icon: '/brand_assets/favicon.svg',
    apple: '/brand_assets/favicon.svg',
  },
}

// JSON-LD structuré pour les moteurs de recherche
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'TaxiService',
  name: 'Owise — Chauffeur Privé VTC',
  description: 'Service VTC de prestige à Paris, Île-de-France et Oise. Transferts aéroport CDG, Orly, Beauvais. Tarif fixe garanti, disponible 24h/24. Creil, Chantilly, Senlis, Compiègne.',
  url: BASE,
  logo: `${BASE}/brand_assets/logo.svg`,
  image: `${BASE}/brand_assets/hero-car.webp`,
  telephone: '+33619106356',
  email: 'owise.entreprise@gmail.com',
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Cash, Credit Card, Stripe',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Paris',
    addressRegion: 'Île-de-France',
    postalCode: '75000',
    addressCountry: 'FR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 48.8566,
    longitude: 2.3522,
  },
  areaServed: [
    { '@type': 'City', name: 'Paris' },
    { '@type': 'State', name: 'Île-de-France' },
    { '@type': 'City', name: 'Creil' },
    { '@type': 'City', name: 'Chantilly' },
    { '@type': 'City', name: 'Senlis' },
    { '@type': 'City', name: 'Compiègne' },
    { '@type': 'City', name: 'Beauvais' },
    { '@type': 'City', name: 'Gouvieux' },
    { '@type': 'AdministrativeArea', name: 'Oise' },
  ],
  priceRange: '€€',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    opens: '00:00',
    closes: '23:59',
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services VTC Owise',
    itemListElement: [
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport CDG', description: 'Paris CDG depuis 85€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Transfert aéroport Orly', description: 'Paris Orly depuis 75€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'VTC Creil / Oise CDG', description: 'Creil → CDG depuis 80€' } },
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Compte entreprise VTC', description: 'Facturation mensuelle, multi-collaborateurs' } },
    ],
  },
  sameAs: ['https://owise.fr', 'https://facebook.com/Owise.vtc', 'https://www.tiktok.com/@owise857'],
}

export const revalidate = 3600

export default async function VitrinePage() {
  const admin = createAdminClient()
  const [{ data: tarifs }, { data: zones }, { data: grille }, { data: params }] = await Promise.all([
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code','HORS').eq('active', true),
    admin.from('grilles_tarifaires').select('zone_depart_id,zone_arrivee_id,prix_berline'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec').single(),
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} grille={grille ?? []} params={params} />
    </>
  )
}
