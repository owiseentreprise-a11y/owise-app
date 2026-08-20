import type { MetadataRoute } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'

const BASE = 'https://www.owise.fr'

const DESTINATIONS = [
  'vtc-aeroport-cdg',
  'vtc-aeroport-orly',
  'vtc-creil',
  'vtc-compiegne',
  'vtc-senlis',
  'vtc-gouvieux',
  'vtc-chantilly',
  'vtc-aeroport-beauvais',
  'vtc-lamorlaye',
  'vtc-pontoise',
  'vtc-versailles',
  'vtc-coye-la-foret',
  'vtc-orry-la-ville',
  'vtc-la-chapelle-en-serval',
  'vtc-boran-sur-oise',
  'vtc-precy-sur-oise',
  'vtc-luzarches',
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createAdminClient()
  let posts: { slug: string; published_at: string | null }[] = []
  try {
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, published_at')
      .eq('statut', 'publie')
      .order('published_at', { ascending: false })
      .limit(60)
    posts = data ?? []
  } catch { /* table absente au build */ }

  return [
    { url: BASE, lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...(posts.length > 0 ? [{ url: `${BASE}/blog`, lastModified: new Date(), changeFrequency: 'daily' as const, priority: 0.7 }] : []),
    { url: `${BASE}/reserver`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    ...DESTINATIONS.map(slug => ({
      url: `${BASE}/${slug}`,
      lastModified: new Date(),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    })),
    ...(posts ?? []).map(p => ({
      url: `${BASE}/blog/${p.slug}`,
      lastModified: new Date(p.published_at ?? Date.now()),
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),
  ]
}
