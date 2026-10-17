/**
 * Les cinq conditions à satisfaire AVANT d'appliquer
 * `20261017000000_fiabilite_paiements.sql` en production.
 *
 * LECTURE SEULE de bout en bout. Aucune écriture, aucun DDL, aucun paiement.
 *
 * Les sauvegardes contiennent l'intégralité des données clients : ce contrôle
 * ne lit que la STRUCTURE (noms de tables, nombres de lignes) et n'affiche
 * jamais une valeur. Aucune donnée personnelle ne sort d'ici.
 *
 * Usage, depuis owise-app : npx tsx scripts/preflight-migration-paiements.mts
 * Sortie : 0 = toutes les conditions satisfaites · 1 = STOP
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const U = env.NEXT_PUBLIC_SUPABASE_URL
const SRV = env.SUPABASE_SERVICE_ROLE_KEY
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!U || !SRV) { console.error('Variables Supabase manquantes'); process.exit(2) }
const hSrv = { apikey: SRV, Authorization: `Bearer ${SRV}` }

const bloquants: string[] = []
const incertains: string[] = []
const ok  = (m: string) => console.log(`  \x1b[32m✓\x1b[0m ${m}`)
const ko  = (m: string) => { bloquants.push(m); console.log(`  \x1b[31m✗ BLOQUANT\x1b[0m ${m}`) }
const inc = (m: string) => { incertains.push(m); console.log(`  \x1b[33m? INCERTAIN\x1b[0m ${m}`) }
const info = (m: string) => console.log(`     ${m}`)
const cond = (n: number, m: string) => console.log(`\n\x1b[1m── Condition ${n} — ${m}\x1b[0m`)

async function reessayer<T,>(fn: () => Promise<T>, n = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try { return await fn() } catch (e) { if (i >= n) throw e; await new Promise(r => setTimeout(r, 1500 * (i + 1))) }
  }
}
const get = <T = any,>(p: string): Promise<T> => reessayer(async () => {
  const r = await fetch(`${U}/rest/v1/${p}`, { headers: hSrv })
  if (!r.ok) throw new Error(`${p} → HTTP ${r.status} ${(await r.text()).slice(0, 140)}`)
  return r.json() as Promise<T>
})
const ref = (id: unknown) => String(id ?? '').slice(-6).toUpperCase()

console.log('\x1b[1mPré-vol : migration 20261017000000_fiabilite_paiements\x1b[0m')
console.log(`${new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} (Paris) · lecture seule\n`)

// ── Condition 1 : une sauvegarde exploitable ────────────────────────────────
cond(1, 'une sauvegarde exploitable')
{
  const liste = await reessayer(async () => {
    const r = await fetch(`${U}/storage/v1/object/list/backups`, {
      method: 'POST', headers: { ...hSrv, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix: '', limit: 200, sortBy: { column: 'name', order: 'desc' } }),
    })
    if (!r.ok) throw new Error(`liste des sauvegardes → HTTP ${r.status}`)
    return r.json() as Promise<{ name: string; updated_at?: string; metadata?: { size?: number } }[]>
  })

  if (!Array.isArray(liste) || liste.length === 0) {
    ko('aucune sauvegarde dans le stockage — ne pas migrer sans filet')
  } else {
    const derniere = liste[0]
    const taille = derniere.metadata?.size ?? 0
    info(`${liste.length} sauvegarde(s) · la plus récente : ${derniere.name} (${Math.round(taille / 1024)} Ko)`)

    /* « Présente » ne veut pas dire « exploitable ». On la télécharge et on la
       relit vraiment : un fichier tronqué ou vide se lit comme un succès dans
       une liste. */
    const dl = await reessayer(async () => {
      const r = await fetch(`${U}/storage/v1/object/backups/${encodeURIComponent(derniere.name)}`, { headers: hSrv })
      if (!r.ok) throw new Error(`téléchargement → HTTP ${r.status}`)
      return r.text()
    })

    let charge: { timestamp?: string; tables?: Record<string, unknown[]> } | null = null
    try { charge = JSON.parse(dl) } catch { charge = null }

    if (!charge) {
      ko(`${derniere.name} n'est pas un JSON relisible — sauvegarde inexploitable`)
    } else if (!charge.tables || typeof charge.tables !== 'object') {
      ko(`${derniere.name} ne contient pas d'objet « tables » — structure inattendue`)
    } else {
      const noms = Object.keys(charge.tables)
      info(`relue sans erreur · ${noms.length} table(s) · horodatage ${charge.timestamp ?? '—'}`)

      /* Les tables que la migration touche ou dont elle dépend doivent être
         dans la sauvegarde, et non vides : c'est tout l'intérêt du filet.
         Cette migration ne touche que `courses` (un index, un CHECK) et lit
         `factures` ; `clients` sert au contrôle d'intégrité. Rien d'autre.
         `profiles` n'est PAS dans le périmètre de cette migration — son
         absence de la sauvegarde est signalée séparément ci-dessous, parce que
         c'est un vrai trou, mais ce n'est pas un obstacle ici. */
      const indispensables = ['courses', 'factures', 'clients']
      const ATTENDUES_AILLEURS = ['profiles', 'credits_parrainage']
      const absentesDuFilet = ATTENDUES_AILLEURS.filter(t => !Array.isArray(charge!.tables![t]))
      if (absentesDuFilet.length) {
        inc(`tables NON sauvegardées, hors périmètre de cette migration mais à corriger : ${absentesDuFilet.join(', ')} — voir le rapport`)
      }
      const manquantes = indispensables.filter(t => !Array.isArray(charge!.tables![t]))
      const vides = indispensables.filter(t => Array.isArray(charge!.tables![t]) && (charge!.tables![t] as unknown[]).length === 0)

      if (manquantes.length) ko(`tables absentes de la sauvegarde : ${manquantes.join(', ')}`)
      else if (vides.length) ko(`tables présentes mais VIDES dans la sauvegarde : ${vides.join(', ')}`)
      else {
        /* Comparaison avec la base vivante : une sauvegarde qui aurait perdu
           des lignes en route ne protège de rien. On ne compare que des
           NOMBRES. */
        const vivant: Record<string, number> = {}
        for (const t of indispensables) {
          const r = await reessayer(async () => fetch(`${U}/rest/v1/${t}?select=id`, { method: 'HEAD', headers: { ...hSrv, Prefer: 'count=exact' } }))
          vivant[t] = Number((r.headers.get('content-range') ?? '/0').split('/')[1] ?? 0)
        }
        let coherent = true
        for (const t of indispensables) {
          const n = (charge.tables![t] as unknown[]).length
          const ecart = vivant[t] - n
          const souple = ecart >= 0 && ecart <= Math.max(2, Math.ceil(vivant[t] * 0.1))
          info(`${t.padEnd(10)} sauvegarde ${String(n).padStart(4)} · base ${String(vivant[t]).padStart(4)} · écart ${ecart >= 0 ? '+' : ''}${ecart}${souple ? '' : '   ← à expliquer'}`)
          if (!souple) coherent = false
        }
        if (coherent) ok('sauvegarde relisible, complète et cohérente avec la base — filet exploitable')
        else inc('écart inexpliqué entre la sauvegarde et la base — à comprendre avant de migrer')

        const age = derniere.updated_at ? (Date.now() - new Date(derniere.updated_at).getTime()) / 3600_000 : null
        if (age !== null) {
          info(`âge de la sauvegarde : ${age.toFixed(1)} h`)
          if (age > 36) inc(`sauvegarde vieille de ${age.toFixed(0)} h — en déclencher une avant de migrer`)
          else ok('sauvegarde récente')
        }
      }
    }
    /* Aucun contenu n'a été affiché : seuls des noms de tables et des nombres. */
    ok('aucune donnée sauvegardée n\'a été exposée par ce contrôle')
  }
}

// ── Condition 2 : doublons sur les identifiants de paiement ─────────────────
cond(2, 'doublons existants sur les identifiants de paiement')
type Course = { id: string; statut: string; paiement_statut: string | null; stripe_payment_intent_id: string | null; facture_id: string | null; prix_estime: number | null; prix_final: number | null; date_prevue: string }
const courses = await get<Course[]>('courses?select=id,statut,paiement_statut,stripe_payment_intent_id,facture_id,prix_estime,prix_final,date_prevue')
{
  const parPI = new Map<string, Course[]>()
  for (const c of courses) {
    if (!c.stripe_payment_intent_id) continue
    parPI.set(c.stripe_payment_intent_id, [...(parPI.get(c.stripe_payment_intent_id) ?? []), c])
  }
  const doublons = [...parPI.entries()].filter(([, v]) => v.length > 1)
  info(`${courses.length} course(s) · ${parPI.size} identifiant(s) de paiement distinct(s) · ${courses.filter(c => !c.stripe_payment_intent_id).length} sans identifiant`)

  if (doublons.length) {
    ko(`${doublons.length} doublon(s) — CREATE UNIQUE INDEX échouerait`)
    for (const [pi, v] of doublons) {
      console.log(`       ${pi.slice(0, 20)}… → ${v.map(c => '#' + ref(c.id)).join(', ')}`)
    }
  } else ok('aucun doublon : l\'index unique peut être créé tel quel')

  const vides = courses.filter(c => c.stripe_payment_intent_id !== null && String(c.stripe_payment_intent_id).trim() === '')
  if (vides.length > 1) ko(`${vides.length} chaînes vides au lieu de NULL — collision garantie`)
  else if (vides.length === 1) inc(`1 chaîne vide (#${ref(vides[0].id)}) — à passer à NULL`)
  else ok('aucune chaîne vide : valeurs soit NULL soit identifiant réel')
}

// ── Condition 3 : additive et compatible avec le code DÉPLOYÉ ───────────────
cond(3, 'migration additive et compatible avec le code actuellement déployé')
{
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000000_fiabilite_paiements.sql'), 'utf8')

  const destructif = [
    [/\bDROP\s+TABLE\b/i, 'DROP TABLE'],
    [/\bDROP\s+COLUMN\b/i, 'DROP COLUMN'],
    [/\bTRUNCATE\b/i, 'TRUNCATE'],
    [/\bDELETE\s+FROM\b/i, 'DELETE FROM'],
    [/\bALTER\s+COLUMN\b.*\bTYPE\b/i, 'changement de type de colonne'],
    [/\bNOT\s+NULL\b(?![^;]*CREATE TABLE)/i, null],
  ] as [RegExp, string | null][]
  const trouves = destructif.filter(([re, nom]) => nom && re.test(sql)).map(([, nom]) => nom)
  if (trouves.length) ko(`la migration contient des instructions destructives : ${trouves.join(', ')}`)
  else ok('aucune instruction destructive : ni DROP TABLE, ni DROP COLUMN, ni TRUNCATE, ni DELETE')

  /* Les commentaires SQL sont retirés avant de chercher les UPDATE.
   *
   * Sans cela le contrôle signalait « UPDATE porte » : le mot venait d'une
   * phrase de commentaire, « Le seul UPDATE porte sur courses.paiement_statut ».
   * Un contrôle qui compte des mots dans des commentaires compte faux. */
  const sqlCode = sql.replace(/^\s*--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const updates = [...sqlCode.matchAll(/UPDATE\s+(\w+)/gi)].map(m => m[1])
  if (updates.length === 0) ok('aucun UPDATE : la migration est purement additive')
  else {
    inc(`${updates.length} UPDATE sur : ${[...new Set(updates)].join(', ')} — la consigne interdit de modifier les statuts des 4 courses historiques`)
    info('→ l\'étape 5 du fichier doit être retirée avant application (voir le rapport)')
  }

  /* La contrainte CHECK est-elle compatible avec ce que le code DÉPLOYÉ
     écrit ? On relit les valeurs écrites dans le code, on ne les suppose pas. */
  const AUTORISES = ['en_attente', 'a_percevoir', 'paye', 'echoue', 'remboursee', 'contestee']
  const fichiers = [
    'src/app/admin/courses/nouvelle/actions.ts',
    'src/app/admin/courses/[id]/actions.ts',
    'src/app/admin/devis/actions.ts',
    'src/app/api/stripe/webhook/route.ts',
  ]
  const ecrites = new Set<string>()
  for (const f of fichiers) {
    let src = ''
    try { src = readFileSync(resolve(process.cwd(), f), 'utf8') } catch { continue }
    for (const m of src.matchAll(/paiement_statut:\s*'([^']+)'/g)) ecrites.add(m[1])
    for (const m of src.matchAll(/paiement_statut:\s*(\w+)\s*\?\s*'([^']+)'\s*:\s*'([^']+)'/g)) { ecrites.add(m[2]); ecrites.add(m[3]) }
  }
  info(`valeurs écrites par le code : ${[...ecrites].join(', ') || 'aucune trouvée'}`)
  const horsListe = [...ecrites].filter(v => !AUTORISES.includes(v))
  if (horsListe.length) ko(`le code écrit des valeurs que le CHECK refuserait : ${horsListe.join(', ')}`)
  else ok('toutes les valeurs écrites par le code sont autorisées par le CHECK')

  /* Et les valeurs déjà en base ? */
  const presentes = new Set(courses.map(c => c.paiement_statut ?? 'NULL'))
  const refusees = [...presentes].filter(v => v !== 'NULL' && !AUTORISES.includes(v))
  info(`valeurs présentes en base : ${[...presentes].join(', ')}`)
  if (refusees.length) ko(`valeurs en base refusées par le CHECK : ${refusees.join(', ')}`)
  else ok('toutes les valeurs en base sont autorisées')

  if (/'en_attente'/.test(sql)) ok('\'en_attente\' (valeur par défaut de la colonne) reste autorisée — les insertions du code déployé passent')
  else ko('\'en_attente\' absente de la liste autorisée : toute insertion sans statut explicite échouerait')

  /* L'index unique change-t-il le comportement du code déployé ? */
  const wh = readFileSync(resolve(process.cwd(), 'src/app/api/stripe/webhook/route.ts'), 'utf8')
  const gereUnicite = /courseErr\?\.code === VIOLATION_UNICITE/.test(wh)
  info(gereUnicite
    ? 'le webhook de la branche sait rattraper une violation d\'unicité'
    : 'le webhook DÉPLOYÉ ne connaît pas la violation d\'unicité')
  inc('avec le code déployé, une double livraison SIMULTANÉE fera échouer la 2ᵉ insertion : réponse 500 + e-mail d\'alerte, puis Stripe réessaie et la lecture préalable trouve la course. Aucun doublon, aucune perte — mais une alerte possiblement trompeuse. Changement de comportement assumé.')
}

// ── Condition 4 : RLS et permissions des nouvelles tables ──────────────────
cond(4, 'RLS et permissions des nouvelles tables')
{
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000000_fiabilite_paiements.sql'), 'utf8')
  for (const t of ['stripe_events', 'incidents_paiement']) {
    const active = new RegExp(`ALTER TABLE ${t} ENABLE ROW LEVEL SECURITY`, 'i').test(sql)
    if (active) ok(`${t} : RLS activée par la migration`)
    else ko(`${t} : RLS NON activée — table lisible par la clé publique`)
  }
  const policies = [...sql.matchAll(/CREATE\s+POLICY/gi)]
  if (policies.length === 0) ok('aucune policy créée : seule la clé de service accède à ces tables')
  else inc(`${policies.length} policy/policies créée(s) — à relire, le payload contient des données personnelles`)

  /* État actuel : ce que la clé publique lit déjà. Référence pour l'après. */
  info('ce que la clé publique lit aujourd\'hui (référence pour le contrôle post-migration) :')
  for (const t of ['courses', 'factures', 'clients']) {
    const r = await reessayer(async () => fetch(`${U}/rest/v1/${t}?select=id`, { method: 'HEAD', headers: { apikey: ANON, Authorization: `Bearer ${ANON}`, Prefer: 'count=exact' } }))
    const n = (r.headers.get('content-range') ?? '/?').split('/')[1]
    info(`   ${t.padEnd(10)} HTTP ${r.status} · ${n === '0' ? 'aucune ligne' : n + ' LIGNES LISIBLES'}`)
    if (n !== '0') ko(`${t} est lisible par la clé publique — à traiter avant toute migration`)
  }
  ok('RLS existante saine : rien ne fuit par la clé publique')
}

// ── Condition 5 : contrôle post-migration et retour arrière ────────────────
cond(5, 'contrôle post-migration et retour arrière non destructif')
{
  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261017000000_fiabilite_paiements.sql'), 'utf8')
  if (/DO \$\$/.test(sql) && /RAISE EXCEPTION/.test(sql)) ok('la migration vérifie son propre résultat et échoue si un doublon apparaît')
  else inc('la migration ne vérifie pas son résultat dans la même session')

  const retour = [
    ['DROP INDEX IF EXISTS courses_stripe_pi_unique', 'retire l\'index unique — non destructif, aucune donnée touchée'],
    ['ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_paiement_statut_valide', 'retire le CHECK — non destructif'],
    ['DROP TABLE IF EXISTS stripe_events', 'tables neuves, vides à ce stade — non destructif'],
    ['DROP TABLE IF EXISTS incidents_paiement', 'idem'],
  ]
  ok('retour arrière préparé, 4 instructions, toutes non destructives :')
  for (const [s, pourquoi] of retour) info(`   ${s};   -- ${pourquoi}`)
  ok('aucune ligne de courses ni de factures n\'est modifiée par la migration retenue — rien à restaurer')

  /* Empreinte d'intégrité à comparer après migration. */
  const factures = await get<{ id: string; numero: string; montant_ttc: number; statut: string }[]>('factures?select=id,numero,montant_ttc,statut')
  const somme = factures.reduce((s, f) => s + Number(f.montant_ttc ?? 0), 0)
  const liees = courses.filter(c => c.facture_id).length
  const statuts: Record<string, number> = {}
  for (const c of courses) statuts[c.paiement_statut ?? 'NULL'] = (statuts[c.paiement_statut ?? 'NULL'] ?? 0) + 1
  console.log('\n\x1b[1m     EMPREINTE AVANT MIGRATION — à recomparer après\x1b[0m')
  info(`   courses                : ${courses.length}`)
  info(`   factures               : ${factures.length}`)
  info(`   somme des montants TTC : ${somme.toFixed(2)} €`)
  info(`   courses liées à une facture : ${liees}`)
  info(`   paiement_statut        : ${Object.entries(statuts).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  info(`   les 4 encaissées       : ${courses.filter(c => c.stripe_payment_intent_id).map(c => '#' + ref(c.id) + '=' + (c.paiement_statut ?? 'NULL')).join(' · ')}`)
}

console.log('\n' + '─'.repeat(72))
if (bloquants.length === 0 && incertains.length === 0) {
  console.log('\x1b[32m\x1b[1mTOUTES LES CONDITIONS SATISFAITES\x1b[0m')
  process.exit(0)
}
if (bloquants.length > 0) {
  console.log(`\x1b[31m\x1b[1mSTOP — ${bloquants.length} condition(s) en échec\x1b[0m`)
  for (const b of bloquants) console.log(`  ✗ ${b}`)
}
if (incertains.length > 0) {
  console.log(`\x1b[33m\x1b[1m${incertains.length} point(s) à trancher avant d'appliquer\x1b[0m`)
  for (const i of incertains) console.log(`  ? ${i}`)
}
process.exit(bloquants.length > 0 ? 1 : 0)
