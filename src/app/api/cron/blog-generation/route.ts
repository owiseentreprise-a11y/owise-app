import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SUJETS, genererContenu } from '@/lib/blogGenerator'
import { Resend } from 'resend'

export const dynamic    = 'force-dynamic'
export const maxDuration = 60

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'

export async function GET(req: NextRequest) {
  // Vérification du secret Vercel Cron
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  try {
    // 1. Trouver le prochain sujet non utilisé
    const { data: usedIds } = await supabase
      .from('blog_posts')
      .select('sujet_id')
      .not('sujet_id', 'is', null)

    const usedSet = new Set((usedIds ?? []).map(r => r.sujet_id))
    const nextSujet = SUJETS.find(s => !usedSet.has(s.id))

    // Tous les sujets utilisés → recommencer le cycle
    if (!nextSujet) {
      // Supprimer les anciens articles pour repartir (garder les 30 plus récents)
      const { data: oldPosts } = await supabase
        .from('blog_posts')
        .select('id')
        .order('published_at', { ascending: true })
        .limit(Math.max(0, (usedIds?.length ?? 0) - 30))

      if (oldPosts && oldPosts.length > 0) {
        await supabase.from('blog_posts').delete().in('id', oldPosts.map(p => p.id))
      }

      // Reprendre depuis le début
      const freshSujet = SUJETS[0]
      return await genererEtSauvegarder(supabase, freshSujet)
    }

    return await genererEtSauvegarder(supabase, nextSujet)

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[blog-generation] Erreur:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

async function genererEtSauvegarder(supabase: ReturnType<typeof createAdminClient>, sujet: Parameters<typeof genererContenu>[0]) {
  // Récupérer le prix réel depuis la base si disponible (transfert aéroport)
  let prixBerline: number | undefined
  if (sujet.type === 'transfert' && sujet.depart && sujet.arrivee) {
    try {
      const { data: tarifs } = await supabase
        .from('tarifs')
        .select('cdg_fixe, orly_fixe, beauvais_fixe')
        .eq('vehicule', 'Berline')
        .single()

      if (tarifs) {
        if (sujet.arrivee === 'CDG' || sujet.depart === 'CDG')     prixBerline = tarifs.cdg_fixe
        if (sujet.arrivee === 'Orly' || sujet.depart === 'Orly')   prixBerline = tarifs.orly_fixe
        if (sujet.arrivee === 'Beauvais')                           prixBerline = tarifs.beauvais_fixe
      }
    } catch { /* pas bloquant */ }
  }

  // Générer le contenu
  const post = genererContenu(sujet, prixBerline)

  // Sauvegarder en base
  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug:         post.slug,
      titre:        post.titre,
      meta_titre:   post.meta_titre,
      meta_desc:    post.meta_desc,
      intro:        post.intro,
      paragraphes:  post.paragraphes,
      conclusion:   post.conclusion,
      faq:          post.faq,
      mots_cles:    post.mots_cles,
      categorie:    post.categorie,
      sujet_id:     post.sujet_id,
      statut:       'publie',
      published_at: new Date().toISOString(),
    })
    .select('id, slug')
    .single()

  if (error) {
    // Slug déjà existant : ajouter un suffixe date
    if (error.code === '23505') {
      const dateStr = new Date().toISOString().slice(0, 10)
      await supabase.from('blog_posts').insert({
        ...post,
        slug: `${post.slug}-${dateStr}`,
        paragraphes: post.paragraphes,
        faq: post.faq,
        statut: 'publie',
        published_at: new Date().toISOString(),
      })
    } else {
      throw new Error(error.message)
    }
  }

  // Notifier par email
  try {
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
    if (resend && data) {
      await resend.emails.send({
        from: 'OWISE <noreply@owise.fr>',
        to: ADMIN_EMAIL,
        subject: `[OWISE Blog] Nouvel article publié : ${post.titre}`,
        html: `<p>Un nouvel article a été publié automatiquement sur le blog Owise :</p>
               <p><strong>${post.titre}</strong></p>
               <p><a href="https://owise.fr/blog/${data.slug}">Voir l'article →</a></p>`,
      })
    }
  } catch { /* email non bloquant */ }

  return NextResponse.json({
    ok: true,
    slug: data?.slug ?? post.slug,
    titre: post.titre,
    sujet: sujet.id,
  })
}
