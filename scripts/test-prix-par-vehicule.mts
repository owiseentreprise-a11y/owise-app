/**
 * Un prix fixé par l'exploitant est-il vraiment appliqué ?
 *
 *   npx tsx scripts/test-prix-par-vehicule.mts
 *
 * LECTURE SEULE sur la base. Aucune écriture : les prix fixés sont simulés
 * EN MÉMOIRE sur une copie de la vraie grille. On ne touche pas aux tarifs
 * de production pour éprouver un calcul.
 *
 * POURQUOI CE CONTRÔLE
 *
 * Depuis le 2026-11-07, `grilles_tarifaires` porte trois colonnes
 * facultatives — `prix_berline_premium`, `prix_van`, `prix_grand_van`. Une
 * colonne ajoutée et jamais lue est le défaut le mieux documenté de ce
 * projet : `supplement_etape` valait 20 € en base, le site facturait 10 €,
 * et le champ d'/admin/tarifs n'avait jamais eu le moindre effet. Personne
 * ne s'en est aperçu pendant des mois, parce que rien ne plantait.
 *
 * Ce contrôle répond donc à une seule question, mais sur les VRAIES données :
 * si l'exploitant écrit 110 €, le client paie-t-il 110 € ?
 *
 * Il vérifie aussi les deux cas où le prix fixé ne doit PAS s'appliquer :
 * la colonne vide (on garde le coefficient) et la valeur zéro (zéro n'est
 * pas un prix, c'est une case qu'on a vidée — la traiter comme un tarif
 * offrirait la course).
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

for (const l of readFileSync(resolve(RACINE, '.env.local'), 'utf8').split('\n')) {
  const i = l.indexOf('=')
  if (i > 0 && !process.env[l.slice(0, i).trim()]) {
    process.env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1')
  }
}
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? `\n      ${G}${d}${Z}` : ''}`) }
}

const { calculerPrix, COLONNES_GRILLE } = await import('../src/lib/calcPrix')
type Ligne = Record<string, unknown>

const U = process.env.NEXT_PUBLIC_SUPABASE_URL
const H = {
  apikey: process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
}
const get = async (p: string) => (await fetch(`${U}/rest/v1/${p}`, { headers: H })).json()

/* La grille est lue avec LA liste unique — si une colonne y manquait, ce
   contrôle ne la verrait pas non plus, et il annoncerait un faux vert. */
const [zones, grilleReelle, tarifs, parametres] = await Promise.all([
  get('zones?select=id,code,type,prefixes_postaux'),
  get(`grilles_tarifaires?select=${COLONNES_GRILLE}`),
  get('tarifs?select=*'),
  get('parametres?select=*'),
]) as [Ligne[], Ligne[], Ligne[], Ligne[]]
const params = parametres[0] ?? null

console.log(`\n${B}UN PRIX FIXÉ PAR L'EXPLOITANT EST-IL APPLIQUÉ ?${Z}`)
console.log(`${G}${grilleReelle.length} trajets lus en base · colonnes : ${COLONNES_GRILLE}${Z}`)
console.log(`${G}aucune écriture : les prix fixés sont simulés en mémoire${Z}\n`)

/* On prend un trajet réel qui a un forfait berline : Creil → CDG. */
const codeVers = (c: string) => (zones.find(z => z.code === c)?.id as string) ?? ''
const CRL = codeVers('CRL'), CDG = codeVers('CDG')
dire(Boolean(CRL && CDG), 'les zones Creil et CDG existent en base', `CRL=${CRL || '?'} CDG=${CDG || '?'}`)

const QUAND = '2027-03-18T14:00'
const prix = (vehicule: string, grille: Ligne[]) =>
  calculerPrix(CRL, CDG, vehicule, QUAND, grille as never, tarifs as never, zones as never, params as never)

// ── 1. Sans prix fixé : le comportement d'avant, intact ─────────────────
console.log(`${B}1. colonnes vides — le calcul par coefficient, comme avant${Z}`)
const sansFixe = grilleReelle.map(g => ({ ...g, prix_berline_premium: null, prix_van: null, prix_grand_van: null }))
const base = { berline: prix('berline', sansFixe), premium: prix('berline_premium', sansFixe), van: prix('van', sansFixe), grandVan: prix('grand_van', sansFixe) }
console.log(`     ${G}Creil → CDG : berline ${base.berline} € · premium ${base.premium} € · van ${base.van} € · grand van ${base.grandVan} €${Z}`)
dire(base.berline === 59, 'la berline vaut 59 € — le forfait réel de la grille', `lu : ${base.berline}`)
const coefP = Number(params?.coef_berline_premium ?? 1.5), coefV = Number(params?.coef_van ?? 1.7)
dire(base.premium === Math.round(59 * coefP * 100) / 100, `le premium suit le coefficient ×${coefP}`, `lu : ${base.premium}`)
dire(base.van === Math.round(59 * coefV * 100) / 100, `le van suit le coefficient ×${coefV}`, `lu : ${base.van}`)

// ── 2. Avec un prix fixé : c'est LUI qu'on paie ─────────────────────────
console.log(`\n${B}2. prix fixés par l'exploitant${Z}`)
const CAS: [string, string, number][] = [
  ['berline_premium', 'prix_berline_premium', 97],
  ['van',             'prix_van',            110],
  ['grand_van',       'prix_grand_van',      145],
]
for (const [vehicule, colonne, montant] of CAS) {
  const avec = grilleReelle.map(g =>
    (g.zone_depart_id === CRL && g.zone_arrivee_id === CDG) || (g.zone_depart_id === CDG && g.zone_arrivee_id === CRL)
      ? { ...g, [colonne]: montant } : g)
  const obtenu = prix(vehicule, avec)
  dire(obtenu === montant, `${colonne} = ${montant} € → le client paie ${montant} €`,
       `obtenu : ${obtenu} € — le prix fixé n'est pas lu, le code est retombé sur le coefficient`)
}

// ── 3. Les deux cas où il ne faut PAS appliquer ─────────────────────────
console.log(`\n${B}3. ce qui ne doit surtout pas être pris pour un prix${Z}`)
const avecZero = grilleReelle.map(g =>
  (g.zone_depart_id === CRL && g.zone_arrivee_id === CDG) || (g.zone_depart_id === CDG && g.zone_arrivee_id === CRL)
    ? { ...g, prix_van: 0 } : g)
dire(prix('van', avecZero) === base.van,
     'une case vidée (0) ne rend pas la course gratuite — on revient au coefficient',
     `obtenu : ${prix('van', avecZero)} € au lieu de ${base.van} €`)

const autreTrajet = grilleReelle.map(g =>
  !((g.zone_depart_id === CRL && g.zone_arrivee_id === CDG) || (g.zone_depart_id === CDG && g.zone_arrivee_id === CRL))
    ? { ...g, prix_van: 999 } : g)
dire(prix('van', autreTrajet) === base.van,
     'un prix fixé sur un AUTRE trajet ne déteint pas sur celui-ci',
     `obtenu : ${prix('van', autreTrajet)} € au lieu de ${base.van} €`)

// ── 4. La berline n'a pas de colonne à elle, et c'est voulu ─────────────
console.log(`\n${B}4. la berline reste le prix de référence${Z}`)
const bruit = grilleReelle.map(g => ({ ...g, prix_berline_premium: 1, prix_van: 2, prix_grand_van: 3 }))
dire(prix('berline', bruit) === base.berline,
     'aucune colonne par véhicule ne peut déplacer le prix berline',
     `obtenu : ${prix('berline', bruit)} € au lieu de ${base.berline} €`)

// ── 5. Ce qui est réellement fixé en base aujourd'hui ───────────────────
console.log(`\n${B}5. état réel de la base${Z}`)
const fixes = grilleReelle.filter(g => g.prix_berline_premium != null || g.prix_van != null || g.prix_grand_van != null)
console.log(`  ${G}${fixes.length} trajet(s) sur ${grilleReelle.length} portent au moins un prix fixé${Z}`)
for (const f of fixes.slice(0, 10)) {
  const nom = (id: unknown) => zones.find(z => z.id === id)?.code ?? '?'
  console.log(`     ${G}${nom(f.zone_depart_id)} → ${nom(f.zone_arrivee_id)} : premium ${f.prix_berline_premium ?? '—'} · van ${f.prix_van ?? '—'} · grand van ${f.prix_grand_van ?? '—'}${Z}`)
}

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}\n`)
