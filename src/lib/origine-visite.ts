/**
 * origine-visite.ts — d'où vient le visiteur, et par quelle porte.
 *
 * ── Pourquoi un module, et pas `document.referrer` lu au moment utile ────
 * Le référent n'est juste qu'à la PREMIÈRE page de la visite. Un visiteur qui
 * arrive sur `/vtc-chantilly` depuis Google puis clique vers `/reserver` a,
 * sur `/reserver`, un référent qui vaut `owise.fr` : on croirait du trafic
 * direct alors que c'est Google. L'origine est donc relevée une fois, à
 * l'ouverture de l'onglet, et conservée le temps de cet onglet.
 *
 * ── Aucun import ─────────────────────────────────────────────────────────
 * `canalDepuisReferent` est appelée depuis le navigateur ET depuis la route
 * serveur, qui ne fait pas confiance à ce que le navigateur lui envoie.
 * Lui donner une dépendance la rendrait inappelable d'un des deux côtés.
 */

export const CLE_ORIGINE = 'ow_origine'

export type OrigineVisite = {
  /** Le site d'où vient le visiteur, tel que le navigateur le donne. */
  referent: string
  /** La première page qu'il a ouverte sur owise.fr. */
  premierePage: string
  utm_source: string
  utm_medium: string
  utm_campaign: string
  /** Présent si le visiteur vient d'un clic Google Ads. */
  gclid: string
}

const VIDE: OrigineVisite = {
  referent: '', premierePage: '', utm_source: '', utm_medium: '', utm_campaign: '', gclid: '',
}

/**
 * Le canal d'arrivée, en un mot lisible.
 *
 * Les assistants (ChatGPT, Perplexity, Claude, Gemini, Copilot) sont
 * distingués un par un, et pas regroupés sous « recherche » : c'est le canal
 * qui amène le plus de clients et il doit pouvoir être compté seul.
 */
export function canalDepuisReferent(
  referent: string | null | undefined,
  utmSource?: string | null,
  gclid?: string | null,
): string {
  if (gclid && gclid.trim()) return 'google_ads'

  const utm = (utmSource ?? '').trim().toLowerCase()
  if (utm) {
    if (utm.includes('google')) return 'google_ads'
    if (utm.includes('chatgpt') || utm.includes('openai')) return 'chatgpt'
    return `utm:${utm.slice(0, 30)}`
  }

  const brut = (referent ?? '').trim()
  if (!brut) return 'direct'

  let hote = ''
  try {
    hote = new URL(brut).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    hote = brut.toLowerCase().replace(/^https?:\/\//, '').split('/')[0].replace(/^www\./, '')
  }
  if (!hote) return 'direct'

  /* Assistants : chacun compté à part. */
  if (/(^|\.)(chatgpt\.com|openai\.com)$/.test(hote)) return 'chatgpt'
  if (/(^|\.)perplexity\.ai$/.test(hote)) return 'perplexity'
  if (/(^|\.)claude\.ai$/.test(hote)) return 'claude'
  if (/(^|\.)gemini\.google\.com$/.test(hote)) return 'gemini'
  if (/(^|\.)copilot\.microsoft\.com$/.test(hote)) return 'copilot'

  /* Moteurs de recherche. */
  if (/(^|\.)google\.[a-z.]+$/.test(hote)) return 'google'
  if (/(^|\.)(bing\.com|duckduckgo\.com|ecosia\.org|qwant\.com|search\.brave\.com|yahoo\.com)$/.test(hote)) return 'recherche'

  /* Réseaux et messageries. */
  if (/(^|\.)(facebook\.com|instagram\.com|linkedin\.com|x\.com|twitter\.com|t\.co|tiktok\.com|pinterest\..+|reddit\.com)$/.test(hote)) return 'reseaux'
  if (/(^|\.)(web\.whatsapp\.com|whatsapp\.com|messenger\.com|mail\.google\.com|outlook\.[a-z.]+)$/.test(hote)) return 'message'

  /* Nos propres pages : ce n'est pas une origine, c'est une navigation. */
  if (/(^|\.)owise\.fr$/.test(hote) || hote.endsWith('.vercel.app') || hote === 'localhost') return 'interne'

  if (/(^|\.)(google\.com|g\.page|maps\.google\.[a-z.]+)$/.test(hote)) return 'fiche_google'

  return hote.slice(0, 40)
}

/* ── Côté navigateur ─────────────────────────────────────────────────── */

/**
 * Relève l'origine à l'ouverture de l'onglet, une seule fois.
 * Rappelée sur chaque page : les appels suivants ne font rien, et c'est
 * exactement le but — ne pas écraser le vrai référent par `owise.fr`.
 */
export function enregistrerOrigine(): void {
  if (typeof window === 'undefined') return
  try {
    if (sessionStorage.getItem(CLE_ORIGINE)) return
    const p = new URLSearchParams(window.location.search)
    const o: OrigineVisite = {
      referent:     document.referrer || '',
      premierePage: window.location.pathname || '/',
      utm_source:   p.get('utm_source') || '',
      utm_medium:   p.get('utm_medium') || '',
      utm_campaign: p.get('utm_campaign') || '',
      gclid:        p.get('gclid') || '',
    }
    sessionStorage.setItem(CLE_ORIGINE, JSON.stringify(o))
  } catch { /* navigation privée, stockage refusé : on se passe de l'origine */ }
}

export function lireOrigine(): OrigineVisite {
  if (typeof window === 'undefined') return VIDE
  try {
    const brut = sessionStorage.getItem(CLE_ORIGINE)
    if (!brut) return VIDE
    const o = JSON.parse(brut) as Partial<OrigineVisite>
    return { ...VIDE, ...o }
  } catch { return VIDE }
}
