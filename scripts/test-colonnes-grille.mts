/**
 * Toutes les pages lisent-elles les MÊMES colonnes de la grille tarifaire ?
 *
 *   npx tsx scripts/test-colonnes-grille.mts
 *
 * POURQUOI CE CONTRÔLE EXISTE
 *
 * Mesuré le 2026-11-07 : neuf endroits lisent `grilles_tarifaires`. Cinq
 * nommaient trois colonnes à la main — la page d'ACCUEIL, les 38 pages
 * villes, les deux pages anglaises et `reserver/actions.ts`. Les quatre
 * autres lisent `*`.
 *
 * Tant que la table n'a qu'une colonne de prix, les deux formes donnent le
 * même résultat, et rien ne signale le problème. Le jour où une colonne de
 * prix s'ajoute — un prix ferme par véhicule, par exemple — les `select`
 * nommés à la main ne la voient pas. /reserver afficherait alors le prix
 * fixé par l'exploitant et l'accueil le prix calculé par coefficient, pour
 * le même trajet, sans qu'aucune erreur ne se produise nulle part.
 *
 * C'est le défaut exact que `supplement_etape` a laissé courir des mois :
 * le site a facturé 10 € quand la base disait 20 €, parce qu'un `select`
 * ne nommait pas la colonne. La règle du projet est écrite : « chaque
 * `select` liste ses colonnes une par une, et une colonne oubliée fait
 * silencieusement retomber le code sur sa valeur de repli ».
 *
 * CE QUI EST ACCEPTÉ : `COLONNES_GRILLE`, la liste unique, ou `'*'` — qui
 * ne peut rien manquer par construction. Tout le reste est refusé.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const SRC = resolve(RACINE, 'src')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? `\n      ${G}${d}${Z}` : ''}`) }
}

const fichiers: string[] = []
const marcher = (d: string) => {
  for (const e of readdirSync(d)) {
    if (e === 'node_modules' || e.startsWith('.')) continue
    const p = join(d, e)
    if (statSync(p).isDirectory()) marcher(p)
    else if (/\.(ts|tsx)$/.test(e)) fichiers.push(p)
  }
}
marcher(SRC)

console.log(`\n${B}LES COLONNES DE LA GRILLE TARIFAIRE${Z}`)
console.log(`${G}${fichiers.length} fichiers de src/ examinés${Z}\n`)

/* La liste unique, lue dans sa source — jamais recopiée ici. */
const calcPrix = readFileSync(resolve(SRC, 'lib/calcPrix.ts'), 'utf8')
/* `[\s\S]*?` et pas un simple espace : la déclaration a débordé sur deux
   lignes dès qu'on y a ajouté les trois colonnes de prix par véhicule, et ce
   contrôle a cessé de la trouver — il annonçait « COLONNES_GRILLE n'est pas
   déclarée » alors qu'elle l'était. Il a signalé son propre angle mort, ce
   qui est le comportement voulu, mais la lecture devait suivre. */
const LISTE = calcPrix.match(/export const COLONNES_GRILLE =[\s\S]*?'([^']+)'/)?.[1]
dire(Boolean(LISTE), 'COLONNES_GRILLE est déclarée dans calcPrix.ts', `lue : ${LISTE ?? '(introuvable)'}`)
if (LISTE) console.log(`      ${G}${LISTE}${Z}`)

/* Chaque lecture de la table, et la forme de son `select`. */
type Lecture = { fichier: string; ligne: number; forme: string }
const lectures: Lecture[] = []
for (const f of fichiers) {
  const texte = readFileSync(f, 'utf8')
  const lignes = texte.split(/\r?\n/)
  lignes.forEach((l, i) => {
    if (!l.includes("from('grilles_tarifaires')")) return
    /* Le `.select(...)` suit parfois sur la ligne d'après. */
    const fenetre = [l, lignes[i + 1] ?? '', lignes[i + 2] ?? ''].join(' ')
    const m = fenetre.match(/\.select\(\s*([^)]*?)\s*\)/)
    /* Une ÉCRITURE n'est pas une lecture. La première version de ce contrôle
       signalait les quatre `update`/`insert`/`delete` d'`admin/tarifs` comme
       « aucun select trouvé » — quatre fausses alertes sur cinq. Un contrôle
       qui crie au loup finit par être ignoré, et c'est alors la vraie alerte
       qu'on manque. */
    if (!m) {
      const estEcriture = /\.(update|insert|upsert|delete)\s*\(/.test(fenetre)
      if (estEcriture) return
    }
    lectures.push({
      fichier: relative(RACINE, f).split('\\').join('/'),
      ligne: i + 1,
      forme: m ? m[1].trim() : '(ni select ni écriture reconnue — à regarder)',
    })
  })
}

console.log(`\n${B}Les ${lectures.length} lectures de grilles_tarifaires${Z}`)
const ACCEPTE = (f: string) => f === 'COLONNES_GRILLE' || f === "'*'" || f === '"*"'
const fautives: Lecture[] = []
for (const l of lectures) {
  const bon = ACCEPTE(l.forme)
  if (!bon) fautives.push(l)
  console.log(`  ${bon ? V + '✓' : R + '✗'}${Z} ${l.fichier}:${l.ligne}  ${G}select(${l.forme})${Z}`)
}

dire(lectures.length >= 8, `${lectures.length} lectures trouvées — le balayage voit bien la table`,
     'moins de 8 : le motif de recherche ne trouve plus les appels, ce contrôle ne protège rien')
dire(fautives.length === 0,
     'aucune lecture ne nomme ses colonnes à la main',
     fautives.map(l => `${l.fichier}:${l.ligne} → select(${l.forme})`).join('\n      '))

/* Le détecteur sait-il échouer ? On lui repasse la forme RÉELLE qui était
   écrite dans cinq fichiers jusqu'au 2026-11-07. S'il l'accepte, il ne
   protège plus rien. */
const FORME_FAUTIVE_HISTORIQUE = "'zone_depart_id,zone_arrivee_id,prix_berline'"
dire(!ACCEPTE(FORME_FAUTIVE_HISTORIQUE),
     'le détecteur refuse toujours la forme écrite à la main d’origine',
     'il l’accepte — ce contrôle ne protège plus rien')

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}\n`)
