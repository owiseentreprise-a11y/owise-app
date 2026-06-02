import type { Metadata } from 'next'
import VitrineBody from '@/components/VitrineBody'
import './vitrine.css'

export const metadata: Metadata = {
  title: 'Owise — Transport VTC de Prestige · Paris, IDF & Oise',
  description:
    'Chauffeurs VTC professionnels à Paris, Île-de-France et Oise. Transferts aéroport CDG, Orly, Beauvais. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
  keywords: [
    'VTC Paris',
    'chauffeur privé Paris',
    'transfert aéroport CDG',
    'VTC IDF',
    'VTC Oise',
    'taxi luxe Paris',
    'chauffeur entreprise',
  ],
  robots: { index: true, follow: true },
  authors: [{ name: 'Owise' }],
  alternates: { canonical: 'https://owise.fr/' },
  openGraph: {
    type: 'website',
    url: 'https://owise.fr/',
    title: 'Owise — Transport VTC de Prestige · Paris & IDF',
    description:
      "Chauffeurs professionnels, tarif fixe garanti, disponible 24h/24. Réservez votre VTC à Paris, en IDF et dans l'Oise.",
    images: [{ url: 'https://owise.fr/brand_assets/og-image.jpg' }],
    locale: 'fr_FR',
    siteName: 'Owise',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Owise — Transport VTC de Prestige',
    description: 'VTC haut de gamme à Paris. Tarif fixe, chauffeurs certifiés, disponible 24h/24.',
    images: ['https://owise.fr/brand_assets/og-image.jpg'],
  },
  icons: {
    icon: '/brand_assets/favicon.svg',
    apple: '/brand_assets/favicon.svg',
  },
}

export default function VitrinePage() {
  return <VitrineBody />
}
