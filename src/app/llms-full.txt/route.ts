import { createAdminClient } from '@/lib/supabase/admin'
import { aujourdhuiParis, dateCourse } from '@/lib/heure'
import { SOCLE, SOCLE_PAGES } from '@/data/llms-full-socle'

/**
 * /llms-full.txt — TOUT LE CONTENU UTILE D'OWISE.FR EN UNE SEULE REQUÊTE.
 *
 * `llms.txt` est un panneau indicateur ; ce fichier est la bibliothèque : un
 * assistant IA obtient l'ensemble du site sans explorer deux cents adresses.
 *
 * ── POURQUOI CE N'EST PLUS UN FICHIER STATIQUE ────────────────────────────
 *
 * Jusqu'au 2026-11-16 c'était `public/llms-full.txt`, produit à la main par
 * `generer-llms-full.mjs`. Or le blog publie SEUL, lundi, mercredi et
 * vendredi à 7 h (`/api/cron/blog-generation`). Le fichier prenait donc un
 * article de retard trois fois par semaine, et rien ne le régénérait :
 *
 *   · du 6 au 15 novembre, il a manqué trois articles et la page de mise
 *     à disposition, sans que rien ne le signale ;
 *   · régénéré le 16 à 0 h 14, il manquait déjà l'article du matin à midi
 *     — trouvé par `test-pages-pour-ia.mjs`, le jour même de son écriture.
 *
 * Le constat de l'utilisateur, ce jour-là, a été de demander que le fichier
 * se tienne à jour tout seul. Il est donc assemblé ici, à la demande :
 *
 *   · le SOCLE — toutes les pages du site SAUF le blog — vient de
 *     `src/data/llms-full-socle.ts`, produit par
 *     `generer-llms-full.mjs --socle`. Il ne change que lorsqu'une page du
 *     site change, c'est-à-dire au déploiement ;
 *   · les ARTICLES sont lus EN DIRECT dans `blog_posts`.
 *
 * ── QUAND LA RÉPONSE SE MET À JOUR ────────────────────────────────────────
 *
 *   · toutes les heures au plus tard (`revalidate`) ;
 *   · IMMÉDIATEMENT après la publication d'un article : la tâche de
 *     publication appelle `revalidatePath('/llms-full.txt')`.
 *
 * ── CE QU'ON REFUSE DE SERVIR ─────────────────────────────────────────────
 *
 * Un fichier partiel présenté comme complet est pire qu'une absence de
 * fichier — c'était déjà la règle du générateur, depuis le 2026-10-20. Si la
 * base est injoignable, ou rend zéro article alors que le blog en compte
 * cent quarante, on LÈVE une erreur au lieu de servir le socle seul. En
 * production, Next continue alors de servir la dernière version correcte ;
 * à la compilation, le déploiement échoue au lieu de publier un fichier
 * troué.
 *
 * Contrôles : `node test-pages-pour-ia.mjs [url]` (toutes les adresses du
 * sitemap sont-elles ici ?) et `npx tsx verifier-llms-full.mjs --prod`
 * (les prix disent-ils vrai ?).
 */
export const dynamic = 'force-static'
export const revalidate = 3600

const BASE = 'https://www.owise.fr'

type Paragraphe = { titre?: string | null; texte?: string | null }
type Question = { question?: string | null; reponse?: string | null }
type Article = {
  slug: string
  titre: string
  intro: string | null
  paragraphes: Paragraphe[] | null
  conclusion: string | null
  faq: Question[] | null
  published_at: string | null
}

export async function GET() {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('blog_posts')
    .select('slug, titre, intro, paragraphes, conclusion, faq, published_at')
    .eq('statut', 'publie')
    .order('published_at', { ascending: false })

  if (error) throw new Error(`llms-full.txt : lecture des articles impossible — ${error.message}`)
  const articles = (data ?? []) as Article[]
  /* Zéro article alors que le blog en publie trois par semaine : ce n'est
     pas un blog vide, c'est une lecture qui a échoué sans le dire. */
  if (articles.length === 0) throw new Error('llms-full.txt : aucun article publié lu — fichier non servi plutôt que troué')

  const total = SOCLE_PAGES + 1 + articles.length   // + la page /blog
  const l: string[] = []

  l.push('# Owise — Chauffeur Privé VTC — contenu complet du site')
  l.push('')
  l.push("> Tout le contenu utile d'owise.fr en un seul fichier, pour être lu en une requête.")
  l.push(`> Généré le ${aujourdhuiParis()} depuis ${BASE}/sitemap.xml — ${total} pages.`)
  l.push(`> Le fichier de priorités reste ${BASE}/llms.txt.`)
  l.push(`> Les ${articles.length} articles du blog sont lus en direct : un article publié figure ici dans l'heure.`)
  l.push('')
  l.push(SOCLE)

  /* ── La page /blog : la liste, toujours à jour ─────────────────────── */
  l.push('## Blog — guides et comparatifs')
  l.push('')
  l.push(`Source : ${BASE}/blog`)
  l.push('')
  for (const a of articles) l.push(`- ${a.titre} : ${BASE}/blog/${a.slug}`)
  l.push('')

  /* ── Un article par section ─────────────────────────────────────────── */
  for (const a of articles) {
    l.push(`## ${a.titre}`)
    l.push('')
    l.push(`Source : ${BASE}/blog/${a.slug}`)
    if (a.published_at) {
      l.push(`Publié le ${dateCourse(a.published_at, { day: 'numeric', month: 'long', year: 'numeric' })}.`)
    }
    l.push('')
    if (a.intro?.trim()) { l.push(a.intro.trim()); l.push('') }
    for (const p of a.paragraphes ?? []) {
      if (p.titre?.trim()) { l.push(`### ${p.titre.trim()}`); l.push('') }
      if (p.texte?.trim()) { l.push(p.texte.trim()); l.push('') }
    }
    if (a.conclusion?.trim()) { l.push(a.conclusion.trim()); l.push('') }
    const faq = (a.faq ?? []).filter(q => q.question?.trim() && q.reponse?.trim())
    if (faq.length) {
      l.push('### Questions fréquentes')
      l.push('')
      for (const q of faq) { l.push(`${q.question!.trim()}`); l.push(`${q.reponse!.trim()}`); l.push('') }
    }
  }

  return new Response(l.join('\n'), {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
