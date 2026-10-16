/**
 * Retire des articles écrits à la main les affirmations selon lesquelles une
 * facture Owise porterait de la TVA, ou qu'elle serait déductible.
 *
 * Owise est en franchise en base (article 293 B du CGI) : ses factures ne
 * portent aucune TVA. Promettre une TVA déductible à une entreprise, c'est
 * lui faire attendre une déduction qu'elle n'obtiendra jamais.
 *
 * Ces articles-là ne sont pas régénérables : ils n'ont pas de `sujet_id`, ou
 * leur catégorie ne correspond à aucun modèle. On remplace donc les tournures
 * une par une.
 *
 * CE QUI N'EST PAS TRAITÉ ICI, VOLONTAIREMENT : « péages et TVA compris »,
 * présent sur 44 articles. La phrase dit que le prix est tout compris, pas
 * qu'une TVA est déductible — elle n'expose personne à une mauvaise écriture
 * comptable. C'est une décision à prendre séparément, pas une correction à
 * glisser dans celle-ci.
 *
 *   npx tsx scripts/corriger-tva-articles-manuels.mts           montre
 *   npx tsx scripts/corriger-tva-articles-manuels.mts --ecrire  applique
 */
import { readFileSync } from 'fs'
import { join } from 'path'

for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = ligne.indexOf('=')
  if (i > 0) process.env[ligne.slice(0, i).trim()] ??= ligne.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')

const ECRIRE = process.argv.includes('--ecrire')
const admin = createAdminClient()

/** Les tournures fautives et ce qu'elles deviennent. */
const REGLES: [RegExp, string][] = [
  [/facturation mensuelle, TVA déductible, récapitulatif de trajets/gi, 'facturation mensuelle, récapitulatif de trajets'],
  [/Facturation mensuelle, TVA déductible\./gi,                        'Facturation mensuelle, facture nette de taxe.'],
  [/la facturation avec TVA déductible/gi,                             'une facturation nominative, nette de taxe'],
  [/VTC professionnel facturation TVA/gi,                              'VTC professionnel facturation entreprise'],
  [/La facture avec TVA est disponible pour les notes de frais\./gi,   'La facture est disponible pour les notes de frais.'],
  [/une facture avec TVA est disponible pour chaque trajet/gi,         'une facture nominative est disponible pour chaque trajet'],
  [/génère une facture nominative avec TVA\./gi,                       'génère une facture nominative.'],
  [/émet une facture nominative avec TVA immédiatement/gi,             'émet une facture nominative immédiatement'],
]

/** Ce qui ne doit plus rien renvoyer une fois le script passé. */
const FAUTIF = /TVA\s*d[ée]ductible|facture[^.""]{0,20}avec TVA|justificatif TVA|facturation TVA/i

const CHAMPS = ['titre', 'meta_titre', 'meta_desc', 'intro', 'paragraphes', 'conclusion', 'faq', 'mots_cles'] as const

const { data: posts } = await admin
  .from('blog_posts')
  .select('id, slug, titre, meta_titre, meta_desc, intro, paragraphes, conclusion, faq, mots_cles')

if (!posts?.length) { console.log('aucun article lu.'); process.exit(1) }

let articlesTouches = 0
let remplacements = 0

for (const p of posts) {
  if (!FAUTIF.test(JSON.stringify(p))) continue

  const modifies: Record<string, unknown> = {}
  const details: string[] = []

  for (const champ of CHAMPS) {
    const valeur = (p as any)[champ]
    if (valeur === null || valeur === undefined) continue
    const estTexte = typeof valeur === 'string'
    let texte = estTexte ? valeur : JSON.stringify(valeur)
    const avant = texte

    for (const [re, vers] of REGLES) {
      const n = (texte.match(re) ?? []).length
      if (!n) continue
      texte = texte.replace(re, vers)
      remplacements += n
      details.push(`${champ} : ${n}× ${String(re).slice(1, 48)}…`)
    }
    if (texte !== avant) modifies[champ] = estTexte ? texte : JSON.parse(texte)
  }

  console.log(`  ${p.slug}`)
  if (!details.length) {
    console.log('     \x1b[33maucune règle ne s’applique — à regarder à la main\x1b[0m')
    console.log(`     ${(JSON.stringify(p).match(FAUTIF) ?? [''])[0]}`)
    continue
  }
  for (const d of details) console.log(`     ${d}`)

  if (ECRIRE) {
    const { error } = await admin.from('blog_posts').update(modifies).eq('id', p.id)
    console.log(error ? `     \x1b[31méchec : ${error.message}\x1b[0m` : '     réécrit')
    if (error) continue
  }
  articlesTouches++
}

console.log(`\n${articlesTouches} article(s), ${remplacements} remplacement(s)`)
if (!ECRIRE) { console.log('\nSIMULATION — rien n’est écrit. Relancer avec « --ecrire ».\n'); process.exit(0) }

/* Relecture depuis la base : on ne croit pas la réponse de l'écriture. */
const { data: relus } = await admin
  .from('blog_posts')
  .select('slug, titre, meta_titre, meta_desc, intro, paragraphes, conclusion, faq, mots_cles')
const restants = (relus ?? []).filter(p => FAUTIF.test(JSON.stringify(p)))
console.log(restants.length
  ? `\n\x1b[31mIL RESTE ${restants.length} article(s) : ${restants.map(p => p.slug).join(', ')}\x1b[0m\n`
  : '\n\x1b[32maucun article n’affirme plus qu’une facture Owise porte de la TVA\x1b[0m\n')
process.exitCode = restants.length ? 1 : 0
