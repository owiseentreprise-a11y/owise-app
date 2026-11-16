/**
 * corriger-annulation-articles.mts — LES ARTICLES DÉJÀ PUBLIÉS ANNONCENT-ILS
 * LA POLITIQUE D'ANNULATION EN VIGUEUR ?
 *
 * ── LE DÉFAUT ─────────────────────────────────────────────────────────────
 *
 * Le 2026-11-03, la politique d'annulation a changé : « gratuite avant
 * attribution, puis 3 €, puis 8 € » est devenue « gratuite jusqu'à 24 h,
 * 50 % entre 24 h et 4 h, 100 % à moins de 4 h ». Le générateur d'articles
 * a été corrigé ce jour-là — il lit désormais `conditions.ts`.
 *
 * Mais un article est ÉCRIT EN BASE une fois pour toutes. Corriger le
 * générateur ne corrige pas les articles déjà publiés. Mesuré le
 * 2026-11-16 : 14 articles sur 153, publiés du 16 septembre au 30 octobre,
 * annonçaient encore l'ancienne politique — à leurs lecteurs, et aux
 * assistants IA qui les lisent dans `/llms-full.txt`. Ils contredisaient
 * les CGV.
 *
 * ── LA CORRECTION ─────────────────────────────────────────────────────────
 *
 * Chaque article devient, mot pour mot, ce que le générateur ACTUEL écrirait.
 * Aucune phrase n'est tapée ici : elles viennent de `conditions.ts`, comme
 * dans le générateur.
 *
 *   · la réponse à « Que se passe-t-il si je dois annuler ? »
 *       → `ANNULATION_PHRASE`   (blogGenerator.ts, ligne de la FAQ)
 *   · « Annulation gratuite tant qu'aucun chauffeur n'a été attribué »
 *     au milieu d'un paragraphe
 *       → `ANNULATION_COURTE`   (blogGenerator.ts, même paragraphe)
 *
 * ── PRÉCAUTIONS ───────────────────────────────────────────────────────────
 *
 *   · SIMULATION par défaut : rien n'est écrit sans `--ecrire`.
 *   · Avant toute écriture, les lignes d'origine sont SAUVEGARDÉES dans
 *     `../sauvegarde-blog/`, au format des sauvegardes déjà présentes.
 *   · On ne touche QUE les champs qui changent, et seulement les articles
 *     qui portent l'ancienne politique.
 *   · Après écriture, on RELIT la base : « un bouton pressé ne prouve pas
 *     une écriture » (règle du projet, 2026-11-10).
 *
 *   npx tsx scripts/corriger-annulation-articles.mts            simulation
 *   npx tsx scripts/corriger-annulation-articles.mts --ecrire   écriture
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { ANNULATION_PHRASE, ANNULATION_COURTE } from '../src/lib/conditions'

const ECRIRE = process.argv.includes('--ecrire')
const V = '\x1b[32m', R = '\x1b[31m', J = '\x1b[33m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

/* Les marques de l'ANCIENNE politique. */
const ANCIENNE = /tant qu.aucun chauffeur|3\s*€\s*de\s*3\s*à\s*10|frais d.annulation de [38]\s*€/i
const PARAGRAPHE_ANCIEN = /Annulation gratuite tant qu.aucun chauffeur n.a été attribué/g
const QUESTION_ANNULATION = /si je dois annuler/i

type Para = { titre?: string; texte?: string }
type Q = { question?: string; reponse?: string }
type Article = { id: string; slug: string; intro: string | null; paragraphes: Para[] | null; conclusion: string | null; faq: Q[] | null }

const { data, error } = await sb.from('blog_posts')
  .select('id, slug, intro, paragraphes, conclusion, faq')
  .eq('statut', 'publie')
if (error) { console.log(R + 'lecture impossible : ' + error.message + Z); process.exit(1) }
const tous = (data ?? []) as Article[]

const corriges: { article: Article; maj: Partial<Article>; changements: string[] }[] = []
for (const a of tous) {
  const brut = JSON.stringify([a.intro, a.paragraphes, a.conclusion, a.faq])
  if (!ANCIENNE.test(brut)) continue

  const maj: Partial<Article> = {}
  const changements: string[] = []

  // La FAQ : la réponse entière devient la phrase officielle.
  if (a.faq?.some(q => ANCIENNE.test(q.reponse ?? ''))) {
    maj.faq = a.faq.map(q => {
      if (!ANCIENNE.test(q.reponse ?? '')) return q
      if (!QUESTION_ANNULATION.test(q.question ?? '')) {
        changements.push(`${R}FAQ NON TRAITÉE — question inattendue : « ${q.question} »${Z}`)
        return q
      }
      changements.push(`FAQ « ${q.question} »\n      ${R}- ${q.reponse}${Z}\n      ${V}+ ${ANNULATION_PHRASE}${Z}`)
      return { ...q, reponse: ANNULATION_PHRASE }
    })
  }

  // Les paragraphes : seule la phrase ancienne est remplacée.
  if (a.paragraphes?.some(p => PARAGRAPHE_ANCIEN.test(p.texte ?? ''))) {
    maj.paragraphes = a.paragraphes.map(p => {
      PARAGRAPHE_ANCIEN.lastIndex = 0
      if (!PARAGRAPHE_ANCIEN.test(p.texte ?? '')) return p
      PARAGRAPHE_ANCIEN.lastIndex = 0
      const avant = (p.texte ?? '').match(PARAGRAPHE_ANCIEN)?.[0]
      changements.push(`paragraphe « ${p.titre} »\n      ${R}- ${avant}${Z}\n      ${V}+ ${ANNULATION_COURTE}${Z}`)
      return { ...p, texte: (p.texte ?? '').replace(PARAGRAPHE_ANCIEN, ANNULATION_COURTE) }
    })
  }

  // Ce qui resterait après correction : on ne devine pas, on le DIT.
  const apres = JSON.stringify([a.intro, maj.paragraphes ?? a.paragraphes, a.conclusion, maj.faq ?? a.faq])
  if (ANCIENNE.test(apres)) changements.push(`${R}RESTE DE L'ANCIENNE POLITIQUE après correction — à traiter à la main${Z}`)

  corriges.push({ article: a, maj, changements })
}

console.log(`\n${B}${corriges.length} article(s) sur ${tous.length} portent l'ancienne politique d'annulation${Z}\n`)
for (const { article, changements } of corriges) {
  console.log(`${B}/blog/${article.slug}${Z}`)
  for (const c of changements) console.log(`   ${c}`)
}

const restes = corriges.filter(c => c.changements.some(x => x.includes('RESTE') || x.includes('NON TRAITÉE')))
if (restes.length) {
  console.log(`\n${R}${B}${restes.length} article(s) ne seraient pas entièrement corrigés : rien n'est écrit.${Z}`)
  process.exit(1)
}

if (!ECRIRE) {
  console.log(`\n${J}SIMULATION — rien n'est écrit. Ajouter « --ecrire ».${Z}\n`)
  process.exit(0)
}

/* ── Sauvegarde, AVANT toute écriture ─────────────────────────────────── */
const dossier = resolve('..', 'sauvegarde-blog')
mkdirSync(dossier, { recursive: true })
const horodatage = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)
const fichier = resolve(dossier, `AVANT-annulation-${horodatage}.json`)
writeFileSync(fichier, JSON.stringify(corriges.map(c => c.article), null, 1))
console.log(`\n${G}sauvegarde des ${corriges.length} article(s) d'origine : ${fichier}${Z}`)

/* ── Écriture ─────────────────────────────────────────────────────────── */
let ecrits = 0
for (const { article, maj } of corriges) {
  const { error: e } = await sb.from('blog_posts').update(maj).eq('id', article.id)
  if (e) { console.log(`${R}✗ /blog/${article.slug} : ${e.message}${Z}`); continue }
  ecrits++
}
console.log(`${ecrits} article(s) écrit(s)`)

/* ── Relecture : la base dit-elle vraiment ce qu'on a écrit ? ─────────── */
const { data: relu } = await sb.from('blog_posts')
  .select('slug, intro, paragraphes, conclusion, faq').eq('statut', 'publie')
const encore = (relu ?? []).filter(a => ANCIENNE.test(JSON.stringify([a.intro, a.paragraphes, a.conclusion, a.faq])))
console.log(encore.length === 0
  ? `${V}${B}Relu en base : plus aucun article ne porte l'ancienne politique.${Z}`
  : `${R}${B}Relu en base : ${encore.length} article(s) la portent ENCORE — ${encore.map(a => a.slug).join(', ')}${Z}`)
process.exit(encore.length === 0 ? 0 : 1)
