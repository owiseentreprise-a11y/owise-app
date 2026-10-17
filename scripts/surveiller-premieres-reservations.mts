/**
 * Surveillance des premières réservations réelles après le déploiement du
 * Sprint 2 (17 octobre 2026, 22:46 Paris, commit 7e439e5).
 *
 * À lancer après chaque réservation réelle, ou une fois par jour pendant les
 * premiers jours. Il dit en une page si la chaîne a fonctionné de bout en
 * bout, et ce qu'il faut regarder sinon.
 *
 * LECTURE SEULE, et c'est le point : aucun paiement n'est créé, aucune donnée
 * n'est modifiée. Le premier vrai test en écriture est la réservation d'un
 * client, pas un paiement fabriqué.
 *
 * Usage, depuis owise-app : npx tsx scripts/surveiller-premieres-reservations.mts
 * Sortie : 0 = conforme · 1 = quelque chose à regarder
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/* L'état relevé juste AVANT le déploiement. Toute différence vient soit d'une
   activité réelle, soit d'un problème — et ce contrôle sait distinguer. */
const AVANT = { courses: 30, factures: 9, sommeTtc: 2041.00, stripeEvents: 0, incidents: 0 }
const DEPLOIEMENT = '2026-10-17T20:46:29Z'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const K = env.SUPABASE_SERVICE_ROLE_KEY
const h = { apikey: K, Authorization: `Bearer ${K}` }

const aRegarder: string[] = []
const ok  = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const ko  = (m: string) => { aRegarder.push(m); console.log(`  \x1b[31m✗\x1b[0m ${m}`) }
const att = (m: string) => { aRegarder.push(m); console.log(`  \x1b[33m⚠\x1b[0m ${m}`) }
const info = (m: string) => console.log(`     ${m}`)
const section = (m: string) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)
const ref = (id: unknown) => String(id ?? '').slice(-6).toUpperCase()
const heure = (s: unknown) => s ? new Date(String(s)).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }) : '—'

async function get<T = any>(p: string, essai = 0): Promise<T> {
  try {
    const r = await fetch(`${U}/rest/v1/${p}`, { headers: h })
    if (!r.ok) throw new Error(`${p} → HTTP ${r.status}`)
    return r.json() as Promise<T>
  } catch (e) {
    if (essai >= 3) throw e
    await new Promise(r => setTimeout(r, 1500 * (essai + 1)))
    return get<T>(p, essai + 1)
  }
}

console.log('\x1b[1mSurveillance des premières réservations — Sprint 2\x1b[0m')
console.log(`${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · lecture seule`)
console.log(`déploiement de référence : ${heure(DEPLOIEMENT)} Paris · commit 7e439e5\n`)

// ── Les événements Stripe reçus depuis le déploiement ──────────────────────
section('Événements Stripe reçus depuis le déploiement')
type Ev = { id: string; type: string; statut: string; tentatives: number; recu_le: string; traite_le: string | null; erreur: string | null; course_id: string | null; facture_id: string | null }
const events = await get<Ev[]>(`stripe_events?select=id,type,statut,tentatives,recu_le,traite_le,erreur,course_id,facture_id&order=recu_le.desc&limit=50`)

if (events.length === 0) {
  info('aucun événement encore reçu — normal tant qu\'aucune réservation n\'a eu lieu')
  info('le webhook ne journalise qu\'un événement SIGNÉ : une sonde à fausse signature est')
  info('refusée en 400 avant le journal, elle ne laisse donc aucune ligne ici.')
} else {
  info(`${events.length} événement(s)`)
  for (const e of events) {
    const marque = e.statut === 'traite' ? '\x1b[32m✓\x1b[0m' : e.statut === 'ignore' ? '·' : '\x1b[31m✗\x1b[0m'
    console.log(`   ${marque} ${e.id.slice(0, 22).padEnd(22)} ${e.type.padEnd(32)} ${e.statut.padEnd(7)} ${e.tentatives} tentative(s)  ${heure(e.recu_le)}`)
    if (e.erreur) console.log(`        erreur : ${e.erreur.slice(0, 160)}`)
  }
  const bloques = events.filter(e => e.statut === 'recu' || e.statut === 'echec')
  if (bloques.length === 0) ok('aucun événement bloqué : tous traités ou ignorés')
  else att(`${bloques.length} événement(s) en « ${[...new Set(bloques.map(e => e.statut))].join('/')} » — à rejouer ou à comprendre : ${bloques.map(e => e.id.slice(0, 18)).join(', ')}`)

  const plusieursTentatives = events.filter(e => e.tentatives > 1)
  if (plusieursTentatives.length) att(`${plusieursTentatives.length} événement(s) ont demandé plusieurs tentatives — Stripe a réessayé, regarder pourquoi`)
  else if (events.length) ok('tous les événements ont abouti à la première tentative')
}

// ── Incidents ouverts ──────────────────────────────────────────────────────
section('Incidents de paiement ouverts')
const incidents = await get<{ type: string; gravite: string; reference: string | null; created_at: string; detail: unknown }[]>(
  'incidents_paiement?select=type,gravite,reference,created_at,detail&resolu_le=is.null&order=created_at.desc')
if (incidents.length === 0) ok('aucun incident ouvert')
else {
  for (const i of incidents) {
    const f = i.gravite === 'critique' ? ko : att
    f(`${i.gravite.toUpperCase()} · ${i.type} · réf ${String(i.reference ?? '—').slice(0, 24)} · ${heure(i.created_at)}`)
    info(`    ${JSON.stringify(i.detail).slice(0, 220)}`)
  }
  console.log('\n     Ce qu\'il faut faire, selon le type :')
  info('    paiement_sans_course       → recréer la course depuis les métadonnées de l\'incident')
  info('    facture_manquante          → créer la facture à la main depuis /admin/facturation/nouvelle')
  info('    metadonnees_inconnues      → paiement reçu hors de l\'application : identifier le client')
  info('    lien_paye_deux_fois        → décider d\'un remboursement, ne rien écraser')
  info('    doublon_paiement           → NE RIEN supprimer avant de savoir laquelle a été honorée')
  info('    facture_non_marquee_payee  → marquer la facture payée à la main')
}

// ── Les courses encaissées ─────────────────────────────────────────────────
section('Courses portant un paiement Stripe')
type C = { id: string; statut: string; paiement_statut: string | null; mode_paiement: string | null; facture_id: string | null; stripe_payment_intent_id: string; prix_estime: number | null; prix_final: number | null; created_at: string }
const encaissees = await get<C[]>('courses?select=id,statut,paiement_statut,mode_paiement,facture_id,stripe_payment_intent_id,prix_estime,prix_final,created_at&stripe_payment_intent_id=not.is.null&order=created_at.desc')

const nouvelles = encaissees.filter(c => new Date(c.created_at) > new Date(DEPLOIEMENT))
const anciennes = encaissees.filter(c => new Date(c.created_at) <= new Date(DEPLOIEMENT))

info(`${encaissees.length} au total · ${anciennes.length} d'avant le déploiement · ${nouvelles.length} depuis`)

if (nouvelles.length === 0) {
  info('aucune réservation payée depuis le déploiement — rien à vérifier encore')
} else {
  console.log('')
  for (const c of nouvelles) {
    console.log(`   #${ref(c.id)} · ${heure(c.created_at)} · ${c.prix_final ?? c.prix_estime} €`)
    const v = (nom: string, bon: boolean, vu: string) =>
      console.log(`      ${bon ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${nom.padEnd(26)} ${vu}`)
    v('paiement_statut = paye', c.paiement_statut === 'paye', String(c.paiement_statut))
    v('mode_paiement = stripe', c.mode_paiement === 'stripe', String(c.mode_paiement))
    v('facture liée', !!c.facture_id, c.facture_id ? ref(c.facture_id) : 'AUCUNE')
    const ev = events.find(e => e.course_id === c.id)
    v('événement journalisé', !!ev && ev.statut === 'traite', ev ? `${ev.id.slice(0, 18)} (${ev.statut})` : 'AUCUN')
    if (c.paiement_statut !== 'paye') ko(`#${ref(c.id)} : encaissée mais paiement_statut = « ${c.paiement_statut} » — le webhook n'a pas écrit le statut`)
    if (!c.facture_id) ko(`#${ref(c.id)} : encaissée sans facture`)
    if (!ev) att(`#${ref(c.id)} : aucun événement journalisé ne la désigne — journal indisponible au moment du paiement ?`)
  }
}

// ── Les quatre courses historiques ─────────────────────────────────────────
section('Les quatre courses historiques — doivent rester inchangées')
const HISTORIQUES = ['821EE9', '27BCE8', 'D54590', '68FFA3']
for (const r of HISTORIQUES) {
  const c = anciennes.find(x => ref(x.id) === r)
  if (!c) { ko(`#${r} introuvable`); continue }
  if (c.paiement_statut === 'en_attente') ok(`#${r} · paiement_statut = en_attente · inchangée`)
  else ko(`#${r} · paiement_statut = « ${c.paiement_statut} » — MODIFIÉE, alors que la consigne l'interdit`)
}

// ── Intégrité globale ──────────────────────────────────────────────────────
section('Intégrité globale')
const compter = async (t: string) => {
  const r = await fetch(`${U}/rest/v1/${t}?select=id`, { method: 'HEAD', headers: { ...h, Prefer: 'count=exact' } })
  return Number((r.headers.get('content-range') ?? '/0').split('/')[1] ?? 0)
}
const nC = await compter('courses'), nF = await compter('factures')
const factures = await get<{ montant_ttc: number; numero: string }[]>('factures?select=montant_ttc,numero')
const somme = factures.reduce((s, f) => s + Number(f.montant_ttc ?? 0), 0)

const evol = (nom: string, avant: number, apres: number, unite = '') => {
  if (apres === avant) ok(`${nom} : ${apres}${unite} — inchangé`)
  else if (apres > avant) info(`${nom} : ${avant} → ${apres}${unite} (+${(apres - avant).toFixed(2)}) — activité réelle, à rapprocher des réservations ci-dessus`)
  else ko(`${nom} : ${avant} → ${apres}${unite} — DIMINUTION, à comprendre`)
}
evol('courses', AVANT.courses, nC)
evol('factures', AVANT.factures, nF)
evol('somme des montants TTC', AVANT.sommeTtc, Math.round(somme * 100) / 100, ' €')

const numeros = new Set(factures.map(f => f.numero))
if (numeros.size === factures.length) ok('aucun numéro de facture en double')
else ko(`${factures.length - numeros.size} numéro(s) de facture en double`)

const parPI = new Map<string, string[]>()
for (const c of encaissees) parPI.set(c.stripe_payment_intent_id, [...(parPI.get(c.stripe_payment_intent_id) ?? []), c.id])
const doublons = [...parPI.entries()].filter(([, v]) => v.length > 1)
if (doublons.length === 0) ok(`aucun doublon d'identifiant de paiement (${parPI.size} paiement(s) distinct(s))`)
else for (const [pi, ids] of doublons) ko(`DOUBLON : ${pi.slice(0, 20)} porté par ${ids.map(ref).join(', ')} — ne rien supprimer sans vérifier laquelle a été honorée`)

// ── Verdict ────────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(72))
if (aRegarder.length === 0) {
  console.log('\x1b[32m\x1b[1mCONFORME\x1b[0m — rien à signaler')
  if (nouvelles.length === 0) console.log('\x1b[90m(aucune réservation payée depuis le déploiement : le premier vrai test reste à venir)\x1b[0m')
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1m${aRegarder.length} POINT(S) À REGARDER\x1b[0m`)
  for (const p of aRegarder) console.log(`  · ${p}`)
  console.log('\n\x1b[90mRollback si nécessaire : audit-owise/23-SPRINT2-DECISION-DEPLOIEMENT.md, section 6.')
  console.log('Le code seulement. Ne supprimer NI stripe_events, NI incidents_paiement.\x1b[0m')
  process.exit(1)
}
