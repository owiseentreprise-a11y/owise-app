import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'

export const revalidate = 3600

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('blog_posts')
    .select('titre, meta_titre, meta_desc')
    .eq('slug', slug).eq('statut', 'publie').single()
  if (!data) return {}
  return {
    title: data.meta_titre,
    description: data.meta_desc,
    alternates: { canonical: `https://owise.fr/blog/${slug}` },
    openGraph: { title: data.meta_titre, description: data.meta_desc, url: `https://owise.fr/blog/${slug}`, siteName: 'Owise' },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const supabase = createAdminClient()
  const { data: post } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug).eq('statut', 'publie').single()

  if (!post) notFound()

  const paragraphes: { titre: string; texte: string }[] = post.paragraphes ?? []
  const faq: { question: string; reponse: string }[]    = post.faq         ?? []
  const mots: string[]                                  = post.mots_cles   ?? []

  const date = post.published_at
    ? new Date(post.published_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : ''

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.titre,
    description: post.meta_desc,
    datePublished: post.published_at,
    author: { '@type': 'Organization', name: 'Owise' },
    publisher: { '@type': 'Organization', name: 'Owise', url: 'https://owise.fr' },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `https://owise.fr/blog/${slug}` },
  }

  const faqLd = faq.length > 0 ? {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faq.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.reponse },
    })),
  } : null

  return (
    <div style={{ minHeight: '100vh', background: '#F8F6F1', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      {/* Header */}
      <div style={{ background: '#09091A', padding: '24px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: 860, margin: '0 auto' }}>
        <Link href="/blog" style={{ fontSize: 12, color: 'rgba(201,168,76,.8)', textDecoration: 'none', letterSpacing: '.08em' }}>← Blog</Link>
        <Link href="/" style={{ fontFamily: 'Georgia, serif', fontSize: 16, fontWeight: 600, letterSpacing: '.1em', color: '#EDE8DF', textDecoration: 'none' }}>OWISE</Link>
        <Link href="/reserver" style={{ fontSize: 12, color: 'rgba(201,168,76,.8)', textDecoration: 'none' }}>Réserver →</Link>
      </div>

      <article style={{ maxWidth: 860, margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Meta */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 }}>
          {post.categorie && (
            <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', padding: '3px 10px', borderRadius: 20, background: 'rgba(201,168,76,.12)', color: '#C9A84C' }}>
              {post.categorie}
            </span>
          )}
          {date && <span style={{ fontSize: 11, color: '#9B9B9B' }}>{date}</span>}
        </div>

        {/* Titre */}
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 500, color: '#09091A', lineHeight: 1.2, margin: '0 0 24px' }}>
          {post.titre}
        </h1>

        {/* Intro */}
        <p style={{ fontSize: 16, color: '#3a3a4a', lineHeight: 1.8, marginBottom: 36, padding: '20px 22px', background: '#fff', borderRadius: 10, borderLeft: '3px solid #C9A84C' }}>
          {post.intro}
        </p>

        {/* Paragraphes */}
        {paragraphes.map((para, i) => (
          <div key={i} style={{ marginBottom: 32 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 22, fontWeight: 500, color: '#09091A', marginBottom: 12 }}>
              {para.titre}
            </h2>
            <p style={{ fontSize: 15, color: '#3a3a4a', lineHeight: 1.8 }}>{para.texte}</p>
          </div>
        ))}

        {/* Conclusion */}
        <div style={{ background: '#09091A', borderRadius: 12, padding: '24px 22px', margin: '40px 0' }}>
          <p style={{ color: '#EDE8DF', lineHeight: 1.8, margin: 0, fontSize: 15 }}>{post.conclusion}</p>
        </div>

        {/* CTA */}
        <div style={{ textAlign: 'center', margin: '40px 0' }}>
          <Link href="/reserver" style={{
            display: 'inline-block', background: '#C9A84C', color: '#09091A',
            textDecoration: 'none', padding: '14px 36px', borderRadius: 8,
            fontWeight: 700, fontSize: 14,
          }}>
            Réserver mon VTC →
          </Link>
        </div>

        {/* FAQ */}
        {faq.length > 0 && (
          <div style={{ marginTop: 48 }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, color: '#09091A', marginBottom: 24 }}>
              Questions fréquentes
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {faq.map((f, i) => (
                <div key={i} style={{ background: '#fff', borderRadius: 10, padding: '18px 20px', border: '1px solid rgba(0,0,0,.06)' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#09091A', marginBottom: 6 }}>{f.question}</div>
                  <div style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.7 }}>{f.reponse}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mots-clés */}
        {mots.length > 0 && (
          <div style={{ marginTop: 32, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {mots.map(m => (
              <span key={m} style={{ fontSize: 10, color: '#9B9B9B', background: '#f0ede8', borderRadius: 20, padding: '4px 12px' }}>{m}</span>
            ))}
          </div>
        )}

        {/* Retour blog */}
        <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid rgba(0,0,0,.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Link href="/blog" style={{ fontSize: 13, color: '#C9A84C', textDecoration: 'none' }}>← Tous les articles</Link>
          <Link href="/reserver" style={{ fontSize: 13, color: '#09091A', textDecoration: 'none', fontWeight: 600 }}>Réserver maintenant →</Link>
        </div>
      </article>
    </div>
  )
}
