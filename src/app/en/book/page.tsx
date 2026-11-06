import type { Metadata } from 'next'
import PageReservation from '../../reserver/PageReservation'

/**
 * La réservation en anglais.
 *
 * Elle ne contient AUCUNE logique : ni chargement de tarifs, ni calcul de
 * prix, ni validation. Tout vient de `PageReservation`, le même fichier que
 * `/reserver` — seule la langue change. C'est la raison d'être de ce
 * découpage : il est impossible que le prix annoncé ici diverge du prix
 * annoncé en français, parce qu'il n'y a qu'un seul code pour le calculer.
 *
 * Pourquoi cette page existe. Owise avait déjà encaissé des clients
 * étrangers — venus en direct et par ChatGPT, jamais par Google. Ils
 * arrivaient sur un formulaire entièrement français : « Adresse de départ ·
 * Votre trajet · Réserver ». Search Console le confirmait par l'autre bout :
 * 28 requêtes anglaises, 148 impressions, **zéro clic** sur 90 jours.
 * Mesuré le 2026-11-05.
 */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Book a Private Chauffeur — Instant Fixed Price | Owise',
  description: 'Book a private chauffeur in 30 seconds. Guaranteed fixed price, professional English-speaking driver, 24/7. Paris, Île-de-France and Oise — CDG, Orly and Beauvais airports.',
  keywords: ['book private chauffeur paris', 'cdg airport transfer', 'orly transfer', 'beauvais transfer', 'private driver paris price', 'chauffeur service paris booking'],
  alternates: {
    canonical: 'https://www.owise.fr/en/book',
    /* La page française déclare celle-ci, celle-ci renvoie vers elle. */
    languages: {
      'fr-FR':     'https://www.owise.fr/reserver',
      'en':        'https://www.owise.fr/en/book',
      'x-default': 'https://www.owise.fr/reserver',
    },
  },
  openGraph: {
    title: 'Book Your Private Chauffeur | Owise — Fixed Price Guaranteed',
    description: 'Book your private chauffeur online. Price calculated in advance, immediate confirmation. Paris, Île-de-France and Oise.',
    url: 'https://www.owise.fr/en/book',
    siteName: 'Owise',
    locale: 'en_GB',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function BookPage() {
  return <PageReservation langue="en" />
}
