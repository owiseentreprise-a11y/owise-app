import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

export const metadata: Metadata = {
  title: 'Blog VTC Owise — Conseils, guides et tarifs chauffeur privé',
  description: 'Guides pratiques, conseils et tarifs pour vos transferts VTC en Île-de-France et Oise. Chantilly, Creil, Senlis, CDG, Orly — tout ce qu\'il faut savoir avec Owise.',
  alternates: { canonical: 'https://owise.fr/blog' },
}

const BASE = 'https://owise.fr'

export default async function BlogPage() {
  const supabase = createAdminClient()
  let posts: { slug: string; titre: string; meta_desc: string | null; categorie: string | null; published_at: string | null }[] = []
  try {
    const { data } = await supabase
      .from('blog_posts')
      .select('slug, titre, meta_desc, categorie, published_at')
      .eq('statut', 'publie')
      .order('published_at', { ascending: false })
      .limit(60)
    posts = data ?? []
  } catch { /* table absente au build — rendu vide */ }

  const categories: Record<string, string> = {
    transfert:  'Transferts',
    guide:      'Guides',
    conseils:   'Conseils pratiques',
    entreprise: 'Entreprises',
    comparatif: 'Comparatifs',
  }

  const COLORS: Record<string, string> = {
    transfert:  '#C9A84C',
    guide:      '#4D8ED4',
    conseils:   '#3DB87A',
    entreprise: '#E8A030',
    comparatif: '#848499',
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F1', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <style>{`.blog-card:hover{transform:translateY(-2px);box-shadow:0 6px 24px rgba(0,0,0,.10)!important}`}</style>

      {/* Header */}
      <div style={{ background: '#09091A', padding: '48px 24px 40px', textAlign: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none' }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 600, letterSpacing: '.12em', color: '#EDE8DF', marginBottom: 24 }}>OWISE</div>
        </Link>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 500, color: '#EDE8DF', margin: '0 0 12px' }}>
          Blog & Guides VTC
        </h1>
        <p style={{ fontSize: 15, color: 'rgba(237,232,223,.6)', maxWidth: 560, margin: '0 auto' }}>
          Conseils, tarifs et guides pratiques pour vos transferts en Île-de-France et Oise
        </p>
      </div>

      {/* Grid articles */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 24px' }}>
        {!posts || posts.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#848499', padding: 60 }}>
            <p>Les premiers articles seront publiés prochainement.</p>
            <Link href="/" style={{ color: '#C9A84C', textDecoration: 'none', fontSize: 14 }}>← Retour à l'accueil</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {posts.map(post => {
              const cat = post.categorie ?? 'conseils'
              const color = COLORS[cat] ?? '#C9A84C'
              const date = post.published_at
                ? new Date(post.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
                : ''
              return (
                <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: 'none' }}>
                  <div className="blog-card" style={{
                    background: '#fff', borderRadius: 14,
                    padding: '24px 22px', height: '100%',
                    border: '1px solid rgba(0,0,0,.06)',
                    boxShadow: '0 2px 12px rgba(0,0,0,.05)',
                    transition: 'transform .15s, box-shadow .15s',
                    display: 'flex', flexDirection: 'column', gap: 10,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '.12em',
                        textTransform: 'uppercase', padding: '3px 10px',
                        borderRadius: 20, background: `${color}18`, color,
                      }}>{categories[cat] ?? cat}</span>
                      {date && <span style={{ fontSize: 11, color: '#9B9B9B', marginLeft: 'auto' }}>{date}</span>}
                    </div>
                    <h2 style={{ fontSize: 16, fontWeight: 600, color: '#09091A', margin: 0, lineHeight: 1.4 }}>
                      {post.titre}
                    </h2>
                    <p style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.6, margin: 0, flex: 1 }}>
                      {post.meta_desc?.slice(0, 120)}{(post.meta_desc?.length ?? 0) > 120 ? '…' : ''}
                    </p>
                    <div style={{ fontSize: 12, color: '#C9A84C', fontWeight: 500, marginTop: 4 }}>
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
          background: '#09091A', borderRadius: 16, padding: '40px 24px',
        }}>
          <div style={{ fontFamily: 'Georgia, serif', fontSize: 26, color: '#EDE8DF', marginBottom: 12 }}>
            Prêt à réserver votre VTC ?
          </div>
          <p style={{ color: 'rgba(237,232,223,.6)', fontSize: 14, marginBottom: 24 }}>
            Tarif fixe garanti · Disponible 24h/24 · Paris, IDF & Oise
          </p>
          <Link href="/reserver" style={{
            display: 'inline-block', background: '#C9A84C', color: '#09091A',
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
