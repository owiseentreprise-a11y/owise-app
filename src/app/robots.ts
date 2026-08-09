import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/reserver'],
        disallow: ['/admin/', '/espace-client/', '/chauffeur/', '/sous-traitant/', '/api/', '/login'],
      },
    ],
    sitemap: `${(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.owise.fr').replace(/\/$/, '')}/sitemap.xml`,
  }
}
