/**
 * L'identité d'Owise telle qu'elle est déclarée aux moteurs et aux IA.
 *
 * Une seule définition, importée par toutes les pages. Ces systèmes ne
 * reconnaissent une entreprise comme une entité unique que si le nom,
 * l'adresse et le téléphone concordent partout : une valeur recopiée à la main
 * finit par diverger, et l'entreprise devient deux entités dont aucune ne fait
 * autorité.
 *
 * Défaut réel, 2026-09-27 : les 38 pages villes déclaraient une fiche
 * d'entreprise **sans image et sans adresse**, alors que l'accueil les portait
 * toutes les deux. Une fiche sans image ni lieu est lue comme du texte, pas
 * comme un établissement — c'est ce qui manquait pour apparaître autrement
 * qu'en texte brut dans les réponses des assistants.
 */

export const BASE_OWISE = 'https://www.owise.fr'

/** Le socle commun à toute fiche `LocalBusiness` / `TaxiService` du site. */
export const IDENTITE_OWISE = {
  name: 'Owise — Chauffeur Privé VTC',
  logo: `${BASE_OWISE}/brand_assets/logo.svg`,
  image: `${BASE_OWISE}/brand_assets/hero-paris-night.webp`,
  telephone: '+33619106356',
  email: 'owise.entreprise@gmail.com',
  priceRange: '€€',
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Cash, Credit Card, Stripe',
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Creil',
    addressRegion: 'Oise',
    postalCode: '60100',
    addressCountry: 'FR',
  },
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 49.2583,
    longitude: 2.4797,
  },
  sameAs: [
    'https://owise.fr',
    'https://www.owise.fr',
    'https://facebook.com/Owise.vtc',
    'https://www.tiktok.com/@owise857',
  ],
} as const

/**
 * Nom de commune exploitable, tiré d'un titre de page.
 *
 * Les titres portent des suffixes commerciaux — « VTC Chantilly — Aéroport &
 * Paris ». Déclarés tels quels dans `areaServed`, ils annoncent une ville qui
 * n'existe pas. On ne garde que ce qui précède le premier séparateur.
 *
 * Défaut réel : `/vtc-chantilly` déclarait la ville « Chantilly — Aéroport »,
 * `/vtc-beauvais` la ville « Beauvais — Chauffeur Privé ».
 */
export function communeDepuisTitre(titre: string): string {
  return titre
    .replace(/^VTC\s+/i, '')
    .split(/\s+[—–-]\s+|\s*&\s*|,/)[0]
    .trim()
}
