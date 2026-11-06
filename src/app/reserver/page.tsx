import type { Metadata } from 'next'
import PageReservation from './PageReservation'

/* Cette route ne fait plus que deux choses : déclarer ses métadonnées
   françaises, et monter la page de réservation en français. Tout le reste —
   chargement des zones, de la grille, des paramètres, et le formulaire — vit
   dans `PageReservation`, partagé avec `/en/book`. Voir l'en-tête de ce
   fichier-là pour la raison. */

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Réserver un VTC — Tarif Instantané en Ligne | Owise',
  description: 'Calculez et réservez votre VTC en 30 secondes. Tarif fixe garanti, chauffeur professionnel, disponible 24h/24. Paris, Île-de-France, Oise. CDG, Orly, Beauvais.',
  keywords: ['réserver vtc', 'vtc en ligne', 'tarif vtc', 'chauffeur privé réservation', 'vtc paris réservation', 'prix vtc cdg', 'réservation vtc immédiate'],
  alternates: {
    canonical: 'https://www.owise.fr/reserver',
    /* hreflang dans les DEUX sens : /en/book renvoie ici, cette page renvoie
       là-bas. Un hreflang unilatéral est ignoré par Google. */
    languages: {
      'fr-FR':     'https://www.owise.fr/reserver',
      'en':        'https://www.owise.fr/en/book',
      'x-default': 'https://www.owise.fr/reserver',
    },
  },
  openGraph: {
    title: 'Réserver votre VTC | Owise — Tarif Fixe Garanti',
    description: 'Réservez votre chauffeur privé en ligne. Tarif calculé à l\'avance, confirmation immédiate. Paris, IDF & Oise.',
    url: 'https://www.owise.fr/reserver',
    siteName: 'Owise',
    locale: 'fr_FR',
    type: 'website',
  },
  robots: { index: true, follow: true },
}

export default function ReserverPage() {
  return <PageReservation langue="fr" />
}
