import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
/* La palette « Paris en mouvement » vit dans `vitrine.css`, sous
   `.vt.vt-palette-a`. On l'importe plutôt que d'en recopier les valeurs. */
import '../vitrine.css'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Blog VTC Owise — Conseils, guides et tarifs chauffeur privé',
  description: 'Guides pratiques, conseils et tarifs pour vos transferts VTC en Île-de-France et Oise. Chantilly, Creil, Senlis, CDG, Orly — tout ce qu\'il faut savoir avec Owise.',
  alternates: { canonical: 'https://www.owise.fr/blog' },
}

const BASE = 'https://www.owise.fr'

export default async function BlogPage() {
  const supabase = createAdminClient()
  let posts: { slug: string; titre: string; meta_desc: string | null; categorie: string | null; published_at: string | null }[] = []
  try {
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, titre, meta_desc, categorie, published_at')
      .eq('statut', 'publie')
      .order('published_at', { ascending: false })
      .limit(200)
    posts = data ?? []
  } catch { /* table absente au build — rendu vide */ }

  const categories: Record<string, string> = {
    transfert:  'Transferts',
    guide:      'Guides',
    conseils:   'Conseils pratiques',
    entreprise: 'Entreprises',
    comparatif: 'Comparatifs',
  }

  /* Chaque catégorie porte une encre ET ses composantes, parce que la
     pastille écrit dans cette couleur sur un voile de la même couleur.
     Les deux doivent donc désigner la MÊME valeur : d'où les paires de
     jetons (`--gold` / `--or-rvb`), et non une opacité collée au code hexa
     — `${color}18` ne veut rien dire quand `color` vaut `var(--gold)`. */
  /* L'encre est la variante CLAIRE de chaque couleur, pas la couleur elle-
     même : la pastille écrit sur un voile de sa propre teinte, donc sur un
     fond déjà éclairci. Mesuré le 2026-11-01 avec `contraste-151-pages.mjs` :
     le terracotta `--gold` sur son propre voile donnait 4,14 — sous le seuil
     de 4,5, sur les 80 pastilles de la page. `--sur-voile-or` y donne 6,1.
     C'est la règle posée à l'étape 147 pour l'accueil, appliquée ici. */
  const COLORS: Record<string, { encre: string; rvb: string }> = {
    transfert:  { encre: 'var(--sur-voile-or)', rvb: 'var(--or-rvb)' },
    guide:      { encre: 'var(--bleu-info)',    rvb: 'var(--bleu-info-rvb)' },
    conseils:   { encre: 'var(--vert-vif)',     rvb: 'var(--vert-rvb)' },
    entreprise: { encre: 'var(--ambre-vif)',    rvb: 'var(--ambre-vif-rvb)' },
    comparatif: { encre: 'var(--t2)',           rvb: 'var(--t2-rvb)' },
  }

  // Les articles eux-mêmes déclarent Article et FAQPage ; cette page-ci ne
  // déclarait rien. Sans elle, un robot voit 129 liens sans savoir qu'il s'agit
  // d'un blog ni ce que chaque lien contient.
  const ficheBlog = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: 'Le blog Owise — VTC, aéroports et Oise',
    url: 'https://www.owise.fr/blog',
    inLanguage: 'fr-FR',
    publisher: {
      '@type': 'Organization',
      name: 'Owise',
      url: 'https://www.owise.fr',
    },
    blogPost: posts.map(p => ({
      '@type': 'BlogPosting',
      headline: p.titre,
      url: `https://www.owise.fr/blog/${p.slug}`,
      ...(p.meta_desc ? { description: p.meta_desc } : {}),
      ...(p.published_at ? { datePublished: p.published_at } : {}),
      ...(p.categorie ? { articleSection: categories[p.categorie] ?? p.categorie } : {}),
      author: { '@type': 'Organization', name: 'Owise' },
    })),
  }

  const ficheFilAriane = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: 'https://www.owise.fr' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://www.owise.fr/blog' },
    ],
  }

  return (
    <div className="vt vt-palette-a" style={{ fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheBlog) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ficheFilAriane) }} />
      <style>{`.blog-card:hover{transform:translateY(-2px);border-color:rgba(var(--or-rvb),.38)!important}`}</style>

      {/* Header */}
      <div style={{ background: 'var(--nuit)', padding: '48px 24px 40px', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, letterSpacing: '.12em', color: 'var(--t1)', marginBottom: 24 }}>OWISE</div>
        </Link>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(32px, 5.6vw, 52px)', fontWeight: 500, letterSpacing: '-.01em', lineHeight: 1.12, color: 'var(--t1)', margin: '0 0 12px' }}>
          Blog & Guides VTC
        </h1>
        <p style={{ fontSize: 15, color: 'var(--t2)', maxWidth: 560, margin: '0 auto' }}>
          Conseils, tarifs et guides pratiques pour vos transferts en Île-de-France et Oise
        </p>
      </div>

      {/* Grid articles */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {!posts || posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--t2)', padding: 60 }}>
            <p>Les premiers articles seront publiés prochainement.</p>
            <Link href="/" style={{ color: 'var(--gold)', textDecoration: 'none', fontSize: 14 }}>← Retour à l'accueil</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {posts.map(post => {
              const cat = post.categorie ?? 'conseils'
              const { encre, rvb } = COLORS[cat] ?? COLORS.transfert
              const date = post.published_at
                ? new Date(post.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : ''
              return (
                <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                  <div className="blog-card" style={{
                    background: 'var(--papier)', borderRadius: 14,
                    padding: '24px 22px', height: '100%',
                    border: '1px solid rgba(var(--contraste-rvb),.08)',
                    /* Le survol éclaircissait une ombre : sur l'anthracite
                       une ombre ne se voit pas. C'est le filet qui s'allume. */
                    transition: 'transform .15s, border-color .15s',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '.12em',
                        textTransform: 'uppercase', padding: '3px 10px',
                        borderRadius: 20, background: `rgba(${rvb},.12)`, color: encre,
                      }}>{categories[cat] ?? cat}</span>
                      {date && <span style={{ fontSize: 11, color: 'var(--t2)', marginLeft: 'auto' }}>{date}</span>}
                    </div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: 'var(--t1)', margin: 0, lineHeight: 1.4 }}>
                      {post.titre}
                    </h2>
                    <p style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, margin: 0, flex: 1 }}>
                      {post.meta_desc?.slice(0, 120)}{(post.meta_desc?.length ?? 0) > 120 ? '…' : ''}
                    </p>
                    <div style={{ fontSize: 12, color: 'var(--gold)', fontWeight: 500, marginTop: 4 }}>
                      Lire l'article →
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {/* CTA réservation */}
        <div style={{
          marginTop: 64, textAlign: 'center',
          background: 'var(--nuit)', borderRadius: 16, padding: '40px 24px',
          border: '1px solid rgba(var(--contraste-rvb),.08)',
        }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: 'var(--t1)', marginBottom: 12 }}>
            Prêt à réserver votre VTC ?
          </div>
          <p style={{ color: 'var(--t2)', fontSize: 14, marginBottom: 24 }}>
            Tarif fixe garanti · Disponible 24h/24 · Paris, Île-de-France & Oise
          </p>
          <Link href="/reserver" style={{
            display: 'inline-block', background: 'var(--gold)', color: 'var(--sur-or)',
            textDecoration: 'none', padding: '14px 36px', borderRadius: 8,
            fontWeight: 700, fontSize: 14, letterSpacing: '.02em',
          }}>
            Estimer mon trajet →
          </Link>
        </div>
      </div>
    </div>
  )
}
