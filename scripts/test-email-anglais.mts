/**
 * L'e-mail de confirmation en anglais part-il, et dit-il la bonne chose ?
 *
 *   npx tsx scripts/test-email-anglais.mts            → capture SANS envoyer
 *   npx tsx scripts/test-email-anglais.mts --envoyer  → envoie pour de vrai
 *
 * CE QUE CE CONTRÔLE FAIT, ET POURQUOI AINSI
 *
 * Le banc d'essai isolé (`scripts/test-e2e-webhook.mjs`) ne peut PAS prouver
 * ce point : il tourne avec `RESEND_API_KEY` vide, et `send()` sort alors
 * immédiatement. Il prouve que la chaîne s'exécute, jamais que le courrier
 * est juste.
 *
 * On appelle donc la VRAIE fonction `envoyerConfirmationClient`, sans la
 * modifier et sans ajouter de couture dans le code de production. On
 * intercepte `fetch` : le SDK Resend passe par là, donc on lit exactement le
 * corps qu'il envoie — sujet et HTML compris. En mode capture, la requête
 * est interrompue avant de sortir ; avec `--envoyer`, on la laisse partir et
 * on relit ensuite le message par l'API Resend.
 *
 * LE DESTINATAIRE est l'adresse de l'exploitant (`ADMIN_EMAIL`), jamais un
 * client. Les données sont marquées comme un essai.
 *
 * CE QU'ON VÉRIFIE, et qui n'est pas évident :
 *   · le sujet est en anglais ;
 *   · aucun libellé français ne subsiste dans le corps ;
 *   · la DATE est écrite à l'anglaise (« Thursday 18 March 2027 ») alors que
 *     l'heure reste l'heure de PARIS — c'est tout l'enjeu de `heure.ts` ;
 *   · le MONTANT garde l'écriture française (« 59,00 € ») : décision
 *     assumée, pour ne pas créer une deuxième écriture de `formaterMontant`.
 *     Si ce contrôle tombe un jour, c'est que quelqu'un a ajouté un second
 *     format — pas que l'anglais est mal fait.
 *   · la version française, elle, n'a pas bougé.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const V = '\x1b[32m', R = '\x1b[31m', J = '\x1b[33m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
const ENVOYER = process.argv.includes('--envoyer')

/* Les variables de `.env.local`, chargées avant l'import du module d'e-mail :
   `email.ts` lit `RESEND_API_KEY` au chargement, pas à l'appel. */
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

/* Interception de `fetch`. On ne touche pas au code de production : le SDK
   Resend passe par `fetch`, donc son corps de requête EST l'e-mail. */
const vraiFetch = globalThis.fetch
globalThis.fetch = (async (entree: Parameters<typeof vraiFetch>[0], options?: Parameters<typeof vraiFetch>[1]) => {
  const url = String(typeof entree === 'string' ? entree : (entree as Request).url ?? entree)
  if (url.includes('api.resend.com') && options?.body) {
    try { envois.push(JSON.parse(String(options.body)) as Envoi) } catch { /* corps non JSON */ }
    if (!ENVOYER) {
      /* Mode capture : rien ne sort. On rend une réponse plausible pour que
         le SDK ne lève pas, et surtout pour qu'on ne puisse pas croire qu'un
         e-mail est parti alors qu'il a été retenu ici. */
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

const { envoyerConfirmationClient } = await import('../src/lib/email')

/* Une réservation d'essai, marquée comme telle. Le trajet et le prix sont
   ceux d'un forfait réel (Senlis → CDG, 59 €) pour que le montant affiché
   soit vérifiable. L'heure est 09:30 heure de PARIS. */
const QUAND = '2027-03-18T09:30'
const REF = 'ESSAI-EN-' + Math.random().toString(36).slice(2, 7).toUpperCase()
const commun = {
  clientEmail: process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com',
  clientPrenom: 'John',
  adresseDepart: '1 Place Henri IV, 60300 Senlis',
  adresseArrivee: 'Aéroport Paris-Charles de Gaulle (CDG), Terminal 2E',
  datePrevue: QUAND,
  typeVehicule: 'Berline',
  nbPassagers: 2,
  prixEstime: 59,
}

console.log(`\n${B}L'E-MAIL DE CONFIRMATION EN ANGLAIS${Z}`)
console.log(`${G}${ENVOYER ? 'mode ENVOI RÉEL vers ' + commun.clientEmail : 'capture seule — rien ne sort'}${Z}`)
console.log(`${G}référence d'essai : ${REF}${Z}\n`)

// ── 1. La version anglaise ───────────────────────────────────────────────
console.log(`${B}1. ce qui part en anglais${Z}`)
await envoyerConfirmationClient({ ...commun, refCourse: REF, langue: 'en' })
const en = envois[0]
dire(Boolean(en), 'un e-mail a bien été préparé')

if (en) {
  console.log(`     ${G}sujet : ${en.subject}${Z}`)
  dire(/Booking confirmed/i.test(en.subject), 'le sujet est en anglais', en.subject)
  dire(!/Confirmation de course|Confirmation aller-retour/.test(en.subject), 'le sujet n’est plus français', en.subject)

  const txt = en.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  for (const mot of ['Your ride is confirmed', 'Hello John', 'Reference', 'Vehicle', 'Passengers', 'Pick-up', 'Drop-off', 'Estimated fare']) {
    dire(txt.includes(mot), `« ${mot} » présent`)
  }
  const RESTES_FR = ['Votre course est confirmée', 'Référence', 'Véhicule', 'Passagers', 'Départ', 'Arrivée', 'Tarif estimé', 'Bonjour', 'Votre chauffeur vous sera']
  const trouves = RESTES_FR.filter(m => txt.includes(m))
  dire(trouves.length === 0, 'aucun libellé français dans le corps', trouves.join(' · '))

  /* La date à l'anglaise, l'heure à PARIS. 09:30 saisi doit rester 09:30
     affiché, quelle que soit la machine qui envoie. */
  dire(/Thursday,? 18 March 2027/.test(txt), 'la date est écrite à l’anglaise',
       (txt.match(/[A-Z][a-z]+day,? \d+ [A-Z][a-z]+ \d{4}/) ?? ['(introuvable)'])[0])
  dire(/\b09:30\b/.test(txt), 'l’heure reste 09:30, heure de Paris',
       (txt.match(/\b\d{2}:\d{2}\b/) ?? ['(introuvable)'])[0])
  dire(!/mars|jeudi/i.test(txt), 'plus de mois ni de jour en français')

  /* Le montant garde l'écriture FRANÇAISE, volontairement. */
  dire(/59,00\s?€/.test(txt), 'le montant s’écrit « 59,00 € » (écriture unique, décision assumée)',
       (txt.match(/\d+[.,]\d{2}\s?€/) ?? ['(introuvable)'])[0])
  dire(!/€\s?59\.00|\$/.test(txt), 'aucune seconde écriture de montant n’est apparue')
  dire(txt.includes(REF), 'la référence de la course est reprise')
  dire(/Private chauffeur service/.test(txt), 'le pied de page est en anglais',
       (txt.match(/OWISE ·[^·]+·/) ?? ['(introuvable)'])[0])
  dire(!/Service VTC/.test(txt), '« Service VTC », terme réglementaire français, a disparu')
}

// ── 2. La version française n'a pas bougé ────────────────────────────────
console.log(`\n${B}2. le français est intact${Z}`)
await envoyerConfirmationClient({ ...commun, refCourse: REF + '-FR', langue: 'fr' })
const fr = envois[1]
dire(Boolean(fr), 'un e-mail français a été préparé')
if (fr) {
  console.log(`     ${G}sujet : ${fr.subject}${Z}`)
  dire(/Confirmation de course/.test(fr.subject), 'le sujet français est celui d’avant', fr.subject)
  const txtFr = fr.html.replace(/<[^>]+>/g, ' ').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ')
  for (const mot of ['Votre course est confirmée', 'Bonjour John', 'Référence', 'Véhicule', 'Tarif estimé']) {
    dire(txtFr.includes(mot), `« ${mot} » toujours là`)
  }
  dire(/jeudi 18 mars 2027/i.test(txtFr), 'la date française est inchangée',
       (txtFr.match(/[a-zéû]+ \d+ [a-zéû]+ \d{4}/i) ?? ['(introuvable)'])[0])
  dire(/\b09:30\b/.test(txtFr), 'et la même heure de Paris')
  dire(/59,00\s?€/.test(txtFr), 'et le même montant')
  dire(/Service VTC/.test(txtFr), 'le pied de page français est resté français')
}

// ── 3. L'expéditeur, et le fait que ce soit vraiment parti ───────────────
console.log(`\n${B}3. l'expédition${Z}`)
if (en) dire(/noreply@owise\.fr/.test(en.from), 'expédié depuis noreply@owise.fr', en.from)
dire(envois.every(e => String(e.to).includes(commun.clientEmail)),
     'les deux e-mails vont à l’adresse de l’exploitant, jamais à un client',
     envois.map(e => String(e.to)).join(' · '))

if (ENVOYER) {
  const ids = reponses.map(r => (r as { id?: string })?.id).filter(Boolean)
  dire(ids.length === envois.length, `Resend a accepté les ${envois.length} e-mails`, JSON.stringify(reponses).slice(0, 200))
  for (const id of ids) console.log(`     ${G}id Resend : ${id}${Z}`)
  /* On relit le message chez Resend : c'est la seule preuve qu'il a été
     accepté ET enregistré, et non pas seulement posté. */
  for (const id of ids) {
    const r = await vraiFetch(`https://api.resend.com/emails/${id}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
    })
    const d = await r.json() as { subject?: string; last_event?: string; to?: string[] }
    dire(r.ok, `relu chez Resend : ${d.subject ?? '(sans sujet)'}`,
         `HTTP ${r.status} ${JSON.stringify(d).slice(0, 140)}`)
    if (r.ok) console.log(`     ${G}état : ${d.last_event ?? 'inconnu'} · vers ${(d.to ?? []).join(', ')}${Z}`)
  }
} else {
  console.log(`  ${J}rien n'a été envoyé${Z} ${G}— relancer avec --envoyer pour recevoir les deux e-mails${Z}`)
}

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}\n`)
