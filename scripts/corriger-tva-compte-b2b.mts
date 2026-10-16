/**
 * Corrige la phrase sur la TVA de l'article « vtc-entreprise-compte-b2b ».
 *
 * Cet article-là ne peut pas être régénéré : sa catégorie est « guide » et il
 * ne porte aucun `sujet_id`, donc `genererContenu()` ne sait pas le produire.
 * On remplace donc la phrase elle-même, et seulement elle.
 *
 * Ce qu'elle disait :
 *   « Chaque trajet génère une facture nominative avec TVA récupérable. »
 *
 * C'est faux. Owise est en franchise en base de TVA (article 293 B du CGI) :
 * aucune TVA n'est facturée, donc il n'y en a aucune à récupérer. Une
 * entreprise qui lisait cette page pouvait croire pouvoir déduire une taxe
 * qui ne lui sera jamais factur��e.
 *
 * Le script s'arrête si la phrase n'est pas trouvée telle quelle — plutôt que
 * de réécrire approximativement un texte publié.
 *
 *   npx tsx scripts/corriger-tva-compte-b2b.mts           montre
 *   npx tsx scripts/corriger-tva-compte-b2b.mts --ecrire  applique
 */
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = ligne.indexOf('=')
  if (i > 0) process.env[ligne.slice(0, i).trim()] ??= ligne.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')

const ECRIRE = process.argv.includes('--ecrire')
const SLUG = 'vtc-entreprise-compte-b2b'

const AVANT = 'Chaque trajet génère une facture nominative avec TVA récupérable.'
const APRES = 'Chaque trajet génère une facture nominative. Owise bénéficie de la franchise en base de TVA (article 293 B du Code général des impôts) : aucune TVA n’est facturée, le montant est net de taxe.'

const admin = createAdminClient()
const { data: post } = await admin
  .from('blog_posts')
  .select('id, slug, paragraphes, intro, conclusion, faq')
  .eq('slug', SLUG)
  .single()

if (!post) { console.log(`ARRÊT — article « ${SLUG} » introuvable.`); process.exit(1) }

/* On cherche la phrase dans TOUS les champs de texte, pas seulement celui
 * qu'on croit : un même défaut se recopie volontiers ailleurs. */
const champs = ['intro', 'paragraphes', 'conclusion', 'faq'] as const
const modifies: Record<string, unknown> = {}
let occurrences = 0

for (const champ of champs) {
  const valeur = (post as any)[champ]
  if (valeur === null || valeur === undefined) continue
  const texte = typeof valeur === 'string' ? valeur : JSON.stringify(valeur)
  if (!texte.includes(AVANT)) continue
  occurrences++
  const corrige = texte.split(AVANT).join(APRES)
  modifies[champ] = typeof valeur === 'string' ? corrige : JSON.parse(corrige)
  console.log(`  ${champ} : phrase trouvée et remplacée`)
}

if (occurrences === 0) {
  console.log('ARRÊT — la phrase n’a été trouvée dans aucun champ.')
  console.log(`Cherchée : « ${AVANT} »`)
  console.log('Elle a peut-être déjà été corrigée, ou sa formulation a changé.')
  process.exit(1)
}

console.log(`\navant : ${AVANT}`)
console.log(`après : ${APRES}`)

if (!ECRIRE) { console.log('\nSIMULATION — rien n’est écrit. Relancer avec « --ecrire ».\n'); process.exit(0) }

writeFileSync(join(process.cwd(), '..', 'article-compte-b2b-avant.json'), JSON.stringify(post, null, 2))
const { error } = await admin.from('blog_posts').update(modifies).eq('id', post.id)
if (error) { console.log(`\nÉCHEC — ${error.message}`); process.exit(1) }

/* On relit depuis la base plutôt que de croire la réponse. */
const { data: relu } = await admin.from('blog_posts').select('intro, paragraphes, conclusion, faq').eq('id', post.id).single()
const reste = /r[ée]cup[ée]rable/i.test(JSON.stringify(relu))
console.log(reste ? '\nÉCHEC — « récupérable » est encore présent après écriture.' : '\ncorrigé — plus aucune mention de TVA récupérable dans cet article.')
console.log('trace de l’état précédent : article-compte-b2b-avant.json\n')
process.exitCode = reste ? 1 : 0
