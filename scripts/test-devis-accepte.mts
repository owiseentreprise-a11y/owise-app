/**
 * Accepter un devis prévient-il vraiment le client ?
 *
 *   npx tsx scripts/test-devis-accepte.mts
 *
 * N'ÉCRIT RIEN : ni en base, ni par e-mail. Ce contrôle lit la SOURCE.
 *
 * POURQUOI LA SOURCE, ET PAS UN NAVIGATEUR
 *
 * Le défaut corrigé le 2026-11-07 était une ABSENCE : `convertirEnCourse`
 * créait la course et n'envoyait aucun e-mail. L'adresse du client était
 * seulement recopiée dans une note interne. L'exploitant cliquait
 * « accepter », la course existait chez lui, et le client n'en savait rien.
 *
 * Une absence ne se voit pas au navigateur : l'écran affichait « Course
 * DEV-XXXXX créée », exactement comme aujourd'hui. Il a fallu lire le code
 * pour s'en apercevoir. C'est la leçon du 2026-11-06, où cinq textes
 * français avaient survécu à deux balayages au navigateur parce qu'ils
 * vivaient dans des branches non déclenchées.
 *
 * Ce contrôle vérifie donc, dans le fichier :
 *   · que la confirmation part bien du module d'e-mail du projet, jamais
 *     d'un message rédigé sur place ;
 *   · qu'elle reçoit l'INSTANT déjà converti, et non la saisie brute — le
 *     défaut qui a fait annoncer 11:30 pour une course de 09:30 ;
 *   · qu'un échec d'envoi n'annule pas la course ;
 *   · que l'exploitant est informé quand le client n'a PAS été prévenu.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? `\n      ${G}${d}${Z}` : ''}`) }
}

const actions = readFileSync(resolve(RACINE, 'src/app/admin/devis/actions.ts'), 'utf8')
const table   = readFileSync(resolve(RACINE, 'src/app/admin/devis/DevisTable.tsx'), 'utf8')

/* On isole la fonction, pour ne pas confondre avec `convertirEnFacture`
   ou `convertirEnDevisClient` qui vivent dans le même fichier. */
const debut = actions.indexOf('export async function convertirEnCourse')
const suite = actions.indexOf('export async function', debut + 10)
const corps = actions.slice(debut, suite > 0 ? suite : undefined)

console.log(`\n${B}ACCEPTER UN DEVIS PRÉVIENT-IL LE CLIENT ?${Z}`)
console.log(`${G}lecture de la source — aucune écriture, aucun e-mail${Z}\n`)

console.log(`${B}1. la confirmation part${Z}`)
dire(debut >= 0, 'la fonction convertirEnCourse existe')
dire(/envoyerConfirmationClient\s*\(/.test(corps),
     'elle appelle envoyerConfirmationClient',
     'aucun appel : la course est créée et le client n’est pas prévenu — c’est le défaut d’origine')
dire(/from '@\/lib\/email'/.test(actions),
     'la confirmation vient du module d’e-mail du projet, pas d’un texte écrit sur place')
dire(!/subject\s*:|<html|Bonjour\s+\$\{/.test(corps),
     'aucun message客 rédigé à la main dans cette fonction'.replace('客', ''),
     'un message écrit ici échapperait aux libellés, au format des montants et à l’heure de Paris')

console.log(`\n${B}2. l'heure envoyée au client${Z}`)
dire(/datePrevue:\s*date_prevue/.test(corps),
     'la confirmation reçoit l’instant déjà converti (date_prevue)',
     'si elle reçoit `devis.date_course` ou `devis.heure`, le client lira une heure fausse de deux heures')
dire(!/datePrevue:\s*`?\$\{?devis\.(date_course|heure)/.test(corps),
     'elle ne reçoit jamais la saisie brute du devis')

console.log(`\n${B}3. un e-mail raté ne doit pas perdre la course${Z}`)
dire(/try\s*\{[\s\S]*envoyerConfirmationClient[\s\S]*\}\s*catch/.test(corps),
     'l’envoi est protégé : un échec n’interrompt pas la création de la course')
const posInsert = corps.indexOf("from('courses').insert")
const posMail   = corps.indexOf('envoyerConfirmationClient')
dire(posInsert >= 0 && posMail > posInsert,
     'la course est enregistrée AVANT l’envoi — on ne promet rien qu’on n’ait écrit',
     `insert à ${posInsert}, envoi à ${posMail}`)

console.log(`\n${B}4. l'exploitant sait si le client a été prévenu${Z}`)
dire(/courrielEnvoye/.test(corps), 'la fonction rend l’information')
dire(/courrielEnvoye/.test(table), 'l’écran des devis s’en sert')
dire(/NON PRÉVENU|non prévenu/i.test(table),
     'l’écran le dit clairement quand le client n’a PAS été prévenu',
     'sans ça, « course créée » laisse croire que c’est fait')

/* ── 5. « Prévenu » doit vouloir dire prévenu ──────────────────────────
   Défaut trouvé le 2026-11-07, le LENDEMAIN de la mise en ligne de la
   section 1 : `send()` avalait toutes les erreurs et ne rendait rien. Le
   `try/catch` de `convertirEnCourse` ne pouvait donc rien attraper, et
   l'écran affichait « client prévenu par e-mail » même quand rien n'était
   parti — y compris quand la clé Resend est absente et que la fonction sort
   à la première ligne. Un faux vert est pire qu'une erreur : l'exploitant
   n'a aucune raison de reprendre contact. */
console.log(`\n${B}5. « prévenu » veut bien dire prévenu${Z}`)
const email = readFileSync(resolve(RACINE, 'src/lib/email.ts'), 'utf8')
dire(/async function send\([^)]*\)\s*:\s*Promise<boolean>/.test(email),
     'send() rend un booléen : l’appelant peut savoir si le message est parti',
     'sans retour, tout échec passe pour un succès')
dire(/if \(r\?\.error\)/.test(email),
     'la réponse de Resend est lue — le SDK ne lève pas, il rend { error }',
     'une adresse refusée passerait pour un envoi réussi')
const confirmation = email.slice(email.indexOf('export async function envoyerConfirmationClient'))
dire(/return await send\(clientEmail/.test(confirmation.slice(0, 12000)),
     'envoyerConfirmationClient rend cette réponse')
dire(/courrielEnvoye = parti/.test(corps),
     'l’écran des devis se fie à la réponse réelle, pas à l’absence d’exception')

/* ── 6. Refuser, c'est le dire ─────────────────────────────────────────
   Jusqu'au 2026-11-07, refuser une demande se faisait avec « supprimer » :
   la ligne disparaissait et le client n'était prévenu de rien. Une demande
   de transfert se prépare des semaines à l'avance — ce silence lui coûtait
   un vrai rendez-vous. */
console.log(`\n${B}6. refuser une demande prévient le client${Z}`)
const refus = actions.slice(actions.indexOf('export async function refuserDevis'),
                            actions.indexOf('export async function supprimerDevis'))
dire(refus.length > 100, 'la fonction refuserDevis existe')
dire(/envoyerRefusDevis\s*\(/.test(refus), 'elle envoie un refus au client')
dire(/instantDepuisSaisieParis/.test(refus),
     'la date du refus est convertie comme celle d’une acceptation',
     'sans conversion, le client lirait une date décalée de deux heures')
dire(/if \(courrielEnvoye \|\| !devis\.email\)/.test(refus),
     'la demande n’est retirée que si le client a pu être prévenu',
     'sinon une demande refusée disparaîtrait sans que personne ne le sache')
dire(/motif/.test(refus) && /envoyerRefusDevis/.test(email),
     'le motif est écrit par l’exploitant, jamais inventé')
dire(/sans prévenir/i.test(table) && /Refuser/.test(table),
     'l’écran distingue « refuser » (prévient) de « supprimer » (ne prévient pas)',
     'deux boutons qui se ressemblent et ne font pas la même chose, c’est un piège')

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}\n`)
