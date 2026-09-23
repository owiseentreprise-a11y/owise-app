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
import { fichiersSource, affichagesSansFuseau, ecrituresNonConverties } from './_heure-regles.mjs'

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

// Cas reels : la course de Mme Menage, son retour, et les deux saisons.
const CAS: [string, string, string][] = [
  ['2026-09-22T04:15', '2026-09-22T02:15:00.000Z', '04:15'],  // ete, +2 h
  ['2026-09-25T20:15', '2026-09-25T18:15:00.000Z', '20:15'],  // ete, +2 h
  ['2026-01-15T07:30', '2026-01-15T06:30:00.000Z', '07:30'],  // hiver, +1 h
  ['2026-10-25T01:30', '2026-10-24T23:30:00.000Z', '01:30'],  // nuit du changement d'heure
  ['2026-10-25T04:30', '2026-10-25T03:30:00.000Z', '04:30'],  // apres le changement, +1 h
]

for (const tz of ['UTC', 'Europe/Paris', 'America/New_York']) {
  for (const [saisie, attenduStocke, attenduAffiche] of CAS) {
    const r = sous(tz, saisie)
    dit(`${tz.padEnd(17)} ${saisie} -> stocke ${r.stocke}`, r.stocke === attenduStocke, `attendu ${attenduStocke}`)
    dit(`${tz.padEnd(17)} ${saisie} -> affiche ${r.heure}`, r.heure === attenduAffiche, `attendu ${attenduAffiche}`)
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

const ecritures = ecrituresNonConverties(fichiers)
dit('toute heure enregistree passe par instantDepuisSaisieParis', ecritures.length === 0,
    `${ecritures.length} endroit(s)`)
for (const a of ecritures) console.log(`      ${a.fichier}:${a.ligne}  ${a.quoi}`)

console.log(`
${ko === 0 ? '✓' : '✗'}  ${ok} controle(s) au vert, ${ko} au rouge
`)
process.exitCode = ko === 0 ? 0 : 1
