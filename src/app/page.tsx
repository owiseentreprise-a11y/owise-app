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
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owise — Transport VTC de Prestige',
    description: 'VTC haut de gamme à Paris. Tarif fixe, chauffeurs certifiés, disponible 24h/24.',
  },
  icons: {
    icon: '/brand_assets/favicon.svg',
    apple: '/brand_assets/favicon.svg',
  },
}

// JSON-LD structuré pour les moteurs de recherche
const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'LocalBusiness',
  name: 'Owise',
  description: 'Service de transport VTC de prestige à Paris, Île-de-France et Oise.',
  url: BASE,
  logo: `${BASE}/brand_assets/logo.svg`,
  telephone: '+33619106356',
  email: 'owise.entreprise@gmail.com',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Paris',
    addressRegion: 'Île-de-France',
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
    { '@type': 'AdministrativeArea', name: 'Oise' },
  ],
  serviceType: 'Transport VTC',
  priceRange: '€€',
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'],
    opens: '00:00',
    closes: '23:59',
  },
  sameAs: ['https://owise.fr'],
}

export default async function VitrinePage() {
  const admin = createAdminClient()
  const [{ data: tarifs }, { data: zones }] = await Promise.all([
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code','HORS').eq('active', true),
  ])

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} />
    </>
  )
}
