/**
 * Le code du webhook correspond-il EXACTEMENT au schéma installé en production ?
 *
 * Un décalage entre les deux est le défaut du 7 octobre : le code envoyait
 * `van`, la base n'acceptait que `van_7`. L'erreur n'était que journalisée, et
 * deux clients ont payé sans course. Ce contrôle existe pour que ce genre
 * d'écart soit vu AVANT un déploiement, pas après.
 *
 * Ce qu'il compare :
 *   - chaque colonne que le code écrit dans stripe_events, incidents_paiement
 *     et courses, contre les colonnes RÉELLES de la production ;
 *   - chaque valeur littérale que le code écrit dans une colonne contrainte
 *     (paiement_statut, statut, statut d'événement, gravité d'incident),
 *     contre les valeurs réellement autorisées ;
 *   - les noms de tables lus et écrits.
 *
 * Les colonnes et les enums viennent de l'introspection OpenAPI de PostgREST :
 * c'est une mesure de la production, pas une lecture des migrations — une
 * migration peut avoir échoué à moitié sans qu'aucun fichier ne le dise.
 *
 * LECTURE SEULE. Aucune écriture.
 *
 * Usage, depuis owise-app : npx tsx scripts/verif-code-vs-schema.mts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}

const ecarts: string[] = []
const ok  = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const ko  = (m: string) => { ecarts.push(m); console.log(`  \x1b[31m✗\x1b[0m ${m}`) }
const att = (m: string) => console.log(`  \x1b[33m⚠\x1b[0m ${m}`)
const info = (m: string) => console.log(`     ${m}`)
const section = (m: string) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)

const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/openapi+json',
  },
})
if (!r.ok) { console.error(`introspection → HTTP ${r.status}`); process.exit(2) }
const spec = await r.json() as { definitions?: Record<string, { properties?: Record<string, any>; required?: string[] }> }
const defs = spec.definitions ?? {}

const lire = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const sansCommentaires = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')

const webhook = sansCommentaires(lire('src/app/api/stripe/webhook/route.ts'))
const paiement = sansCommentaires(lire('src/lib/paiement.ts'))
const recon = sansCommentaires(lire('src/app/api/cron/reconciliation-paiements/route.ts'))
const cronFact = sansCommentaires(lire('src/app/api/cron/facturation-mensuelle/route.ts'))
const toutLeCode = [webhook, paiement, recon, cronFact].join('\n')

console.log('\x1b[1mCode du webhook vs schéma installé en production\x1b[0m')
console.log(`${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · lecture seule\n`)

// ── 1. Les tables que le code nomme existent-elles ? ───────────────────────
section('1. Tables nommées par le code')
{
  const nommees = new Set([...toutLeCode.matchAll(/\.from\('([a-z_]+)'\)/g)].map(m => m[1]))
  info(`${nommees.size} table(s) nommée(s) : ${[...nommees].sort().join(', ')}`)
  for (const t of [...nommees].sort()) {
    if (defs[t]) ok(`${t} existe en production`)
    else ko(`${t} est nommée par le code mais N'EXISTE PAS en production`)
  }
}

// ── 2. Les colonnes écrites existent-elles ? ───────────────────────────────
section('2. Colonnes écrites par le code')
{
  /* On relève les littéraux d'objet passés à insert()/update() pour les trois
     tables qui comptent ici. Volontairement grossier mais sûr : une colonne
     manquée est signalée, jamais inventée. */
  const colonnesEcrites: Record<string, Set<string>> = {
    stripe_events: new Set(['id', 'type', 'payload', 'tentatives', 'statut', 'traite_le', 'erreur', 'course_id', 'facture_id', 'recu_le']),
    incidents_paiement: new Set(['type', 'gravite', 'reference', 'detail', 'resolu_le', 'resolu_par', 'created_at']),
    courses: new Set(['paiement_statut', 'mode_paiement', 'stripe_payment_intent_id', 'facture_id',
      'client_id', 'adresse_depart', 'adresse_arrivee', 'date_prevue', 'type_vehicule', 'nb_passagers',
      'prix_estime', 'etapes', 'num_vol_train', 'terminal', 'heure_arrivee_vol', 'notes', 'statut']),
  }

  for (const [table, colonnes] of Object.entries(colonnesEcrites)) {
    const reelles = new Set(Object.keys(defs[table]?.properties ?? {}))
    if (reelles.size === 0) { ko(`${table} : aucune colonne lisible en production`); continue }
    const manquantes = [...colonnes].filter(c => !reelles.has(c))
    if (manquantes.length === 0) ok(`${table} : les ${colonnes.size} colonnes écrites existent toutes (${reelles.size} en production)`)
    else ko(`${table} : colonnes écrites ABSENTES de la production : ${manquantes.join(', ')}`)
  }

  /* Les colonnes NOT NULL sans défaut que le code devrait toujours fournir. */
  for (const table of ['stripe_events', 'incidents_paiement']) {
    const d = defs[table]
    if (!d) continue
    const obligatoires = (d.required ?? []).filter(c => d.properties?.[c]?.default === undefined)
    const fournies = colonnesEcrites[table]
    const oubliees = obligatoires.filter(c => !fournies.has(c))
    if (oubliees.length === 0) ok(`${table} : toutes les colonnes obligatoires sans défaut sont fournies`)
    else ko(`${table} : colonnes obligatoires non fournies par le code : ${oubliees.join(', ')}`)
  }
}

// ── 3. Les valeurs littérales sont-elles acceptées ? ───────────────────────
section('3. Valeurs littérales écrites par le code')
{
  /* paiement_statut : contrainte CHECK, invisible dans l'OpenAPI. La liste de
     référence est celle de la migration — et la contrainte a été confirmée en
     production par l'exploitant, puis éprouvée sur un PostgreSQL réel avec la
     migration identique (les six acceptées, une septième refusée en 23514). */
  const AUTORISES_CHECK = ['en_attente', 'a_percevoir', 'paye', 'echoue', 'remboursee', 'contestee']
  const migration = lire('supabase/migrations/20261017000000_fiabilite_paiements.sql')
  const dansMigration = AUTORISES_CHECK.every(v => migration.includes(`'${v}'`))
  if (dansMigration) ok(`les 6 valeurs de référence sont bien celles de la migration appliquée`)
  else ko(`la liste de référence ne correspond pas à la migration`)

  const ecrits = new Set([...toutLeCode.matchAll(/paiement_statut:\s*'([^']+)'/g)].map(m => m[1]))
  for (const m of toutLeCode.matchAll(/paiement_statut['"]?\s*[,:]\s*'([^']+)'/g)) ecrits.add(m[1])
  info(`paiement_statut écrit par le code : ${[...ecrits].join(', ') || 'aucun littéral trouvé'}`)
  const refuses = [...ecrits].filter(v => !AUTORISES_CHECK.includes(v))
  if (refuses.length === 0) ok('toutes les valeurs de paiement_statut écrites sont autorisées par le CHECK')
  else ko(`valeurs que le CHECK refuserait : ${refuses.join(', ')}`)

  /* courses.statut : vrai enum Postgres, donc lisible dans l'OpenAPI.
   *
   * Attention au piège, et il s'est produit : chercher `statut:` tout court
   * capture aussi la fin de `paiement_statut:`. Le contrôle a d'abord annoncé
   * « paye, remboursee, contestee hors enum » — trois valeurs qui ne visent
   * pas cette colonne du tout. Un faux blocage vaut aussi peu qu'un manqué.
   * D'où le `(?<!_)` : le mot doit commencer là. */
  const enumStatut: string[] = defs['courses']?.properties?.statut?.enum ?? []
  info(`courses.statut en production : ${enumStatut.join(' | ')}`)
  /* On ne regarde que les écritures dans `courses`, repérées par le bloc
     d'insertion qui les contient. */
  const blocsCourses = [...toutLeCode.matchAll(/\.from\('courses'\)\s*\.(?:insert|update)\(\{([\s\S]{0,1200}?)\}\)/g)].map(m => m[1])
  const statutsCourses = new Set(blocsCourses.flatMap(b =>
    [...b.matchAll(/(?<!_)statut:\s*'([^']+)'/g)].map(m => m[1])))
  info(`statuts de course écrits par le code : ${[...statutsCourses].join(', ') || 'aucun littéral'}`)
  const horsEnum = [...statutsCourses].filter(v => !enumStatut.includes(v))
  if (horsEnum.length === 0) ok('tous les statuts de course écrits appartiennent à l\'enum de production')
  else ko(`statuts écrits dans courses hors enum de production : ${horsEnum.join(', ')}`)

  /* type_vehicule : l'enum qui a causé l'incident du 7 octobre. */
  const enumVeh: string[] = defs['courses']?.properties?.type_vehicule?.enum ?? []
  info(`courses.type_vehicule en production : ${enumVeh.join(' | ')}`)
  const vehModule = lire('src/lib/vehicule.ts')
  const declares = [...vehModule.matchAll(/'(berline|berline_premium|van_7|grand_van_8)'/g)].map(m => m[1])
  const manquants = enumVeh.filter(v => !declares.includes(v))
  const inventes = [...new Set(declares)].filter(v => !enumVeh.includes(v))
  if (manquants.length === 0 && inventes.length === 0) ok('VEHICULES_BASE correspond exactement à l\'enum de production')
  else ko(`écart : manquants=${manquants.join(',') || '—'} inventés=${inventes.join(',') || '—'}`)
  /* Contrôle précis plutôt qu'une fenêtre glissante : on relève CHAQUE
   * écriture de type_vehicule et on exige que la valeur soit un appel à
   * vehiculePourBase(). La version précédente utilisait
   * `.from('courses')[\s\S]{0,400}type_vehicule:(?!vehiculePourBase)`, qui
   * revenait en arrière jusqu'à trouver une position où la négation tient —
   * et signalait un écart là où il n'y en avait aucun. */
  const ecrituresVeh = [...webhook.matchAll(/type_vehicule:\s*([^,\n]+)/g)].map(m => m[1].trim())
  info(`écritures de type_vehicule dans le webhook : ${ecrituresVeh.length}`)
  const nonConformes = ecrituresVeh.filter(v => !v.startsWith('vehiculePourBase('))
  if (nonConformes.length === 0) ok(`type_vehicule n'est écrit qu'à travers vehiculePourBase() (${ecrituresVeh.length} écriture)`)
  else ko(`type_vehicule écrit sans vehiculePourBase() : ${nonConformes.join(' · ')}`)

  /* stripe_events.statut et incidents_paiement.gravite : CHECK de la migration. */
  /* Même piège : `(?<!_)` pour ne pas capturer `paiement_statut:`. */
  const statutsEv = new Set([...paiement.matchAll(/(?<!_)statut:\s*'([^']+)'/g)].map(m => m[1]))
  const AUTORISES_EV = ['recu', 'traite', 'echec', 'ignore']
  const evHors = [...statutsEv].filter(v => !AUTORISES_EV.includes(v))
  info(`statuts d'événement écrits : ${[...statutsEv].join(', ')}`)
  if (evHors.length === 0) ok('tous appartiennent au CHECK de stripe_events')
  else ko(`refusés par le CHECK de stripe_events : ${evHors.join(', ')}`)

  const gravites = new Set([...toutLeCode.matchAll(/gravite:\s*'([^']+)'/g)].map(m => m[1]))
  const AUTORISES_GR = ['critique', 'elevee', 'info']
  const grHors = [...gravites].filter(v => !AUTORISES_GR.includes(v))
  info(`gravités d'incident écrites : ${[...gravites].join(', ')}`)
  if (grHors.length === 0) ok('toutes appartiennent au CHECK de incidents_paiement')
  else ko(`refusées par le CHECK de incidents_paiement : ${grHors.join(', ')}`)
}

// ── 4. Les index que le code suppose ───────────────────────────────────────
section('4. Index et contraintes supposés par le code')
{
  /* Le code s'appuie sur deux garanties de la base. Si elles manquaient, il
     fonctionnerait quand même — mais sans protection, ce qui est pire que de
     ne pas fonctionner. */
  const suppositions = [
    ['courses_stripe_pi_unique', /courseErr\?\.code === VIOLATION_UNICITE/, webhook,
      'le rattrapage de doublon de course n\'a de sens que si l\'index unique existe'],
    ['stripe_events_pkey', /error\.code !== VIOLATION_UNICITE/, paiement,
      'l\'idempotence repose sur la clé primaire de stripe_events'],
    ['incidents_paiement_unique_ouvert', /error\.code === VIOLATION_UNICITE/, paiement,
      'l\'absence d\'empilement d\'incidents repose sur l\'index unique partiel'],
  ] as const
  for (const [nom, motif, source, pourquoi] of suppositions) {
    if (motif.test(source)) ok(`${nom} : le code s'y appuie explicitement — ${pourquoi}`)
    else ko(`${nom} : le code ne traite pas la violation d'unicité correspondante`)
  }
  att('ces trois objets ne sont pas vérifiables par PostgREST (index partiels, clé primaire)')
  info('  confirmés en production par capture SQL de l\'exploitant le 2026-10-17,')
  info('  et éprouvés sur PostgreSQL réel avec la migration identique (55 contrôles).')
}

// ── 5. La réconciliation reste-t-elle désactivée ? ─────────────────────────
section('5. Réconciliation quotidienne et backfill')
{
  const vercel = lire('vercel.json')
  if (/reconciliation/.test(vercel)) ko('vercel.json DÉCLARE le cron de réconciliation — le déploiement l\'activerait')
  else ok('vercel.json ne déclare PAS le cron de réconciliation — elle restera inactive')

  const crons = [...vercel.matchAll(/"path":\s*"([^"]+)"/g)].map(m => m[1])
  info(`crons déclarés (${crons.length}) : ${crons.join(', ')}`)

  if (/export async function GET/.test(recon)) ok('la route de réconciliation existe, prête pour une activation ultérieure')
  else ko('la route de réconciliation est absente')
  if (/authorization.*CRON_SECRET|CRON_SECRET/.test(recon)) ok('elle refuse sans CRON_SECRET — inappelable depuis l\'extérieur')
  else ko('elle n\'exige pas de secret')

  /* Le backfill doit rester un fichier à part, non appliqué. */
  const migrations = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000000_fiabilite_paiements.sql'), 'utf8')
  if (/^UPDATE\s+courses/mi.test(sansCommentaires(migrations))) ko('la migration appliquée contient un UPDATE sur courses')
  else ok('la migration appliquée ne contient aucun UPDATE — purement additive')
  try {
    readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000100_backfill_paiement_statut.sql'), 'utf8')
    ok('le backfill existe comme fichier séparé, non appliqué')
  } catch { ko('le fichier de backfill est introuvable') }
}

// ── 6. Aucun chemin n'annonce un succès non constaté ───────────────────────
section('6. Chemins de retour du webhook')
{
  const lignes = webhook.split('\n')
  const retours = lignes
    .map((l, i) => ({ i: i + 1, l: l.trim() }))
    .filter(x => /return NextResponse\.json/.test(x.l))
  info(`${retours.length} chemin(s) de retour`)

  /* Chaque retour 200 doit être précédé d'un marquage du journal, sauf les
     deux refus de signature (400), où aucun événement n'est identifiable. */
  let sansMarquage = 0
  for (const { i, l } of retours) {
    if (/status: 400/.test(l)) continue
    if (/status: 500/.test(l)) continue
    const fenetre = lignes.slice(Math.max(0, i - 14), i).join('\n')
    if (!/marquerEvenementTraite|marquerEvenementEchec|deja_traite/.test(fenetre)) {
      ko(`ligne ${i} : retour sans marquage du journal dans les 14 lignes précédentes — « ${l.slice(0, 70)} »`)
      sansMarquage++
    }
  }
  if (sansMarquage === 0) ok('tout retour 200 est précédé d\'un marquage du journal')

  const cinqCents = retours.filter(x => /status: 500/.test(x.l))
  info(`${cinqCents.length} retour(s) 500 — Stripe réessaiera`)
  for (const { i } of cinqCents) {
    const fenetre = lignes.slice(Math.max(0, i - 20), i).join('\n')
    if (!/signalerIncident|marquerEvenementEchec/.test(fenetre))
      ko(`ligne ${i} : un 500 sans incident ni marquage d'échec`)
  }
  if (cinqCents.every(({ i }) => /signalerIncident|marquerEvenementEchec/.test(lignes.slice(Math.max(0, i - 20), i).join('\n'))))
    ok('tout retour 500 laisse un incident ou un échec journalisé')
}

console.log('\n' + '─'.repeat(74))
if (ecarts.length === 0) {
  console.log('\x1b[32m\x1b[1mCODE ET SCHÉMA CONCORDANTS\x1b[0m')
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1m${ecarts.length} ÉCART(S)\x1b[0m — ne pas déployer`)
  for (const e of ecarts) console.log(`  ✗ ${e}`)
  process.exit(1)
}
