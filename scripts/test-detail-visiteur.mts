/**
 * Le détail du visiteur : canal d'arrivée, page, adresse saisie.
 *
 *   npx tsx scripts/test-detail-visiteur.mts
 *
 * N'OUVRE NI RÉSEAU NI BASE.
 *
 * Décision de l'exploitant du 2026-11-09 : les estimations gardent désormais
 * l'adresse exacte tapée, la page consultée et le canal d'arrivée. Trois
 * familles de défauts sont possibles, et ce contrôle vise les trois.
 *
 *  1. Le canal mal reconnu. Un référent interne compté en « direct » ferait
 *     passer Google et ChatGPT pour du trafic direct — le chiffre serait non
 *     seulement faux mais rassurant, donc jamais remis en cause.
 *  2. Le détail jamais envoyé. Un champ ajouté à la route mais oublié dans un
 *     des deux formulaires se voit uniquement en lisant une vraie ligne.
 *  3. La page de confidentialité qui ment. Elle annonce une durée de
 *     conservation ; si la tâche d'effacement applique une autre durée, le
 *     texte publié est faux.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canalDepuisReferent } from '../src/lib/origine-visite'
import { MOIS_CONSERVATION_SIMULATIONS } from '../src/lib/conservation'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p: string) => readFileSync(resolve(RACINE, p), 'utf8')

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ok = 0
const rates: string[] = []
const verifier = (quoi: string, condition: boolean, vu?: string) => {
  if (condition) { ok++; return }
  rates.push(vu === undefined ? quoi : `${quoi} — obtenu « ${vu} »`)
}

console.log(`\n${B}LE DÉTAIL DU VISITEUR EST-IL RELEVÉ, ET JUSTE ?${Z}`)

/* ── 1. Le canal d'arrivée ──────────────────────────────────────────────
   Référents écrits tels qu'un navigateur les donne : URL complète, pas un
   nom d'hôte reconstitué de mémoire. */
console.log(`\n${B}1. le canal d'arrivée, sur de vrais référents${Z}`)
const CAS: Array<[string, string, string]> = [
  ['',                                           '', 'direct'],
  ['https://www.google.com/',                    '', 'google'],
  ['https://www.google.fr/search?q=vtc+chantilly', '', 'google'],
  ['https://chatgpt.com/',                       '', 'chatgpt'],
  ['https://chatgpt.com/c/abc-123',              '', 'chatgpt'],
  ['https://www.perplexity.ai/search/xyz',       '', 'perplexity'],
  ['https://claude.ai/chat/1',                   '', 'claude'],
  ['https://gemini.google.com/app',              '', 'gemini'],
  ['https://copilot.microsoft.com/',             '', 'copilot'],
  ['https://duckduckgo.com/',                    '', 'recherche'],
  ['https://search.brave.com/search?q=owise',    '', 'recherche'],
  ['https://www.bing.com/search?q=vtc',          '', 'recherche'],
  ['https://www.facebook.com/',                  '', 'reseaux'],
  ['https://l.instagram.com/',                   '', 'reseaux'],
  ['https://www.linkedin.com/feed/',             '', 'reseaux'],
  ['https://web.whatsapp.com/',                  '', 'message'],
  ['https://g.page/r/CWZi3uynC81LEAE',           '', 'fiche_google'],
  ['https://www.owise.fr/vtc-chantilly',         '', 'interne'],
  ['https://owise.fr/',                          '', 'interne'],
  ['https://owise-app.vercel.app/',              '', 'interne'],
  ['https://exemple-inconnu.fr/page',            '', 'exemple-inconnu.fr'],
]
for (const [ref, utm, attendu] of CAS) {
  const vu = canalDepuisReferent(ref, utm)
  verifier(`« ${ref || '(aucun référent)'} » → ${attendu}`, vu === attendu, vu)
  if (vu !== attendu) console.log(`   ${R}✗${Z} ${ref || '(vide)'} → « ${vu} » au lieu de « ${attendu} »`)
}

/* Le piège qui compte : une navigation interne ne doit JAMAIS être comptée
   comme une arrivée directe. C'est le défaut qui gonflerait silencieusement
   le « direct » avec du trafic Google ou ChatGPT. */
verifier('une navigation interne n\'est pas du trafic direct',
  canalDepuisReferent('https://www.owise.fr/reserver') !== 'direct',
  canalDepuisReferent('https://www.owise.fr/reserver'))

/* Google Ads : reconnu par le gclid, qui prime sur tout le reste. */
verifier('un clic Google Ads est reconnu par son gclid',
  canalDepuisReferent('https://www.google.com/', '', 'Cj0KCQiA') === 'google_ads',
  canalDepuisReferent('https://www.google.com/', '', 'Cj0KCQiA'))
verifier('un gclid prime même sans référent',
  canalDepuisReferent('', '', 'Cj0KCQiA') === 'google_ads',
  canalDepuisReferent('', '', 'Cj0KCQiA'))

/* ── 2. Le détail part-il vraiment des deux formulaires ? ───────────────
   Un champ ajouté côté serveur et oublié côté page ne se voit qu'en lisant
   une vraie ligne, longtemps après. */
console.log(`\n${B}2. les deux formulaires envoient le détail${Z}`)
const CHAMPS = ['adresse_depart_saisie', 'adresse_arrivee_saisie', 'page', 'referent', 'utm_source', 'gclid']
for (const [nom, chemin] of [
  ['accueil',  'src/components/VitrineBody.tsx'],
  ['réserver', 'src/app/reserver/ReserverClient.tsx'],
] as const) {
  const src = lire(chemin)
  for (const champ of CHAMPS) {
    verifier(`${nom} envoie « ${champ} »`, src.includes(`${champ}:`), 'absent')
  }
  verifier(`${nom} lit l'origine de la visite`, src.includes('lireOrigine('), 'absent')
}

/* Le relevé doit être posé dans le gabarit racine : sur une seule page, il
   manquerait l'origine de toutes les visites entrées ailleurs. */
const layout = lire('src/app/layout.tsx')
verifier('le relevé d\'origine est dans le gabarit racine',
  layout.includes('<OrigineVisite />'), 'absent')

/* ── 3. Le serveur ne fait pas confiance au navigateur ──────────────────
   Le canal est recalculé côté serveur. S'il était simplement recopié depuis
   la requête, n'importe quel script pourrait fausser les comptages. */
console.log(`\n${B}3. le canal est recalculé par le serveur${Z}`)
const route = lire('src/app/api/estimations/route.ts')
verifier('la route recalcule le canal', route.includes('canalDepuisReferent('), 'absent')
verifier('la route ne recopie pas un canal reçu du navigateur',
  !/const\s*\{[^}]*\bcanal\b[^}]*\}\s*=\s*body/.test(route), 'le canal est lu depuis le corps de la requête')
verifier('la route écrit toujours la version généralisée',
  route.includes('generaliserLieu(dep)') && route.includes('adresse_depart:  depPropre'), 'absent')

/* ── 4. Les mentions légales ne mentent pas ─────────────────────────────
   Elles annoncent au visiteur ce qu'on garde et combien de temps. Le nombre
   affiché doit être celui qu'applique la tâche d'effacement. */
console.log(`\n${B}4. la page publique dit ce qui est vraiment fait${Z}`)
const legales = lire('src/app/mentions-legales/MentionsLegalesClient.tsx')
verifier('les simulations sont déclarées dans les données collectées',
  /Simulations de prix/.test(legales), 'absent')
verifier('la collecte des adresses saisies est déclarée',
  /saisies dans le simulateur/.test(legales), 'absent')
verifier(`la durée annoncée est bien ${MOIS_CONSERVATION_SIMULATIONS} mois`,
  new RegExp(`Simulations de prix[\\s\\S]{0,200}?${MOIS_CONSERVATION_SIMULATIONS} mois`).test(legales),
  'la durée publiée ne correspond pas à conservation.ts')
verifier('la page ne prétend plus que la mesure est anonymisée',
  !/analyse statistique anonymisée/.test(legales),
  'le texte annonce encore une analyse anonymisée')

/* L'écran d'administration l'annonçait aussi — « Estimations anonymes »,
   « sans saisie d'informations personnelles ». Un écran qui se décrit à
   l'envers finit par être cru sur parole. */
const ecran = lire('src/app/admin/estimations/page.tsx')
verifier('l\'écran ne s\'annonce plus anonyme',
  !/Estimations anonymes/.test(ecran), 'le titre dit encore « Estimations anonymes »')
verifier('l\'écran ne promet plus l\'absence d\'informations personnelles',
  !/sans saisie d&apos;informations personnelles/.test(ecran), 'le sous-titre le promet encore')

const purge = lire('src/app/api/cron/purge-estimations/route.ts')
verifier('la tâche d\'effacement lit la même constante',
  purge.includes('MOIS_CONSERVATION_SIMULATIONS'), 'absent')
verifier('la tâche efface le détail sans supprimer la statistique',
  purge.includes('adresse_depart_saisie:  null') && !/\.delete\(/.test(purge),
  'la tâche supprime des lignes')
const vercel = lire('vercel.json')
verifier('l\'effacement est planifié', vercel.includes('/api/cron/purge-estimations'), 'absent')

/* ── 5. Le module d'origine reste appelable des deux côtés ──────────────
   Il est lu par le navigateur ET par la route serveur. Un import le
   rendrait inappelable d'un des deux. */
console.log(`\n${B}5. le module d'origine n'a aucune dépendance${Z}`)
const origine = lire('src/lib/origine-visite.ts')
const imports = origine.match(/^\s*import\s.+$/gm) ?? []
verifier('origine-visite.ts n\'importe rien', imports.length === 0, imports.join(' / '))
const conservation = lire('src/lib/conservation.ts')
verifier('conservation.ts n\'importe rien',
  (conservation.match(/^\s*import\s.+$/gm) ?? []).length === 0, 'au moins un import')

console.log(`\n${B}RÉSULTAT${Z}`)
console.log(`  ${ok} contrôles au vert · ${rates.length ? R : V}${rates.length} au rouge${Z}`)
if (rates.length) {
  console.log(`\n${B}Ce qui échoue${Z}`)
  for (const r of rates) console.log(`  ${R}✗${Z} ${r}`)
}
console.log(`\n${G}Aucun réseau, aucune base : tout est lu dans le code et les textes publiés.${Z}\n`)
process.exit(rates.length ? 1 : 0)
