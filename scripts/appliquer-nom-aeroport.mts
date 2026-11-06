/**
 * Écrire le vrai nom de l'aéroport là où les pages ne disent que « CDG ».
 *
 *   npx tsx scripts/appliquer-nom-aeroport.mts            → simulation
 *   npx tsx scripts/appliquer-nom-aeroport.mts --ecrire
 *
 * CE QU'ON A MESURÉ, LE 2026-11-06
 *
 * 31 des 39 pages villes parlent de CDG sans jamais écrire « Charles de
 * Gaulle » dans leur texte visible. « CDG » y figure 20 à 25 fois, « Roissy »
 * 7 fois, le nom réel de l'aéroport zéro fois.
 *
 * Or Search Console mesure, sur 28 jours, que des visiteurs cherchent
 * précisément ces mots :
 *   · « taxi versailles charles de gaulle »       → 71e place
 *   · « chantilly to charles de gaulle airport »  → 2e requête du sujet
 *   · « charles de gaulle airport to chantilly »  → 37e place
 *
 * Les 8 pages qui écrivent le nom en entier sont aussi celles qui se classent
 * le mieux (/en/chantilly-to-charles-de-gaulle-airport : 7e). C'est une
 * CORRÉLATION, pas une preuve : Google ne publie pas ses raisons, et ces 8
 * pages ont d'autres particularités. Ce qui est certain, en revanche, c'est
 * qu'une page ne peut pas répondre à des mots qu'elle n'écrit pas.
 *
 * CE QUE CET OUTIL FAIT, ET CE QU'IL NE FAIT PAS
 *
 * Une seule substitution par page, dans l'`intro`, à la PREMIÈRE mention :
 * « vers CDG, Orly et Paris » devient « vers Charles de Gaulle (CDG), Orly et
 * Paris ». Ce n'est pas du bourrage de mots-clés — c'est nommer correctement
 * un aéroport, une fois. Les 20 autres « CDG » de la page restent « CDG »,
 * qui est l'usage courant et la bonne abréviation.
 *
 * « Charles de Gaulle » et non « Paris-Charles de Gaulle » : le mot « Paris »
 * figure déjà dans la même phrase sur presque toutes ces pages, et
 * « Paris-Charles de Gaulle (CDG), Orly et Paris » se lit mal.
 *
 * Le champ `duree` ('40 min vers CDG') n'est JAMAIS touché : c'est une
 * pastille courte, l'allonger casserait la mise en page.
 *
 * Rien n'est écrit si un seul compte ne tombe pas juste.
 *
 * NOTE SUR detectZone — ce changement ne l'atteint pas. detectZone lit des
 * ADRESSES soumises par un visiteur, jamais le texte d'une page. Le piège
 * documenté (« Avenue Charles de Gaulle » à Creil facturée comme un départ de
 * CDG) concerne les adresses, et aucune adresse n'est modifiée ici.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const FICHIER = resolve(ICI, '../src/app/[destination]/page.tsx')
const ECRIRE = process.argv.includes('--ecrire')
const V = '\x1b[32m', R = '\x1b[31m', J = '\x1b[33m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

/* Les pages où ne PAS écrire le nom complet est le bon choix. Elles parlent
   d'un autre aéroport et ne citent CDG qu'en passant — dans une comparaison,
   ou dans la pastille `duree` qu'on ne touche jamais. Leur imposer le nom
   complet dirait au lecteur que la page traite de CDG, ce qui serait faux.
   Liste déclarée : si l'une d'elles change et mérite le nom, elle apparaîtra
   comme exception morte ci-dessous. */
const HORS_SUJET: Record<string, string> = {
  'vtc-creil-orly': 'page Orly : CDG n’y est cité que pour situer le trajet',
  'vtc-compiegne-orly': 'page Orly : même raison',
  'vtc-creil-beauvais': 'page Beauvais-Tillé : CDG n’y est qu’un point de comparaison',
  'vtc-meru': 'Méru est hors zone forfaitaire ; sa page renvoie au prix au kilomètre, pas à un aéroport',
}

const NOM_COMPLET = /charles[ -]de[ -]gaulle/i
/* « CDG » isolé, et pas déjà précédé du nom complet. */
const CDG_SEUL = /\bCDG\b/

const src = readFileSync(FICHIER, 'utf8')

/* Découpage sur les entrées de DESTINATIONS, lues dans le fichier et jamais
   énumérées de mémoire : une entrée oubliée serait une page qu'on croit
   traitée. */
const entrees: { slug: string; debut: number }[] = []
for (const m of src.matchAll(/\n  '([a-z0-9-]+)':\s*\{/g)) {
  entrees.push({ slug: m[1], debut: m.index! })
}
if (entrees.length < 30) {
  console.log(`${R}ARRÊT — ${entrees.length} entrées seulement : le découpage a échoué.${Z}`)
  process.exit(1)
}

/* `apres` porte le texte COMPLET : c'est sur lui que le garde-fou compte les
   insertions. La première version ne gardait que 110 caractères pour
   l'affichage et comptait dessus — sur une intro longue, l'insertion tombait
   au-delà, le compte donnait 0, et le garde-fou refusait d'écrire une
   substitution parfaitement correcte. Un contrôle qui ne regarde pas au bon
   endroit est aussi faux quand il bloque à tort que quand il laisse passer. */
type Cas = { slug: string; ou: string; avant: string; apres: string }
/* Une fenêtre autour du changement, pour qu'il soit visible à l'œil. */
const fenetre = (t: string) => {
  const i = t.indexOf('Charles de Gaulle (CDG)')
  if (i < 0) return t.slice(0, 110)
  return `${i > 60 ? '…' : ''}${t.slice(Math.max(0, i - 60), i + 60)}…`
}
const faits: Cas[] = []
const deja: string[] = []
const impossibles: string[] = []

let sortie = ''
let curseur = 0

for (let i = 0; i < entrees.length; i++) {
  const fin = i + 1 < entrees.length ? entrees[i + 1].debut : src.length
  const { slug, debut } = entrees[i]
  let bloc = src.slice(debut, fin)

  /* Le texte VISIBLE : ni metaTitle, ni metaDesc, ni keywords — un mot dans
     une balise ne se lit pas sur la page. */
  const visible = bloc
    .replace(/metaTitle:[^\n]*\n/g, '')
    .replace(/metaDesc:[^\n]*\n/g, '')
    .replace(/keywords:\s*\[[\s\S]*?\],\n/g, '')

  if (!CDG_SEUL.test(visible)) { sortie += src.slice(curseur, fin); curseur = fin; continue }
  if (NOM_COMPLET.test(visible)) {
    deja.push(slug)
    sortie += src.slice(curseur, fin); curseur = fin; continue
  }

  /* 1er choix : l'intro. 2e choix : la première réponse de FAQ. */
  const intro = bloc.match(/\n(\s*)intro: '((?:[^'\\]|\\.)*)',/)
  let remplace = false
  let ou = ''
  if (intro && CDG_SEUL.test(intro[2])) {
    const neuf = intro[2].replace(CDG_SEUL, 'Charles de Gaulle (CDG)')
    bloc = bloc.replace(intro[0], `\n${intro[1]}intro: '${neuf}',`)
    faits.push({ slug, ou: 'intro', avant: intro[2].slice(0, 90), apres: neuf })
    remplace = true; ou = 'intro'
  } else {
    const faq = bloc.match(/\{ q: '((?:[^'\\]|\\.)*)', a: '((?:[^'\\]|\\.)*)' \}/)
    if (faq && CDG_SEUL.test(faq[2])) {
      const neuf = faq[2].replace(CDG_SEUL, 'Charles de Gaulle (CDG)')
      bloc = bloc.replace(faq[0], `{ q: '${faq[1]}', a: '${neuf}' }`)
      faits.push({ slug, ou: 'faq', avant: faq[2].slice(0, 90), apres: neuf })
      remplace = true; ou = 'faq'
    }
  }
  if (!remplace) impossibles.push(slug)

  sortie += bloc
  curseur = fin
  void ou
}
sortie += src.slice(curseur)

console.log(`\n${B}LE VRAI NOM DE L'AÉROPORT DANS LES PAGES VILLES${Z}`)
console.log(`${G}${entrees.length} entrées lues dans ${FICHIER.split(/[\\/]/).slice(-3).join('/')}${Z}\n`)
console.log(`  ${V}${faits.length}${Z} page(s) reçoivent « Charles de Gaulle (CDG) »`)
console.log(`  ${G}${deja.length} l'écrivaient déjà : ${deja.join(', ')}${Z}`)
if (impossibles.length) {
  console.log(`  ${J}${impossibles.length} sans point d'insertion naturel : ${impossibles.join(', ')}${Z}`)
}

console.log(`\n${B}Les trois pages du jour, mot pour mot${Z}`)
for (const c of faits.filter(c => ['vtc-versailles', 'vtc-chantilly', 'vtc-creil'].includes(c.slug))) {
  console.log(`\n  ${B}${c.slug}${Z} ${G}(${c.ou})${Z}`)
  console.log(`    ${R}avant${Z} ${c.avant}…`)
  console.log(`    ${V}après${Z} ${fenetre(c.apres)}`)
}

/* Le garde-fou : une seule insertion par page, et la page doit la porter. */
let anomalies = 0
for (const c of faits) {
  const n = (c.apres.match(/Charles de Gaulle \(CDG\)/g) ?? []).length
  if (n !== 1) { console.log(`\n  ${R}✗ ${c.slug} : ${n} insertion(s) au lieu d'une${Z}`); anomalies++ }
}
const totalNeuf = (sortie.match(/Charles de Gaulle \(CDG\)/g) ?? []).length
const totalVieux = (src.match(/Charles de Gaulle \(CDG\)/g) ?? []).length
if (totalNeuf - totalVieux !== faits.length) {
  console.log(`\n  ${R}✗ le fichier gagne ${totalNeuf - totalVieux} mentions pour ${faits.length} pages traitées${Z}`)
  anomalies++
}

/* Les pages sans point d'insertion qui ne sont PAS déclarées hors sujet :
   celles-là sont un vrai trou, pas un choix. */
const trousNonDeclares = impossibles.filter(s => !HORS_SUJET[s])
const exceptionsMortes = Object.keys(HORS_SUJET).filter(s => !impossibles.includes(s))

console.log('\n' + '─'.repeat(72))
if (anomalies) { console.log(`${R}${B}${anomalies} anomalie(s) — rien n'est écrit.${Z}\n`); process.exit(1) }

if (ECRIRE) {
  writeFileSync(FICHIER, sortie, 'utf8')
  console.log(`${V}${B}${faits.length} insertions écrites.${Z}\n`)
  process.exit(0)
}

/* ── Sans --ecrire, ce fichier EST le contrôle ────────────────────────────
   Relancé après l'ajout d'une page ville, il échoue s'il reste une page qui
   parle de CDG sans le nommer. C'est ce qui empêche le défaut de revenir à
   la page suivante — le compte seul ne protège rien. */
let ko = 0
if (faits.length) {
  console.log(`${R}✗ ${faits.length} page(s) parlent de CDG sans écrire « Charles de Gaulle » :${Z}`)
  console.log(`  ${faits.map(c => c.slug).join(', ')}`)
  console.log(`  ${G}→ npx tsx scripts/appliquer-nom-aeroport.mts --ecrire${Z}`)
  ko++
}
if (trousNonDeclares.length) {
  console.log(`${R}✗ ${trousNonDeclares.length} page(s) sans point d'insertion et sans raison déclarée :${Z}`)
  console.log(`  ${trousNonDeclares.join(', ')}`)
  console.log(`  ${G}→ soit leur écrire une intro qui nomme l'aéroport, soit les déclarer dans HORS_SUJET${Z}`)
  ko++
}
if (exceptionsMortes.length) {
  console.log(`${J}~ ${exceptionsMortes.length} exception(s) morte(s) : ${exceptionsMortes.join(', ')}${Z}`)
  console.log(`  ${G}ces pages ont changé — retirer l'entrée de HORS_SUJET${Z}`)
  ko++
}
if (ko) { console.log(''); process.exit(1) }
console.log(`${V}${B}les ${deja.length} pages qui parlent de CDG le nomment en entier${Z}`)
console.log(`${G}${Object.keys(HORS_SUJET).length} page(s) hors sujet, assumées :${Z}`)
for (const [s, r] of Object.entries(HORS_SUJET)) console.log(`  ${G}· ${s} — ${r}${Z}`)
console.log('')
