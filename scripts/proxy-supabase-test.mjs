/**
 * Relais local qui donne à PostgREST la forme d'une API Supabase.
 *
 * `supabase-js` appelle `<URL>/rest/v1/…` et `<URL>/auth/v1/…`. PostgREST sert
 * à sa racine. Sans ce relais, tous les appels tombent en 404 — et le webhook
 * échoue d'une façon trompeuse : il croit devoir créer un compte parce que
 * `find_user_by_email` n'a rien rendu.
 *
 * Il sert aussi de MOUCHARD : chaque requête est écrite dans un journal, ce
 * qui donne une trace vérifiable de tout ce que l'application a demandé
 * pendant le test. Si une requête partait ailleurs qu'ici, elle manquerait à
 * l'appel.
 *
 * ── Ce qui est fidèle ────────────────────────────────────────────────────
 *   /rest/v1/*  → PostgREST, tel quel : mêmes verbes, mêmes en-têtes, mêmes
 *                 codes d'erreur Postgres (23505, 23514…).
 *
 * ── Ce qui est un LEURRE, et doit être lu comme tel ──────────────────────
 *   /auth/v1/admin/users → une imitation minimale de GoTrue. Elle insère une
 *   ligne dans `utilisateurs_test` et rend un objet de la bonne forme. Ce
 *   n'est PAS Supabase Auth : pas de hachage de mot de passe, pas de règles
 *   d'unicité réelles, pas de métadonnées d'application. Tout scénario qui
 *   dépend du comportement véritable de GoTrue n'est pas concluant ici.
 *
 * Usage : node scripts/proxy-supabase-test.mjs [port] [port-postgrest]
 */
import { createServer } from 'node:http'
import { appendFileSync, writeFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const PORT = Number(process.argv[2] ?? 54320)
const AMONT = `http://localhost:${process.argv[3] ?? 54321}`
const JOURNAL = 'scripts/.proxy-test.log'

/** Compteur des pannes d'authentification provoquées, par adresse. */
const pannesTransitoires = {}

writeFileSync(JOURNAL, `# relais démarré ${new Date().toISOString()}\n`, 'utf8')
const tracer = (l) => { try { appendFileSync(JOURNAL, l + '\n') } catch { /* sans importance */ } }

const lireCorps = (req) => new Promise((res) => {
  const morceaux = []
  req.on('data', (c) => morceaux.push(c))
  req.on('end', () => res(Buffer.concat(morceaux)))
})

/** Appelle PostgREST avec les droits de service, en SQL brut via PostgREST. */
async function postgrest(chemin, options = {}) {
  return fetch(`${AMONT}${chemin}`, options)
}

const serveur = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`)
  const corps = await lireCorps(req)
  tracer(`${new Date().toISOString()} ${req.method} ${url.pathname}${url.search}`)

  const repondre = (code, charge, enTetes = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json', ...enTetes })
    res.end(typeof charge === 'string' ? charge : JSON.stringify(charge))
  }

  // ── Leurre d'authentification ────────────────────────────────────────────
  if (url.pathname.startsWith('/auth/v1/admin/users')) {
    if (req.method !== 'POST') return repondre(200, { users: [] })
    let demande = {}
    try { demande = JSON.parse(corps.toString() || '{}') } catch { /* vide */ }

    /* Deux pannes provoquées, déclenchées par l'adresse, pour éprouver les
       conséquences exactes d'un échec de Supabase Auth :
         « echec-auth »    → échoue toujours ;
         « transitoire »   → échoue la PREMIÈRE fois, réussit ensuite.
       La seconde reproduit le cas réaliste : une indisponibilité passagère,
       suivie d'une nouvelle tentative de Stripe. */
    const mail = String(demande.email ?? '')
    if (mail.includes('echec-auth')) {
      tracer(`    PANNE AUTH PROVOQUEE (permanente) pour ${mail}`)
      return repondre(500, { code: 500, msg: 'panne auth provoquee' })
    }
    if (mail.includes('transitoire')) {
      pannesTransitoires[mail] = (pannesTransitoires[mail] ?? 0) + 1
      if (pannesTransitoires[mail] === 1) {
        tracer(`    PANNE AUTH PROVOQUEE (1re fois) pour ${mail}`)
        return repondre(503, { code: 503, msg: 'panne auth passagere provoquee' })
      }
      tracer(`    PANNE AUTH TERMINEE pour ${mail} (tentative ${pannesTransitoires[mail]})`)
    }

    const id = randomUUID()
    const r = await postgrest('/utilisateurs_test', {
      method: 'POST',
      headers: { ...Object.fromEntries(Object.entries(req.headers).filter(([k]) => k === 'apikey' || k === 'authorization')), 'Content-Type': 'application/json', Prefer: 'return=representation' },
      body: JSON.stringify({ id, email: demande.email }),
    })
    if (!r.ok) {
      tracer(`    LEURRE AUTH : refus ${r.status}`)
      return repondre(422, { code: 422, msg: 'utilisateur deja present (leurre)' })
    }
    tracer(`    LEURRE AUTH : compte fictif ${id} pour ${demande.email}`)
    return repondre(200, { id, email: demande.email, user: { id, email: demande.email } })
  }

  // ── Tout le reste de /auth : non implémenté, et on le dit ───────────────
  if (url.pathname.startsWith('/auth/')) {
    tracer(`    AUTH NON IMPLEMENTE : ${url.pathname}`)
    return repondre(501, { code: 501, msg: `route auth non implementee dans le relais de test : ${url.pathname}` })
  }

  // ── PostgREST, sans transformation ───────────────────────────────────────
  if (url.pathname.startsWith('/rest/v1/')) {
    const cible = url.pathname.replace('/rest/v1', '') + url.search
    const enTetes = { ...req.headers }
    delete enTetes.host
    delete enTetes['content-length']
    try {
      const r = await postgrest(cible, {
        method: req.method,
        headers: enTetes,
        body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : corps,
      })
      const texte = await r.text()
      if (r.status >= 400) tracer(`    -> ${r.status} ${texte.slice(0, 160)}`)
      const sortie = {}
      for (const [k, v] of r.headers) if (!['content-encoding', 'transfer-encoding', 'content-length'].includes(k)) sortie[k] = v
      res.writeHead(r.status, sortie)
      return res.end(texte)
    } catch (e) {
      tracer(`    -> ERREUR RELAIS ${String(e.message).slice(0, 120)}`)
      return repondre(502, { message: 'relais : amont injoignable' })
    }
  }

  // ── Stockage : refusé explicitement plutôt que silencieusement ───────────
  if (url.pathname.startsWith('/storage/')) {
    tracer(`    STOCKAGE NON IMPLEMENTE : ${url.pathname}`)
    return repondre(501, { message: 'stockage non implemente dans le relais de test' })
  }

  tracer(`    CHEMIN INCONNU : ${url.pathname}`)
  repondre(404, { message: 'chemin inconnu du relais de test' })
})

serveur.listen(PORT, '127.0.0.1', () => {
  console.log(`relais Supabase de test sur http://localhost:${PORT} → ${AMONT}`)
  console.log(`journal des appels : ${JOURNAL}`)
})
