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
import { normaliserTelephone, verifierReservation, verifierTrajet } from '../src/lib/validationReservation'

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
  // Depart de CDG : depuis le 2026-10-08 le vol et son heure sont requis.
  // C'est exactement la reservation de M. Galligan, telle qu'elle aurait du
  // etre saisie.
  type_zone_depart: 'aeroport',
  num_vol_train: 'FI542',
  heure_arrivee_vol: '13:00',
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

/* ── 2 bis. Depart d'un aeroport ou d'une gare : vol et heure requis ───── */
// Les deux seules reservations en ligne encaissees etaient deux accueils a CDG,
// sans numero de vol ni heure d'arrivee. Il a fallu les redemander par WhatsApp.
// Le depart est un aeroport, et les deux champs sont VIDES : c'est l'etat
// dans lequel MM. Sillers et Galligan ont pu payer.
const AEROPORT = {
  ...COMPLET,
  adresse_depart: 'Aéroport Paris-Charles de Gaulle (CDG)',
  type_zone_depart: 'aeroport',
  num_vol_train: '',
  heure_arrivee_vol: '',
}

dire(!verifierReservation(AEROPORT).ok,
  'depart d un aeroport sans numero de vol : refuse')
dire(!verifierReservation({ ...AEROPORT, num_vol_train: 'FI542' }).ok,
  'numero de vol mais pas d heure d arrivee : refuse')
dire(verifierReservation({ ...AEROPORT, num_vol_train: 'FI542', heure_arrivee_vol: '13:00' }).ok,
  'numero de vol + heure : accepte')
dire(verifierReservation({ ...AEROPORT, num_vol_train: 'Reykjavik', heure_arrivee_vol: '13:00' }).ok,
  'la provenance vaut le numero de vol')
dire(!verifierReservation({ ...AEROPORT, num_vol_train: 'FI542', heure_arrivee_vol: '25:00' }).ok,
  'une heure impossible est refusee')
dire(verifierReservation({ ...COMPLET, adresse_depart: 'Gare de Lyon, Paris', type_zone_depart: 'gare', num_vol_train: 'TGV 6423', heure_arrivee_vol: '09:12' }).ok,
  'depart d une gare avec train et heure : accepte')

// Le piege a eviter : une adresse de particulier qui contient le mot « gare ».
// Exiger un numero de vol l'empecherait purement et simplement de reserver.
for (const adresse of ['12 rue de la Gare, 60300 Senlis', '3 avenue des Aéronautes, Creil', 'Place de la Bastille, Paris']) {
  dire(verifierReservation({ ...COMPLET, adresse_depart: adresse, type_zone_depart: null, num_vol_train: '', heure_arrivee_vol: '' }).ok,
    `« ${adresse} » n exige pas de numero de vol`)
}

// Mais le libelle d'un aeroport, lui, suffit meme sans type de zone.
dire(!verifierReservation({ ...COMPLET, adresse_depart: 'Aéroport de Beauvais-Tillé', type_zone_depart: null, num_vol_train: '', heure_arrivee_vol: '' }).ok,
  'un libelle d aeroport suffit a rendre le vol obligatoire')

/* ── 3. Une date se juge a Paris, pas sur la machine ───────────────────────── */
// 2026-10-10 13:00 a Paris = 11:00 UTC. A 11:30 UTC la course est passee ;
// a 10:30 UTC elle est a venir. Le verdict doit etre le meme partout.
const PASSEE = new Date('2026-10-10T11:30:00Z')
const AVENIR = new Date('2026-10-10T10:30:00Z')
const course = { ...COMPLET, date_prevue: '2026-10-10T13:00' }
dire(!verifierReservation(course, PASSEE).ok, 'une course de 13h00 Paris est passee a 11h30 UTC')
dire(verifierReservation(course, AVENIR).ok, 'la meme est encore a venir a 10h30 UTC')

const formulaire = readFileSync(new URL('../src/app/reserver/ReserverClient.tsx', import.meta.url), 'utf8')

/* ── 3 bis. La regle du vol s'exprime-t-elle la ou le champ se trouve ? ── */
// Le 2026-10-08, le message « indiquez votre numero de vol » apparaissait a
// l'ecran du PAIEMENT, alors que le champ est a l'ecran precedent. Le client
// etait bloque sans aucun moyen de corriger. Un controle doit s'exprimer la
// ou l'on peut y repondre.
const TRAJET_SEUL = {
  adresse_depart: 'Aéroport Paris-Charles de Gaulle (CDG)',
  adresse_arrivee: '11 Av. du Maréchal Joffre, 60500 Chantilly',
  date_prevue: '2030-01-01T10:00',
  type_zone_depart: 'aeroport',
}
dire(!verifierTrajet(TRAJET_SEUL).ok,
  'verifierTrajet refuse un depart d aeroport sans vol, sans connaitre le client')
dire(verifierTrajet({ ...TRAJET_SEUL, num_vol_train: 'AF1234', heure_arrivee_vol: '10:00' }).ok,
  'verifierTrajet accepte des que le vol est renseigne')

const ecran1 = formulaire.slice(formulaire.indexOf('function handleStep1'), formulaire.indexOf('function handlePayer'))
dire(ecran1.includes('verifierTrajet('),
  'le premier ecran verifie le trajet avant de passer au paiement')
dire(ecran1.includes('num_vol_train'),
  'le premier ecran transmet bien le numero de vol a la verification')

/* ── 4. Le serveur verifie-t-il AVANT de creer le paiement ? ───────────────── */
const actions = readFileSync(new URL('../src/app/reserver/actions.ts', import.meta.url), 'utf8')
const posVerif = actions.indexOf('verifierReservation(')
const posStripe = actions.indexOf('checkout/sessions')
dire(posVerif > 0 && posStripe > 0 && posVerif < posStripe,
  'actions.ts appelle verifierReservation AVANT de creer la session Stripe')

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
