/**
 * Les briques communes aux documents PDF d'Owise — papier, polices, écriture.
 *
 * Pourquoi ce fichier : la facture et le devis sont le même papier à en-tête.
 * Tant que `facture-pdf.ts` portait seul sa palette, ses marges et ses
 * fonctions de tracé, le devis ne pouvait que les recopier — et deux copies
 * d'un même dessin divergent (CLAUDE.md le répète pour le CSS du document,
 * pour les libellés de facture et pour le calcul de prix ; la règle vaut ici).
 *
 * Ce module est **pur** : il ne tire ni Supabase ni Resend, seulement
 * `pdf-lib`. Il ne décrit aucun contenu, seulement la manière de le poser sur
 * la page. Ce que dit un document reste dans `facture-document.ts` ou
 * `devis-client.ts`.
 */
import { rgb, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib'

// Palette papier — identique au bloc @media print de globals.css.
export const OR      = rgb(0x9a / 255, 0x7a / 255, 0x2a / 255)
export const TEXTE   = rgb(0x11 / 255, 0x11 / 255, 0x11 / 255)
export const TEXTE_2 = rgb(0x44 / 255, 0x44 / 255, 0x44 / 255)
export const TEXTE_3 = rgb(0x88 / 255, 0x88 / 255, 0x88 / 255)
export const TRAIT   = rgb(0xdd / 255, 0xdd / 255, 0xdd / 255)
export const VERT    = rgb(0x1a / 255, 0x7a / 255, 0x40 / 255)

export const A4 = { largeur: 595.28, hauteur: 841.89 }
export const MARGE = 52
export const BAS_DE_PAGE = 84

/**
 * Les polices standard d'un PDF n'encodent que le jeu WinAnsi. Une adresse
 * saisie au clavier peut contenir n'importe quoi (flèche, emoji, guillemet
 * exotique) : sans ce filtre, la génération lève une exception et le client
 * ne reçoit plus rien du tout. On préfère un caractère approché à un échec.
 */
const REMPLACEMENTS: Record<string, string> = {
  '→': 'vers', '←': 'de', '‑': '-', '−': '-',
  ' ': ' ', ' ': ' ', ' ': ' ',
  '№': 'n',
}

/**
 * Jeu WinAnsi : ASCII imprimable, Latin-1 haut, plus quelques signes
 * typographiques dont l'euro — vérifié caractère par caractère contre la
 * police Helvetica embarquée, pas supposé.
 */
const SIGNES_WINANSI = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ'

function encodable(code: number): boolean {
  return (code >= 0x20 && code <= 0x7e)
    || (code >= 0xa0 && code <= 0xff)
    || SIGNES_WINANSI.includes(String.fromCodePoint(code))
}

export function nettoyerPourPdf(texte: string): string {
  let out = ''
  for (const ch of texte ?? '') {
    if (REMPLACEMENTS[ch] !== undefined) { out += REMPLACEMENTS[ch]; continue }
    if (encodable(ch.codePointAt(0)!)) { out += ch; continue }
    // Dernière chance : retirer l'accent (« ā » → « a »), sinon abandonner.
    const sansAccent = ch.normalize('NFD').replace(/[̀-ͯ]/g, '')
    out += [...sansAccent].every(c => encodable(c.codePointAt(0)!)) ? sansAccent : ''
  }
  return out
}

export type Contexte = { doc: PDFDocument; page: PDFPage; y: number; normal: PDFFont; gras: PDFFont }

export function nouvellePage(ctx: Contexte) {
  ctx.page = ctx.doc.addPage([A4.largeur, A4.hauteur])
  ctx.y = A4.hauteur - MARGE
}

/** Passe à la page suivante si le bloc à venir ne tient plus. */
export function placePour(ctx: Contexte, hauteur: number) {
  if (ctx.y - hauteur < BAS_DE_PAGE) nouvellePage(ctx)
}

export function ecrire(
  ctx: Contexte,
  texte: string,
  x: number,
  taille: number,
  couleur = TEXTE,
  gras = false,
  aligneADroite?: number,
) {
  const police = gras ? ctx.gras : ctx.normal
  const t = nettoyerPourPdf(texte)
  const posX = aligneADroite !== undefined
    ? aligneADroite - police.widthOfTextAtSize(t, taille)
    : x
  ctx.page.drawText(t, { x: posX, y: ctx.y, size: taille, font: police, color: couleur })
}

export function trait(ctx: Contexte, y: number) {
  ctx.page.drawLine({
    start: { x: MARGE, y },
    end:   { x: A4.largeur - MARGE, y },
    thickness: 0.7,
    color: TRAIT,
  })
}

/** Découpe un texte pour qu'aucune ligne ne dépasse `largeur`. */
export function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
  const mots = nettoyerPourPdf(texte).split(/\s+/).filter(Boolean)
  const lignes: string[] = []
  let courante = ''
  for (const mot of mots) {
    const essai = courante ? `${courante} ${mot}` : mot
    if (police.widthOfTextAtSize(essai, taille) <= largeur) { courante = essai; continue }
    if (courante) lignes.push(courante)
    courante = mot
  }
  if (courante) lignes.push(courante)
  return lignes.length ? lignes : ['']
}

/**
 * Le pied de page, posé sur chaque page une fois le document fini.
 *
 * Il s'écrit en dernier parce qu'il porte « 1 / 3 » : le nombre de pages
 * n'est connu qu'à la fin.
 */
export function piedDePage(ctx: Contexte, mention: string) {
  const pages = ctx.doc.getPages()
  const droite = A4.largeur - MARGE
  pages.forEach((page, i) => {
    page.drawText(nettoyerPourPdf(mention), {
      x: MARGE, y: 48, size: 8, font: ctx.normal, color: TEXTE_3,
    })
    if (pages.length > 1) {
      const num = `${i + 1} / ${pages.length}`
      page.drawText(num, {
        x: droite - ctx.normal.widthOfTextAtSize(num, 8),
        y: 48, size: 8, font: ctx.normal, color: TEXTE_3,
      })
    }
  })
}

/** L'encre du sceau — le bleu nuit de la marque. */
export const NUIT = rgb(0x09 / 255, 0x09 / 255, 0x1a / 255)

/**
 * Le sceau Owise : l'anneau, l'arc doré, le point.
 *
 * Il existait sur la page web du document (`fac-sceau`) mais pas sur le PDF,
 * dessiné à la main — le même devis arrivait donc avec un logo s'il était
 * imprimé depuis le navigateur, et sans logo s'il partait en pièce jointe.
 * Relevé par l'exploitant le 2026-11-03.
 *
 * `x` et `yHaut` repèrent le coin haut-gauche ; le dessin est défini sur une
 * grille de 56 points, comme le SVG d'origine, et simplement mis à l'échelle.
 */
export function cartoucheOwise(ctx: Contexte, x: number, yHaut: number, cote = 46) {
  /* Le carre dore de `.fac-sceau` : fond or a 10 %, filet a 28 %, rayon 11
     sur 46 — les memes proportions que la page web. */
  ctx.page.drawRectangle({
    x, y: yHaut - cote, width: cote, height: cote,
    color: OR, opacity: 0.10,
    borderColor: OR, borderOpacity: 0.28, borderWidth: 1,
  })
  const dessin = cote * (26 / 46)
  sceauOwise(ctx, x + (cote - dessin) / 2, yHaut - (cote - dessin) / 2, dessin)
}

export function sceauOwise(ctx: Contexte, x: number, yHaut: number, cote = 26) {
  const k = cote / 56
  const cx = x + 28 * k
  const cy = yHaut - 28 * k

  ctx.page.drawCircle({
    x: cx, y: cy, size: 15.4 * k,
    borderColor: NUIT, borderOpacity: 0.82, borderWidth: 2.4 * k,
  })
  /* L'arc doré, en coordonnées SVG : pdf-lib retourne l'axe vertical
     lui-même à partir du point d'ancrage. */
  ctx.page.drawSvgPath('M 28 12.6 A 15.4 15.4 0 0 1 42 21.7', {
    x, y: yHaut, scale: k,
    borderColor: OR, borderWidth: 3 * k,
  })
  ctx.page.drawCircle({ x: cx, y: cy, size: 3 * k, color: OR })
}
