/**
 * Les quatre e-mails du Grand Van partent-ils, et disent-ils la bonne chose ?
 *
 *   npx tsx scripts/test-emails-blocage.mts            → capture SANS envoyer
 *   npx tsx scripts/test-emails-blocage.mts --envoyer  → envoie pour de vrai
 *
 * LE DESTINATAIRE EST TOUJOURS L'EXPLOITANT (`ADMIN_EMAIL`), jamais un
 * client. Les données sont fictives et marquées comme telles.
 *
 * POURQUOI CE CONTRÔLE, ET POURQUOI IL NE POUVAIT PAS SE FAIRE AU BANC
 *
 * Le banc d'essai isolé tourne avec `RESEND_API_KEY` vide : `send()` sort à
 * la première ligne et aucun courrier ne peut partir. Il prouve donc que la
 * chaîne S'EXÉCUTE, jamais que le courrier est juste. C'est le dernier
 * maillon du blocage de carte qui n'avait jamais été exercé.
 *
 * On appelle ici les VRAIES fonctions, sans les modifier et sans ajouter de
 * couture dans le code de production. On intercepte `fetch` : le SDK Resend
 * passe par là, donc on lit exactement le corps qu'il envoie. En mode
 * capture la requête est retenue ; avec `--envoyer` elle part, et on relit
 * le message par l'API Resend — seule preuve qu'il a été accepté ET
 * enregistré, et non seulement posté.
 *
 * CE QU'ON VÉRIFIE, et qui n'est pas évident :
 *   · le client bloqué ne lit JAMAIS « votre course est confirmée » : il
 *     croirait sa course réservée, cesserait de chercher ailleurs, et le
 *     découvrirait trop tard ;
 *   · il lit en toutes lettres que sa carte n'est pas débitée ;
 *   · les montants s'écrivent à la française (« 120,00 € ») — la règle du
 *     projet interdit `toFixed(2)`, qui rend l'écriture anglaise ;
 *   · l'heure est celle de PARIS, quelle que soit la machine qui envoie ;
 *   · l'e-mail de l'exploitant annonce « À VALIDER » et le délai de 7 jours.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const V = '\x1b[32m', R = '\x1b[31m', J = '\x1b[33m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
const ENVOYER = process.argv.includes('--envoyer')

for (const l of readFileSync(resolve(RACINE, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) {
    const cle = l.slice(0, i).trim()
    if (!process.env[cle]) process.env[cle] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
  }
}

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? ` ${G}— ${d}${Z}` : ''}`) }
}

type Envoi = { to: string | string[]; subject: string; html: string; from: string }
const envois: Envoi[] = []
const reponses: unknown[] = []

const vraiFetch = globalThis.fetch
globalThis.fetch = (async (entree: Parameters<typeof vraiFetch>[0], options?: Parameters<typeof vraiFetch>[1]) => {
  const url = String(typeof entree === 'string' ? entree : (entree as Request).url ?? entree)
  if (url.includes('api.resend.com') && options?.body) {
    try { envois.push(JSON.parse(String(options.body)) as Envoi) } catch { /* corps non JSON */ }
    if (!ENVOYER) {
      return new Response(JSON.stringify({ id: 'capture-sans-envoi' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      })
    }
    const r = await vraiFetch(entree, options)
    try { reponses.push(await r.clone().json()) } catch { /* sans corps */ }
    return r
  }
  return vraiFetch(entree, options)
}) as typeof vraiFetch

const { envoyerDemandeBloquee, envoyerRefusDevis, envoyerConfirmationClient, envoyerNotificationAdmin } =
  await import('../src/lib/email')

const MOI = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'
const REF = 'ESSAI8-' + Math.random().toString(36).slice(2, 7).toUpperCase()
/* 09:00 heure de PARIS. C'est l'enjeu de heure.ts : le serveur Vercel tourne
   en temps universel, et une lecture directe afficherait 07:00 ou 11:00. */
const QUAND = '2027-06-12T09:00'
const commun = {
  clientEmail: MOI,
  clientPrenom: 'Client',
  adresseDepart: '1 Place Henri IV, 60300 Senlis',
  adresseArrivee: 'Aéroport Paris-Charles de Gaulle (CDG)',
  datePrevue: QUAND,
}

console.log(`\n${B}LES QUATRE E-MAILS DU GRAND VAN${Z}`)
console.log(`${G}${ENVOYER ? 'ENVOI RÉEL vers ' + MOI : 'capture seule — rien ne sort'} · référence ${REF}${Z}`)

// ── 1. « Votre carte est retenue, pas débitée » ──────────────────────────
console.log(`\n${B}1. ce que reçoit le client quand sa carte est bloquée${Z}`)
await envoyerDemandeBloquee({
  ...commun, typeVehicule: 'Grand Van 8 places', nbPassagers: 1,
  montantBloque: 120, refCourse: REF,
})
const e1 = envois[0]
dire(Boolean(e1), 'un e-mail est préparé')
if (e1) {
  const t = e1.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  console.log(`     ${G}sujet : ${e1.subject}${Z}`)
  dire(/n'a pas été débitée|n’a pas été débitée/.test(t), 'il lit que sa carte N’A PAS été débitée')
  dire(/vous ne paierez rien/i.test(t), 'et qu’il ne paiera rien si le trajet ne peut pas être assuré')
  dire(/48 h|48 heures/.test(t), 'le délai de réponse est annoncé', t.slice(0, 60))
  dire(!/votre course est confirmée/i.test(t),
       'il ne lit JAMAIS « votre course est confirmée »',
       'il croirait sa course réservée et cesserait de chercher ailleurs')
  dire(/120,00\s?€/.test(t), 'le montant retenu s’écrit « 120,00 € », à la française',
       (t.match(/\d+[.,]\d{2}\s?€/) ?? ['(introuvable)'])[0])
  dire(/\b09:00\b/.test(t), 'l’heure est 09:00, heure de Paris',
       (t.match(/\b\d{2}:\d{2}\b/) ?? ['(introuvable)'])[0])
  dire(t.includes(REF), 'la référence de la course est reprise')
  dire(/06 19 10 63 56|\+33 6 19 10 63 56/.test(t), 'un téléphone lui est donné pour joindre quelqu’un')
}

// ── 2. Ce que reçoit l'exploitant ────────────────────────────────────────
console.log(`\n${B}2. ce que vous recevez, vous${Z}`)
await envoyerNotificationAdmin({
  adresseDepart: commun.adresseDepart, adresseArrivee: commun.adresseArrivee,
  datePrevue: QUAND, clientNom: 'Client Fictif', typeVehicule: 'Grand Van 8 places',
  refCourse: REF, aValider: true,
})
const e2 = envois[1]
dire(Boolean(e2), 'un e-mail vous est préparé')
if (e2) {
  const t = e2.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  console.log(`     ${G}sujet : ${e2.subject}${Z}`)
  dire(/A VALIDER|À VALIDER/i.test(e2.subject), 'le sujet annonce « À VALIDER »', e2.subject)
  dire(/7 j|7 jours/.test(e2.subject + t), 'le délai de 7 jours est rappelé')
  dire(/bloquée, pas débitée|bloquee, pas debitee/i.test(t), 'il rappelle que la carte est bloquée et non débitée')
  dire(/réservation est perdue|reservation est perdue/i.test(t),
       'il avertit que sans décision la réservation est perdue',
       'sans cet avertissement, une retenue oubliée tombe en silence')
}

// ── 3. La confirmation, après validation ─────────────────────────────────
console.log(`\n${B}3. ce que reçoit le client quand vous validez${Z}`)
await envoyerConfirmationClient({
  ...commun, typeVehicule: 'Grand Van 8 places', nbPassagers: 1,
  prixEstime: 120, refCourse: REF,
})
const e3 = envois[2]
dire(Boolean(e3), 'un e-mail de confirmation est préparé')
if (e3) {
  const t = e3.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  console.log(`     ${G}sujet : ${e3.subject}${Z}`)
  dire(/confirmée|confirmee/i.test(t), 'il lit enfin que sa course est confirmée')
  dire(/120,00\s?€/.test(t), 'avec le même montant, à la française')
  dire(/\b09:00\b/.test(t), 'et la même heure de Paris')
}

// ── 4. Le refus ──────────────────────────────────────────────────────────
console.log(`\n${B}4. ce que reçoit le client quand vous refusez${Z}`)
await envoyerRefusDevis({
  ...commun, motif: 'aucun véhicule 8 places disponible à cette date',
})
const e4 = envois[3]
dire(Boolean(e4), 'un e-mail de refus est préparé')
if (e4) {
  const t = e4.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  console.log(`     ${G}sujet : ${e4.subject}${Z}`)
  dire(/pas en mesure d'assurer|pas en mesure d’assurer/.test(t), 'il lit qu’on ne peut pas assurer ce trajet')
  dire(t.includes('aucun véhicule 8 places disponible'), 'votre motif est repris mot pour mot')
  /* Les deux écritures sont valables : « 06 19… » pour un lecteur
     français, « +33 6 19… » en international. La première version de ce
     contrôle n'acceptait que la première et criait au loup sur un
     e-mail qui portait bien un téléphone. */
  dire(/0?6 19 10 63 56/.test(t), 'un téléphone lui reste donné — un refus laisse une porte ouverte',
       (t.match(/\+?\d[\d ]{8,}/) ?? ['(aucun)'])[0])
  dire(!/confirmée|confirmee/i.test(t), 'rien n’y évoque une confirmation')
}

// ── 5. Le destinataire, et la preuve d'envoi ─────────────────────────────
console.log(`\n${B}5. où cela part${Z}`)
dire(envois.length === 4, `les quatre e-mails ont été préparés`, `${envois.length}`)
dire(envois.every(e => String(e.to).includes(MOI)),
     'tous partent à VOTRE adresse, aucun à un client',
     envois.map(e => String(e.to)).join(' · '))
dire(envois.every(e => /noreply@owise\.fr/.test(e.from)), 'expédiés depuis noreply@owise.fr')

if (ENVOYER) {
  const ids = reponses.map(r => (r as { id?: string })?.id).filter(Boolean) as string[]
  dire(ids.length === envois.length, `Resend a accepté les ${envois.length} e-mails`,
       JSON.stringify(reponses).slice(0, 200))
  for (const id of ids) {
    const r = await vraiFetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    const d = await r.json() as { subject?: string; last_event?: string; to?: string[] }
    dire(r.ok, `relu chez Resend : ${(d.subject ?? '(sans sujet)').slice(0, 54)}`,
         `HTTP ${r.status}`)
    if (r.ok) console.log(`     ${G}état : ${d.last_event ?? 'inconnu'} · vers ${(d.to ?? []).join(', ')}${Z}`)
  }
} else {
  console.log(`  ${J}rien n'a été envoyé${Z} ${G}— relancer avec --envoyer pour les recevoir${Z}`)
}

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}\n`)
