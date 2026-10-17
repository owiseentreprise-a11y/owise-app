/**
 * Test de bout en bout du webhook Stripe, en environnement isolé.
 *
 * CE QUI EST ISOLÉ, et comment c'est garanti :
 *   - la base : PostgreSQL + PostgREST dans des conteneurs jetables, sur
 *     localhost, montés par scripts/stack-test-local.mjs ;
 *   - l'application : `next dev -p 3210` avec .env.test.integration, dont
 *     aucune variable ne porte un secret de production (vérifié par
 *     scripts/tableau-environnements.mts, empreintes SHA-256 comparées) ;
 *   - Stripe : AUCUN appel à l'API Stripe. Les événements sont signés ici, en
 *     HMAC-SHA256, avec un secret de webhook propre au test. Les destinations
 *     Live ne sont donc même pas effleurées ;
 *   - les effets de bord : Resend, Meta CAPI, Google Ads, PostHog et Sentry
 *     ont leurs clés vides. `email.ts` n'a qu'un point d'envoi, `send()`, qui
 *     sort immédiatement quand la clé manque — aucun e-mail ne peut partir.
 *
 * PREUVE D'ISOLEMENT, faite AVANT toute écriture : la page d'accueil servie
 * par l'application n'affiche AUCUN prix, parce que la base locale est vide.
 * La production afficherait 59/89/100/100. L'application lit donc bien le
 * local.
 *
 * CE QUI N'EST PAS COUVERT : la création d'un nouveau compte client, qui passe
 * par Supabase Auth (GoTrue), absent de la pile. Le test exerce la branche
 * « client déjà connu ».
 *
 * Usage, depuis owise-app, la pile et l'application étant démarrées :
 *   node scripts/test-e2e-webhook.mjs
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createHmac, randomUUID } from 'node:crypto'

const APP = 'http://localhost:3210'
const PG = 'owise-test-pg'
const DB = 'owise_test'
const CLIENT_FICTIF = '11111111-1111-1111-1111-111111111111'

const env = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.test.integration'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !l.trimStart().startsWith('#')) env[l.slice(0, i).trim()] = l.slice(i + 1).trim()
}
const WHSEC = env.STRIPE_WEBHOOK_SECRET
if (!WHSEC) { console.error('STRIPE_WEBHOOK_SECRET absent de .env.test.integration'); process.exit(2) }

let passes = 0
const echecs = []
const verifier = (nom, ok, detail = '') => {
  if (ok) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${nom}`) }
  else { echecs.push(nom); console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? `\n       ${String(detail).trim().slice(0, 300)}` : ''}`) }
}
const section = (m) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)

const sql = (t) => {
  try {
    return execFileSync('docker', ['exec', '-i', PG, 'psql', '-U', 'postgres', '-d', DB, '-t', '-A', '-f', '-'],
      { encoding: 'utf8', input: t, stdio: ['pipe', 'pipe', 'pipe'] }).trim()
  } catch (e) { return 'ERREUR: ' + String(e.stderr ?? e.message).slice(0, 200) }
}

/** Signe comme Stripe : t=<horodatage>,v1=HMAC-SHA256(ts.payload, secret). */
function signer(charge, decalageSecondes = 0) {
  const corps = JSON.stringify(charge)
  const ts = Math.floor(Date.now() / 1000) + decalageSecondes
  const sig = createHmac('sha256', WHSEC).update(`${ts}.${corps}`).digest('hex')
  return { corps, entete: `t=${ts},v1=${sig}` }
}

/* Une rafale de renvois rapides fait parfois tomber une connexion réutilisée
   par le serveur de développement (UND_ERR_SOCKET). Ce n'est pas le sujet du
   test : on réessaie, en fermant la connexion à chaque fois. */
const envoyer = async (charge, decalage = 0, essai = 0) => {
  const { corps, entete } = signer(charge, decalage)
  let r
  try {
    r = await fetch(`${APP}/api/stripe/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'stripe-signature': entete, Connection: 'close' },
      body: corps,
    })
  } catch (e) {
    if (essai >= 3) throw e
    await new Promise(res => setTimeout(res, 500 * (essai + 1)))
    return envoyer(charge, decalage, essai + 1)
  }
  let json = null
  const texte = await r.text()
  try { json = JSON.parse(texte) } catch { /* pas du json */ }
  return { statut: r.status, json, texte }
}

/** Un événement de paiement réussi, avec des données entièrement fictives. */
const evenement = ({ id = 'evt_test_' + randomUUID().slice(0, 8), pi, vehicule = 'van', prix = 89 } = {}) => ({
  id,
  object: 'event',
  type: 'checkout.session.completed',
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'cs_test_' + randomUUID().slice(0, 12),
      object: 'checkout.session',
      payment_status: 'paid',
      amount_total: prix * 100,
      payment_intent: pi,
      metadata: {
        type: 'reservation',
        email: 'client.fictif@exemple.test',
        nom: 'Fictif',
        prenom: 'Client',
        telephone: '+33600000000',
        adresse_depart: '1 rue de Nulle Part, 60500 Lieu-Fictif',
        adresse_arrivee: 'Aeroport Fictif, 95700 Nulle-Part',
        date_prevue: '2026-12-24T09:30',
        type_vehicule: vehicule,
        nb_passagers: '5',
        prix: String(prix),
      },
    },
  },
})

console.log('\x1b[1mTest de bout en bout du webhook — environnement isolé\x1b[0m')
console.log(`application ${APP} · base locale ${PG} · aucun appel à Stripe\n`)

/* Le test doit être rejouable : il réutilise des identifiants d'événement
 * fixes, et l'état du passage précédent le faussait — un événement déjà
 * « traite » répondait « deja_traite » là où le scénario attendait un échec.
 *
 * La remise à zéro passe par `docker exec` sur le conteneur de test : elle ne
 * PEUT PAS atteindre la production, qui n'est joignable que par HTTP. On
 * vérifie quand même que l'environnement chargé pointe bien localhost — une
 * ceinture de plus ne coûte rien quand il s'agit d'un TRUNCATE. */
if (!/localhost|127\.0\.0\.1/.test(env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
  console.error(`ARRÊT : NEXT_PUBLIC_SUPABASE_URL ne pointe pas localhost (${env.NEXT_PUBLIC_SUPABASE_URL})`)
  process.exit(2)
}
const remiseAZero = sql('TRUNCATE courses, factures, stripe_events, incidents_paiement;')
if (remiseAZero.startsWith('ERREUR')) { console.error('remise à zéro impossible : ' + remiseAZero); process.exit(2) }
console.log('base locale remise à zéro (conteneur jetable)\n')

// ── 0. L'isolement tient-il toujours ? ─────────────────────────────────────
section('0. Vérification d\'isolement, avant toute écriture')
{
  const r = await fetch(`${APP}/`)
  const html = await r.text()
  const prix = [...html.matchAll(/class="vc-amount[^"]*"[^>]*>(\d+)/g)].map(m => m[1])
  verifier('l\'application répond', r.status === 200, `HTTP ${r.status}`)
  verifier('aucun prix sur la page d\'accueil → base locale vide, pas la production',
    prix.length === 0, `prix trouvés : ${prix.join('/')} (la production dirait 59/89/100/100)`)
  verifier('la base locale est vierge de courses', sql('SELECT count(*) FROM courses;') === '0')
  const mauvaiseSignature = await fetch(`${APP}/api/stripe/webhook`, {
    method: 'POST', headers: { 'stripe-signature': 't=1,v1=' + '0'.repeat(64) }, body: '{}',
  })
  verifier('une signature fausse est refusée (400)', mauvaiseSignature.status === 400, `HTTP ${mauvaiseSignature.status}`)
}

// ── 1. Le parcours complet ─────────────────────────────────────────────────
section('1. Paiement réussi → webhook signé → course → facture → statut payé')
const PI_1 = 'pi_test_' + randomUUID().slice(0, 12)
const EV_1 = evenement({ pi: PI_1 })
{
  const r = await envoyer(EV_1)
  verifier('le webhook accepte l\'événement signé', r.statut === 200, `HTTP ${r.statut} ${r.texte.slice(0, 200)}`)

  const course = sql(`SELECT id||'|'||statut||'|'||coalesce(paiement_statut,'NULL')||'|'||coalesce(mode_paiement,'NULL')||'|'||type_vehicule||'|'||coalesce(facture_id::text,'NULL')||'|'||coalesce(prix_estime::text,'NULL')
                        FROM courses WHERE stripe_payment_intent_id='${PI_1}';`)
  const [id, statut, paiement, mode, vehicule, factureId, prixBase] = course.split('|')
  verifier('une course est créée', !!id && id.length === 36, course)
  verifier('son statut de course est « en_attente »', statut === 'en_attente', statut)
  verifier('son statut de paiement est « paye »', paiement === 'paye', paiement)
  verifier('son mode de paiement est « stripe »', mode === 'stripe', mode)
  verifier('« van » a bien été traduit en « van_7 » (la cause de l\'incident du 7 octobre)',
    vehicule === 'van_7', vehicule)
  verifier('le prix est repris des métadonnées', prixBase === '89.00' || prixBase === '89', prixBase)
  verifier('une facture est liée à la course', factureId !== 'NULL' && factureId?.length === 36, factureId)

  const facture = sql(`SELECT numero||'|'||statut||'|'||montant_ttc::text FROM factures WHERE id='${factureId}';`)
  const [numero, fStatut, montant] = facture.split('|')
  verifier('la facture porte un numéro', /^TEST-\d{6}-\d{4}$/.test(numero ?? ''), numero)
  verifier('la facture est marquée « payee »', fStatut === 'payee', fStatut)
  /* `numeric` sans précision ici : l'introspection OpenAPI ne donne pas
     l'échelle des colonnes numériques, donc le schéma local rend « 89 » là où
     la production, en numeric(10,2), rendrait « 89.00 ». On compare donc des
     nombres, pas des chaînes — et la limite est notée au rapport. */
  verifier('son montant correspond', Number(montant) === 89, montant)

  const ev = sql(`SELECT statut||'|'||tentatives::text||'|'||coalesce(course_id::text,'NULL') FROM stripe_events WHERE id='${EV_1.id}';`)
  const [evStatut, tentatives, evCourse] = ev.split('|')
  verifier('l\'événement est journalisé comme « traite »', evStatut === 'traite', ev)
  verifier('à la première tentative', tentatives === '1', tentatives)
  verifier('et il pointe la course créée', evCourse === id, `${evCourse} vs ${id}`)
}

// ── 2. Renvoi du même événement ────────────────────────────────────────────
section('2. Renvoi du même événement (le geste du 8 octobre)')
{
  const avant = sql(`SELECT count(*) FROM courses;`)
  const avantF = sql(`SELECT count(*) FROM factures;`)

  const r = await envoyer(EV_1)
  verifier('le renvoi répond 200', r.statut === 200, `HTTP ${r.statut}`)
  verifier('et annonce explicitement « déjà traité »', r.json?.deja_traite === true, JSON.stringify(r.json))

  verifier('aucune course supplémentaire', sql(`SELECT count(*) FROM courses;`) === avant,
    `${avant} → ${sql(`SELECT count(*) FROM courses;`)}`)
  verifier('aucune facture supplémentaire', sql(`SELECT count(*) FROM factures;`) === avantF)

  /* Trois renvois de plus, comme une reprise de file Stripe. */
  for (let i = 0; i < 3; i++) await envoyer(EV_1)
  verifier('après 4 renvois au total : toujours une seule course',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_1}';`) === '1')
  verifier('toujours une seule facture',
    sql(`SELECT count(*) FROM factures;`) === avantF)
}

// ── 3. Deux livraisons concurrentes ────────────────────────────────────────
section('3. Deux livraisons concurrentes du même paiement')
{
  const PI_2 = 'pi_test_' + randomUUID().slice(0, 12)
  /* Deux événements DIFFÉRENTS — donc la garde du journal ne joue pas — mais
     portant le MÊME paiement. Seul l'index unique sur courses peut trancher. */
  const a = evenement({ id: 'evt_test_concur_a', pi: PI_2 })
  const b = evenement({ id: 'evt_test_concur_b', pi: PI_2 })

  const [ra, rb] = await Promise.all([envoyer(a), envoyer(b)])
  console.log(`     réponses : ${ra.statut} et ${rb.statut}`)

  verifier('une seule course pour ce paiement',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_2}';`) === '1',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_2}';`))

  const nbFactures = sql(`SELECT count(*) FROM factures;`)
  verifier('une seule facture créée au total (pas de doublon de facture)', nbFactures === '2', nbFactures)

  verifier('les deux événements sont journalisés séparément',
    sql(`SELECT count(*) FROM stripe_events WHERE id IN ('evt_test_concur_a','evt_test_concur_b');`) === '2')
  verifier('les deux réponses sont 200 (le perdant retrouve la course gagnante)',
    ra.statut === 200 && rb.statut === 200, `${ra.statut}/${rb.statut}`)
}

// ── 4. Échec de traitement, puis reprise ───────────────────────────────────
section('4. Échec de traitement, puis reprise')
{
  const PI_3 = 'pi_test_' + randomUUID().slice(0, 12)
  /* Un type de véhicule inconnu : vehiculePourBase() lève, exactement comme
     le 7 octobre avec « van » avant la correction. */
  const mauvais = evenement({ id: 'evt_test_echec', pi: PI_3, vehicule: 'limousine_inexistante' })

  const r = await envoyer(mauvais)
  verifier('le webhook répond 500 — Stripe réessaiera', r.statut === 500, `HTTP ${r.statut} ${r.texte.slice(0, 120)}`)
  verifier('aucune course n\'a été créée',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_3}';`) === '0')

  const ev = sql(`SELECT statut||'|'||coalesce(erreur,'NULL') FROM stripe_events WHERE id='evt_test_echec';`)
  verifier('l\'événement est journalisé en « echec »', ev.startsWith('echec|'), ev)
  verifier('l\'erreur est conservée, exploitable', /limousine_inexistante|vehicule/i.test(ev), ev.slice(0, 160))

  const inc = sql(`SELECT type||'|'||gravite||'|'||coalesce(reference,'NULL') FROM incidents_paiement WHERE reference='${PI_3}';`)
  verifier('un incident critique est ouvert', inc === `paiement_sans_course|critique|${PI_3}`, inc)

  /* La reprise : le même événement, corrigé. C'est ce que fait la
     réconciliation quotidienne en rejouant le payload journalisé. */
  const corrige = evenement({ id: 'evt_test_echec', pi: PI_3, vehicule: 'van' })
  const r2 = await envoyer(corrige)
  verifier('le rejeu de l\'événement en échec est accepté', r2.statut === 200, `HTTP ${r2.statut}`)
  verifier('la course est enfin créée',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_3}';`) === '1')
  verifier('l\'événement passe à « traite »',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_echec';`) === 'traite')
  verifier('l\'incident est refermé automatiquement',
    sql(`SELECT coalesce(resolu_le::text,'OUVERT') FROM incidents_paiement WHERE reference='${PI_3}';`) !== 'OUVERT')
}

// ── 4bis. Les chemins qui annonçaient un succès à tort ─────────────────────
section('4bis. Aucun chemin n\'annonce un succès qu\'il n\'a pas constaté')
{
  /* Une session PAYÉE dont aucune métadonnée n'est reconnue. Elle tombait
     jusqu'ici dans le `return { received: true }` de fin de fonction :
     succès annoncé, rien créé, aucun incident. */
  const PI_4 = 'pi_test_' + randomUUID().slice(0, 12)
  const orpheline = {
    id: 'evt_test_meta_inconnue', object: 'event', type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: { object: {
      id: 'cs_test_orpheline', object: 'checkout.session', payment_status: 'paid',
      amount_total: 12300, payment_intent: PI_4,
      metadata: { provenance: 'lien cree a la main hors de l application' },
    } },
  }
  const r = await envoyer(orpheline)
  verifier('la réponse signale l\'incident au lieu d\'un succès muet',
    r.json?.incident === 'metadonnees_inconnues', JSON.stringify(r.json))
  verifier('un incident critique est ouvert',
    sql(`SELECT type||'|'||gravite FROM incidents_paiement WHERE reference='${PI_4}';`) === 'metadonnees_inconnues|critique',
    sql(`SELECT type||'|'||gravite FROM incidents_paiement WHERE reference='${PI_4}';`))
  verifier('l\'événement est marqué « echec », pas « traite »',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_meta_inconnue';`) === 'echec')
  verifier('aucune course n\'a été créée pour autant',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_4}';`) === '0')

  /* Un type d'événement sur lequel nous n'agissons pas : il doit être marqué
     « ignore », pas laissé « recu » — sinon la réconciliation le reprend
     chaque jour pour rien. */
  const autre = {
    id: 'evt_test_type_ignore', object: 'event', type: 'customer.updated',
    created: Math.floor(Date.now() / 1000), data: { object: { id: 'cus_test' } },
  }
  const r2 = await envoyer(autre)
  verifier('un type non traité répond 200', r2.statut === 200, `HTTP ${r2.statut}`)
  verifier('et il est marqué « ignore », jamais laissé « recu »',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_type_ignore';`) === 'ignore',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_type_ignore';`))

  /* Une session non payée : traitée, sans incident. */
  const nonPayee = {
    id: 'evt_test_non_payee', object: 'event', type: 'checkout.session.completed',
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: 'cs_test_np', payment_status: 'unpaid', amount_total: 0, metadata: {} } },
  }
  await envoyer(nonPayee)
  verifier('une session non payée est marquée « traite » sans incident',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_non_payee';`) === 'traite')
}

// ── 4ter. Création d'un NOUVEAU client, et échec de Supabase Auth ──────────
//
// Le trou nommé dans le rapport précédent. Le leurre d'authentification du
// relais n'est PAS GoTrue — pas de hachage, pas de règles réelles — mais il
// permet d'éprouver ce qui compte ici : les conséquences exactes d'un échec
// d'Auth sur la réservation, et la reprise.
section('4ter. Nouveau client, et conséquences d\'un échec de Supabase Auth')
{
  /* a) Un client inconnu : le code prend la branche « créer le compte ». */
  const PI_N = 'pi_test_' + randomUUID().slice(0, 12)
  const nouveau = evenement({ id: 'evt_test_nouveau', pi: PI_N })
  nouveau.data.object.metadata.email = 'nouveau.fictif@exemple.test'
  const rn = await envoyer(nouveau)
  verifier('un client inconnu : la réservation aboutit quand même', rn.statut === 200, `HTTP ${rn.statut} ${rn.texte.slice(0, 150)}`)
  verifier('sa course est créée',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_N}';`) === '1')
  verifier('un compte a bien été créé pour lui',
    sql(`SELECT count(*) FROM utilisateurs_test WHERE email='nouveau.fictif@exemple.test';`) === '1')

  /* b) Panne d'Auth PERMANENTE : que devient la réservation ? */
  const PI_E = 'pi_test_' + randomUUID().slice(0, 12)
  const panne = evenement({ id: 'evt_test_auth_echec', pi: PI_E })
  panne.data.object.metadata.email = 'echec-auth@exemple.test'
  const re = await envoyer(panne)
  verifier('panne d\'Auth : le webhook répond 500, il n\'annonce PAS un succès',
    re.statut === 500, `HTTP ${re.statut}`)
  verifier('aucune course n\'est créée',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_E}';`) === '0')
  verifier('l\'événement est conservé en « echec », donc rejouable',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_auth_echec';`) === 'echec')
  verifier('la charge utile complète est conservée — seule copie du trajet',
    sql(`SELECT (payload->'data'->'object'->'metadata'->>'adresse_depart') FROM stripe_events WHERE id='evt_test_auth_echec';`)
      .includes('Nulle Part'))
  verifier('un incident critique est ouvert avec les métadonnées',
    sql(`SELECT gravite FROM incidents_paiement WHERE reference='${PI_E}';`) === 'critique')

  /* c) Panne PASSAGÈRE : Stripe réessaie, et la réservation doit aboutir. */
  const PI_T = 'pi_test_' + randomUUID().slice(0, 12)
  const transitoire = evenement({ id: 'evt_test_auth_transitoire', pi: PI_T })
  transitoire.data.object.metadata.email = 'transitoire@exemple.test'
  const r1 = await envoyer(transitoire)
  verifier('panne passagère : première livraison en 500', r1.statut === 500, `HTTP ${r1.statut}`)
  verifier('rien n\'est créé à ce stade',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_T}';`) === '0')

  const r2 = await envoyer(transitoire)   // la nouvelle tentative de Stripe
  verifier('la nouvelle tentative aboutit', r2.statut === 200, `HTTP ${r2.statut} ${r2.texte.slice(0, 150)}`)
  verifier('la course est créée à la seconde tentative',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_T}';`) === '1')
  verifier('l\'événement passe de « echec » à « traite »',
    sql(`SELECT statut FROM stripe_events WHERE id='evt_test_auth_transitoire';`) === 'traite')
  verifier('et l\'incident se referme',
    sql(`SELECT coalesce(resolu_le::text,'OUVERT') FROM incidents_paiement WHERE reference='${PI_T}';`) !== 'OUVERT')
  verifier('aucun doublon de course malgré les deux livraisons',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='${PI_T}';`) === '1')
}

// ── 5. Aucun doublon, aucune perte, à l'échelle ────────────────────────────
section('5. État final de la base locale')
{
  const n = sql(`SELECT count(*) FROM courses;`)
  const nf = sql(`SELECT count(*) FROM factures;`)
  const nev = sql(`SELECT count(*) FROM stripe_events;`)
  console.log(`     ${n} course(s) · ${nf} facture(s) · ${nev} événement(s) journalisé(s)`)

  verifier('une course par paiement distinct, aucune en trop', n === sql(`SELECT count(DISTINCT stripe_payment_intent_id) FROM courses WHERE stripe_payment_intent_id IS NOT NULL;`), n)
  const dbl = sql(`SELECT count(*) FROM (SELECT stripe_payment_intent_id FROM courses
                    WHERE stripe_payment_intent_id IS NOT NULL
                    GROUP BY 1 HAVING count(*) > 1) d;`)
  verifier('aucun doublon d\'identifiant de paiement', dbl === '0', dbl)
  verifier('toutes les courses encaissées sont à « paye »',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id IS NOT NULL AND paiement_statut <> 'paye';`) === '0')
  verifier('toutes portent une facture',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id IS NOT NULL AND facture_id IS NULL;`) === '0')
  const numDbl = sql(`SELECT count(*) FROM (SELECT numero FROM factures GROUP BY 1 HAVING count(*) > 1) d;`)
  verifier('aucun numéro de facture en double', numDbl === '0', numDbl)
  verifier('aucun événement resté « recu » sans suite',
    sql(`SELECT count(*) FROM stripe_events WHERE statut='recu';`) === '0')
}

// ── 6. Effets de bord ──────────────────────────────────────────────────────
section('6. Effets de bord : rien n\'est sorti de la machine')
{
  const journal = process.argv[2]
  let log = ''
  try { log = readFileSync(journal ?? '', 'utf8') } catch { /* chemin non fourni */ }

  if (!log) {
    console.log('     (journal du serveur non fourni — passer son chemin en argument pour ce contrôle)')
  } else {
    verifier('aucun appel à l\'API Resend', !/api\.resend\.com/.test(log))
    verifier('Meta CAPI a été ignoré faute de jeton', /META_CAPI_ACCESS_TOKEN manquant/.test(log) || !/graph\.facebook\.com/.test(log))
    verifier('aucun appel à Google Ads', !/googleads\.googleapis\.com/.test(log))
    verifier('aucun appel à la Supabase de production', !/fbawdscnczdpjsbvyhfe/.test(log))
    verifier('les requêtes base sont allées sur localhost:54321', /localhost:54321/.test(log) || !/supabase\.co/.test(log))
  }

  /* Contrôle indépendant du journal : la production n'a pas bougé. */
  const prodEnv = {}
  for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const i = l.indexOf('=')
    if (i > 0) prodEnv[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
  }
  const h = { apikey: prodEnv.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${prodEnv.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'count=exact' }
  const compter = async (t) => {
    const r = await fetch(`${prodEnv.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${t}?select=id`, { method: 'HEAD', headers: h })
    return (r.headers.get('content-range') ?? '/?').split('/')[1]
  }
  const pc = await compter('courses'), pf = await compter('factures'), pe = await compter('stripe_events')
  console.log(`     production : ${pc} course(s) · ${pf} facture(s) · ${pe} événement(s)`)
  verifier('la production compte toujours 30 courses', pc === '30', pc)
  verifier('la production compte toujours 9 factures', pf === '9', pf)
  verifier('stripe_events de production est restée VIDE — aucune écriture de test n\'a fui', pe === '0', pe)
}

console.log('\n' + '─'.repeat(72))
if (echecs.length === 0) {
  console.log(`\x1b[32m\x1b[1m${passes} CONTRÔLES AU VERT\x1b[0m — chaîne complète, en isolement`)
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1m${echecs.length} ÉCHEC(S)\x1b[0m sur ${passes + echecs.length}`)
  for (const e of echecs) console.log(`  · ${e}`)
  process.exit(1)
}
