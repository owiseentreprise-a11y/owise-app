/**
 * Le garde-fou des routes Google tient-il ses promesses ?
 *
 * On ne teste pas contre un serveur : on interroge directement la fonction de
 * décision, pour pouvoir pousser jusqu'aux plafonds sans envoyer un seul appel
 * à Google.
 *
 * Lancer depuis owise-app :  npx tsx scripts/test-quota.mts
 */
import { refuser, PLAFONDS } from '../src/lib/quota'

let ok = 0, ko = 0
const dit = (titre: string, vrai: boolean, detail = '') => {
  console.log(`  ${vrai ? '✓' : '✗'} ${titre}${vrai ? '' : `  —  ${detail}`}`)
  vrai ? ok++ : ko++
}

console.log('\nGarde-fou des routes facturées par Google\n')
console.log(`plafonds : ${JSON.stringify(PLAFONDS.places)}\n`)

// ── 1. Un visiteur seul est arrêté à sa propre limite ─────────────────────
{
  const p = PLAFONDS.places.visiteur
  let refus: string | null = null
  for (let i = 0; i < p; i++) refus = refuser('places', '1.1.1.1')
  dit(`${p} appels d'un même visiteur passent`, refus === null, `refusé à ${refus}`)
  dit('le suivant est refusé', refuser('places', '1.1.1.1') === 'visiteur', 'passé quand même')
}

// ── 2. Une attaque répartie est arrêtée par le plafond global ─────────────
// C'était le trou : chaque adresse restait sous sa propre limite, donc rien
// ne les arrêtait. On envoie un appel depuis des adresses toutes différentes.
{
  const p = PLAFONDS.geocode.minute
  let premierRefus = -1
  for (let i = 0; i < p + 50; i++) {
    if (refuser('geocode', `10.0.${Math.floor(i / 250)}.${i % 250}`) !== null && premierRefus < 0) premierRefus = i
  }
  dit('une attaque répartie finit par être arrêtée', premierRefus >= 0, 'jamais arrêtée')
  dit(`arrêtée au plafond par minute (${p})`, premierRefus === p,
      `arrêtée au ${premierRefus}e appel`)
}

// ── 3. Chaque route a son propre compteur ─────────────────────────────────
{
  dit('une route saturée n’en bloque pas une autre',
      refuser('distance', '2.2.2.2') === null,
      'distance refusée alors que seule geocode était saturée')
}

// ── 4. Les plafonds laissent passer l'usage réel ──────────────────────────
// Mesure du 2026-09-21 : environ 80 appels à Google sur 24 heures, tous
// services confondus. Les plafonds doivent garder une marge confortable.
{
  const usageReelParJour = 80
  const marge = Math.min(...Object.values(PLAFONDS).map(p => p.jour)) / usageReelParJour
  dit(`marge d’au moins 20 fois l’usage réel (${marge.toFixed(0)}×)`, marge >= 20,
      `seulement ${marge.toFixed(1)}×`)
}

console.log(`\n${ko === 0 ? '✓' : '✗'}  ${ok} contrôle(s) au vert, ${ko} au rouge\n`)
process.exitCode = ko === 0 ? 0 : 1
