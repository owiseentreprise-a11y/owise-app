/**
 * Réécrit les articles « entreprise » déjà publiés à partir du générateur
 * corrigé.
 *
 * POURQUOI
 *
 * Cinq articles en ligne annonçaient « Compatible avec les obligations
 * comptables françaises — TVA récupérable ». C'est faux : Owise est en
 * franchise en base (article 293 B du CGI) et ne facture aucune TVA, donc il
 * n'y en a aucune à récupérer. La phrase contredisait les factures
 * elles-mêmes, et aurait contredit la réponse faite à une cliente qui posait
 * précisément cette question.
 *
 * Un sixième défaut touchait l'article du 2026-10-16 : le modèle écrit « les
 * entreprises basées à ${theme} », en supposant que le thème est un lieu.
 * Pour le sujet « séminaires et événements d'entreprise », cela donnait « les
 * entreprises basées à séminaires et événements d'entreprise ». Corrigé par
 * le drapeau `themeHorsLieu`.
 *
 * CE QUE CE SCRIPT NE FAIT PAS
 *
 * Il ne réécrit aucun texte à la main : il rappelle `genererContenu()`, la
 * même fonction que le cron, et remplace le contenu en base par ce qu'elle
 * rend aujourd'hui. Le slug, la date de publication et l'identifiant sont
 * conservés — l'URL ne bouge pas, donc rien ne sort du sitemap ni de l'index
 * Google.
 *
 *   npx tsx scripts/regenerer-articles-entreprise.mts           montre
 *   npx tsx scripts/regenerer-articles-entreprise.mts --ecrire  applique
 */
import { readFileSync } from 'fs'
import { join } from 'path'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = ligne.indexOf('=')
  if (i > 0) process.env[ligne.slice(0, i).trim()] ??= ligne.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}

const { createAdminClient } = await import('../src/lib/supabase/admin')
const { SUJETS, genererContenu } = await import('../src/lib/blogGenerator')

const ECRIRE = process.argv.includes('--ecrire')
const admin = createAdminClient()

/* Le prix berline sert aux modèles qui citent un tarif. On le lit comme le
 * fait le cron, plutôt que de le supposer. */
const { data: tarifs } = await admin.from('tarifs').select('vehicule, cdg_fixe')
const prixBerline = Number(tarifs?.find((t: any) => t.vehicule === 'berline')?.cdg_fixe ?? 0) || undefined

const { data: articles } = await admin
  .from('blog_posts')
  .select('id, slug, sujet_id, titre, statut, published_at')
  .eq('categorie', 'entreprise')
  .order('published_at', { ascending: false })

if (!articles?.length) { console.log('aucun article de catégorie « entreprise ».'); process.exit(0) }

console.log(`${articles.length} article(s) de catégorie « entreprise »\n`)

let aEcrire = 0
for (const a of articles) {
  const sujet = SUJETS.find(s => s.id === a.sujet_id)
  if (!sujet) { console.log(`  ⚠ ${a.slug} — sujet « ${a.sujet_id} » introuvable, laissé tel quel`); continue }

  const post = genererContenu(sujet, prixBerline)

  if (post.slug !== a.slug) {
    console.log(`  ⚠ ${a.slug} — le générateur produirait « ${post.slug} », URL différente : laissé tel quel`)
    continue
  }

  const champs = {
    titre: post.titre, meta_titre: post.meta_titre, meta_desc: post.meta_desc,
    intro: post.intro, paragraphes: post.paragraphes, conclusion: post.conclusion,
    faq: post.faq, mots_cles: post.mots_cles,
  }

  console.log(`  ${a.slug}`)
  console.log(`     titre : ${post.titre}`)
  const tout = JSON.stringify(champs)
  console.log(`     « TVA récupérable » : ${/r[ée]cup[ée]rable/i.test(tout) ? '\x1b[31mENCORE PRÉSENT\x1b[0m' : 'retiré'}`)
  console.log(`     « basées à <thème> » : ${/bas[ée]es? à (séminaires|facturation|transport)/i.test(tout) ? '\x1b[31mENCORE PRÉSENT\x1b[0m' : 'correct'}`)

  if (ECRIRE) {
    const { error } = await admin.from('blog_posts').update(champs).eq('id', a.id)
    if (error) { console.log(`     \x1b[31méchec : ${error.message}\x1b[0m`); continue }
    console.log('     réécrit')
  }
  aEcrire++
  console.log('')
}

if (!ECRIRE) console.log(`\nSIMULATION — ${aEcrire} article(s) seraient réécrits. Relancer avec « --ecrire ».\n`)
else console.log(`\n${aEcrire} article(s) réécrit(s).\n`)
