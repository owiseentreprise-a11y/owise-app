/**
 * L'heure d'une course s'affiche-t-elle pareil partout ?
 *
 * Le defaut trouve le 2026-09-22 : la meme valeur donnait 04:15 sur le serveur
 * Vercel (heure universelle) et 06:15 dans un navigateur francais. Mme Menage,
 * attendue a 04:15, a recu une confirmation annoncant 06:15, et a du telephoner
 * la veille pour faire corriger.
 *
 * Ce controle lance un vrai processus par fuseau horaire — c'est la seule facon
 * fiable de reproduire ce que voit une machine reglee autrement.
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

const ALLER = '2026-09-22T04:15:00+00:00'   // valeur exacte lue en base
const RETOUR = '2026-09-25T20:15:00+00:00'

function sous(tz: string, valeur: string) {
  const out = execFileSync('npx', ['tsx', 'scripts/_heure-sonde.mts', valeur], {
    encoding: 'utf8', env: { ...process.env, TZ: tz }, shell: true,
  })
  return JSON.parse(out.slice(out.indexOf('{')))
}

console.log('\nHeure d\'une course, selon le fuseau de la machine\n')

for (const tz of ['UTC', 'Europe/Paris', 'America/New_York']) {
  const a = sous(tz, ALLER)
  const r = sous(tz, RETOUR)
  dit(`${tz.padEnd(18)} aller  ${a.heure}`, a.heure === '04:15', `attendu 04:15`)
  dit(`${tz.padEnd(18)} retour ${r.heure}`, r.heure === '20:15', `attendu 20:15`)
  dit(`${tz.padEnd(18)} date   ${a.date}`, /22 septembre 2026/.test(a.date), a.date)
}

const p = sous('Europe/Paris', '2026-09-22T04:15:00')
dit('valeur sans suffixe de fuseau', p.heure === '04:15', p.heure)
const z = sous('Europe/Paris', '2026-09-22T04:15:00Z')
dit('valeur terminee par Z', z.heure === '04:15', z.heure)


/* ── L'heure est-elle lue partout par la fonction commune ? ───────────────── */
const fichiers: string[] = []
;(function parcourir(d: string) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, e.name)
    if (e.isDirectory()) parcourir(f)
    else if (/\.tsx?$/.test(e.name)) fichiers.push(f)
  }
})('src')

// Personne ne doit relire `date_prevue` a la main. Les actions serveur et les
// routes construisent la valeur avant ecriture : elles sont hors du controle.
const brut = fichiers.filter(f => {
  if (f.endsWith(path.join('lib', 'heure.ts'))) return false
  if (/actions\.ts$|route\.ts$/.test(f)) return false
  const c = fs.readFileSync(f, 'utf8')
  return /new Date\([^)]*date_prevue/.test(c) || /date_prevue\.replace/.test(c)
})
dit("aucun ecran ne relit l'heure a la main", brut.length === 0, brut.join(', '))

// La rustine qui retirait le suffixe de fuseau etait recopiee dans 4 fichiers ;
// elle ne doit plus exister nulle part ailleurs que dans lib/heure.ts.
const rustine = fichiers.filter(f =>
  !f.endsWith(path.join('lib', 'heure.ts')) &&
  /\[\+\-\]\d\{2\}:\d\{2\}\|Z/.test(fs.readFileSync(f, 'utf8')))
dit('la rustine de fuseau n\'est copiee nulle part', rustine.length === 0, rustine.join(', '))

console.log(`\n${ko === 0 ? '✓' : '✗'}  ${ok} controle(s) au vert, ${ko} au rouge\n`)
process.exitCode = ko === 0 ? 0 : 1
