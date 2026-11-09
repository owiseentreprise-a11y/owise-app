/**
 * Le Grand Van a sa propre ligne de tarif — sans qu'aucun prix ne bouge.
 *
 *   npx tsx scripts/test-tarif-grand-van.mts
 *
 * N'OUVRE NI RÉSEAU NI BASE.
 *
 * CE QUI CHANGE, ET CE QUI NE DOIT PAS
 *
 * Jusqu'au 2026-11-09, le Grand Van 8 places n'avait aucune ligne dans
 * `tarifs` : son prix au kilomètre dérivait de celui du Van 7 places, avec
 * + 0,10 EUR écrits en dur dans `calcPrix.ts`. L'exploitant ne pouvait donc
 * le régler nulle part — il n'avait pas de carte dans /admin/tarifs.
 *
 * Il a maintenant sa ligne, réglée exactement sur les valeurs effectives
 * d'avant (prise en charge 49 EUR, 1,65 EUR/km = 1,55 + 0,10). Le tarif
 * devient réglable SANS que le client voie le moindre changement.
 *
 * LE DANGER RÉEL : L'ORDRE DES DEUX MISES EN PLACE
 *
 * Le code part en production et la ligne est créée en base à deux moments
 * différents. Entre les deux, le code cherche une ligne qui n'existe pas
 * encore. Sans repli, `tarifs.find` échoue et le calcul retombe sur
 * 15 EUR + 2 EUR/km — c'est-à-dire MOINS CHER que le van 7 places, le défaut
 * exact corrigé le 2026-11-03. Ce contrôle éprouve donc les DEUX états.
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { calculerPrixKm, calculerPrixEtapes, type TarifCalc } from '../src/lib/calcPrix'
import { vehiculeParCle } from '../src/lib/gamme'

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const lire = (p: string) => readFileSync(resolve(RACINE, p), 'utf8')

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ok = 0
const rates: string[] = []
const verifier = (quoi: string, condition: boolean, vu?: string) => {
  if (condition) ok++; else rates.push(vu === undefined ? quoi : `${quoi} — ${vu}`)
}

const zero = { cdg_fixe: 0, orly_fixe: 0, beauvais_fixe: 0 }
const BERLINE:  TarifCalc = { vehicule: 'Berline',            prise_en_charge: 39, prix_km: 1.25, ...zero }
const PREMIUM:  TarifCalc = { vehicule: 'Berline Premium',    prise_en_charge: 49, prix_km: 1.50, ...zero }
const VAN:      TarifCalc = { vehicule: 'Van 7 places',       prise_en_charge: 49, prix_km: 1.55, ...zero }
const GRANDVAN: TarifCalc = { vehicule: 'Grand Van 8 places', prise_en_charge: 49, prix_km: 1.65, ...zero }

/* Un mardi à 10h : ni nuit, ni week-end, ni férié. Les majorations sont
   testées ailleurs ; ici on veut lire le tarif de base, pas une somme. */
const QUAND = '2026-11-10T10:00'

const AVANT = [BERLINE, PREMIUM, VAN]              // la ligne n'existe pas encore
const APRES = [BERLINE, PREMIUM, VAN, GRANDVAN]    // une fois la ligne créée

const DISTANCES = [1, 5, 12, 25, 35, 50, 80, 120, 196, 300]

console.log(`\n${B}LE GRAND VAN A SON TARIF, SANS QU'AUCUN PRIX NE BOUGE${Z}`)

/* ── 1. Le prix est le même avec et sans la ligne ───────────────────────── */
console.log(`\n${B}1. le même prix, que la ligne existe ou non${Z}`)
for (const d of DISTANCES) {
  const avant = calculerPrixKm(d, 'grand_van', QUAND, AVANT)
  const apres = calculerPrixKm(d, 'grand_van', QUAND, APRES)
  verifier(`${d} km : identique avant/après`, avant === apres, `${avant} € puis ${apres} €`)
  if (avant !== apres) console.log(`   ${R}✗${Z} ${d} km : ${avant} € → ${apres} €`)
}
/* Et la valeur elle-même est celle d'avant le changement : 49 + d × 1,65. */
for (const d of [25, 50, 120]) {
  const attendu = Math.round((49 + d * 1.65) * 100) / 100
  verifier(`${d} km vaut bien ${attendu} €`, calculerPrixKm(d, 'grand_van', QUAND, APRES) === attendu,
    String(calculerPrixKm(d, 'grand_van', QUAND, APRES)))
}

/* ── 2. Le 8 places reste plus cher que le 7 places ─────────────────────
   Le défaut du 2026-11-03 : le Grand Van revenait moins cher que le van sur
   101 liaisons sur 127. Il ne doit jamais revenir, dans aucun des deux états. */
console.log(`\n${B}2. le 8 places reste plus cher que le 7 places${Z}`)
for (const [nom, jeu] of [['sans la ligne', AVANT], ['avec la ligne', APRES]] as const) {
  for (const d of DISTANCES) {
    const van = calculerPrixKm(d, 'van', QUAND, jeu as TarifCalc[])
    const gv  = calculerPrixKm(d, 'grand_van', QUAND, jeu as TarifCalc[])
    verifier(`${nom}, ${d} km : grand van > van`, gv !== null && van !== null && gv > van,
      `van ${van} € / grand van ${gv} €`)
  }
}

/* ── 3. Le détour d'une étape coûte le même kilomètre ───────────────────
   Il était chiffré à 2 EUR/km — une valeur inventée, inférieure à celle du
   van (constaté le 2026-11-03). */
console.log(`\n${B}3. le détour d'une étape suit le même tarif${Z}`)
for (const [directe, troncons] of [[30, [20, 20]], [50, [40, 25]], [12, [8, 9]]] as const) {
  const avant = calculerPrixEtapes(100, directe, [...troncons], 'grand_van', QUAND, AVANT)
  const apres = calculerPrixEtapes(100, directe, [...troncons], 'grand_van', QUAND, APRES)
  verifier(`détour ${directe} km : identique avant/après`, avant === apres, `${avant} € puis ${apres} €`)
  const van = calculerPrixEtapes(100, directe, [...troncons], 'van', QUAND, APRES)
  verifier(`détour ${directe} km : plus cher que le van`, apres >= van, `van ${van} € / grand van ${apres} €`)
}

/* ── 4. Un tarif modifié est RÉELLEMENT pris en compte ──────────────────
   C'est tout l'objet du changement : si régler la carte ne déplaçait pas le
   prix, on aurait ajouté un champ décoratif. Le projet a déjà connu ça —
   `supplement_etape` valait 20 EUR en base et le site facturait 10 EUR. */
console.log(`\n${B}4. modifier la carte déplace vraiment le prix${Z}`)
const PLUS_CHER: TarifCalc = { ...GRANDVAN, prise_en_charge: 79, prix_km: 2.40 }
const jeuModifie = [BERLINE, PREMIUM, VAN, PLUS_CHER]
for (const d of [25, 50]) {
  const avant = calculerPrixKm(d, 'grand_van', QUAND, APRES)!
  const apres = calculerPrixKm(d, 'grand_van', QUAND, jeuModifie)!
  verifier(`${d} km : le nouveau tarif s'applique`, apres > avant, `${avant} € puis ${apres} €`)
  verifier(`${d} km : la valeur attendue`, apres === Math.round((79 + d * 2.40) * 100) / 100, String(apres))
}
/* Et il ne déborde pas sur les autres véhicules. */
verifier('le van 7 places n\'a pas bougé',
  calculerPrixKm(50, 'van', QUAND, APRES) === calculerPrixKm(50, 'van', QUAND, jeuModifie))
verifier('la berline n\'a pas bougé',
  calculerPrixKm(50, 'berline', QUAND, APRES) === calculerPrixKm(50, 'berline', QUAND, jeuModifie))

/* ── 5. Le code et l'écran sont d'accord ────────────────────────────────── */
console.log(`\n${B}5. la gamme et l'écran désignent la même ligne${Z}`)
verifier('gamme.ts pointe le Grand Van sur sa propre ligne',
  vehiculeParCle('grand_van')?.nomTarif === 'Grand Van 8 places',
  String(vehiculeParCle('grand_van')?.nomTarif))
const ecran = lire('src/app/admin/tarifs/TarifsVehicules.tsx')
verifier('l\'écran affiche une carte Grand Van', ecran.includes("'Grand Van 8 places'"))
verifier('l\'écran prévient si la ligne manque', ecran.includes('grandVanAbsent'))
verifier('l\'écran signale un plus grand moins cher', ecran.includes('incoherences'))

console.log(`\n${B}RÉSULTAT${Z}`)
console.log(`  ${ok} contrôles au vert · ${rates.length ? R : V}${rates.length} au rouge${Z}`)
if (rates.length) {
  console.log(`\n${B}Ce qui échoue${Z}`)
  for (const r of rates) console.log(`  ${R}✗${Z} ${r}`)
}
console.log(`\n${G}Aucun réseau, aucune base.${Z}\n`)
process.exit(rates.length ? 1 : 0)
