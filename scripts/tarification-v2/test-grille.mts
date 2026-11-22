/**
 * test-grille.mts — LA GRILLE UNIQUE SE COMPORTE-T-ELLE COMME UN ACCÉLÉRATEUR ?
 *
 * Contrôle de src/lib/tarification-v2/grille.ts. Aucun accès réseau ni base.
 *   npx tsx scripts/tarification-v2/test-grille.mts
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, resolve } from 'path'
import { prixV2, cleVehiculeV2, GRILLE_DE_DEPART, type GrilleV2, type MesuresTrajet, type CleVehiculeV2 } from '../../src/lib/tarification-v2/grille'

let ok = 0, ko = 0
const V = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', Z = '\x1b[0m'
const verifier = (c: boolean, m: string) => { if (c) { ok++; console.log(`${V}✓${Z} ${m}`) } else { ko++; console.log(`${R}✗ ${m}${Z}`) } }
const copie = (g: GrilleV2): GrilleV2 => JSON.parse(JSON.stringify(g))
const VEH: CleVehiculeV2[] = ['berline', 'berline_premium', 'van', 'grand_van'];

/* Un éventail de trajets, du très court au très long, proches et loin des bases.
   T(trajet km, min, approche Roissy, approche Paris, retour→Roissy, retour→Paris) */
type P = [number, number] | null
const M = (x: P) => x && { km: x[0], min: x[1] }
const T = (km: number, min: number, ar: P, ap: P, rr: P, rp: P): MesuresTrajet => ({
  trajet: { km, min },
  approches: { 'Roissy-CDG': M(ar), 'Paris Châtelet': M(ap) },
  retoursBase: { 'Roissy-CDG': M(rr), 'Paris Châtelet': M(rp) },
})
const TRAJETS = [
  T(4, 15, [30, 35], [3, 10], [31, 36], [5, 12]),              // petit trajet dans Paris
  T(22, 34, [31, 39], [5, 17], [20, 25], [17, 25]),            // Paris → Orly
  T(26, 30, [27, 31], [55, 62], [0, 2], [30, 35]),             // Chantilly → CDG
  T(77, 59, [76, 55], [104, 85], [20, 22], [8, 15]),           // Beauvais → Saint-Ouen
  T(185, 126, [158, 114], [132, 97], [95, 80], [80, 70]),      // Orléans → Provins
  T(215, 136, [25, 25], [54, 55], [220, 140], [230, 145]),     // Luzarches → Lille
  T(197, 131, [810, 465], [776, 451], [770, 450], [790, 455]), // Marseille → Nice
]
/* Le cas trouvé par l'exploitant le 2026-11-22 (mesures Google réelles) :
   le même chemin pour le chauffeur dans les deux sens. */
const BEAUVAIS_CDG = T(73, 50, [76, 55], [85, 70], [0, 1], [30, 35])
const CDG_BEAUVAIS = T(76, 55, [0, 1], [30, 35], [73, 50], [85, 70])
const tous = (g: GrilleV2, v: CleVehiculeV2) => TRAJETS.map(t => prixV2(v, t, g).prix)

console.log(`${B}L'accélérateur${Z}`)
{
  const base = copie(GRILLE_DE_DEPART), plus = copie(GRILLE_DE_DEPART)
  plus.vehicules.berline.prixKm *= 1.2
  const a = tous(base, 'berline'), b = tous(plus, 'berline')
  verifier(b.every((p, i) => p >= a[i]) && b.some((p, i) => p > a[i]), 'prix du km de la berline +20 % → aucun trajet ne baisse, et les trajets au-dessus du minimum montent')
  verifier(VEH.filter(v => v !== 'berline').every(v => JSON.stringify(tous(base, v)) === JSON.stringify(tous(plus, v))), '… et aucun autre véhicule ne bouge')
}
{
  const base = copie(GRILLE_DE_DEPART), moins = copie(GRILLE_DE_DEPART)
  moins.vehicules.van.prixHeure *= 0.8
  const a = tous(base, 'van'), b = tous(moins, 'van')
  verifier(b.every((p, i) => p <= a[i]) && b.some((p, i) => p < a[i]), 'prix de l’heure du van −20 % → aucun trajet en van ne monte, et ceux au-dessus du minimum baissent')
}
{
  const base = copie(GRILLE_DE_DEPART), pec = copie(GRILLE_DE_DEPART)
  pec.vehicules.berline.priseEnCharge = 10
  const t = TRAJETS[4]
  verifier(prixV2('berline', t, pec).prix === prixV2('berline', t, base).prix + 10, 'prise en charge +10 € → +10 € sur un trajet au-dessus du minimum')
}

console.log(`\n${B}Le minimum et l'arrondi${Z}`)
verifier(prixV2('berline', TRAJETS[0], GRILLE_DE_DEPART).prix === 59 && prixV2('berline', TRAJETS[0], GRILLE_DE_DEPART).auMinimum, 'petit trajet dans Paris → minimum de la berline (59 €), signalé « au minimum »')
verifier(VEH.every(v => tous(GRILLE_DE_DEPART, v).every(p => p >= GRILLE_DE_DEPART.vehicules[v].minimum && Number.isInteger(p))), 'tous les prix sont des euros entiers, jamais sous le minimum de leur véhicule')

console.log(`\n${B}Le circuit réel (règle du 2026-11-22)${Z}`)
{
  const d = prixV2('berline', TRAJETS[2], GRILLE_DE_DEPART)
  verifier(d.base === 'Roissy-CDG' && Math.abs(d.kmFactures - (27 + 26 + 0)) < 1e-9, 'Chantilly → CDG : base Roissy, km = approche 27 + trajet 26 + retour 0')
  const a = prixV2('berline', BEAUVAIS_CDG, GRILLE_DE_DEPART), b = prixV2('berline', CDG_BEAUVAIS, GRILLE_DE_DEPART)
  verifier(a.prix === b.prix && Math.abs(a.kmFactures - b.kmFactures) < 1e-9, `Beauvais → CDG (${a.prix} €) = CDG → Beauvais (${b.prix} €) : le même chemin coûte le même prix`)
  const t = TRAJETS[1]
  verifier(prixV2('berline', t, GRILLE_DE_DEPART).base === 'Paris Châtelet', 'départ à Paris → base Paris (la moins chère)')
  const g = copie(GRILLE_DE_DEPART); g.bases[1].active = false
  verifier(prixV2('berline', t, g).base === 'Roissy-CDG', 'base Paris désactivée → Roissy prend le relais')
  const g0 = copie(GRILLE_DE_DEPART); g0.bases.forEach(x => (x.active = false))
  const sans = prixV2('berline', TRAJETS[4], g0)
  verifier(sans.base === null && Math.abs(sans.kmFactures - 2 * 185) < 1e-9, 'aucune base active → aller-retour du trajet seul, et « base : aucune »')
}

console.log(`\n${B}Zone d'action et approche offerte (2026-11-22)${Z}`)
{
  const t = TRAJETS[4] // Orléans → Provins : approche Paris 132 km / 97 min (base retenue)
  const ref = prixV2('berline', t, GRILLE_DE_DEPART)
  const g = copie(GRILLE_DE_DEPART); g.bases[1].kmInclus = 25; g.bases[1].minInclus = 30
  const d = prixV2('berline', t, g)
  verifier(ref.base === 'Paris Châtelet' && d.base === 'Paris Châtelet' && Math.abs(d.kmFactures - (ref.kmFactures - 25)) < 1e-9 && Math.abs(d.minFactures - (ref.minFactures - 30)) < 1e-9 && d.approcheOfferteKm === 25,
    'base Paris, 25 km et 30 min d’approche offerts → 25 km et 30 min de moins facturés')
  verifier(d.prix < ref.prix, `… et le prix baisse (${ref.prix} € → ${d.prix} €)`)
  const g2 = copie(GRILLE_DE_DEPART); g2.bases[1].kmInclus = 25; g2.bases[1].minInclus = 30
  const c = prixV2('berline', TRAJETS[0], g2) // approche Paris 3 km / 10 min, trajet 4 km, retour 5 km
  verifier(c.approcheOfferteKm === 3 && Math.abs(c.kmFactures - (4 + 5)) < 1e-9, 'approche plus courte que l’offert → approche gratuite, jamais négative ; trajet et retour restent payés')
  const g3 = copie(GRILLE_DE_DEPART); g3.bases[0].zoneKm = 10; g3.bases[0].kmInclus = 1000; g3.bases[0].minInclus = 1000
  verifier(prixV2('berline', t, g3).base === 'Paris Châtelet', 'zone d’action jugée sur l’approche RÉELLE : Roissy (zone 10 km) reste écartée même avec 1000 km offerts')
  const g4 = copie(GRILLE_DE_DEPART); g4.bases[1].zoneKm = 10
  verifier(prixV2('berline', TRAJETS[1], g4).base === 'Paris Châtelet' && prixV2('berline', t, g4).base === 'Roissy-CDG', 'zone de 10 km sur Paris : gardée pour un départ à 5 km, écartée pour Orléans → Provins')
}

console.log(`\n${B}Les noms de véhicule de la base${Z}`)
verifier(cleVehiculeV2('grand_van_8') === 'grand_van' && cleVehiculeV2('van_7') === 'van' && cleVehiculeV2('berline_premium') === 'berline_premium' && cleVehiculeV2('inconnu') === null, 'grand_van_8 → grand_van, van_7 → van, inconnu → aucun')

console.log(`\n${B}Rien n'est branché dans le site${Z}`)
{
  const fichiers: string[] = []
  const parcourir = (d: string) => { for (const f of readdirSync(d)) { const p = join(d, f); if (statSync(p).isDirectory()) parcourir(p); else if (/\.(ts|tsx)$/.test(f)) fichiers.push(p) } }
  parcourir(resolve('src'))
  /* Hors des dossiers du projet, AUCUN fichier ne doit IMPORTER le code v2.
     Un simple lien (le menu de l'administration) n'est pas un branchement. */
  const branches = fichiers.filter(f => !/[\\/]tarification-v2[\\/]/.test(f) && /from\s+['"][^'"]*tarification-v2/.test(readFileSync(f, 'utf8')))
  verifier(branches.length === 0, `aucun fichier du site n’importe le calcul v2 (${branches.length}${branches.length ? ' : ' + branches.join(', ') : ''})`)
  /* Et le code v2 ne lit le calcul actuel que par UN fichier : prix-actuel.ts,
     autorisé par l'exploitant le 2026-11-21 pour afficher le prix actuel à
     côté du prix v2 (déclaré aussi dans controle-prod-intacte.mjs). */
  const v2 = fichiers.filter(f => /[\\/]tarification-v2[\\/]/.test(f))
  const versActuel = v2.filter(f => /from\s+['"][^'"]*(calcPrix|tarification['"]|devis-et-tarifs|affichagePrix)['"]/.test(readFileSync(f, 'utf8')))
  const autorise = (f: string) => /[\\/]src[\\/]lib[\\/]tarification-v2[\\/]prix-actuel\.ts$/.test(f)
  verifier(v2.length >= 5 && versActuel.length === 1 && versActuel.every(autorise),
    `le code v2 (${v2.length} fichiers) ne lit le calcul actuel que par prix-actuel.ts (${versActuel.length} lecteur(s)${versActuel.filter(f => !autorise(f)).length ? ' — NON autorisé : ' + versActuel.filter(f => !autorise(f)).join(', ') : ''})`)
}

console.log(`\n${ko ? R : V}${B}${ok} contrôle(s) réussi(s), ${ko} échec(s)${Z}`)
process.exit(ko ? 1 : 0)
