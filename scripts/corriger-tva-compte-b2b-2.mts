/**
 * Deuxième passe sur « vtc-entreprise-compte-b2b » : le paragraphe et la FAQ
 * entièrement consacrés à une TVA qui n'existe pas.
 *
 * La première passe n'avait remplacé qu'une phrase. Le contrôle de relecture
 * a révélé le reste — un paragraphe intitulé « TVA récupérable sur les
 * trajets VTC » et une question de FAQ qui répondait « Oui » :
 *
 *   « Vos trajets Owise génèrent des factures avec TVA à 10 % (transport de
 *     personnes), récupérable si votre entreprise est assujettie à la TVA. »
 *
 * C'est faux, et c'est la plus coûteuse des cinq occurrences : précise,
 * chiffrée, assurée, et publiée depuis le 2026-09-07. Une entreprise qui l'a
 * lue a pu provisionner une déduction qu'elle n'obtiendra jamais.
 *
 * La vérité : Owise bénéficie de la franchise en base (article 293 B du CGI).
 * Ses factures ne portent aucune TVA — c'est d'ailleurs ce qu'elles écrivent.
 *
 * Chaque remplacement doit trouver sa cible exacte, sinon le script s'arrête.
 *
 *   npx tsx scripts/corriger-tva-compte-b2b-2.mts           montre
 *   npx tsx scripts/corriger-tva-compte-b2b-2.mts --ecrire  applique
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

const { data: post } = await admin
  .from('blog_posts')
  .select('id, paragraphes, faq')
  .eq('slug', 'vtc-entreprise-compte-b2b')
  .single()
if (!post) { console.log('ARRÊT — article introuvable.'); process.exit(1) }

const paragraphes = structuredClone(post.paragraphes) as { titre: string; texte: string }[]
const faq         = structuredClone(post.faq)         as { question: string; reponse: string }[]

const P_TITRE_AVANT = 'TVA récupérable sur les trajets VTC'
const P_TEXTE_AVANT = "Contrairement aux taxis dont la TVA n'est pas récupérable, les VTC sont des entreprises soumises à la TVA. Vos trajets Owise génèrent des factures avec TVA à 10 % (transport de personnes), récupérable si votre entreprise est assujettie à la TVA."
const Q_AVANT       = 'La TVA sur les trajets VTC Owise est-elle récupérable ?'

const P_TITRE_APRES = 'TVA : Owise est en franchise en base'
const P_TEXTE_APRES = 'Owise bénéficie de la franchise en base de TVA (article 293 B du Code général des impôts). Ses factures ne portent donc aucune TVA : le montant indiqué est net de taxe, et il n’y a rien à récupérer. Pour votre comptabilité, le trajet s’enregistre pour son montant total, sans ligne de taxe — et un tarif Owise ne se compare pas à un tarif hors taxe, puisqu’il n’y a pas de distinction entre HT et TTC.'
const R_APRES       = 'Non, parce qu’il n’y en a pas. Owise bénéficie de la franchise en base de TVA (article 293 B du Code général des impôts) : aucune TVA n’est facturée sur ses courses, et le montant indiqué est net de taxe. Il n’y a donc aucune taxe à récupérer.'

const p = paragraphes.find(x => x.titre === P_TITRE_AVANT)
if (!p) { console.log(`ARRÊT — paragraphe « ${P_TITRE_AVANT} » introuvable.`); process.exit(1) }
if (p.texte !== P_TEXTE_AVANT) {
  console.log('ARRÊT — le texte du paragraphe n’est pas celui attendu. Il a changé depuis la mesure.')
  console.log(`   en base : ${p.texte.slice(0, 120)}…`)
  process.exit(1)
}
p.titre = P_TITRE_APRES
p.texte = P_TEXTE_APRES

const q = faq.find(x => x.question === Q_AVANT)
if (!q) { console.log(`ARRÊT — question « ${Q_AVANT} » introuvable.`); process.exit(1) }
q.reponse = R_APRES   // la question reste : c'est bien celle que les gens posent

console.log('PARAGRAPHE')
console.log(`  titre  ${P_TITRE_AVANT}\n      ->  ${P_TITRE_APRES}`)
console.log(`  texte  ${P_TEXTE_AVANT.slice(0, 90)}…\n      ->  ${P_TEXTE_APRES.slice(0, 90)}…`)
console.log('\nFAQ')
console.log(`  question inchangée : ${Q_AVANT}`)
console.log(`  réponse  ->  ${R_APRES.slice(0, 90)}…`)

if (!ECRIRE) { console.log('\nSIMULATION — rien n’est écrit. Relancer avec « --ecrire ».\n'); process.exit(0) }

const { error } = await admin.from('blog_posts').update({ paragraphes, faq }).eq('id', post.id)
if (error) { console.log(`\nÉCHEC — ${error.message}`); process.exit(1) }

const { data: relu } = await admin.from('blog_posts')
  .select('titre, meta_titre, meta_desc, intro, paragraphes, conclusion, faq, mots_cles')
  .eq('id', post.id).single()
const reste = (JSON.stringify(relu).match(/r[ée]cup[ée]rable/gi) ?? []).length
console.log(reste
  ? `\nÉCHEC — « récupérable » apparaît encore ${reste} fois après écriture.`
  : '\ncorrigé — plus aucune mention de TVA récupérable dans cet article.')
process.exitCode = reste ? 1 : 0
