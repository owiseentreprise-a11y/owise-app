/**
 * Une estimation garde-t-elle le nom de la commune ?
 *
 *   npx tsx scripts/test-statistique-commune.mts
 *
 * N'OUVRE NI RÉSEAU NI BASE. Tout est pur : on rejoue la chaîne complète
 * telle qu'elle tourne vraiment, dans l'ordre réel.
 *
 *   navigateur : lieuPourStatistique(libellé, code postal, zone)
 *   serveur    : generaliserLieu(ce qui est arrivé)   ← le filet
 *
 * Les deux maillons existaient déjà et chacun, lu seul, paraissait correct.
 * C'est leur enchaînement qui perdait la commune : le filet ne reconnaissait
 * pas « CDG, 95700 » comme une valeur déjà généralisée, essayait de la
 * raboter, n'y trouvait pas de commune, et écrivait « commune non précisée ».
 * Un contrôle qui n'appellerait qu'une des deux fonctions ne verrait rien.
 *
 * On éprouve LES 21 LIEUX CONNUS, un par un, lus dans `lieux.ts` — jamais une
 * liste recopiée ici. Le défaut du 2026-10-22 ne touchait qu'eux, et il n'a
 * été vu que seize jours plus tard.
 *
 * On vérifie aussi que le filet protège toujours ce pour quoi il a été
 * écrit : aucune adresse de voirie ne doit survivre.
 */
import {
  lieuPourStatistique, generaliserLieu, estDejaGeneralise,
  communeDepuisLibelle, communeDuLieuConnu, LIEU_INCONNU,
} from '../src/lib/estimation-anonyme'
import { LIEUX_CONNUS } from '../src/lib/lieux'

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ok = 0
const rates: string[] = []

function verifier(quoi: string, condition: boolean, vu?: string) {
  if (condition) { ok++; return }
  rates.push(vu === undefined ? quoi : `${quoi} — obtenu « ${vu} »`)
}

/** Un nom de ville : code postal suivi d'au moins une lettre. */
const PORTE_UN_NOM = (s: string) => /\d{5}\s+\p{L}/u.test(s)
/** Repères de voirie qui ne doivent JAMAIS franchir le filet. */
const VOIRIE = /\b(rue|avenue|boulevard|impasse|chemin|all[ée]e|place|quai|route|villa)\b/i

/** La chaîne complète, dans l'ordre réel. */
const chaine = (libelle: string, cp: string | undefined, zone: string | null) =>
  generaliserLieu(lieuPourStatistique(libelle, cp, zone))

console.log(`\n${B}LE NOM DE LA COMMUNE SURVIT-IL À LA CHAÎNE COMPLÈTE ?${Z}`)

/* ── 1. Les 21 lieux connus, choisis dans la liste de suggestions ─────────
   C'est le parcours exact : `pick()` recopie le libellé du lieu et son code
   postal. Deux cas par lieu, car la zone tarifaire n'est pas toujours
   reconnue — et dans les deux, la commune doit survivre. */
console.log(`\n${B}1. les ${LIEUX_CONNUS.length} lieux connus, choisis dans la liste${Z}`)
for (const lieu of LIEUX_CONNUS) {
  for (const [nomCas, zone] of [['avec zone', 'CDG'], ['sans zone', null]] as const) {
    const sortie = chaine(lieu.label, lieu.codePostal, zone)
    const bon = PORTE_UN_NOM(sortie) && !VOIRIE.test(sortie)
    verifier(`« ${lieu.label} » (${nomCas}) doit porter un nom de ville`, bon, sortie)
    if (!bon) console.log(`   ${R}✗${Z} ${lieu.label} (${nomCas}) → « ${sortie} »`)
  }
}
console.log(`   ${G}chaque lieu éprouvé avec et sans zone tarifaire${Z}`)

/* Chaque lieu doit déclarer sa commune, et la déclarer juste : le code postal
   du champ `commune` doit être celui du lieu. Sans ce contrôle, une faute de
   frappe passerait inaperçue. */
console.log(`\n${B}2. chaque lieu déclare une commune cohérente avec son code postal${Z}`)
for (const lieu of LIEUX_CONNUS) {
  verifier(`« ${lieu.label} » déclare une commune`, !!lieu.commune?.trim(), lieu.commune)
  verifier(`« ${lieu.label} » : commune au bon code postal`,
    lieu.commune?.startsWith(`${lieu.codePostal} `) === true, lieu.commune)
  verifier(`« ${lieu.label} » : commune retrouvée par son libellé`,
    communeDuLieuConnu(lieu.label) === lieu.commune.trim(), String(communeDuLieuConnu(lieu.label)))
}

/* ── 3. Le défaut exact du 2026-10-22 ────────────────────────────────────
   Ces valeurs sont celles que la page produisait et que le filet détruisait.
   Si ce bloc repasse au rouge, c'est que le défaut est revenu. */
console.log(`\n${B}3. le défaut exact du 2026-10-22 ne doit pas revenir${Z}`)
for (const v of ['CDG, 95700', 'ORY, 94390', 'BVA, 60000', '95700', 'Z1, 75010']) {
  verifier(`« ${v} » est déjà généralisée`, estDejaGeneralise(v), String(estDejaGeneralise(v)))
  verifier(`« ${v} » traverse le filet intacte`, generaliserLieu(v) === v, generaliserLieu(v))
}

/* ── 4. Les vraies adresses, telles que Google les renvoie ───────────────
   Libellés réellement observés via /api/geocode, jamais supposés. */
console.log(`\n${B}4. adresses réelles renvoyées par Google${Z}`)
const REELLES: Array<[string, string, string]> = [
  ['1 Pl. Henri IV, 60300 Senlis, France',                      '60300', '60300 Senlis'],
  ['Aéroport Charles-de-Gaulle, 93290 Tremblay-en-France',      '93290', '93290 Tremblay-en-France'],
  ['12 Rue de Paris, 60500 Chantilly, France',                  '60500', '60500 Chantilly'],
  ['55 Rue des Usages, 60560 Orry-la-Ville, France',            '60560', '60560 Orry-la-Ville'],
  ['Avenue Charles de Gaulle, 60100 Creil, France',             '60100', '60100 Creil'],
]
for (const [libelle, cp, attendu] of REELLES) {
  const sortie = chaine(libelle, cp, 'CHA')
  verifier(`« ${libelle.slice(0, 34)}… » → commune`, sortie.endsWith(attendu), sortie)
  verifier(`« ${libelle.slice(0, 34)}… » → sans voirie`, !VOIRIE.test(sortie), sortie)
  verifier(`communeDepuisLibelle garde « ${attendu} »`, communeDepuisLibelle(libelle) === attendu,
    String(communeDepuisLibelle(libelle)))
}

/* ── 5. Confidentialité : ce pour quoi le filet existe ───────────────────
   Il a été écrit le 2026-10-22 parce que la table recevait numéro et rue. En
   réparant la commune, on ne doit pas rouvrir cette porte. */
console.log(`\n${B}5. aucune adresse de voirie ne franchit le filet${Z}`)
const INTERDITES = [
  '12 Rue de Paris, 60500 Chantilly, France',
  '14 rue du Vieux Moulin, 60740 Saint-Maximin, France',
  '55 Rue des Usages, 60560 Orry-la-Ville, France',
  "4b avenue de l'Europe, 95700 Roissy-en-France",
  '18 Rue de Dunkerque, 75010 Paris, France',
]
for (const v of INTERDITES) {
  const sortie = generaliserLieu(v)
  verifier(`« ${v.slice(0, 30)}… » perd sa voirie`, !VOIRIE.test(sortie), sortie)
  verifier(`« ${v.slice(0, 30)}… » perd son numéro`, !/^\s*\d{1,4}\s*[a-z]?\s+\p{L}/iu.test(sortie), sortie)
}
/* La commune de l'exploitant est desservie et peut légitimement apparaître ;
   c'est la RUE qui ne doit jamais sortir. On vérifie les deux séparément. */
verifier('la rue de l\'exploitant ne sort pas',
  !/rue du vieux moulin/i.test(generaliserLieu('14 rue du Vieux Moulin, 60740 Saint-Maximin')),
  generaliserLieu('14 rue du Vieux Moulin, 60740 Saint-Maximin'))
verifier('mais sa commune reste lisible',
  generaliserLieu('14 rue du Vieux Moulin, 60740 Saint-Maximin') === '60740 Saint-Maximin',
  generaliserLieu('14 rue du Vieux Moulin, 60740 Saint-Maximin'))

/* ── 6. Le filet est idempotent ──────────────────────────────────────────
   Il tourne sur chaque écriture, y compris sur une valeur qu'il a lui-même
   produite. S'il n'est pas idempotent, il dégrade un peu plus à chaque
   passage — et c'est précisément ce qu'il faisait. */
console.log(`\n${B}6. le filet ne dégrade pas ce qu'il a déjà produit${Z}`)
const ECHANTILLON = [
  ...LIEUX_CONNUS.map(l => lieuPourStatistique(l.label, l.codePostal, 'CDG')),
  ...REELLES.map(([lib, cp]) => lieuPourStatistique(lib, cp, 'CHA')),
  LIEU_INCONNU, 'Z1, commune non précisée', 'CDG, 95700', '60300 Senlis',
]
for (const v of ECHANTILLON) {
  const un = generaliserLieu(v)
  verifier(`« ${v} » stable au deuxième passage`, generaliserLieu(un) === un, generaliserLieu(un))
}

/* ── 7. Rien ne doit jamais être détruit sans raison ─────────────────────
   Un filet de confidentialité doit DÉGRADER, pas DÉTRUIRE. Dès qu'un code
   postal existe dans la valeur, il doit rester quelque chose. */
console.log(`\n${B}7. une valeur qui contient un code postal garde au moins ce code${Z}`)
for (const v of ['Terminal 2E, 95700', 'quelque part 60300', 'CDG, 95700', 'Zone industrielle, 93420']) {
  const sortie = generaliserLieu(v)
  verifier(`« ${v} » conserve son code postal`, /\d{5}/.test(sortie), sortie)
}
/* Et à l'inverse : sans rien d'exploitable, on n'invente pas. */
for (const v of ['Aéroport', 'chez moi', 'xx']) {
  verifier(`« ${v} » n'invente aucune commune`, generaliserLieu(v) === LIEU_INCONNU, generaliserLieu(v))
}

console.log(`\n${B}RÉSULTAT${Z}`)
console.log(`  ${ok} contrôles au vert · ${rates.length ? R : V}${rates.length} au rouge${Z}`)
if (rates.length) {
  console.log(`\n${B}Ce qui échoue${Z}`)
  for (const r of rates) console.log(`  ${R}✗${Z} ${r}`)
}
console.log('')
process.exit(rates.length ? 1 : 0)
