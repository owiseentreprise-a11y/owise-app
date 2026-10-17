/**
 * Contrôles du Sprint 2 — fiabilité des paiements.
 *
 * Les trois scénarios exigés par la mission — renvoi d'un même événement, deux
 * traitements simultanés, panne temporaire de Supabase — sont joués contre un
 * FAUX SERVEUR PostgREST local qui applique les mêmes contraintes que la
 * migration : clé primaire sur `stripe_events.id`, index unique partiel sur
 * `courses.stripe_payment_intent_id`, index unique partiel sur les incidents
 * ouverts. Le code testé est le vrai `src/lib/paiement.ts`, piloté par un vrai
 * client `@supabase/supabase-js` : les codes d'erreur Postgres traversent donc
 * la même chaîne qu'en production.
 *
 * Aucune donnée réelle. Aucune écriture dans la base Owise. Aucun appel à
 * Stripe. Aucun paiement.
 *
 * Usage, depuis owise-app : npx tsx scripts/test-paiement.mts
 */
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import {
  enregistrerEvenement, marquerEvenementTraite, marquerEvenementEchec,
  marquerPaiementConfirme, marquerRemboursement, signalerIncident,
  resoudreIncident, evenementsAReprendre, STATUTS_PAIEMENT, VIOLATION_UNICITE,
} from '../src/lib/paiement.js'

let passes = 0
const echecs: string[] = []
const verifier = (nom: string, condition: boolean, detail = '') => {
  if (condition) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${nom}`) }
  else { echecs.push(nom); console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? ` — ${detail}` : ''}`) }
}
const section = (m: string) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)

/* ── Faux PostgREST ─────────────────────────────────────────────────────────
 * Il n'implémente que ce que `paiement.ts` utilise, mais il applique les
 * contraintes POUR DE VRAI : sans elles, le test validerait du vide. */
type Ligne = Record<string, any>
const tables: Record<string, Ligne[]> = { stripe_events: [], courses: [], incidents_paiement: [] }
let pannes = 0            // nombre de requêtes à faire échouer en 503
let latenceInsertion = 0  // ms d'attente avant d'appliquer une insertion

const erreurUnicite = (contrainte: string) => ({
  code: VIOLATION_UNICITE,
  message: `duplicate key value violates unique constraint "${contrainte}"`,
  details: null, hint: null,
})

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://x')
  const table = url.pathname.replace('/rest/v1/', '')
  const corps = await new Promise<string>(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)) })
  const envoyer = (code: number, charge: unknown) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(charge))
  }

  if (pannes > 0) { pannes--; return envoyer(503, { message: 'service indisponible (panne simulee)' }) }
  if (!tables[table]) return envoyer(404, { message: `table ${table} inconnue` })

  /* Filtres : on ne gère que `col=eq.valeur`, `col=is.null` et `col=in.(…)`,
   * ce qui couvre tout ce que paiement.ts envoie. */
  const filtre = (l: Ligne) => {
    for (const [cle, brut] of url.searchParams) {
      if (['select', 'order', 'limit', 'on_conflict', 'columns'].includes(cle)) continue
      if (brut.startsWith('eq.')) { if (String(l[cle]) !== brut.slice(3)) return false }
      else if (brut === 'is.null') { if (l[cle] !== null && l[cle] !== undefined) return false }
      else if (brut.startsWith('neq.')) { if (String(l[cle]) === brut.slice(4)) return false }
      else if (brut.startsWith('in.')) {
        const vals = brut.slice(4, -1).split(',').map(s => s.replace(/^"|"$/g, ''))
        if (!vals.includes(String(l[cle]))) return false
      } else if (brut.startsWith('gte.')) { if (String(l[cle]) < brut.slice(4)) return false }
    }
    return true
  }

  if (req.method === 'GET') return envoyer(200, tables[table].filter(filtre))

  if (req.method === 'POST') {
    const lignes: Ligne[] = JSON.parse(corps || '[]')
    const aInserer = Array.isArray(lignes) ? lignes : [lignes]
    if (latenceInsertion) await new Promise(r => setTimeout(r, latenceInsertion))
    const inserees: Ligne[] = []
    for (const l of aInserer) {
      // Clé primaire de stripe_events
      if (table === 'stripe_events' && tables[table].some(x => x.id === l.id)) {
        return envoyer(409, erreurUnicite('stripe_events_pkey'))
      }
      // Index unique partiel sur courses.stripe_payment_intent_id
      if (table === 'courses' && l.stripe_payment_intent_id
          && tables[table].some(x => x.stripe_payment_intent_id === l.stripe_payment_intent_id)) {
        return envoyer(409, erreurUnicite('courses_stripe_pi_unique'))
      }
      // Index unique partiel sur les incidents OUVERTS
      if (table === 'incidents_paiement'
          && tables[table].some(x => x.type === l.type && x.reference === l.reference && !x.resolu_le)) {
        return envoyer(409, erreurUnicite('incidents_paiement_unique_ouvert'))
      }
      const ligne: Ligne = {
        statut: table === 'stripe_events' ? 'recu' : undefined,
        tentatives: table === 'stripe_events' ? 0 : undefined,
        resolu_le: table === 'incidents_paiement' ? null : undefined,
        recu_le: table === 'stripe_events' ? new Date().toISOString() : undefined,
        created_at: new Date().toISOString(),
        id: l.id ?? `fictif-${table}-${tables[table].length + 1}`,
        ...l,
      }
      tables[table].push(ligne); inserees.push(ligne)
    }
    return envoyer(201, inserees)
  }

  if (req.method === 'PATCH') {
    const maj: Ligne = JSON.parse(corps || '{}')
    const touchees = tables[table].filter(filtre)
    for (const l of touchees) Object.assign(l, maj)
    return envoyer(200, touchees)
  }

  return envoyer(405, { message: 'methode non geree' })
})

await new Promise<void>(r => serveur.listen(0, '127.0.0.1', () => r()))
const port = (serveur.address() as { port: number }).port
const sb = createClient(`http://127.0.0.1:${port}`, 'cle-fictive-de-test', {
  auth: { persistSession: false, autoRefreshToken: false },
})

console.log('\x1b[1mContrôles des paiements — Sprint 2\x1b[0m')
console.log(`faux PostgREST sur 127.0.0.1:${port} · aucune donnée réelle, aucun paiement\n`)

const EV = { id: 'evt_fictif_001', type: 'checkout.session.completed' }
const CHARGE = { id: EV.id, data: { object: { id: 'cs_fictif', metadata: { type: 'reservation' } } } }

// ── 1 ───────────────────────────────────────────────────────────────────────
section('1. Renvoi d\'un même événement (le geste du 8 octobre)')
{
  const a = await enregistrerEvenement(sb, EV, CHARGE)
  verifier('première livraison : à traiter', a.action === 'traiter', JSON.stringify(a))
  verifier('journalisée une fois', tables.stripe_events.length === 1)

  const b = await enregistrerEvenement(sb, EV, CHARGE)
  verifier('deuxième livraison avant la fin du traitement : à traiter (sinon on perdrait la course)',
    b.action === 'traiter', JSON.stringify(b))
  verifier('toujours une seule ligne au journal', tables.stripe_events.length === 1)
  verifier('le compteur de tentatives a augmenté', tables.stripe_events[0].tentatives === 2,
    String(tables.stripe_events[0].tentatives))

  await marquerEvenementTraite(sb, EV.id, { courseId: 'course-fictive-1' })
  verifier('marqué traité', tables.stripe_events[0].statut === 'traite')

  const c = await enregistrerEvenement(sb, EV, CHARGE)
  verifier('renvoi APRÈS traitement : ignoré', c.action === 'ignorer', JSON.stringify(c))
  verifier('aucune ligne ajoutée', tables.stripe_events.length === 1)
}

// ── 2 ───────────────────────────────────────────────────────────────────────
section('2. Événement journalisé puis échoué — il doit être repris')
{
  const ev2 = { id: 'evt_fictif_002', type: 'checkout.session.completed' }
  await enregistrerEvenement(sb, ev2, CHARGE)
  await marquerEvenementEchec(sb, ev2.id, new Error('enum type_vehicule refuse « van »'))
  const ligne = tables.stripe_events.find(e => e.id === ev2.id)!
  verifier('marqué en échec', ligne.statut === 'echec')
  verifier('l\'erreur est conservée', String(ligne.erreur).includes('van'))

  const r = await enregistrerEvenement(sb, ev2, CHARGE)
  verifier('un événement en échec est RETRAITÉ, pas ignoré', r.action === 'traiter', JSON.stringify(r))

  const aReprendre = await evenementsAReprendre(sb)
  verifier('la réconciliation le voit dans les événements à reprendre',
    aReprendre.some(e => e.id === ev2.id), JSON.stringify(aReprendre.map(e => e.id)))
  verifier('elle ne voit PAS celui qui est traité',
    !aReprendre.some(e => e.id === EV.id))
}

// ── 3 ───────────────────────────────────────────────────────────────────────
section('3. Deux traitements simultanés du même paiement')
{
  const PI = 'pi_fictif_concurrent'
  const inserer = () => sb.from('courses').insert({
    adresse_depart: 'A', adresse_arrivee: 'B', prix_estime: 59,
    statut: 'en_attente', mode_paiement: 'stripe', paiement_statut: 'paye',
    stripe_payment_intent_id: PI,
  }).select('id').single()

  latenceInsertion = 40   // les deux requêtes se chevauchent vraiment
  const [r1, r2] = await Promise.all([inserer(), inserer()])
  latenceInsertion = 0

  const reussies = [r1, r2].filter(r => !r.error)
  const refusees = [r1, r2].filter(r => r.error?.code === VIOLATION_UNICITE)
  verifier('exactement une insertion réussit', reussies.length === 1, `${reussies.length} réussie(s)`)
  verifier('l\'autre est refusée par la contrainte d\'unicité', refusees.length === 1,
    `codes : ${[r1, r2].map(r => r.error?.code ?? 'ok').join(', ')}`)
  verifier('une seule course en base pour ce paiement',
    tables.courses.filter(c => c.stripe_payment_intent_id === PI).length === 1)

  /* Ce que le webhook fait du refus : il retrouve la course gagnante et sort
   * AVANT de créer la facture. C'est ce qui empêche la facture en double. */
  const { data: gagnante } = await sb.from('courses').select('id').eq('stripe_payment_intent_id', PI).maybeSingle()
  verifier('le perdant peut retrouver la course gagnante', !!gagnante?.id)
}

// ── 4 ───────────────────────────────────────────────────────────────────────
section('4. Panne temporaire de Supabase')
{
  const ev4 = { id: 'evt_fictif_004', type: 'checkout.session.completed' }
  pannes = 1
  const r = await enregistrerEvenement(sb, ev4, CHARGE)
  verifier('journal indisponible : on traite quand même (perdre la trace < perdre la réservation)',
    r.action === 'traiter', JSON.stringify(r))
  verifier('rien n\'a été journalisé', !tables.stripe_events.some(e => e.id === ev4.id))

  pannes = 1
  let leve = false
  try { await marquerPaiementConfirme(sb, 'course-fictive-1', 'pi_fictif_panne') } catch { leve = true }
  verifier('un paiement confirmé non enregistré LÈVE (le webhook répondra 500 et Stripe réessaiera)', leve)

  pannes = 0
  await sb.from('courses').insert({ id: 'course-panne', stripe_payment_intent_id: 'pi_fictif_panne', paiement_statut: 'en_attente' })
  await marquerPaiementConfirme(sb, 'course-panne', 'pi_fictif_panne')
  const c = tables.courses.find(x => x.id === 'course-panne')!
  verifier('après la panne, la même correction aboutit', c.paiement_statut === 'paye' && c.mode_paiement === 'stripe')
}

// ── 5 ───────────────────────────────────────────────────────────────────────
section('5. Statut de paiement : écriture et transitions')
{
  await sb.from('courses').insert({ id: 'course-statut', stripe_payment_intent_id: 'pi_fictif_statut', paiement_statut: 'en_attente' })
  await marquerPaiementConfirme(sb, 'course-statut', 'pi_fictif_statut')
  const c = () => tables.courses.find(x => x.id === 'course-statut')!
  verifier('paiement confirmé → paye', c().paiement_statut === 'paye')
  verifier('mode_paiement renseigné', c().mode_paiement === 'stripe')

  const id = await marquerRemboursement(sb, 'pi_fictif_statut')
  verifier('remboursement → remboursee', c().paiement_statut === 'remboursee' && id === 'course-statut')

  const rejoue = await marquerRemboursement(sb, 'pi_fictif_statut')
  verifier('remboursement rejoué : aucun effet (idempotent)', rejoue === null)

  verifier('les six valeurs attendues sont déclarées',
    STATUTS_PAIEMENT.length === 6 && STATUTS_PAIEMENT.includes('paye') && STATUTS_PAIEMENT.includes('contestee'))
}

// ── 6 ───────────────────────────────────────────────────────────────────────
section('6. Incidents : une alerte qui survit à un e-mail manqué')
{
  const a = await signalerIncident(sb, { type: 'paiement_sans_course', gravite: 'critique', reference: 'pi_fictif_alerte', detail: { montant: 89 } })
  verifier('premier signalement : nouveau', a.nouveau)
  const b = await signalerIncident(sb, { type: 'paiement_sans_course', gravite: 'critique', reference: 'pi_fictif_alerte', detail: { montant: 89 } })
  verifier('signalement répété le lendemain : pas de doublon', !b.nouveau)
  verifier('une seule ligne ouverte',
    tables.incidents_paiement.filter(i => i.reference === 'pi_fictif_alerte' && !i.resolu_le).length === 1)

  await resoudreIncident(sb, 'paiement_sans_course', 'pi_fictif_alerte')
  verifier('résolu', tables.incidents_paiement.find(i => i.reference === 'pi_fictif_alerte')!.resolu_le !== null)

  const c = await signalerIncident(sb, { type: 'paiement_sans_course', gravite: 'critique', reference: 'pi_fictif_alerte' })
  verifier('le même problème qui revient après résolution rouvre un incident', c.nouveau)
}

// ── 7 ───────────────────────────────────────────────────────────────────────
// Contrôles de structure, sur le modèle de `test-heure-course.mts` : ils ne
// mesurent pas un comportement mais vérifient qu'aucun fichier ne contourne la
// règle. Un test de comportement de bout en bout demande les migrations
// appliquées et le mode test de Stripe — c'est une étape d'après validation.
section('7. Le code respecte-t-il les règles ? (contrôles de structure)')
{
  const lire = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
  /* Les commentaires sont retirés avant tout contrôle de structure.
   *
   * Sans cela le contrôle est creux : en vérifiant que ces tests savaient
   * échouer, la barrière `.is('stripe_payment_intent_id', null)` a été
   * commentée — et le contrôle est resté AU VERT, parce que la ligne existait
   * toujours dans le fichier. Un contrôle qui ne cherche pas au bon endroit
   * rassure à tort. */
  const sansCommentaires = (src: string) =>
    src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
  const lireCode = (p: string) => sansCommentaires(lire(p))
  const webhook = lireCode('src/app/api/stripe/webhook/route.ts')
  const cron    = lireCode('src/app/api/cron/facturation-mensuelle/route.ts')
  const vercel  = lire('vercel.json')

  verifier('le webhook journalise l\'événement AVANT de le traiter',
    webhook.indexOf('enregistrerEvenement') < webhook.indexOf("event.type === 'checkout.session.completed'")
    && webhook.includes('enregistrerEvenement'))

  verifier('un événement déjà traité est ignoré',
    /action === 'ignorer'/.test(webhook) && /deja_traite/.test(webhook))

  verifier('la course naît avec paiement_statut = paye',
    /paiement_statut:\s*'paye'/.test(webhook))

  verifier('le paiement par lien écrit aussi le statut',
    /marquerPaiementConfirme\(supabase, courseId, paymentIntentId\)/.test(webhook))

  /* On vise la GARDE, pas l'import : chercher « VIOLATION_UNICITE » tout court
     trouvait la ligne d'import en tête de fichier, et le contrôle passait au
     rouge pour une raison fausse. */
  const iInsert  = webhook.indexOf('.from(\'courses\').insert({')
  const iGarde   = webhook.indexOf('courseErr?.code === VIOLATION_UNICITE')
  /* Ancré sur du code, pas sur un commentaire : les commentaires sont retirés. */
  const iFacture = webhook.indexOf('genererNumeroFacture(supabase)')
  verifier('la violation d\'unicité est rattrapée APRÈS l\'insertion et AVANT la facture',
    iInsert > 0 && iGarde > iInsert && iFacture > iGarde,
    `insert=${iInsert} garde=${iGarde} facture=${iFacture}`)

  verifier('un échec de facture laisse un incident au lieu d\'être avalé',
    /type: 'facture_manquante'/.test(webhook))

  verifier('la facturation mensuelle écarte toute course portant un paiement Stripe',
    /\.is\('stripe_payment_intent_id', null\)/.test(cron))

  verifier('la réconciliation quotidienne est déclarée dans vercel.json',
    /reconciliation-paiements/.test(vercel))

  const recon = lireCode('src/app/api/cron/reconciliation-paiements/route.ts')
  verifier('la réconciliation n\'appelle AUCUNE méthode Stripe qui débite ou rembourse',
    !/refunds\.create|charges\.create|paymentIntents\.create|checkout\.sessions\.create/.test(recon))
  verifier('la réconciliation ne supprime ni ne fusionne aucune course',
    !/\.delete\(\)/.test(recon))
  verifier('la réconciliation sait récupérer une réservation perdue',
    /handleNewReservation\(meta, pi\)/.test(recon))

  const pai = lireCode('src/lib/paiement.ts')
  const ecrituresDirectes = [
    ['src/app/api/stripe/webhook/route.ts', webhook],
    ['src/app/api/cron/reconciliation-paiements/route.ts', recon],
  ].filter(([, src]) => /update\(\{[^}]*paiement_statut/.test(src as string))
  verifier('aucun fichier n\'écrit paiement_statut par un update direct — tout passe par paiement.ts',
    ecrituresDirectes.length === 0,
    ecrituresDirectes.map(([f]) => f).join(', '))
  verifier('paiement.ts est bien la source des transitions',
    /export async function marquerPaiementConfirme/.test(pai) && /export async function marquerRemboursement/.test(pai))
}

serveur.close()

console.log('\n' + '─'.repeat(70))
if (echecs.length === 0) {
  console.log(`\x1b[32m\x1b[1m${passes} CONTRÔLES AU VERT\x1b[0m`)
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1m${echecs.length} ÉCHEC(S)\x1b[0m sur ${passes + echecs.length} contrôles`)
  for (const e of echecs) console.log(`  · ${e}`)
  process.exit(1)
}
