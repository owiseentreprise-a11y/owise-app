import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { DESTINATION_SLUGS } from './[destination]/page'

const BASE = 'https://www.owise.fr'

/**
 * Le sitemap dit à Google quelles pages existent. Deux défauts y vivaient
 * jusqu'au 2026-09-21, tous deux invisibles sans compter les lignes :
 *
 * 1. La liste des pages villes était recopiée ici à la main. Elle comptait 37
 *    entrées quand `[destination]/page.tsx` en définissait 38 — la page
 *    vtc-goussainville, créée la veille, manquait. Elle vient désormais de
 *    DESTINATION_SLUGS, dérivé de l'objet qui crée réellement les pages.
 *
 * 2. Les articles de blog étaient plafonnés à 60 par un `.limit(60)` sans
 *    justification, alors que 129 étaient publiés : 69 articles absents du
 *    sitemap. Google accepte jusqu'à 50 000 URL par sitemap.
 */

// Garde-fou très au-dessus du nombre d'articles publiés (129 au 2026-09-21),
// très en dessous de la limite de 50 000 URL d'un sitemap. Sert uniquement à
// éviter une requête non bornée si la table grossissait anormalement.
const MAX_ARTICLES = 2000

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient()
  let posts: { slug: string; published_at: string | null }[] = []
  try {
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .eq('statut', 'publie')
      .order('published_at', { ascending: false })
      .limit(MAX_ARTICLES)
    posts = data ?? []
  } catch { /* table absente au build */ }

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE}/reserver`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    ...(posts.length > 0 ? [{ url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 }] : []),
    ...DESTINATION_SLUGS.map(slug => ({
      url: `${BASE}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...posts.map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.published_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
