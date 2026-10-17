/**
 * Fabrique un schéma PostgreSQL local à partir de l'introspection RÉELLE de la
 * production, pour un test d'intégration en environnement isolé.
 *
 * Pourquoi c'est nécessaire. `supabase/migrations/` ne contient que 15
 * correctifs incrémentaux — aucun `CREATE TABLE courses`, aucun `CREATE TYPE`.
 * Le schéma de base n'a jamais été versionné. Un `supabase start` produirait
 * donc une base vide, et un test contre une base vide ne prouve rien.
 *
 * D'où viennent les informations. Du document OpenAPI que PostgREST publie :
 * tables, colonnes, types, valeurs par défaut, colonnes obligatoires, et les
 * valeurs des types énumérés. C'est une MESURE de la production, pas une
 * reconstitution de mémoire — ce qui compte, parce que l'incident du
 * 2026-10-07 venait précisément d'une valeur absente d'un enum (`van` au lieu
 * de `van_7`).
 *
 * CE QUE CE SCHÉMA NE REPRODUIT PAS, et il faut le savoir avant de lui faire
 * confiance :
 *   - les clés étrangères : PostgREST ne les décrit pas de façon exploitable ;
 *   - les politiques RLS : invisibles depuis l'API ;
 *   - les déclencheurs et les fonctions, sauf celles réécrites à la main ici ;
 *   - le schéma `auth` de Supabase (GoTrue).
 * Un test qui dépendrait de l'un de ces quatre points ne serait pas concluant.
 *
 * LECTURE SEULE sur la production. Écrit un fichier SQL local.
 *
 * Usage, depuis owise-app : npx tsx scripts/generer-schema-local.mts
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}

const r = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
  headers: {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    Accept: 'application/openapi+json',
  },
})
if (!r.ok) { console.error(`OpenAPI → HTTP ${r.status}`); process.exit(2) }
const spec = await r.json() as { definitions?: Record<string, any> }
const defs = spec.definitions ?? {}

type Col = { nom: string; type: string; defaut?: string; requis: boolean; enumNom?: string; enumVals?: string[] }

/** Traduit un type OpenAPI/PostgREST en type PostgreSQL. */
function typeSql(p: any): { sql: string; enumNom?: string; enumVals?: string[] } {
  const f = String(p.format ?? '')
  if (f.startsWith('public.') && Array.isArray(p.enum)) {
    return { sql: f, enumNom: f.replace('public.', ''), enumVals: p.enum }
  }
  if (f) return { sql: f }
  switch (p.type) {
    case 'integer': return { sql: 'integer' }
    case 'number':  return { sql: 'numeric' }
    case 'boolean': return { sql: 'boolean' }
    case 'array':   return { sql: 'text[]' }
    case 'object':  return { sql: 'jsonb' }
    default:        return { sql: 'text' }
  }
}

const enums = new Map<string, string[]>()
const tables: { nom: string; cols: Col[] }[] = []

for (const [nom, def] of Object.entries(defs)) {
  const props = (def as any).properties ?? {}
  if (Object.keys(props).length === 0) continue          // vues / RPC
  const requis: string[] = (def as any).required ?? []
  const cols: Col[] = []
  for (const [cn, p] of Object.entries<any>(props)) {
    const t = typeSql(p)
    if (t.enumNom && t.enumVals) enums.set(t.enumNom, t.enumVals)
    cols.push({
      nom: cn, type: t.sql, requis: requis.includes(cn),
      defaut: p.default !== undefined ? String(p.default) : undefined,
      enumNom: t.enumNom, enumVals: t.enumVals,
    })
  }
  tables.push({ nom, cols })
}

const lignes: string[] = []
lignes.push('-- ============================================================================')
lignes.push('-- Schéma local pour le test d\'intégration — Owise')
lignes.push(`-- Généré le ${new Date().toISOString()} depuis l'introspection OpenAPI de la production.`)
lignes.push('--')
lignes.push('-- NE JAMAIS appliquer ce fichier sur la production : il est fait pour une base')
lignes.push('-- jetable. Il ne reproduit ni les clés étrangères, ni les politiques RLS, ni les')
lignes.push('-- déclencheurs, ni le schéma auth de Supabase.')
lignes.push(`-- ${tables.length} table(s) · ${enums.size} type(s) énuméré(s)`)
lignes.push('-- ============================================================================')
lignes.push('')
lignes.push('CREATE EXTENSION IF NOT EXISTS pgcrypto;')
lignes.push('CREATE SCHEMA IF NOT EXISTS extensions;')
lignes.push('CREATE OR REPLACE FUNCTION extensions.uuid_generate_v4() RETURNS uuid')
lignes.push('  LANGUAGE sql AS $$ SELECT gen_random_uuid() $$;')
lignes.push('')
lignes.push('-- ── Types énumérés, relevés en production ───────────────────────────────────')
for (const [nom, vals] of [...enums].sort()) {
  lignes.push(`DO $$ BEGIN CREATE TYPE public.${nom} AS ENUM (${vals.map(v => `'${v}'`).join(', ')});`)
  lignes.push(`EXCEPTION WHEN duplicate_object THEN NULL; END $$;`)
}
lignes.push('')
lignes.push('-- ── Tables ──────────────────────────────────────────────────────────────────')
for (const t of tables.sort((a, b) => a.nom.localeCompare(b.nom))) {
  lignes.push(`CREATE TABLE IF NOT EXISTS public.${t.nom} (`)
  const defs2 = t.cols.map(c => {
    let s = `  ${c.nom} ${c.type}`
    if (c.defaut !== undefined) {
      const d = c.defaut
      const litteral = /^(now\(\)|true|false|-?\d+(\.\d+)?|extensions\.uuid_generate_v4\(\)|gen_random_uuid\(\)|'.*'.*)$/.test(d)
      s += ` DEFAULT ${litteral ? d : `'${d.replace(/'/g, "''")}'`}${c.enumNom && !litteral ? `::public.${c.enumNom}` : ''}`
    }
    if (c.nom === 'id') s += ' PRIMARY KEY'
    else if (c.requis) s += ' NOT NULL'
    return s
  })
  lignes.push(defs2.join(',\n'))
  lignes.push(');')
}
lignes.push('')
lignes.push('-- ── Fonctions réécrites à la main ───────────────────────────────────────────')
lignes.push('--')
lignes.push('-- `find_user_by_email` n\'est définie nulle part dans le dépôt : elle vit')
lignes.push('-- uniquement en production. Sans schéma `auth`, on reproduit son CONTRAT —')
lignes.push('-- rendre l\'identifiant d\'un compte existant, ou NULL — avec une table locale.')
lignes.push('-- Le test exerce donc la branche « client déjà connu » du webhook ; la')
lignes.push('-- création d\'un compte par Supabase Auth reste hors de portée.')
lignes.push('CREATE TABLE IF NOT EXISTS public.utilisateurs_test (id uuid PRIMARY KEY, email text UNIQUE NOT NULL);')
lignes.push('CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text) RETURNS uuid')
lignes.push('  LANGUAGE sql SECURITY DEFINER AS $$')
lignes.push('    SELECT id FROM public.utilisateurs_test WHERE lower(email) = lower(p_email) LIMIT 1;')
lignes.push('  $$;')
lignes.push('')
lignes.push('-- PostgREST a besoin de ces rôles pour démarrer.')
lignes.push('DO $$ BEGIN CREATE ROLE anon NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;')
lignes.push('DO $$ BEGIN CREATE ROLE authenticated NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;')
lignes.push('DO $$ BEGIN CREATE ROLE service_role NOLOGIN BYPASSRLS; EXCEPTION WHEN duplicate_object THEN NULL; END $$;')
lignes.push('DO $$ BEGIN CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD \'test\'; EXCEPTION WHEN duplicate_object THEN NULL; END $$;')
lignes.push('GRANT anon, authenticated, service_role TO authenticator;')
lignes.push('GRANT USAGE ON SCHEMA public, extensions TO anon, authenticated, service_role;')
lignes.push('GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;')
lignes.push('GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;')
lignes.push('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role, anon, authenticated;')
lignes.push('-- anon ne reçoit AUCUN droit de lecture : même posture qu\'en production.')

const sortie = resolve(process.cwd(), 'scripts/schema-local-test.sql')
writeFileSync(sortie, lignes.join('\n') + '\n', 'utf8')

console.log(`\x1b[1mSchéma local généré\x1b[0m`)
console.log(`  source  : introspection OpenAPI de la production (lecture seule)`)
console.log(`  tables  : ${tables.length}`)
console.log(`  enums   : ${enums.size} → ${[...enums.keys()].join(', ')}`)
console.log(`  fichier : scripts/schema-local-test.sql (${lignes.length} lignes)`)
console.log('')
const c = tables.find(t => t.nom === 'courses')
console.log(`  courses : ${c?.cols.length} colonnes`)
for (const n of ['statut', 'type_vehicule', 'paiement_statut', 'mode_paiement']) {
  const col = c?.cols.find(x => x.nom === n)
  console.log(`     ${n.padEnd(18)} ${col?.type}${col?.enumVals ? ' [' + col.enumVals.join('|') + ']' : ''}${col?.defaut !== undefined ? ' défaut=' + col.defaut : ''}`)
}
console.log('')
console.log('  \x1b[33mNon reproduit\x1b[0m : clés étrangères, RLS, déclencheurs, schéma auth de Supabase.')
