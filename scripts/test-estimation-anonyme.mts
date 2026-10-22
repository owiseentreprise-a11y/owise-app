/**
 * test-estimation-anonyme.mts — étape 88.
 *
 * Ce que la table `estimations` a le droit de recevoir. Les libellés d'entrée
 * sont ceux que Google renvoie RÉELLEMENT (même précaution qu'à l'étape 21
 * sur la détection de zone : jamais de libellé supposé).
 *
 * Lancer depuis owise-app :  npx tsx scripts/test-estimation-anonyme.mts
 */
import {
  lieuPourStatistique, generaliserLieu, communeDepuisLibelle, LIEU_INCONNU,
} from '../src/lib/estimation-anonyme'

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ko = 0, n = 0

function eq(titre: string, obtenu: unknown, attendu: unknown) {
  n++
  const ok = obtenu === attendu
  if (!ok) ko++
  console.log(`  ${ok ? V + '✓' : R + '✗'} ${titre}${Z}`)
  if (!ok) console.log(`     ${R}attendu : ${JSON.stringify(attendu)}\n     obtenu  : ${JSON.stringify(obtenu)}${Z}`)
}

function vrai(titre: string, cond: boolean, detail = '') {
  n++
  if (!cond) ko++
  console.log(`  ${cond ? V + '✓' : R + '✗'} ${titre}${Z}${detail ? `  ${G}${detail}${Z}` : ''}`)
}

console.log(`\n${B}1. Extraction de la commune${Z}`)
eq('adresse de voirie complète',
  communeDepuisLibelle('12 Rue de Paris, 60500 Chantilly, France'), '60500 Chantilly')
eq('libellé réécrit par Google pour CDG',
  communeDepuisLibelle('Aéroport Charles-de-Gaulle, Rue du Luxembourg, 93290 Tremblay-en-France'),
  '93290 Tremblay-en-France')
eq('commune composée', communeDepuisLibelle('3 Av. Foch, 60740 Saint-Maximin, France'), '60740 Saint-Maximin')
eq('aucun code postal', communeDepuisLibelle('Bruxelles, Belgique'), null)
eq('vide', communeDepuisLibelle(''), null)

console.log(`\n${B}2. Ce qu'on enregistre${Z}`)
eq('zone reconnue + commune',
  lieuPourStatistique('12 Rue de Paris, 60500 Chantilly, France', '60500', 'CHA'), 'CHA, 60500 Chantilly')
eq('aéroport',
  lieuPourStatistique('Aéroport Charles-de-Gaulle, Rue du Luxembourg, 93290 Tremblay-en-France', '93290', 'CDG'),
  'CDG, 93290 Tremblay-en-France')
eq('zone courte (Z1) sans commune lisible',
  lieuPourStatistique('Paris', '', 'Z1'), `Z1, ${LIEU_INCONNU}`)
eq('aucune zone, commune lisible',
  lieuPourStatistique('4 Avenue Foch, 75116 Paris, France', '75116', null), '75116 Paris')
eq('aucune zone, code postal seul',
  lieuPourStatistique('Quelque part', '60500', null), '60500')
eq('rien d’exploitable', lieuPourStatistique('', '', null), LIEU_INCONNU)
eq('zone en minuscules normalisée',
  lieuPourStatistique('Rue X, 60100 Creil, France', '60100', 'crl'), 'CRL, 60100 Creil')

console.log(`\n${B}3. Aucune rue, aucun numéro, aucune coordonnée ne survit${Z}`)
const entrees = [
  '12 Rue de Paris, 60500 Chantilly, France',
  '4b avenue des Champs-Élysées, 75008 Paris, France',
  "7 Impasse du Moulin, 60740 Saint-Maximin, France",
  'Chemin des Vignes, 60260 Lamorlaye, France',
  '1 Place de la Bastille, 75011 Paris, France',
]
for (const e of entrees) {
  const sortie = generaliserLieu(e)
  const propre = !/\d{1,4}\s*[a-z]?\s+(rue|avenue|av\.|boulevard|impasse|chemin|place|allée|quai|route)/i.test(sortie)
    && !/(rue|avenue|boulevard|impasse|chemin|allée|quai|route|place)\s/i.test(sortie)
  vrai(`« ${e.slice(0, 42)}… » → « ${sortie} »`, propre)
}

console.log(`\n${B}4. Le filet serveur est idempotent${Z}`)
for (const v of ['CHA, 60500 Chantilly', 'CDG, 93290 Tremblay-en-France', '75116 Paris', `Z1, ${LIEU_INCONNU}`, LIEU_INCONNU]) {
  eq(`« ${v} » reste inchangé`, generaliserLieu(v), v)
  eq(`« ${v} » stable au second passage`, generaliserLieu(generaliserLieu(v)), v)
}

console.log(`\n${B}5. Entrées hostiles${Z}`)
eq('objet au lieu d’une chaîne', generaliserLieu({ a: 1 }), LIEU_INCONNU)
eq('null', generaliserLieu(null), LIEU_INCONNU)
eq('coordonnées GPS brutes', generaliserLieu('49.0097, 2.5479'), LIEU_INCONNU)
eq('nom et téléphone glissés dans le champ',
  generaliserLieu('Jean Dupont 0612345678'), LIEU_INCONNU)
vrai('une valeur longue est tronquée à 80 caractères',
  generaliserLieu('75116 ' + 'A'.repeat(300)).length <= 80,
  `longueur ${generaliserLieu('75116 ' + 'A'.repeat(300)).length}`)

console.log(`\n${B}6. La forme produite reste lisible par /admin/estimations${Z}`)
/* L'écran découpe sur la virgule et cherche « NNNNN Commune ». */
function extractCityCommeAdmin(addr: string): string {
  for (const part of addr.split(',').map(p => p.trim())) {
    const m = part.match(/^\d{5}\s+(.+)$/)
    if (m) return m[1]
  }
  return ''
}
eq('« CHA, 60500 Chantilly » → ville « Chantilly »', extractCityCommeAdmin('CHA, 60500 Chantilly'), 'Chantilly')
eq('« 75116 Paris » → ville « Paris »', extractCityCommeAdmin('75116 Paris'), 'Paris')
eq('ancienne ligne encore lisible',
  extractCityCommeAdmin('12 Rue de Paris, 60500 Chantilly, France'), 'Chantilly')

console.log(`\n${B}7. La longueur minimale exigée par la route est respectée${Z}`)
/* /api/estimations refuse une valeur de moins de 3 caractères. */
for (const code of ['Z1', 'CHA', 'CDG', 'BVA', 'ORY', 'CHR', 'BEL', 'CRL', 'BEA', 'GAR']) {
  const v = lieuPourStatistique('', '', code)
  vrai(`zone « ${code} » produit au moins 3 caractères`, v.length >= 3, `« ${v} » (${v.length})`)
}

console.log(`\n${'─'.repeat(60)}`)
console.log(ko ? `${R}${B}${ko} échec(s) sur ${n} contrôles.${Z}\n` : `${V}${B}${n} contrôles au vert.${Z}\n`)
process.exit(ko ? 1 : 0)
