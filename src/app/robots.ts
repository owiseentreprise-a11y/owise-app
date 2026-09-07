import type { MetadataRoute } from 'next'

const LLM_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'PerplexityBot', 'anthropic-ai', 'ClaudeBot',
  'cohere-ai', 'YouBot', 'CCBot', 'Bytespider',
  'Applebot-Extended', 'Amazonbot', 'meta-externalagent', 'Diffbot',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/reserver'],
        disallow: ['/admin/', '/espace-client/', '/chauffeur/', '/sous-traitant/', '/api/', '/login', '/client-login', '/sous-traitant-login', '/paiement/'],
      },
      ...LLM_BOTS.map(bot => ({ userAgent: bot, allow: '/' })),
    ],
    sitemap: 'https://www.owise.fr/sitemap.xml',
  }
}
