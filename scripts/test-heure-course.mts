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
import fs from 'node:fs'
import path from 'node:path'

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

/* ── Personne ne lit ni n'ecrit l'heure a la main ─────────────────────────── */
const fichiers: string[] = []
;(function parcourir(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) parcourir(f)
    else if (/\.tsx?$/.test(e.name)) fichiers.push(f)
  }
})('src')

// Formater une heure de course a la main est interdit : c'est ainsi que
// l'ecart de deux heures est apparu. Comparer l'instant reel a `Date.now()`
// reste permis — c'est meme la seule facon juste de mesurer une echeance.
const formateursBruts = fichiers.filter(f => {
  if (f.endsWith(path.join('lib', 'heure.ts'))) return false
  const c = fs.readFileSync(f, 'utf8')
  return /new Date\([^)]*date_prevue[^)]*\)[\s\S]{0,4}\.toLocale/.test(c) || /date_prevue\.replace/.test(c)
})
dit('aucun fichier ne formate une heure de course a la main', formateursBruts.length === 0, formateursBruts.join(', '))

const rustine = fichiers.filter(f =>
  !f.endsWith(path.join('lib', 'heure.ts')) &&
  /\[\+\-\]\d\{2\}:\d\{2\}\|Z/.test(fs.readFileSync(f, 'utf8')))
dit("la rustine de fuseau n'est copiee nulle part", rustine.length === 0, rustine.join(', '))

console.log(`\n${ko === 0 ? '✓' : '✗'}  ${ok} controle(s) au vert, ${ko} au rouge\n`)
process.exitCode = ko === 0 ? 0 : 1
