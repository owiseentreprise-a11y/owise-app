/**
 * La table `parametres` peut-elle encore fuiter vers le navigateur ?
 *
 *   npx tsx scripts/test-parametres-prives.mts [url]
 *
 * L'INCIDENT QUE CE CONTRÔLE EXISTE POUR EMPÊCHER
 *
 * Le 2026-11-03, `chargerParametres` est passée d'une liste de sept colonnes
 * nommées à `select('*')`, pour une bonne raison : une colonne oubliée
 * faisait silencieusement retomber un prix sur sa valeur de repli
 * (`supplement_etape` valait 20 € en base et le site facturait 10 € depuis
 * des mois).
 *
 * Mais `parametres` ne contient pas que des tarifs. Elle porte aussi
 * `societe_adresse`, `banque_iban`, `banque_bic`, `banque_nom`. Et ces
 * paramètres sont passés en `props` à des composants CLIENT — or tout prop
 * d'un composant client est sérialisé dans le HTML pour l'hydratation.
 *
 * Résultat, publié trois jours sur 41 pages : l'adresse du domicile de
 * l'exploitant et son IBAN, lisibles dans la source de la page d'accueil.
 *
 * Trouvé le 2026-11-06, non pas par ce contrôle mais en vérifiant à la main
 * une page NOUVELLE. `test-identite-privee.mjs` voyait parfaitement la
 * fuite — il n'avait simplement jamais été relancé après le changement.
 * D'où ce contrôle-ci, qui n'a pas besoin du site en ligne pour les deux
 * premières sections.
 *
 * TROIS SECTIONS
 *   1. la liste d'exécution `CLES_PARAMS_CALC` couvre-t-elle toutes les
 *      colonnes tarifaires RÉELLES de la base, et aucune colonne privée ?
 *   2. `paramsPourNavigateur()` laisse-t-elle vraiment tomber le privé ?
 *   3. avec une url : la page servie contient-elle encore quelque chose
 *      qu'elle ne devrait pas ?
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CLES_PARAMS_CALC, paramsPourNavigateur } from '../src/lib/tarification'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
const URL_SITE = process.argv[2] ?? null

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? ` ${G}— ${d}${Z}` : ''}`) }
}

/* Ce qui ne doit JAMAIS franchir la frontière du navigateur. */
const PRIVE = /^(societe_|banque_|facture_|created_at|updated_at|id$)/
/* Ce qui est un réglage de tarif, et doit donc être dans la liste. */
const TARIFAIRE = /^(coef_|supplement_|surcout_|tarif_|prix_|avis_)/

// ── 1. La liste d'exécution contre la VRAIE base ────────────────────────
console.log(`\n${B}LES PARAMÈTRES PRIVÉS RESTENT-ILS AU SERVEUR ?${Z}\n`)
console.log(`${B}1. la liste d'exécution face aux colonnes réelles${Z}`)

const env: Record<string, string> = {}
for (const l of readFileSync(resolve(RACINE, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
}
const entetes = {
  apikey: env.SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
}
const reponse = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/parametres?select=*&id=eq.true`, { headers: entetes })
const lignes = await reponse.json() as Record<string, unknown>[]
const ligne = lignes?.[0]
dire(Boolean(ligne), 'la ligne de paramètres est lisible en base')

if (ligne) {
  const colonnes = Object.keys(ligne)
  const liste = new Set<string>(CLES_PARAMS_CALC as readonly string[])

  /* Les tarifs de la base sont-ils tous dans la liste ? C'est la propriété
     que `select('*')` avait apportée, et qu'on ne veut pas reperdre. Les
     exceptions sont déclarées, avec leur raison. */
  const HORS_LISTE_ASSUME: Record<string, string> = {
    coef_berline: 'vaut 1,5 en base et ne doit PAS être branché — le brancher majorerait toutes les berlines de 50 %',
    avis_nombre: 'lu séparément par lireAvis(), pas par le calcul de prix',
    avis_note: 'lu séparément par lireAvis(), pas par le calcul de prix',
    supplement_ferie: "non utilisé par le calcul à ce jour",
    tarif_km_particulier: 'lu depuis la table `tarifs`, pas ici',
    tarif_base_particulier: 'lu depuis la table `tarifs`, pas ici',
  }
  const tarifsOublies = colonnes
    .filter(c => TARIFAIRE.test(c) && !liste.has(c) && !(c in HORS_LISTE_ASSUME))
  dire(tarifsOublies.length === 0,
       'aucun réglage de tarif de la base n’est absent de la liste',
       tarifsOublies.join(', ') + ' — un réglage absent retombe sur sa valeur de repli, en silence')

  const priveDansListe = [...liste].filter(c => PRIVE.test(c))
  dire(priveDansListe.length === 0, 'aucune colonne privée ne s’est glissée dans la liste', priveDansListe.join(', '))

  /* Et la liste ne doit pas nommer de colonne qui n'existe plus. */
  const fantomes = [...liste].filter(c => !colonnes.includes(c) &&
    !['supplement_grand_van', 'surcout_km_grand_van'].includes(c))
  dire(fantomes.length === 0, 'la liste ne nomme aucune colonne disparue', fantomes.join(', '))

  // ── 2. Le filtre fait-il son travail ? ────────────────────────────────
  console.log(`\n${B}2. paramsPourNavigateur() sur la vraie ligne${Z}`)
  const filtre = paramsPourNavigateur(ligne as never) as Record<string, unknown> | null
  dire(filtre !== null, 'le filtre rend bien un objet')
  if (filtre) {
    const restes = Object.keys(filtre).filter(c => PRIVE.test(c))
    dire(restes.length === 0, 'plus aucune colonne privée après filtrage', restes.join(', '))

    const serialise = JSON.stringify(filtre)
    const interdits: [string, string][] = [
      ['adresse du domicile', '14 rue du Vieux Moulin'],
      ['IBAN', 'FR76'],
      ['BIC', 'SNNNFR22'],
      ['nom de la banque', 'SHINE'],
    ]
    for (const [quoi, aiguille] of interdits) {
      dire(!serialise.includes(aiguille), `${quoi} absent du résultat`)
    }
    dire(Object.keys(filtre).length >= 8,
         `${Object.keys(filtre).length} réglages de tarif conservés`,
         'un filtre qui rend presque rien casserait les prix')
  }
  dire(PRIVE.test('banque_iban') && PRIVE.test('societe_adresse'),
       'le motif « privé » reconnaît bien l’IBAN et l’adresse',
       'sinon tout le reste du contrôle ne prouve rien')
}

// ── 3. La page servie ───────────────────────────────────────────────────
if (URL_SITE) {
  console.log(`\n${B}3. ce que la page servie contient vraiment${Z} ${G}${URL_SITE}${Z}`)
  for (const chemin of ['/', '/reserver', '/en/book', '/vtc-chantilly-cdg']) {
    let html = ''
    try {
      const r = await fetch(`${URL_SITE}${chemin}`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36' },
      })
      if (!r.ok) { console.log(`  ${G}⚠ ${chemin} → HTTP ${r.status}${Z}`); continue }
      html = await r.text()
    } catch { console.log(`  ${G}⚠ ${chemin} injoignable${Z}`); continue }
    const trouves = [
      ['adresse du domicile', /rue du vieux[- ]moulin/i],
      ['IBAN', /FR\d{2}\s?\d{4}\s?\d{4}/],
      ['BIC', /SNNNFR22/i],
      ['nom de l’exploitant', /houna|hassan/i],
    ].filter(([, motif]) => (motif as RegExp).test(html)).map(([quoi]) => quoi as string)
    dire(trouves.length === 0, `${chemin} ne publie rien de privé`, trouves.join(', '))
  }
} else {
  console.log(`\n${G}Section 3 ignorée — passer une url pour vérifier les pages servies.${Z}`)
}

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z} ${G}— les tarifs passent, le privé reste${Z}\n`)
