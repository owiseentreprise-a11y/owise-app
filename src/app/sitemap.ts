import type { MetadataRoute } from 'next'

const BASE = 'https://owise.fr'

const DESTINATIONS = [
  'vtc-aeroport-cdg',
  'vtc-aeroport-orly',
  'vtc-creil',
  'vtc-compiegne',
  'vtc-senlis',
  'vtc-gouvieux',
  'vtc-chantilly',
]

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE,
      lastModified: new Date(),
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${BASE}/reserver`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...DESTINATIONS.map((slug) => ({
      url: `${BASE}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
  ]
}
