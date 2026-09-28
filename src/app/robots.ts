import type { MetadataRoute } from 'next'

/**
 * Les robots d'IA nommés explicitement, plutôt que laissés à la règle « * ».
 *
 * Nommer un robot, c'est déclarer une position au lieu de la laisser deviner :
 * les outils de lisibilité par les agents vérifient cette liste, et certains
 * moteurs traitent l'absence de mention comme une permission incertaine.
 *
 * Ajoutés le 2026-09-28, après mesure : ils obtenaient déjà la page en 200 par
 * la règle générale, mais rien ne le déclarait.
 *   Google-Extended  → Gemini et les AI Overviews
 *   Bingbot          → Copilot, qui n'a pas d'autre index
 */
const LLM_BOTS = [
  'GPTBot', 'ChatGPT-User', 'OAI-SearchBot',
  'PerplexityBot', 'anthropic-ai', 'ClaudeBot',
  'Google-Extended', 'Bingbot',
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
