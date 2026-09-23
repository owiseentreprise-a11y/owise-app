/**
 * L'heure saisie a Paris est-elle celle qui ressort, partout ?
 *
 * Defaut trouve le 2026-09-22 : la saisie parisienne etait enregistree avec une
 * etiquette « +00:00 » mensongere. Selon la machine, l'affichage donnait 04:15
 * ou 06:15. Mme Menage, attendue a 04:15, a recu une confirmation annoncant
 * 06:15 et a du telephoner la veille pour faire corriger.
 *
 * Ce controle verifie l'aller-retour complet — saisie parisienne, instant reel
 * stocke, reaffichage — en lancant un vrai processus par fuseau horaire.
 *
 * Lancer depuis owise-app :  npx tsx scripts/test-heure-course.mts
 */
import { execFileSync } from 'node:child_process'
import { fichiersSource, affichagesSansFuseau, ecrituresNonConverties, regroupementsParJourUniversel } from './_heure-regles.mjs'

let ok = 0, ko = 0
const dit = (titre: string, vrai: boolean, detail = '') => {
  console.log(`  ${vrai ? '✓' : '✗'} ${titre}${vrai ? '' : `  —  ${detail}`}`)
  vrai ? ok++ : ko++
}
function sous(tz: string, saisie: string) {
  const out = execFileSync('npx', ['tsx', 'scripts/_heure-sonde.mts', saisie], {
    encoding: 'utf8', env: { ...process.env, TZ: tz }, shell: true,
  })
  return JSON.parse(out.slice(out.indexOf('{')))
}

console.log('\nUne heure saisie a Paris, vue depuis trois machines differentes\n')

// Cas reels : les courses de Mme Menage et de Mme Bouchard, les deux saisons,
// la nuit du changement d'heure, et deux courses de nuit — celles-ci sont
// enregistrees la VEILLE en temps universel, ce qui les faisait basculer de
// jour dans l'agenda du sous-traitant et de mois dans les statistiques.
const CAS: [string, string, string, string][] = [
  ['2026-09-22T04:15', '2026-09-22T02:15:00.000Z', '04:15', '2026-09-22'],  // ete, +2 h
  ['2026-09-25T20:15', '2026-09-25T18:15:00.000Z', '20:15', '2026-09-25'],  // ete, +2 h
  ['2026-09-24T14:00', '2026-09-24T12:00:00.000Z', '14:00', '2026-09-24'],  // retour Mme Bouchard
  ['2026-01-15T07:30', '2026-01-15T06:30:00.000Z', '07:30', '2026-01-15'],  // hiver, +1 h
  ['2026-10-25T01:30', '2026-10-24T23:30:00.000Z', '01:30', '2026-10-25'],  // nuit du changement d'heure
  ['2026-10-25T04:30', '2026-10-25T03:30:00.000Z', '04:30', '2026-10-25'],  // apres le changement, +1 h
  ['2026-09-25T00:30', '2026-09-24T22:30:00.000Z', '00:30', '2026-09-25'],  // nuit d'ete : veille en UTC
  ['2026-10-01T00:30', '2026-09-30T22:30:00.000Z', '00:30', '2026-10-01'],  // 1er du mois, avant 02:00
  ['2026-01-01T00:30', '2025-12-31T23:30:00.000Z', '00:30', '2026-01-01'],  // 1er janvier : annee precedente en UTC
]

for (const tz of ['UTC', 'Europe/Paris', 'America/New_York']) {
  for (const [saisie, attenduStocke, attenduAffiche, attenduJour] of CAS) {
    const r = sous(tz, saisie)
    dit(`${tz.padEnd(17)} ${saisie} -> stocke ${r.stocke}`, r.stocke === attenduStocke, `attendu ${attenduStocke}`)
    dit(`${tz.padEnd(17)} ${saisie} -> affiche ${r.heure}`, r.heure === attenduAffiche, `attendu ${attenduAffiche}`)
    dit(`${tz.padEnd(17)} ${saisie} -> jour ${r.jour}`, r.jour === attenduJour, `attendu ${attenduJour}`)
    dit(`${tz.padEnd(17)} ${saisie} -> champ ${r.champ}`, r.champ === saisie, `attendu ${saisie}`)
  }
}

/* ── Le code respecte-t-il les deux regles ? ──────────────────────────────── */
const fichiers = fichiersSource('src')
console.log(`
Le code, sur ${fichiers.length} fichiers
`)

const lectures = affichagesSansFuseau(fichiers)
dit("aucune heure de course ne s'affiche sans fuseau", lectures.length === 0,
    `${lectures.length} endroit(s)`)
for (const a of lectures) console.log(`      ${a.fichier}:${a.ligne}  ${a.quoi}`)

const jours = regroupementsParJourUniversel(fichiers)
dit('aucun regroupement par jour ne decoupe la chaine brute', jours.length === 0,
    `${jours.length} endroit(s)`)
for (const a of jours) console.log(`      ${a.fichier}:${a.ligne}  ${a.quoi}`)

const ecritures = ecrituresNonConverties(fichiers)
dit('toute heure enregistree passe par instantDepuisSaisieParis', ecritures.length === 0,
    `${ecritures.length} endroit(s)`)
for (const a of ecritures) console.log(`      ${a.fichier}:${a.ligne}  ${a.quoi}`)

console.log(`
${ko === 0 ? '✓' : '✗'}  ${ok} controle(s) au vert, ${ko} au rouge
`)
process.exitCode = ko === 0 ? 0 : 1
