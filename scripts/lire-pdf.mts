/**
 * Relire un PDF produit par pdf-lib — brique partagée par les contrôles.
 *
 * Elle vivait dans `test-facture-pdf.mts`. Le contrôle du devis en avait
 * besoin à son tour ; en écrire une seconde version a coûté une série
 * d'échecs trompeurs — la copie ne lisait que les chaînes littérales
 * « (OWISE) Tj » et ne décompressait pas les flux, alors que pdf-lib écrit
 * en hexadécimal « <4F57495345> Tj » dans des flux Flate. Les PDF étaient
 * justes, le lecteur était faux.
 *
 * C'est précisément ce que CLAUDE.md répète : une deuxième écriture d'une
 * même règle dérive. Les deux contrôles lisent maintenant ici.
 */
import { inflateSync } from 'zlib'

/** Déséchappe une chaîne littérale PDF : \( \) \\ \n \ddd */
function decoderChaine(brut: string): string {
  let out = ''
  for (let i = 0; i < brut.length; i++) {
    if (brut[i] !== '\\') { out += brut[i]; continue }
    const suivant = brut[++i]
    if (suivant >= '0' && suivant <= '7') {
      let oct = suivant
      while (oct.length < 3 && brut[i + 1] >= '0' && brut[i + 1] <= '7') oct += brut[++i]
      out += String.fromCharCode(parseInt(oct, 8))
    } else if (suivant === 'n') out += '\n'
    else if (suivant === 'r') out += '\r'
    else if (suivant === 't') out += '\t'
    else out += suivant
  }
  return out
}

/**
 * Les octets d'une police standard sont du WinAnsi. Latin-1 suffit partout
 * sauf entre 0x80 et 0x9F, où WinAnsi loge l'euro et les signes typographiques.
 * Sans cette table, « 59,00 € » se relit « 59,00  » et le contrôle du
 * montant échoue alors que le document est juste.
 */
const WINANSI_HAUT: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

export function decoderWinAnsi(s: string): string {
  return [...s].map(c => WINANSI_HAUT[c.charCodeAt(0)] ?? c).join('')
}

/**
 * Extrait le texte réellement inscrit dans le PDF, en lisant les opérateurs Tj
 * des flux de contenu, décompressés au passage.
 *
 * Deux écritures coexistent dans un PDF : la chaîne littérale « (OWISE) Tj »
 * et la chaîne hexadécimale « <4F57495345> Tj ». pdf-lib emploie la seconde —
 * ne lire que la première faisait passer ce contrôle pour un échec total alors
 * que les PDF étaient corrects.
 */
export function lireTextePdf(octets: Uint8Array): string {
  const buf = Buffer.from(octets)
  const morceaux: string[] = []

  const ajouterDepuis = (source: string) => {
    for (const m of source.matchAll(/(?:\(((?:\\.|[^\\()])*)\)|<([0-9A-Fa-f\s]*)>)\s*Tj/g)) {
      if (m[1] !== undefined) morceaux.push(decoderChaine(m[1]))
      else morceaux.push(Buffer.from(m[2].replace(/\s/g, ''), 'hex').toString('latin1'))
    }
  }

  const texte = buf.toString('latin1')
  ajouterDepuis(texte)

  let pos = 0
  while ((pos = texte.indexOf('stream', pos)) !== -1) {
    let debut = pos + 'stream'.length
    if (texte[debut] === '\r') debut++
    if (texte[debut] === '\n') debut++
    const fin = texte.indexOf('endstream', debut)
    if (fin === -1) break
    try { ajouterDepuis(inflateSync(buf.subarray(debut, fin)).toString('latin1')) } catch { /* flux non compressé */ }
    pos = fin + 'endstream'.length
  }

  return decoderWinAnsi(morceaux.join('\n'))
}
