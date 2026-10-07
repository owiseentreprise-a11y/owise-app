/**
 * Une reservation incomplete peut-elle encore etre payee ?
 *
 * Jusqu'au 2026-10-08, le serveur ne verifiait que le prix. Le formulaire
 * demandait le nom, le prenom et un e-mail « contenant un @ », et le
 * telephone etait explicitement marque « optionnel ». Resultat, sur les deux
 * seules reservations en ligne encaissees — deux accueils a l'aeroport :
 *
 *   Ian Galligan    « 016233005065 »   12 chiffres, incomposable
 *   Robert Sillers  « 2142932755 »     10 chiffres, sans indicatif
 *
 * Si le chauffeur ne trouve pas son client a CDG, il n'a aucun moyen de
 * l'appeler.
 *
 * Les cas de telephone ci-dessous sont ceux-la, en vrai, plus les formes
 * francaises usuelles. Le cas « 2142932755 » doit etre REFUSE : on ne devine
 * pas un indicatif pays. Enregistrer +1 par presomption, c'est stocker un
 * numero faux avec l'air d'etre juste.
 *
 * Lance sous deux fuseaux, parce qu'une date se compare a « maintenant » et
 * que le serveur Vercel tourne en temps universel :
 *   npx tsx scripts/test-validation-reservation.mts
 */
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { normaliserTelephone, verifierReservation } from '../src/lib/validationReservation'

const ok: string[] = []
const ko: string[] = []
const dire = (bon: boolean, texte: string) => (bon ? ok : ko).push(texte)

/* ── 1. Le telephone ───────────────────────────────────────────────────────── */
const TELEPHONES: [string, string | null, string][] = [
  ['+33612345678',    '+33612345678', 'deja international'],
  ['+33 6 12 34 56 78', '+33612345678', 'international avec espaces'],
  ['0033612345678',   '+33612345678', 'prefixe 00'],
  ['06 12 34 56 78',  '+33612345678', 'francais avec espaces'],
  ['0612345678',      '+33612345678', 'francais colle'],
  ['01.42.68.53.00',  '+33142685300', 'fixe parisien avec points'],
  ['016233005065',    '+16233005065', 'cas reel Galligan : 0 devant un numero americain'],
  ['+1 623 300 5065', '+16233005065', 'americain en forme internationale'],
  ['2142932755',      null,           'cas reel Sillers : 10 chiffres sans indicatif, AMBIGU'],
  ['',                null,           'vide'],
  ['   ',             null,           'espaces'],
  ['pas un numero',   null,           'texte'],
  ['06123',           null,           'trop court'],
]
for (const [saisie, attendu, pourquoi] of TELEPHONES) {
  const obtenu = normaliserTelephone(saisie)
  dire(obtenu === attendu,
    `« ${saisie || '(vide)'} » -> ${obtenu ?? 'refuse'} (attendu ${attendu ?? 'refuse'}) — ${pourquoi}`)
}

/* ── 2. Les champs obligatoires ────────────────────────────────────────────── */
const COMPLET = {
  nom: 'Galligan', prenom: 'Ian', email: 'iangalligan@gmail.com',
  telephone: '+1 623 300 5065', date_prevue: '2030-01-01T13:00',
  adresse_depart: 'Aéroport Paris-Charles de Gaulle (CDG)',
  adresse_arrivee: 'Le Château, All. des Marronniers, 60520 La Chapelle-en-Serval',
}
dire(verifierReservation(COMPLET).ok, 'une reservation complete est acceptee')

const MANQUES: [string, Record<string, unknown>][] = [
  ['nom',             { nom: '' }],
  ['prenom',          { prenom: '' }],
  ['email',           { email: 'ian@gmail' }],
  ['email',           { email: 'pas-une-adresse' }],
  ['telephone',       { telephone: '' }],
  ['telephone',       { telephone: '2142932755' }],
  ['adresse_depart',  { adresse_depart: '  ' }],
  ['adresse_arrivee', { adresse_arrivee: '' }],
  ['date_prevue',     { date_prevue: '' }],
  ['date_prevue',     { date_prevue: '2020-01-01T10:00' }],
]
for (const [champ, remplacement] of MANQUES) {
  const v = verifierReservation({ ...COMPLET, ...remplacement })
  const valeur = JSON.stringify(Object.values(remplacement)[0])
  dire(!v.ok && v.champ === champ, `refuse ${champ} = ${valeur}`)
}

/* ── 3. Une date se juge a Paris, pas sur la machine ───────────────────────── */
// 2026-10-10 13:00 a Paris = 11:00 UTC. A 11:30 UTC la course est passee ;
// a 10:30 UTC elle est a venir. Le verdict doit etre le meme partout.
const PASSEE = new Date('2026-10-10T11:30:00Z')
const AVENIR = new Date('2026-10-10T10:30:00Z')
const course = { ...COMPLET, date_prevue: '2026-10-10T13:00' }
dire(!verifierReservation(course, PASSEE).ok, 'une course de 13h00 Paris est passee a 11h30 UTC')
dire(verifierReservation(course, AVENIR).ok, 'la meme est encore a venir a 10h30 UTC')

/* ── 4. Le serveur verifie-t-il AVANT de creer le paiement ? ───────────────── */
const actions = readFileSync(new URL('../src/app/reserver/actions.ts', import.meta.url), 'utf8')
const posVerif = actions.indexOf('verifierReservation(')
const posStripe = actions.indexOf('checkout/sessions')
dire(posVerif > 0 && posStripe > 0 && posVerif < posStripe,
  'actions.ts appelle verifierReservation AVANT de creer la session Stripe')

const formulaire = readFileSync(new URL('../src/app/reserver/ReserverClient.tsx', import.meta.url), 'utf8')
dire(formulaire.includes('verifierReservation('), 'le formulaire utilise la meme verification')
dire(!formulaire.includes("Téléphone (optionnel)"), 'le telephone n est plus annonce comme optionnel')

/* ── Verdict ───────────────────────────────────────────────────────────────── */
const fuseau = process.env.TZ ?? '(celui de la machine)'
console.log(`\nfuseau : ${fuseau}`)
for (const t of ok) console.log(`   OK    ${t}`)
for (const t of ko) console.log(`   ECHEC ${t}`)
console.log(ko.length === 0
  ? `\n${ok.length} controles au vert\n`
  : `\n${ko.length} echec(s) sur ${ok.length + ko.length}\n`)

/* Relance sous l'autre fuseau, une seule fois. */
if (!process.env.OW_DEJA_RELANCE) {
  for (const tz of ['UTC', 'Europe/Paris']) {
    console.log(`${'─'.repeat(70)}\nrelance sous TZ=${tz}`)
    try {
      execFileSync('npx', ['tsx', 'scripts/test-validation-reservation.mts'], {
        stdio: 'inherit', shell: true,
        env: { ...process.env, TZ: tz, OW_DEJA_RELANCE: '1' },
      })
    } catch { process.exitCode = 1 }
  }
}
process.exitCode = ko.length ? 1 : process.exitCode
