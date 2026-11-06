/**
 * Un visiteur anglophone peut-il traverser la réservation sans retomber en
 * français ?
 *
 *   npx tsx scripts/test-langue-reservation.mts
 *
 * Le défaut que ce contrôle existe pour attraper n'est pas une faute de
 * traduction : c'est un DÉCROCHAGE SILENCIEUX.
 *
 * `validationReservation.ts` reste volontairement en français — c'est lui qui
 * refuse un paiement côté serveur, et `/admin/funnel` groupe ses messages
 * tels quels. `langue.ts` les traduit donc à l'affichage, **par
 * correspondance exacte de la chaîne française**. Conséquence : il suffit
 * qu'on ajoute une virgule dans un message de validation pour que
 * l'anglophone reçoive du français, sans erreur, sans log, sans rien.
 *
 * Ce contrôle lit les messages RÉELLEMENT écrits dans
 * `validationReservation.ts` — jamais une liste recopiée ici — et exige que
 * chacun ait sa traduction.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { textes, messageDansLaLangue, messagesTraduisibles, type Langue } from '../src/lib/langue'
import { verifierTrajet, verifierReservation } from '../src/lib/validationReservation'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const lireFichier = (f: string) => readFileSync(resolve(RACINE, f), 'utf8')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? ` ${G}— ${d}${Z}` : ''}`) }
}

console.log(`\n${B}LA RÉSERVATION EN ANGLAIS${Z}\n`)

// ── 1. Tout message de validation a-t-il sa traduction ? ────────────────
console.log(`${B}1. les messages de validation${Z} ${G}(lus dans le fichier, pas listés ici)${Z}`)
const src = readFileSync(resolve(RACINE, 'src/lib/validationReservation.ts'), 'utf8')
/* On neutralise les commentaires : ils citent des messages pour les
   expliquer, et un commentaire n'est pas montré au visiteur. */
const sansCommentaires = src
  .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
  .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))

const messagesReels = [...sansCommentaires.matchAll(/refus\(\s*'[^']+'\s*,\s*\n?\s*'((?:[^'\\]|\\.)*)'/g)]
  .map(m => m[1].replace(/\\'/g, "'"))
dire(messagesReels.length >= 10, `${messagesReels.length} messages de refus trouvés dans le source`,
     'moins de 10 : le motif de lecture ne trouve probablement plus les appels')

const traduisibles = new Set(messagesTraduisibles())
for (const m of messagesReels) {
  const court = m.length > 58 ? m.slice(0, 55) + '…' : m
  dire(traduisibles.has(m), `traduit : « ${court} »`,
       'absent de langue.ts — l’anglophone verrait ce message en français')
}

// ── 2. Les traductions sont-elles vraiment traduites ? ──────────────────
console.log(`\n${B}2. la colonne anglaise dit-elle autre chose que la française ?${Z}`)
const fr = textes('fr'), en = textes('en')
const cles = Object.keys(fr) as (keyof typeof fr)[]
const identiques = cles.filter(k => fr[k] === en[k])
/* Quelques textes s'écrivent légitimement de la même façon dans les deux
   langues : une adresse d'exemple, et trois mots qui ne changent pas
   (« Date », « Distance », « Total »). On les DÉCLARE un par un plutôt que
   d'assouplir le contrôle : ainsi, le jour où une vraie phrase reste en
   français, elle apparaît toujours. */
const IDENTIQUES_ASSUMES = new Set([
  'adresse_depart_exemple', 'date', 'distance', 'total',
  /* « Terminal » et « 2E, T1… » s'écrivent pareil dans les deux langues. */
  'terminal', 'terminal_exemple',
])
const oublis = identiques.filter(k => !IDENTIQUES_ASSUMES.has(k as string))
dire(oublis.length === 0, 'aucune entrée laissée en français dans la colonne anglaise',
     oublis.join(', '))

/* Un reste de français en anglais : accent, ou mot-outil français. Le piège
   est que « Île-de-France », « Français » et « ✈ » sont légitimes. */
const MOTS_FR = /\b(votre|vos|nous|vous|merci|adresse|départ|arrivée|heure|veuillez|du|des|une)\b/i
const suspects = cles.filter(k => MOTS_FR.test(en[k]) && k !== 'autre_langue')
dire(suspects.length === 0, 'aucun mot français resté dans un texte anglais', suspects.join(', '))

// ── 3. Le passage par la vraie fonction de validation ───────────────────
console.log(`\n${B}3. de bout en bout, par les vraies fonctions${Z}`)
const demain = new Date(Date.now() + 86_400_000)
const base = {
  adresse_depart: '', adresse_arrivee: 'CDG', date_prevue: demain.toISOString().slice(0, 16),
  nom: 'Smith', prenom: 'John', email: 'john@example.com', telephone: '+33 6 12 34 56 78',
} as Parameters<typeof verifierTrajet>[0]

const sansDepart = verifierTrajet(base)
dire(!sansDepart.ok, 'un départ vide est bien refusé')
if (!sansDepart.ok) {
  const anglais = messageDansLaLangue(sansDepart.erreur, 'en')
  dire(anglais !== sansDepart.erreur, 'et le refus ressort en anglais', `rendu : « ${anglais} »`)
  dire(!/[éèêà]/.test(anglais), 'sans accent français dedans', anglais)
}

const mauvaisTel = verifierReservation({ ...base, adresse_depart: 'Chantilly', telephone: '2142932755' })
dire(!mauvaisTel.ok, 'un téléphone sans indicatif est bien refusé')
if (!mauvaisTel.ok) {
  const anglais = messageDansLaLangue(mauvaisTel.erreur, 'en')
  dire(anglais.includes('country code'), 'et son message anglais parle bien de l’indicatif',
       anglais.slice(0, 70))
}

// ── 2 bis. Reste-t-il du français EN DUR dans le tunnel ? ───────────────
/* Un contrôle STATIQUE, et c'est tout l'intérêt : le navigateur ne montre
   que les branches qu'il déclenche. « Voie / Quai » n'apparaît que pour une
   gare, « aller-retour » que si l'option est cochée, et un essai qui va de
   Senlis à CDG ne les verra jamais. Trois textes français ont survécu ainsi
   à deux passages de mesure au navigateur ; celui-ci les voit tous. */
console.log(`\n${B}2 bis. du français laissé en dur dans le tunnel ?${Z}`)
const FICHIERS_TUNNEL = [
  'src/app/reserver/ReserverClient.tsx',
  'src/app/reserver/ReservationSummary.tsx',
  'src/app/reserver/TarifsReference.tsx',
]
/* Un littéral est suspect s'il contient un accent français ou un mot-outil.
   On neutralise d'abord les commentaires : ils sont écrits en français par
   choix et ne sont montrés à personne. */
const ACCENT_FR = /[éèêëàâçùûôîï]/
const OUTIL_FR = /\b(le|la|les|un|une|des|du|de|votre|vos|nous|vous|et|ou|pour|avec|sans|sur|dans|par|au|aux|ce|cette|qui|que|plus|tout|si|en)\b/i
let enDurTunnel = 0
for (const f of FICHIERS_TUNNEL) {
  const net = lireFichier(f)
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, m => m.replace(/[^\n]/g, ' '))
    /* Les `value="…"` d'un <option> sont des DONNÉES, pas de l'affichage :
       c'est la chaîne qui part en base pour la statistique d'origine
       (« Bouche-à-oreille »). Les traduire scinderait ces statistiques en
       deux vocabulaires selon la langue du visiteur. Elles restent donc
       françaises par décision, et le contrôle les ignore — mais seulement
       elles : le texte AFFICHÉ de la même option est bien vérifié. */
    .replace(/value="[^"]*"/g, m => m.replace(/[^\n]/g, ' '))
  const suspects: string[] = []
  for (const m of net.matchAll(/'((?:[^'\\\n]|\\.){4,160})'|"((?:[^"\\\n]|\\.){4,160})"/g)) {
    const t = (m[1] ?? m[2]).trim()
    /* Ni un chemin, ni une propriété CSS, ni une clé technique. */
    if (/^[a-z-]+(\/[a-z0-9-]+)+$/i.test(t) || /^(var\(|rgba?\(|#[0-9a-f]{3,8}|\d)/i.test(t)) continue
    if (/^[a-z_]+$/.test(t)) continue
    /* Une locale (« en-GB ») contient « en » et tombait dans le filet. */
    if (/^[a-z]{2}-[A-Z]{2}$/.test(t)) continue
    if (!ACCENT_FR.test(t) && !OUTIL_FR.test(t)) continue
    suspects.push(t.length > 54 ? t.slice(0, 51) + '…' : t)
  }
  dire(suspects.length === 0, `${f.split('/').pop()} n'a plus de texte français en dur`,
       suspects.slice(0, 4).join(' · '))
  enDurTunnel += suspects.length
}

// ── 2 ter. La FAQ a-t-elle ses deux colonnes ? ──────────────────────────
/* Le bloc « parcours et questions » porte ses deux langues dans UNE liste.
   C'est ce qui alimente la fiche FAQPage — et donc le seul canal qui
   convertisse aujourd'hui. Une question ajoutée en français sans sa version
   anglaise donnerait à un assistant une réponse française sur une page
   anglaise : pire que pas de réponse. */
console.log(`
${B}2 ter. le parcours et la FAQ, dans les deux langues${Z}`)
const { QUESTIONS } = await import('../src/app/reserver/ParcoursEtQuestions')
const { ANNULATION_PHRASE, ANNULATION_PHRASE_EN } = await import('../src/lib/conditions')

dire(QUESTIONS.length >= 5, `${QUESTIONS.length} questions déclarées`)
const sansEn = QUESTIONS.filter(q => !q.qEn?.trim() || !q.rEn?.trim())
dire(sansEn.length === 0, 'chaque question a sa version anglaise',
     sansEn.map(q => q.q.slice(0, 40)).join(' · '))
const pareilles = QUESTIONS.filter(q => q.q === q.qEn || q.r === q.rEn)
dire(pareilles.length === 0, 'aucune question laissée en français côté anglais',
     pareilles.map(q => q.q.slice(0, 40)).join(' · '))
const accentuees = QUESTIONS.filter(q => /[éèêàçù]/i.test(q.qEn + ' ' + q.rEn))
dire(accentuees.length === 0, 'aucun accent français dans les textes anglais',
     accentuees.map(q => q.qEn.slice(0, 40)).join(' · '))

/* La réponse sur l'annulation doit VENIR de conditions.ts, pas être retapée :
   sinon le délai passerait à 48 h en français et resterait à 24 h en
   anglais, sans que rien ne le signale. */
const annulation = QUESTIONS.find(q => /annuler|cancel/i.test(q.q + q.qEn))
dire(Boolean(annulation), 'la question sur l’annulation existe')
if (annulation) {
  dire(annulation.r === ANNULATION_PHRASE, 'sa réponse française vient de conditions.ts')
  dire(annulation.rEn === ANNULATION_PHRASE_EN, 'sa réponse anglaise vient de conditions.ts aussi')
  dire(/24 hours/.test(ANNULATION_PHRASE_EN) && /24 heures/.test(ANNULATION_PHRASE),
       'les deux versions annoncent le MÊME délai de 24 h',
       `fr: ${ANNULATION_PHRASE.slice(0, 48)} / en: ${ANNULATION_PHRASE_EN.slice(0, 48)}`)
}

// ── 3 bis. La langue survit-elle jusqu'à l'e-mail ? ─────────────────────
/* Quatre fichiers séparent le formulaire de l'e-mail de confirmation :
   le formulaire, l'action qui crée la session Stripe, le webhook qui la
   relit, et le module d'e-mail. Si UN seul maillon manque, le client
   anglophone reçoit une confirmation française — sans erreur, sans log.
   On vérifie donc les quatre maillons dans le source. */
console.log(`\n${B}3 bis. la langue va-t-elle du formulaire jusqu'à l'e-mail ?${Z}`)


const maillons: [string, string, RegExp][] = [
  ['le formulaire annonce sa langue',    'src/app/reserver/ReserverClient.tsx', /createReservationCheckout\(\{\s*\r?\n\s*langue,/],
  ['l’action la met dans Stripe',        'src/app/reserver/actions.ts',         /metadata\[langue\]/],
  ['le webhook la relit',                'src/app/api/stripe/webhook/route.ts', /langue:\s*meta\.langue === 'en'/],
  ['l’e-mail client l’accepte',          'src/lib/email.ts',                    /langue\?:\s*Langue/],
]
for (const [quoi, fichier, motif] of maillons) {
  dire(motif.test(lireFichier(fichier)), quoi, `introuvable dans ${fichier}`)
}

/* Et plus aucun libellé français en dur dans cette fonction d'e-mail : un
   seul oublié et la confirmation anglaise affiche « Référence » au milieu. */
const mail = lireFichier('src/lib/email.ts')
const fonctionMail = mail.slice(
  mail.indexOf('export async function envoyerConfirmationClient'),
  mail.indexOf('export async function envoyerLienPaiement'),
)
const enDur = ['Référence', 'Véhicule', 'Passagers', 'Départ', 'Arrivée', 'Tarif estimé', 'Trajet aller', 'Trajet retour']
  .filter(m => fonctionMail.includes(`'${m}'`))
dire(enDur.length === 0, 'aucun libellé français en dur dans la confirmation client', enDur.join(', '))

// ── 4. Le français n'a pas bougé ────────────────────────────────────────
console.log(`\n${B}4. le français est intact${Z}`)
for (const m of messagesReels.slice(0, 4)) {
  dire(messageDansLaLangue(m, 'fr') === m, `« ${m.slice(0, 44)}… » inchangé en français`)
}
dire(textes('fr').titre === 'Réservez votre course', 'le titre français est bien celui d’avant')

// ── Verdict ─────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z} ${G}— ${messagesReels.length} messages de validation couverts${Z}\n`)
