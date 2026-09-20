/**
 * Contrôle que le PDF joint aux e-mails de facture dit bien la même chose que
 * la base — sur TOUTES les factures existantes, pas sur un échantillon.
 *
 * Ce projet s'est déjà fait piéger par des rendus divergents de la même donnée
 * (trois calculs de prix incompatibles, une zone testée sur un seul trajet).
 * Une facture est pire : un écart entre l'écran et le PDF envoyé au client est
 * une erreur comptable. Ce script relit le PDF produit — il n'interroge pas le
 * code qui l'a écrit — et compare chaque montant à la ligne en base.
 *
 * Usage : npx tsx scripts/test-facture-pdf.ts [--ecrire <dossier>]
 * Sort en code 1 dès qu'un contrôle échoue.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { inflateSync } from 'zlib'

// .env.local avant tout import applicatif : createAdminClient lit process.env
// au moment de l'appel, mais autant échouer tôt et clairement.
for (const ligne of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const { createAdminClient } = await import('../src/lib/supabase/admin')
const { chargerDocumentFacture, formaterMontant } = await import('../src/lib/facture-document')
const { rendreFacturePdf, nettoyerPourPdf } = await import('../src/lib/facture-pdf')

const dossier = process.argv.includes('--ecrire')
  ? process.argv[process.argv.indexOf('--ecrire') + 1]
  : null
if (dossier) mkdirSync(dossier, { recursive: true })

// ── Relecture du PDF ─────────────────────────────────────────────────────────

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
 * Extrait le texte réellement inscrit dans le PDF, en lisant les opérateurs Tj
 * des flux de contenu, décompressés au passage.
 *
 * Deux écritures coexistent dans un PDF : la chaîne littérale « (OWISE) Tj »
 * et la chaîne hexadécimale « <4F57495345> Tj ». pdf-lib emploie la seconde —
 * ne lire que la première faisait passer ce contrôle pour un échec total alors
 * que les PDF étaient corrects.
 */
function lireTextePdf(octets: Uint8Array): string {
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

/**
 * Les octets d'une police standard sont du WinAnsi. Latin-1 suffit partout
 * sauf entre 0x80 et 0x9F, où WinAnsi loge l'euro et les signes typographiques.
 * Sans cette table, « 59.00 € » se relit « 59.00  » et le contrôle du
 * montant échoue alors que le document est juste.
 */
const WINANSI_HAUT: Record<number, string> = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜',
  0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
}

function decoderWinAnsi(s: string): string {
  return [...s].map(c => WINANSI_HAUT[c.charCodeAt(0)] ?? c).join('')
}

// ── Contrôles ────────────────────────────────────────────────────────────────

let ok = 0
const echecs: string[] = []

function verifier(intitule: string, condition: boolean, detail = '') {
  if (condition) { ok++; return }
  echecs.push(`${intitule}${detail ? ` — ${detail}` : ''}`)
}

/**
 * Compare en ignorant les accents, et en passant l'attendu par le même filtre
 * que le document : une police PDF standard ne sait pas écrire « → » ni « € ».
 * Comparer la valeur brute de la base ferait échouer des factures correctes.
 */
function sansAccents(s: string): string {
  return nettoyerPourPdf(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/**
 * Position de chaque texte posé dans le PDF (opérateur « x y Tm »).
 * Sert à détecter un débordement : un montant écrit hors de la feuille est
 * invisible à la lecture du texte, mais absent du document imprimé.
 */
function positionsTexte(octets: Uint8Array): { x: number; y: number }[] {
  const buf = Buffer.from(octets)
  const texte = buf.toString('latin1')
  const positions: { x: number; y: number }[] = []
  const collecter = (src: string) => {
    for (const m of src.matchAll(/1 0 0 1 (-?[\d.]+) (-?[\d.]+) Tm/g)) {
      positions.push({ x: Number(m[1]), y: Number(m[2]) })
    }
  }
  let pos = 0
  while ((pos = texte.indexOf('stream', pos)) !== -1) {
    let debut = pos + 'stream'.length
    if (texte[debut] === '\r') debut++
    if (texte[debut] === '\n') debut++
    const fin = texte.indexOf('endstream', debut)
    if (fin === -1) break
    try { collecter(inflateSync(buf.subarray(debut, fin)).toString('latin1')) } catch { /* non compressé */ }
    pos = fin + 'endstream'.length
  }
  return positions
}

const admin = createAdminClient()

const { data: factures, error } = await admin
  .from('factures')
  .select('id, numero, statut, montant_ht, montant_ttc, tva, mode_paiement')
  .order('numero')

if (error) { console.error('Lecture des factures impossible :', error.message); process.exit(2) }
if (!factures?.length) { console.error('Aucune facture en base — rien à contrôler.'); process.exit(2) }

const { data: parametres } = await admin
  .from('parametres')
  .select('societe_nom, societe_siret, societe_adresse, societe_code_postal, banque_iban')
  .eq('id', true)
  .single()

console.log(`\nContrôle du PDF de facture — ${factures.length} facture(s)\n`)

for (const f of factures) {
  const doc = await chargerDocumentFacture(f.id)
  if (!doc) { echecs.push(`${f.numero} : document introuvable`); continue }

  const pdf = await rendreFacturePdf(doc)
  const txt = lireTextePdf(pdf)
  const plat = sansAccents(txt)

  if (dossier) writeFileSync(join(dossier, `${f.numero}.pdf`), Buffer.from(pdf))

  const p = `${f.numero}`
  verifier(`${p} · le PDF n'est pas vide`, pdf.length > 1000, `${pdf.length} octets`)

  // Rien ne doit sortir de la feuille A4 (595 x 842 pt), marges comprises.
  const dehors = positionsTexte(pdf).filter(pt => pt.x < 30 || pt.x > 570 || pt.y < 30 || pt.y > 812)
  verifier(`${p} · aucun texte hors de la page`, dehors.length === 0,
    dehors.map(d => `(${d.x}, ${d.y})`).join(' '))
  verifier(`${p} · numéro de facture présent`, txt.includes(f.numero))
  verifier(`${p} · raison sociale présente`,
    plat.includes(sansAccents(parametres?.societe_nom ?? 'OWISE')))
  verifier(`${p} · nom du client présent`,
    plat.includes(sansAccents(doc.client.nom)), doc.client.nom)

  // Montants : c'est là que se joue l'exactitude comptable.
  for (const [nom, valeur] of [
    ['HT',  Number(f.montant_ht)],
    ['TVA', Number(f.tva)],
    ['TTC', Number(f.montant_ttc)],
  ] as const) {
    // Écriture française attendue : « 1 234,56 € », jamais « 1234.56 € ».
    const attendu = nettoyerPourPdf(formaterMontant(valeur))
    verifier(`${p} · montant ${nom} exact`, txt.includes(attendu), `attendu ${attendu}`)
  }

  // Somme des lignes = total HT. Un écart ici veut dire qu'une course
  // facturée manque au détail, ou qu'une course étrangère s'y est glissée.
  const sommeLignes = doc.lignes.reduce((t, l) => t + Number(l.montantHt ?? 0), 0)
  verifier(`${p} · les lignes totalisent le montant HT`,
    doc.lignes.length === 0 || Math.abs(sommeLignes - Number(f.montant_ht)) < 0.01,
    `lignes ${sommeLignes.toFixed(2)} vs HT ${Number(f.montant_ht).toFixed(2)}`)

  for (const ligne of doc.lignes) {
    verifier(`${p} · course « ${ligne.depart} » au détail`, plat.includes(sansAccents(ligne.depart)))
    verifier(`${p} · course « ${ligne.arrivee} » au détail`, plat.includes(sansAccents(ligne.arrivee)))
  }

  if (parametres?.societe_siret) {
    verifier(`${p} · SIRET présent`, txt.includes(parametres.societe_siret))
  }

  // Décision du 2026-09-20 : aucune adresse de société sur une facture.
  if (parametres?.societe_adresse) {
    verifier(`${p} · pas d'adresse de la société`, !plat.includes(sansAccents(parametres.societe_adresse)))
  }
  if (parametres?.societe_code_postal) {
    verifier(`${p} · pas de code postal de la société`, !txt.includes(parametres.societe_code_postal))
  }

  // Jamais d'IBAN sur une facture acquittée : le client pourrait payer deux fois.
  if (parametres?.banque_iban) {
    const ibanPresent = txt.replace(/\s/g, '').includes(parametres.banque_iban.replace(/\s/g, ''))
    verifier(
      f.statut === 'payee' ? `${p} · pas d'IBAN sur une facture réglée` : `${p} · IBAN présent (facture due)`,
      f.statut === 'payee' ? !ibanPresent : ibanPresent,
    )
  }

  if (f.statut === 'payee') {
    verifier(`${p} · mention « Réglée »`, plat.includes('reglee'))
    verifier(`${p} · aucune échéance annoncée`, !plat.includes('echeance'))
  } else {
    verifier(`${p} · échéance annoncée`, plat.includes('echeance'))
  }

  console.log(`  ${f.numero.padEnd(18)} ${String(pdf.length).padStart(6)} o · ${doc.lignes.length} ligne(s) · ${doc.statutLabel}`)
}

console.log(`\n${ok} contrôle(s) réussi(s), ${echecs.length} échec(s)`)
for (const e of echecs) console.log(`  ✗ ${e}`)
if (dossier) console.log(`\nPDF écrits dans ${dossier}`)
process.exit(echecs.length ? 1 : 0)
