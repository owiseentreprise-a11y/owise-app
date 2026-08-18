import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/reserver'],
        disallow: ['/admin/', '/espace-client/', '/chauffeur/', '/sous-traitant/', '/api/', '/login', '/client-login', '/sous-traitant-login', '/paiement/'],
      },
    ],
    sitemap: 'https://www.owise.fr/sitemap.xml',
  }
}
