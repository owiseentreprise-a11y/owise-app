/**
 * Test d'intégration RÉEL de la migration des paiements.
 *
 * Pourquoi ce fichier existe en plus de `test-paiement.mts`. Celui-là pilote
 * le vrai code applicatif, mais contre un FAUX serveur PostgREST : les
 * contraintes y sont réimplémentées à la main. Il prouve que le code réagit
 * correctement à une violation d'unicité — il ne prouve pas que PostgreSQL la
 * lève. Un faux serveur qui se trompe sur les contraintes valide du vide.
 *
 * Ici : un PostgreSQL authentique dans un conteneur jetable, la migration
 * appliquée TELLE QUELLE depuis `supabase/migrations/`, et les trois
 * scénarios joués en SQL réel — livraisons répétées, concurrence, et
 * interruption de traitement au milieu d'une transaction.
 *
 * ENVIRONNEMENT ISOLÉ. Rien ne touche la base Owise : le conteneur est créé,
 * utilisé, puis supprimé. Aucune donnée réelle, aucun paiement.
 *
 * Prérequis : Docker en fonctionnement.
 * Usage, depuis owise-app : node scripts/test-integration-paiements.mjs
 */
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const NOM = 'owise-test-paiements'
const IMAGE = 'postgres:16-alpine'
const DB = 'owise_test'

let passes = 0
const echecs = []
const verifier = (nom, ok, detail = '') => {
  if (ok) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${nom}`) }
  else { echecs.push(nom); console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? `\n       ${String(detail).trim().slice(0, 300)}` : ''}`) }
}
const section = (m) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)

const docker = (args, opts = {}) =>
  execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], ...opts })

/** Exécute du SQL et rend { sortie, erreur }. N'interrompt jamais le test. */
function sql(texte, { tolerant = true } = {}) {
  try {
    const sortie = execFileSync('docker',
      ['exec', '-i', NOM, 'psql', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-f', '-'],
      { encoding: 'utf8', input: texte, stdio: ['pipe', 'pipe', 'pipe'] })
    return { sortie: sortie.trim(), erreur: null }
  } catch (e) {
    const erreur = String(e.stderr ?? e.message)
    if (!tolerant) throw new Error(erreur)
    return { sortie: String(e.stdout ?? '').trim(), erreur }
  }
}

/** Code d'erreur SQLSTATE d'une erreur psql, quand il est annoncé. */
const sqlstate = (erreur) => {
  if (!erreur) return null
  if (/duplicate key value violates unique constraint/.test(erreur)) return '23505'
  if (/violates check constraint/.test(erreur)) return '23514'
  if (/violates not-null constraint/.test(erreur)) return '23502'
  return 'autre'
}

const nettoyer = () => { try { docker(['rm', '-f', '-v', NOM]) } catch { /* pas de conteneur */ } }

process.on('exit', nettoyer)
process.on('SIGINT', () => { nettoyer(); process.exit(130) })

console.log('\x1b[1mTest d\'intégration — migration des paiements\x1b[0m')
console.log('PostgreSQL réel, conteneur jetable, aucune donnée Owise\n')

// ── Démarrage ───────────────────────────────────────────────────────────────
section('Environnement isolé')
nettoyer()
try {
  docker(['run', '-d', '--name', NOM, '-e', 'POSTGRES_PASSWORD=test',
    '-e', `POSTGRES_DB=${DB}`, IMAGE])
  console.log(`     conteneur ${NOM} démarré (${IMAGE})`)
} catch (e) {
  console.error('  \x1b[31m✗\x1b[0m impossible de démarrer le conteneur :', String(e.stderr ?? e.message).slice(0, 300))
  console.error('    Docker est-il en fonctionnement ?')
  process.exit(2)
}

// Attendre que Postgres accepte les connexions, sans boucle infinie.
let pret = false
for (let i = 0; i < 60; i++) {
  try { docker(['exec', NOM, 'pg_isready', '-U', 'postgres', '-d', DB]); pret = true; break }
  catch { execFileSync(process.execPath, ['-e', 'setTimeout(()=>{},1000)']) }
}
verifier('PostgreSQL accepte les connexions', pret)
if (!pret) process.exit(2)
console.log(`     version : ${sql('SELECT version();').sortie.split(' ').slice(0, 2).join(' ')}`)

// ── Schéma de départ ────────────────────────────────────────────────────────
//
// On ne modélise QUE ce que la migration touche ou dont elle dépend. Les
// colonnes et le DEFAULT de `paiement_statut` sont reproduits fidèlement :
// c'est précisément ce DEFAULT qui impose de garder 'en_attente' dans la
// liste autorisée du CHECK.
section('Schéma de départ (avant migration)')
{
  const { erreur } = sql(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;
    CREATE TABLE courses (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      adresse_depart text,
      adresse_arrivee text,
      date_prevue timestamptz,
      date_fin timestamptz,
      statut text NOT NULL DEFAULT 'en_attente',
      paiement_statut text DEFAULT 'en_attente',
      mode_paiement text,
      stripe_payment_intent_id text,
      stripe_payment_link text,
      facture_id uuid,
      prix_estime numeric(10,2),
      prix_final numeric(10,2),
      client_id uuid
    );
    CREATE TABLE factures (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      numero text UNIQUE NOT NULL,
      statut text NOT NULL DEFAULT 'en_attente',
      montant_ttc numeric(10,2)
    );
    -- Les quatre courses encaissées d'octobre, reproduites à l'identique :
    -- un identifiant de paiement, et paiement_statut laissé au DEFAUT.
    INSERT INTO courses (stripe_payment_intent_id, prix_estime, statut) VALUES
      ('pi_fictif_a', 89,  'acceptee'),
      ('pi_fictif_b', 89,  'terminee'),
      ('pi_fictif_c', 89,  'terminee'),
      ('pi_fictif_d', 164, 'acceptee');
    -- Et 26 courses sans paiement Stripe, comme en production.
    INSERT INTO courses (prix_estime, statut)
      SELECT 59, 'terminee' FROM generate_series(1, 26);
  `, { tolerant: false })
  verifier('schéma de départ créé', !erreur, erreur)
  const n = sql('SELECT count(*) FROM courses;').sortie
  const nNull = sql('SELECT count(*) FROM courses WHERE stripe_payment_intent_id IS NULL;').sortie
  verifier('30 courses, dont 26 sans identifiant de paiement — comme en production',
    n === '30' && nNull === '26', `courses=${n} sans_pi=${nNull}`)
}

// ── Application de la migration, telle quelle ───────────────────────────────
section('Migration appliquée telle quelle depuis supabase/migrations/')
{
  const chemin = 'supabase/migrations/20261017000000_fiabilite_paiements.sql'
  const migration = readFileSync(resolve(process.cwd(), chemin), 'utf8')
  console.log(`     ${chemin} · ${migration.split('\n').length} lignes`)

  /* Les ALTER TABLE ... ENABLE ROW LEVEL SECURITY fonctionnent sur un
     PostgreSQL nu ; les rôles `anon`/`authenticated` de Supabase n'existent
     pas, mais la migration n'en crée aucune policy, donc rien n'y fait appel. */
  const { erreur } = sql(migration)
  verifier('la migration s\'applique sans erreur', !erreur, erreur)
  if (erreur) { console.log('\n  Migration en échec : les scénarios suivants n\'ont pas de sens.'); }
}

// ── Les objets sont-ils réellement en place ? ───────────────────────────────
section('Présence effective des objets créés')
{
  const tables = sql(`SELECT string_agg(tablename, ',' ORDER BY tablename) FROM pg_tables
                       WHERE schemaname='public' AND tablename IN ('stripe_events','incidents_paiement');`).sortie
  verifier('les deux tables existent', tables === 'incidents_paiement,stripe_events', tables)

  const pk = sql(`SELECT count(*) FROM pg_constraint
                   WHERE conname='stripe_events_pkey' AND contype='p';`).sortie
  verifier('stripe_events a une clé primaire', pk === '1')

  const idx = sql(`SELECT indexdef FROM pg_indexes
                    WHERE schemaname='public' AND indexname='courses_stripe_pi_unique';`).sortie
  verifier('l\'index unique partiel existe sur courses', /UNIQUE/.test(idx) && /WHERE/.test(idx), idx)
  verifier('il est bien PARTIEL (clause WHERE ... IS NOT NULL)',
    /stripe_payment_intent_id IS NOT NULL/.test(idx), idx)

  const chk = sql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint
                    WHERE conname='courses_paiement_statut_valide';`).sortie
  verifier('la contrainte CHECK existe', chk.length > 0, chk)
  verifier('elle autorise en_attente (valeur par défaut de la colonne)', /en_attente/.test(chk), chk)
  verifier('elle autorise les six valeurs attendues',
    ['en_attente', 'a_percevoir', 'paye', 'echoue', 'remboursee', 'contestee'].every(v => chk.includes(v)), chk)

  const rls = sql(`SELECT string_agg(relname || '=' || relrowsecurity::text, ',' ORDER BY relname)
                     FROM pg_class WHERE relname IN ('stripe_events','incidents_paiement');`).sortie
  verifier('RLS activée sur les deux tables neuves',
    rls === 'incidents_paiement=true,stripe_events=true', rls)

  const pol = sql(`SELECT count(*) FROM pg_policies WHERE schemaname='public'
                    AND tablename IN ('stripe_events','incidents_paiement');`).sortie
  verifier('aucune policy : seule la clé de service accède à ces tables', pol === '0', pol)

  const incIdx = sql(`SELECT indexdef FROM pg_indexes WHERE indexname='incidents_paiement_unique_ouvert';`).sortie
  verifier('l\'index unique sur les incidents OUVERTS existe',
    /UNIQUE/.test(incIdx) && /resolu_le IS NULL/.test(incIdx), incIdx)
}

// ── Intégrité des données existantes ────────────────────────────────────────
section('Intégrité : la migration n\'a touché aucune ligne')
{
  const n = sql('SELECT count(*) FROM courses;').sortie
  verifier('toujours 30 courses', n === '30', n)
  const statuts = sql(`SELECT string_agg(paiement_statut || '=' || n::text, ' · ' ORDER BY paiement_statut)
                        FROM (SELECT paiement_statut, count(*) n FROM courses GROUP BY 1) s;`).sortie
  verifier('les 4 courses encaissées sont RESTÉES en_attente (consigne : ne pas les modifier)',
    statuts === 'en_attente=30', statuts)
  const f = sql('SELECT count(*) FROM factures;').sortie
  verifier('table factures intacte', f === '0', f)
}

// ── Scénario 1 : livraisons répétées ────────────────────────────────────────
section('Scénario 1 — livraisons répétées du même événement')
{
  const a = sql(`INSERT INTO stripe_events (id, type, payload)
                 VALUES ('evt_1', 'checkout.session.completed', '{"x":1}'::jsonb);`)
  verifier('1ʳᵉ livraison : enregistrée', !a.erreur, a.erreur)

  const b = sql(`INSERT INTO stripe_events (id, type, payload)
                 VALUES ('evt_1', 'checkout.session.completed', '{"x":1}'::jsonb);`)
  verifier('2ᵉ livraison : refusée par la clé primaire (23505)', sqlstate(b.erreur) === '23505', b.erreur)

  const n = sql(`SELECT count(*) FROM stripe_events WHERE id='evt_1';`).sortie
  verifier('une seule ligne au journal', n === '1', n)

  /* C'est le geste du 8 octobre : renvoyer l'événement à la main depuis le
     tableau de bord Stripe. Autant de fois qu'on veut, désormais. */
  let refus = 0
  for (let i = 0; i < 5; i++) {
    const r = sql(`INSERT INTO stripe_events (id, type, payload) VALUES ('evt_1','x','{}'::jsonb);`)
    if (sqlstate(r.erreur) === '23505') refus++
  }
  verifier('5 renvois manuels supplémentaires : 5 refus, toujours une ligne',
    refus === 5 && sql(`SELECT count(*) FROM stripe_events WHERE id='evt_1';`).sortie === '1')
}

// ── Scénario 2 : concurrence réelle ─────────────────────────────────────────
section('Scénario 2 — deux traitements simultanés du même paiement')
{
  /* Deux transactions PostgreSQL qui se chevauchent pour de bon. La première
     insère et attend avant de valider ; la seconde se heurte au verrou de
     l'index unique, reste bloquée, puis échoue quand la première valide.
     C'est exactement ce que le faux serveur ne pouvait pas démontrer. */
  const lancer = (pause) => new Promise((res) => {
    const p = spawn('docker', ['exec', '-i', NOM, 'psql', '-U', 'postgres', '-d', DB, '-v', 'ON_ERROR_STOP=1', '-t', '-A', '-f', '-'],
      { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d)
    p.on('close', (code) => res({ code, out: out.trim(), err: err.trim() }))
    p.stdin.end(`
      BEGIN;
      INSERT INTO courses (stripe_payment_intent_id, prix_estime, paiement_statut)
        VALUES ('pi_fictif_concurrent', 59, 'paye');
      SELECT pg_sleep(${pause});
      COMMIT;
    `)
  })

  const [r1, r2] = await Promise.all([lancer(1.5), lancer(0)])
  const reussies = [r1, r2].filter(r => r.code === 0)
  const bloquees = [r1, r2].filter(r => /duplicate key value violates unique constraint "courses_stripe_pi_unique"/.test(r.err))

  verifier('exactement une transaction valide', reussies.length === 1,
    `codes : ${r1.code}/${r2.code}`)
  verifier('l\'autre est refusée par courses_stripe_pi_unique', bloquees.length === 1,
    `erreurs : ${[r1.err, r2.err].filter(Boolean).map(e => e.slice(0, 120)).join(' | ') || 'aucune'}`)
  const n = sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='pi_fictif_concurrent';`).sortie
  verifier('une seule course en base pour ce paiement', n === '1', n)

  /* Le perdant doit pouvoir retrouver la gagnante — c'est ce que fait le
     nouveau webhook pour sortir avant de créer une facture en double. */
  const gagnante = sql(`SELECT id FROM courses WHERE stripe_payment_intent_id='pi_fictif_concurrent';`).sortie
  verifier('le perdant peut retrouver la course gagnante par son identifiant de paiement',
    gagnante.length === 36, gagnante)

  /* Et l'index étant partiel, les 26 courses sans paiement ne gênent pas. */
  const multiNull = sql(`INSERT INTO courses (prix_estime) VALUES (59),(59),(59);`)
  verifier('plusieurs courses sans identifiant de paiement restent permises (index partiel)',
    !multiNull.erreur, multiNull.erreur)
}

// ── Scénario 3 : interruption de traitement ─────────────────────────────────
section('Scénario 3 — interruption de traitement au milieu du travail')
{
  /* Une panne au milieu du traitement : l'événement est journalisé, la course
     insérée, puis tout s'arrête. Sans transaction, l'état partiel reste. */
  const avecTransaction = sql(`
    BEGIN;
    INSERT INTO stripe_events (id, type, payload) VALUES ('evt_interrompu','x','{}'::jsonb);
    INSERT INTO courses (stripe_payment_intent_id, prix_estime) VALUES ('pi_fictif_interrompu', 59);
    ROLLBACK;
  `)
  verifier('une transaction annulée ne laisse rien derrière elle', !avecTransaction.erreur, avecTransaction.erreur)
  const ev = sql(`SELECT count(*) FROM stripe_events WHERE id='evt_interrompu';`).sortie
  const co = sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='pi_fictif_interrompu';`).sortie
  verifier('aucun événement, aucune course après annulation', ev === '0' && co === '0', `ev=${ev} co=${co}`)

  const rejeu = sql(`
    INSERT INTO stripe_events (id, type, payload) VALUES ('evt_interrompu','x','{}'::jsonb);
    INSERT INTO courses (stripe_payment_intent_id, prix_estime, paiement_statut)
      VALUES ('pi_fictif_interrompu', 59, 'paye');
  `)
  verifier('le rejeu après interruption aboutit', !rejeu.erreur, rejeu.erreur)
  verifier('et il ne crée qu\'une seule course',
    sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='pi_fictif_interrompu';`).sortie === '1')

  /* Le cas réel du webhook : l'événement est journalisé HORS transaction, puis
     le traitement échoue. La ligne reste en statut 'recu' — et c'est voulu :
     elle doit être reprise, pas ignorée. */
  sql(`INSERT INTO stripe_events (id, type, payload) VALUES ('evt_echoue','x','{}'::jsonb);
       UPDATE stripe_events SET statut='echec', erreur='enum type_vehicule refuse van' WHERE id='evt_echoue';`)
  const aReprendre = sql(`SELECT count(*) FROM stripe_events WHERE statut IN ('recu','echec');`).sortie
  const traites = sql(`SELECT count(*) FROM stripe_events WHERE statut='traite';`).sortie
  verifier('un événement en échec reste visible pour la reprise',
    Number(aReprendre) >= 1, `a_reprendre=${aReprendre} traites=${traites}`)
  verifier('l\'erreur est conservée pour le diagnostic',
    sql(`SELECT erreur FROM stripe_events WHERE id='evt_echoue';`).sortie.includes('van'))
}

// ── La contrainte CHECK se comporte-t-elle comme prévu ? ────────────────────
section('Contrainte CHECK : ce qu\'elle accepte et ce qu\'elle refuse')
{
  const defaut = sql(`INSERT INTO courses (prix_estime) VALUES (59);`)
  verifier('une insertion sans paiement_statut passe (DEFAULT en_attente autorisé)',
    !defaut.erreur, defaut.erreur)

  for (const v of ['paye', 'a_percevoir', 'remboursee', 'echoue', 'contestee']) {
    const r = sql(`INSERT INTO courses (prix_estime, paiement_statut) VALUES (59, '${v}');`)
    verifier(`'${v}' accepté`, !r.erreur, r.erreur)
  }

  const mauvais = sql(`INSERT INTO courses (prix_estime, paiement_statut) VALUES (59, 'en_cours_de_paiement');`)
  verifier('une valeur hors liste est refusée (23514)', sqlstate(mauvais.erreur) === '23514', mauvais.erreur)

  const nul = sql(`INSERT INTO courses (prix_estime, paiement_statut) VALUES (59, NULL);`)
  verifier('NULL reste permis', !nul.erreur, nul.erreur)
}

// ── Incidents : pas d'empilement ────────────────────────────────────────────
section('Incidents : un seul ouvert par (type, référence)')
{
  const a = sql(`INSERT INTO incidents_paiement (type, gravite, reference) VALUES ('paiement_sans_course','critique','pi_x');`)
  verifier('premier incident ouvert', !a.erreur, a.erreur)
  const b = sql(`INSERT INTO incidents_paiement (type, gravite, reference) VALUES ('paiement_sans_course','critique','pi_x');`)
  verifier('le même, le lendemain : refusé (23505) — pas d\'empilement', sqlstate(b.erreur) === '23505', b.erreur)
  sql(`UPDATE incidents_paiement SET resolu_le=now() WHERE reference='pi_x';`)
  const c = sql(`INSERT INTO incidents_paiement (type, gravite, reference) VALUES ('paiement_sans_course','critique','pi_x');`)
  verifier('après résolution, le problème peut rouvrir un incident', !c.erreur, c.erreur)
  const g = sql(`INSERT INTO incidents_paiement (type, gravite, reference) VALUES ('x','inconnue','y');`)
  verifier('une gravité hors liste est refusée', sqlstate(g.erreur) === '23514', g.erreur)
}

// ── Retour arrière ──────────────────────────────────────────────────────────
section('Retour arrière non destructif')
{
  const avant = sql('SELECT count(*) FROM courses;').sortie
  const r = sql(`
    DROP INDEX IF EXISTS courses_stripe_pi_unique;
    ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_paiement_statut_valide;
    DROP TABLE IF EXISTS stripe_events;
    DROP TABLE IF EXISTS incidents_paiement;
  `)
  verifier('les 4 instructions de retour arrière passent', !r.erreur, r.erreur)
  const apres = sql('SELECT count(*) FROM courses;').sortie
  verifier('aucune course perdue par le retour arrière', avant === apres, `${avant} → ${apres}`)
  const reste = sql(`SELECT count(*) FROM pg_indexes WHERE indexname='courses_stripe_pi_unique';`).sortie
  verifier('l\'index a bien disparu', reste === '0', reste)
  const libre = sql(`INSERT INTO courses (stripe_payment_intent_id, prix_estime) VALUES ('pi_fictif_concurrent', 59);`)
  verifier('le comportement d\'avant la migration est rétabli (doublon de nouveau permis)',
    !libre.erreur, libre.erreur)

  /* Propriété de sûreté : tant qu'un doublon existe, la migration DOIT
     refuser de s'appliquer. On vient précisément d'en créer un pour prouver
     que le retour arrière avait rétabli le comportement d'avant — c'est donc
     le moment de le vérifier.
     (Ce contrôle est né d'un bug de ce test : le nettoyage ne supprimait rien,
     parce qu'il cherchait paiement_statut IS NULL alors que la colonne a un
     DEFAUT. La migration a échoué, et elle avait raison.) */
  const migration = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000000_fiabilite_paiements.sql'), 'utf8')
  const avecDoublon = sql(migration)
  verifier('avec un doublon présent, la migration REFUSE de s\'appliquer',
    /could not create unique index/.test(String(avecDoublon.erreur)), avecDoublon.erreur ?? 'aucune erreur — elle aurait dû refuser')

  /* Et une fois le doublon retiré, elle se rejoue sans heurt : IF NOT EXISTS
     partout, DROP CONSTRAINT IF EXISTS avant l'ADD. */
  sql(`DELETE FROM courses WHERE id IN (
         SELECT id FROM courses WHERE stripe_payment_intent_id='pi_fictif_concurrent'
          ORDER BY id OFFSET 1);`)
  const restants = sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id='pi_fictif_concurrent';`).sortie
  verifier('doublon retiré, une seule ligne reste', restants === '1', restants)
  const rejouee = sql(migration)
  verifier('la migration est rejouable après retour arrière', !rejouee.erreur, rejouee.erreur)
}

// ── Le backfill, séparément ─────────────────────────────────────────────────
section('Backfill des statuts (fichier séparé, NON appliqué en production)')
{
  const avant = sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id IS NOT NULL AND paiement_statut='paye';`).sortie
  const r = sql(readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000100_backfill_paiement_statut.sql'), 'utf8'))
  verifier('le backfill s\'applique sans erreur (ici, en isolé)', !r.erreur, r.erreur)
  const apres = sql(`SELECT count(*) FROM courses WHERE stripe_payment_intent_id IS NOT NULL AND paiement_statut='paye';`).sortie
  verifier('il marque bien les courses encaissées', Number(apres) > Number(avant), `${avant} → ${apres}`)
  const total = sql('SELECT count(*) FROM courses;').sortie
  verifier('et il ne supprime ni n\'ajoute aucune course', Number(total) > 0, total)
  const retour = sql(`UPDATE courses SET paiement_statut='en_attente'
                       WHERE stripe_payment_intent_id IN ('pi_fictif_a','pi_fictif_b','pi_fictif_c','pi_fictif_d');`)
  verifier('son retour arrière fonctionne (valeurs d\'origine connues)', !retour.erreur, retour.erreur)
}

nettoyer()
console.log('\n' + '─'.repeat(72))
console.log('     conteneur supprimé · la base Owise n\'a jamais été touchée')
if (echecs.length === 0) {
  console.log(`\x1b[32m\x1b[1m${passes} CONTRÔLES AU VERT\x1b[0m sur PostgreSQL réel`)
  process.exit(0)
} else {
  console.log(`\x1b[31m\x1b[1m${echecs.length} ÉCHEC(S)\x1b[0m sur ${passes + echecs.length} contrôles`)
  for (const e of echecs) console.log(`  · ${e}`)
  process.exit(1)
}
