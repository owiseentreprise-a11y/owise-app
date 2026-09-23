/**
 * Les deux règles de fond sur l'heure d'une course, vérifiées sur le code.
 *
 * Elles existent parce que la version précédente de ce contrôle ne cherchait
 * qu'un motif littéral (`new Date(...date_prevue...).toLocale`). Elle a laissé
 * passer une fonction maison `fmt(iso)` sur la page de détail d'une course, et
 * ne regardait aucun chemin d'écriture : le retour de Mme Bouchard est passé
 * de 14:00 à 16:00 sans qu'aucun test ne bronche (2026-09-23).
 */
import fs from 'node:fs'
import path from 'node:path'

export type Anomalie = { fichier: string; ligne: number; quoi: string; code: string }

const CHAMPS = '(date_prevue|date_debut|date_fin|date_course|datePrevue)'
const aUnChamp = (s: string) => new RegExp('\\b' + CHAMPS + '\\b').test(s)
const passeParLeModule = (s: string) =>
  /lireHeureCourse|heureCourse|dateCourse|heureMuraleParis|formaterAParis|pourChampSaisie/.test(s)

export function fichiersSource(racine = 'src'): string[] {
  const out: string[] = []
  ;(function marcher(d: string) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const f = path.join(d, e.name)
      if (e.isDirectory()) marcher(f)
      else if (/\.tsx?$/.test(e.name)) out.push(f)
    }
  })(racine)
  return out
}

/* ─────────────────────────── Règle 1 : l'affichage ───────────────────────── */

/**
 * Aucune heure de course ne s'affiche sans fuseau.
 *
 * Suit les variables (`const d = new Date(c.date_prevue)` puis `d.toLocale…`)
 * et les petites fonctions de formatage déclarées dans le fichier — c'est par
 * l'une d'elles, `fmt(iso)`, que la page de détail échappait à la règle.
 */
export function affichagesSansFuseau(fichiers: string[]): Anomalie[] {
  const trouve: Anomalie[] = []

  for (const f of fichiers) {
    if (f.endsWith(path.join('lib', 'heure.ts'))) continue
    const lignes = fs.readFileSync(f, 'utf8').split('\n')

    const variables = new Map<string, number>()
    const fonctions = new Map<string, number>()

    lignes.forEach((l, i) => {
      const mv = l.match(/(?:const|let|var)\s+(\w+)\s*(?::[^=]*)?=\s*new Date\((.*)$/)
      if (mv && aUnChamp(mv[2]) && !passeParLeModule(l)) variables.set(mv[1], i + 1)

      const mf = l.match(/(?:const|let)\s+(\w+)\s*=\s*\(?[^)=]*\)?\s*=>\s*new Date\(/)
      if (mf && /\.toLocale/.test(l) && !/timeZone/.test(l)) fonctions.set(mf[1], i + 1)

      const mg = l.match(/function\s+(\w+)\s*\(/)
      if (mg) {
        const corps = lignes.slice(i, i + 8).join('\n')
        if (/new Date\([^)]*\)\s*\.toLocale/.test(corps) && !/timeZone/.test(corps)) fonctions.set(mg[1], i + 1)
      }
    })

    lignes.forEach((l, i) => {
      const n = i + 1
      if (/new Date\([^;]*\)\s*\.toLocale/.test(l) && aUnChamp(l) && !/timeZone/.test(l) && !passeParLeModule(l)) {
        trouve.push({ fichier: f, ligne: n, quoi: 'formatage direct sans fuseau', code: l.trim() })
        return
      }
      for (const [nom, decl] of variables) {
        if (new RegExp('\\b' + nom + '\\s*\\.toLocale').test(l)) {
          trouve.push({ fichier: f, ligne: n, quoi: `variable « ${nom} » (l.${decl}) construite sans fuseau`, code: l.trim() })
        }
      }
      for (const [nom, decl] of fonctions) {
        if (new RegExp('\\b' + nom + '\\s*\\(').test(l) && aUnChamp(l) && !l.includes('=>') && decl !== n) {
          trouve.push({ fichier: f, ligne: n, quoi: `« ${nom}() » (l.${decl}) formate sans fuseau`, code: l.trim() })
        }
      }
    })
  }

  const vus = new Set<string>()
  return trouve.filter(a => {
    const cle = `${a.fichier}:${a.ligne}`
    if (vus.has(cle)) return false
    vus.add(cle); return true
  })
}

/* ─────────────────────────── Règle 2 : l'écriture ────────────────────────── */

/** Une expression qui produit un instant réel, et non une heure murale. */
const PRODUIT_UN_INSTANT = /instantDepuisSaisieParis|pourLaBase|new Date\(\)|Date\.now\(\)|^null$|^\w+\.created_at/

/**
 * Remonte la chaîne d'affectations d'une variable, dans le même fichier, et dit
 * si son origine produit un instant réel. Quatre sauts suffisent en pratique
 * (`saisie → instantDepuisSaisieParis → Date → toISOString`).
 */
function origineSaine(nom: string, lignes: string[], sauts = 4): boolean {
  if (sauts === 0) return false
  const decl = lignes.find(l => new RegExp(`(?:const|let|var)\\s+${nom}\\b\\s*(?::[^=]*)?=`).test(l))
  if (!decl) return false
  const valeur = decl.slice(decl.indexOf('=') + 1).trim()
  if (PRODUIT_UN_INSTANT.test(valeur)) return true
  const suivant = valeur.match(/^(\w+)(?:\.toISOString\(\))?\s*$/)?.[1]
  return suivant ? origineSaine(suivant, lignes, sauts - 1) : false
}

/**
 * Toute valeur posée dans `date_prevue` / `date_debut` / `date_fin` **par une
 * écriture en base** vient de `instantDepuisSaisieParis`, de `pourLaBase`, ou
 * d'un instant déjà réel.
 *
 * Ne regarde que l'intérieur d'un `.insert({…})` ou `.update({…})` : ailleurs,
 * `date_prevue: x` n'est qu'un argument passé à une action serveur, qui fera
 * elle-même la conversion, et le signaler noierait la vraie anomalie.
 */
export function ecrituresNonConverties(fichiers: string[]): Anomalie[] {
  const trouve: Anomalie[] = []

  for (const f of fichiers) {
    if (f.includes(path.join('api', 'test'))) continue      // routes de test
    const lignes = fs.readFileSync(f, 'utf8').split('\n')

    for (let i = 0; i < lignes.length; i++) {
      if (!/\.(insert|update|upsert)\s*\(/.test(lignes[i])) continue

      // On parcourt l'objet écrit jusqu'à ce que les parenthèses se referment.
      let profondeur = 0, demarre = false
      for (let j = i; j < Math.min(lignes.length, i + 60); j++) {
        for (const c of lignes[j]) {
          if (c === '(') { profondeur++; demarre = true }
          else if (c === ')') profondeur--
        }
        const m = lignes[j].match(/^\s*(date_prevue|date_debut|date_fin)\s*:\s*(.+?),?\s*$/)
        if (m) {
          const valeur = m[2]
          if (!PRODUIT_UN_INSTANT.test(valeur)) {
            const nom = valeur.match(/^(\w+)(?:\.toISOString\(\))?\s*$/)?.[1]
            if (!nom || !origineSaine(nom, lignes)) {
              trouve.push({
                fichier: f, ligne: j + 1,
                quoi: nom
                  ? `« ${nom} » n'est pas converti en instant reel`
                  : 'valeur ecrite sans conversion',
                code: lignes[j].trim(),
              })
            }
          }
        }
        if (demarre && profondeur <= 0) break
      }
    }
  }
  return trouve
}

/* ────────────────────── Règle 3 : le regroupement par jour ───────────────── */

/**
 * Un regroupement ou un filtrage par jour se fait sur le jour **parisien**.
 *
 * Découper la chaîne stockée (`date_prevue.slice(0, 10)`, `.startsWith(today)`)
 * donne le jour universel. Une course de nuit à 00:30 heure de Paris est
 * enregistrée la veille : elle se rangeait au mauvais jour dans l'agenda du
 * sous-traitant, sortait du compteur « courses aujourd'hui », et basculait de
 * mois dans les statistiques.
 *
 * `new Date().toISOString().slice(0, 10)` est signalé de la même façon quand il
 * sert de « aujourd'hui » : sur le serveur Vercel, il annonce encore la veille
 * jusqu'à 02:00 heure française.
 */
export function regroupementsParJourUniversel(fichiers: string[]): Anomalie[] {
  const trouve: Anomalie[] = []
  const champs = /\b(date_prevue|date_debut|date_fin)\b/

  for (const f of fichiers) {
    if (f.endsWith(path.join('lib', 'heure.ts'))) continue
    const lignes = fs.readFileSync(f, 'utf8').split('\n')

    lignes.forEach((l, i) => {
      const n = i + 1
      if (champs.test(l) && /\.slice\(\s*0\s*,\s*10\s*\)/.test(l) && !/jourParis/.test(l)) {
        trouve.push({ fichier: f, ligne: n, quoi: 'jour obtenu en decoupant la chaine stockee', code: l.trim() })
        return
      }
      if (champs.test(l) && /\.startsWith\(/.test(l) && !passeParLeModule(l) && !/jourParis/.test(l)) {
        trouve.push({ fichier: f, ligne: n, quoi: 'jour ou mois compare sur la chaine stockee', code: l.trim() })
        return
      }
      // « aujourd'hui » pris sur l'horloge universelle, au voisinage d'une course
      if (/new Date\(\)\.toISOString\(\)\s*\.?\s*(slice\(\s*0\s*,\s*10\s*\)|split\('T'\)\[0\])/.test(l)) {
        const autour = lignes.slice(Math.max(0, i - 6), i + 7).join('\n')
        if (/course|Course|today|Today|jour|Jour/.test(autour) && !/date_emission|date_echeance|DATE_M(IN|AX)|min=/.test(autour)) {
          trouve.push({ fichier: f, ligne: n, quoi: "« aujourd'hui » pris en temps universel", code: l.trim() })
        }
      }
    })
  }
  return trouve
}
