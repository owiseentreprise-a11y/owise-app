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

/**
 * ── LES ZONES PRIVÉES, ÉCRITES UNE FOIS ET RÉPÉTÉES DANS CHAQUE GROUPE ──
 *
 * Un robot n'obéit qu'à UN SEUL groupe de `robots.txt` : le plus spécifique
 * qui le nomme. Dès qu'un robot a son propre groupe, il ignore ENTIÈREMENT
 * celui de « * » — donc toutes les interdictions qui s'y trouvent.
 *
 * Défaut réel, mesuré le 2026-11-16 : les seize robots nommés ci-dessus
 * n'avaient qu'un `Allow: /`. Le fichier leur déclarait donc que `/admin/`,
 * `/api/`, `/login`, `/client-login`, `/paiement/`, `/espace-client/`,
 * `/chauffeur/` et `/sous-traitant/` leur étaient ouverts. Bingbot est dans
 * la liste, et Bing alimente Copilot ET l'index de recherche de ChatGPT :
 * une page de connexion ou une confirmation de paiement pouvait s'y
 * retrouver.
 *
 * Chaque groupe reprend donc la même liste. Elle est écrite UNE fois,
 * ci-dessous, et personne ne peut l'oublier dans un groupe.
 * Contrôle : `node test-pages-pour-ia.mjs [url]`.
 */
/* ── ON NE BLOQUE QUE CE QUI N'A AUCUNE RAISON D'ETRE EXPLORE ───────────
   Cette liste a contenu les huit zones privees du site. C'etait le mauvais
   outil, et Search Console l'a montre le 2026-11-16 : `/client-login`,
   bloquee ici mais liee depuis 40 pages, est devenue « Indexee malgre le
   blocage par le fichier robots.txt ». Une page bloquee ne peut pas faire
   lire son `noindex` : Google la connait par ses liens, ne peut pas la
   visiter, et l'indexe a l'aveugle.

   Les zones privees sortent donc de l'index par l'en-tete `X-Robots-Tag:
   noindex` pose dans `next.config.ts`, et restent EXPLORABLES pour que cet
   en-tete soit lu. Elles n'exposent rien : un visiteur anonyme est
   redirige vers une page de connexion par `src/proxy.ts`.

   Il ne reste ici que `/api` : des points d'entree techniques, jamais
   lies comme des pages, qui n'ont rien a montrer a un robot.

   (Cette meme liste avait d'abord oublie `/espace-client` sans barre
   finale, puis l'avait ajoute le matin du 16 — ce qui l'exposait au meme
   sort que `/client-login`. Corrige le soir meme.)
   Controle : `node test-noindex-prive.mjs [url]`. */
const ZONES_PRIVEES = ['/api']

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: ['/', '/reserver'], disallow: ZONES_PRIVEES },
      ...LLM_BOTS.map(bot => ({ userAgent: bot, allow: '/', disallow: ZONES_PRIVEES })),
    ],
    sitemap: 'https://www.owise.fr/sitemap.xml',
  }
}
