/**
 * robot.ts — reconnaître ce qui n'est pas un client potentiel.
 *
 * ── Pourquoi ce fichier existe ───────────────────────────────────────────
 * Le 2026-11-09, en vérifiant tout le site à la demande de l'exploitant, les
 * contrôles automatiques ont écrit **99 estimations et 118 événements de
 * tunnel** dans la base — 31 % de ses analytiques. Un seul contrôle,
 * `test-prix-grille.mjs`, en a produit 56 en cinq minutes.
 *
 * Les scripts ont depuis une garde côté navigateur (`garde-mesures.mjs`),
 * mais elle demande de penser à l'appeler, dans chacun des ~70 scripts qui
 * ouvrent le site. Ce filet-ci ne demande rien à personne : le serveur
 * reconnaît un navigateur piloté et n'écrit pas.
 *
 * ── Ce que ça retire aussi, et c'est voulu ──────────────────────────────
 * Les robots d'indexation (Googlebot, GPTBot, PerplexityBot…) parcourent les
 * pages villes et déclenchaient des mesures. Ce n'est pas de la demande : un
 * robot ne réserve pas de course. Les compter gonflait les totaux sans rien
 * dire du marché.
 *
 * ── Ce que ça ne touche pas ─────────────────────────────────────────────
 * Rien d'autre que la MESURE. Une réservation, un paiement, un devis ne
 * passent jamais par ici : si un jour un vrai client arrivait avec un
 * en-tête inhabituel, il pourrait réserver et payer normalement — seule sa
 * statistique serait perdue. C'est le bon sens de l'erreur : mieux vaut
 * manquer une mesure que refuser une course.
 *
 * Aucun import : lu depuis une route d'API comme depuis une action serveur.
 */

/**
 * Signatures d'automatisation et d'indexation.
 *
 * `HeadlessChrome` couvre Puppeteer et Playwright en mode sans fenêtre, qui
 * est le mode de tous nos contrôles. Les autres motifs couvrent les robots
 * déclarés et les clients en ligne de commande.
 */
const MOTIFS = [
  /headlesschrome/i,          // Puppeteer / Playwright sans fenêtre
  /\bheadless\b/i,
  /puppeteer|playwright|selenium|webdriver|phantomjs|cypress/i,
  /\bbot\b|bot\/|spider|crawler|crawling/i,
  /googlebot|bingbot|gptbot|claudebot|anthropic-ai|perplexitybot|oai-searchbot|ccbot|applebot|yandex|baiduspider|duckduckbot/i,
  /curl\/|wget\/|python-requests|node-fetch|axios\/|go-http-client|java\/|okhttp/i,
  /lighthouse|pagespeed|gtmetrix|pingdom|uptimerobot|ahrefs|semrush|mj12bot|dotbot/i,
]

/**
 * Vrai si l'en-tête `user-agent` désigne un automate plutôt qu'une personne.
 * Un en-tête absent ou vide compte comme un automate : aucun navigateur réel
 * n'en est dépourvu.
 */
export function estUnRobot(userAgent: string | null | undefined): boolean {
  const ua = (userAgent ?? '').trim()
  if (!ua) return true
  return MOTIFS.some(m => m.test(ua))
}
