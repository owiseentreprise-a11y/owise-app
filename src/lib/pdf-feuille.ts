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
import {
  popGraphicsState, pushGraphicsState, rgb, setCharacterSpacing,
  type PDFDocument, type PDFFont, type PDFPage, type RGB,
} from 'pdf-lib'

/**
 * Palette du DOCUMENT, reprise de `document-feuille.ts`.
 *
 * Elle venait du bloc @media print de globals.css, qui habille toute
 * l'administration imprimee et y pose --gold: #9a7a2a. Mais le document, lui,
 * declare ses propres variables sur `.fac-feuille` (--or: #C9A84C,
 * --papier: #F8F6F1) et toutes ses regles lisent celles-la. Le document
 * imprime depuis le navigateur n'a donc jamais porte l'or sombre de
 * l'administration — seul le PDF le portait. Deux ors pour la meme facture.
 *
 * Toute couleur ici doit se lire dans `document-feuille.ts`, pas ailleurs.
 */
export const OR       = rgb(0xc9 / 255, 0xa8 / 255, 0x4c / 255) // --or
export const TEXTE    = rgb(0x09 / 255, 0x09 / 255, 0x1a / 255) // --encre
export const TEXTE_2  = rgb(0x4a / 255, 0x4a / 255, 0x60 / 255) // --encre-2
export const TEXTE_3  = rgb(0x8a / 255, 0x8a / 255, 0x9a / 255) // --encre-3
export const PAPIER   = rgb(0xf8 / 255, 0xf6 / 255, 0xf1 / 255) // --papier
export const PAPIER_2 = rgb(0xf1 / 255, 0xed / 255, 0xe4 / 255) // --papier-2
export const VERT     = rgb(0x3d / 255, 0xb8 / 255, 0x7a / 255)

/**
 * Les deux filets du document, et leur opacite.
 *
 * Le document en a DEUX, pas un : un filet dore a 28 % sous l'en-tete, sous
 * les titres de colonnes et au-dessus du pied ; un filet encre a 7 % entre
 * deux lignes de prestation. Le PDF n'en avait qu'un, gris, partout.
 */
export const TRAIT          = OR                                  // --or-trait
export const TRAIT_OPACITE  = 0.28
export const TRAIT_LIGNE    = TEXTE                               // rgba(9,9,26,.07)
export const TRAIT_LIGNE_OP = 0.07

export const A4 = { largeur: 595.28, hauteur: 841.89 }

/**
 * Les marges du document, en points, telles que son bloc @media print les
 * pose : `padding: 9mm 14mm`. Elles valaient 52 pt de tous les cotes, soit
 * 18,3 mm — le PDF etait donc plus etroit que le meme document imprime.
 * 1 mm = 72 / 25,4 = 2,8346 pt.
 */
const MM = 72 / 25.4
export const MARGE = Math.round(14 * MM * 100) / 100  // 39.69 pt
export const MARGE_HAUT = Math.round(9 * MM * 100) / 100 // 25.51 pt
export const BAS_DE_PAGE = 60

/**
 * Convertit une taille du document (en pixels CSS) en points PDF.
 *
 * La feuille est ecrite en pixels — « font-size:13.5px » — et un PDF compte
 * en points. 1 px CSS = 1/96 pouce, 1 pt = 1/72 pouce, donc 1 px = 0,75 pt.
 * Passer par cette fonction plutot que par des nombres choisis a l'oeil est
 * ce qui garantit que le PDF et le document imprime ont la meme echelle.
 */
export function px(pixels: number): number {
  return Math.round(pixels * 0.75 * 100) / 100
}

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

/**
 * Le contexte d'écriture : le document, la page courante, l'ordonnée atteinte
 * et les polices.
 *
 * `serif` est la police du TITRE — « Facture », « Devis » —, que le document
 * compose en Cormorant Garamond. Un PDF ne peut embarquer Cormorant qu'en
 * embarquant le fichier de police ; à défaut, une serif standard reste plus
 * proche de la maquette qu'une Helvetica. Elle est optionnelle pour qu'un
 * appelant qui ne la fournit pas retombe simplement sur le corps de texte.
 */
export type Contexte = {
  doc: PDFDocument
  page: PDFPage
  y: number
  normal: PDFFont
  gras: PDFFont
  serif?: PDFFont
}

/** Écrit avec une police choisie — le titre du document, en serif. */
export function ecrireSerif(
  ctx: Contexte,
  texte: string,
  x: number,
  taille: number,
  couleur = TEXTE,
  em = 0,
) {
  return ecrireEspacement(ctx, ctx.serif ?? ctx.gras, texte, x, taille, couleur, em)
}
/**
 * Le papier crème, sur toute la page.
 *
 * La charte Owise interdit le blanc pur, et le bloc @media print du document
 * le dit en toutes lettres : la feuille entière reste crème, avec une marge
 * INTÉRIEURE pour que le fond atteigne les bords du PDF. Le PDF joint à
 * l'e-mail, lui, partait sur une page blanche : le client recevait le seul
 * document Owise au fond blanc. Relevé le 2026-11-09.
 */
export function fondPapier(page: PDFPage) {
  page.drawRectangle({ x: 0, y: 0, width: A4.largeur, height: A4.hauteur, color: PAPIER })
}

/** Une feuille neuve, papier compris. Toute page du document passe par ici. */
export function feuilleNeuve(doc: PDFDocument): PDFPage {
  const page = doc.addPage([A4.largeur, A4.hauteur])
  fondPapier(page)
  return page
}

export function nouvellePage(ctx: Contexte) {
  ctx.page = feuilleNeuve(ctx.doc)
  ctx.y = A4.hauteur - MARGE_HAUT
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

/** Le filet doré du document : sous l'en-tête, sous les titres, au pied. */
export function trait(ctx: Contexte, y: number, x1 = MARGE, x2 = A4.largeur - MARGE) {
  ctx.page.drawLine({
    start: { x: x1, y },
    end:   { x: x2, y },
    thickness: 0.7,
    color: TRAIT,
    opacity: TRAIT_OPACITE,
  })
}

/** Le filet discret entre deux lignes de prestation — encre à 7 %. */
export function traitLigne(ctx: Contexte, y: number, x1 = MARGE, x2 = A4.largeur - MARGE) {
  ctx.page.drawLine({
    start: { x: x1, y },
    end:   { x: x2, y },
    thickness: 0.6,
    color: TRAIT_LIGNE,
    opacity: TRAIT_LIGNE_OP,
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

/**
 * Écrit un texte en espaçant ses lettres, comme « letter-spacing » le fait.
 *
 * Le document s'en sert partout où il met des capitales : « PRESTATAIRE »
 * (.2em), « OWISE » (.11em), les titres de colonnes (.14em), le libellé du
 * total (.16em). pdf-lib ne connaît pas l'espacement de caractères : on pose
 * chaque lettre à sa position. C'est ce qui sépare une étiquette qui ressemble
 * à celle de la page d'une étiquette simplement écrite en majuscules.
 */
export function ecrireEspace(
  ctx: Contexte,
  texte: string,
  x: number,
  taille: number,
  couleur = TEXTE,
  em = 0.2,
  gras = false,
  aligneADroite?: number,
) {
  return ecrireEspacement(ctx, gras ? ctx.gras : ctx.normal, texte, x, taille, couleur, em, aligneADroite)
}

/**
 * Écrit un texte avec un espacement de caractères réel — l'opérateur Tc du
 * format PDF, que pdf-lib expose sous setCharacterSpacing.
 *
 * La première version posait chaque lettre à sa position, une par une. Le
 * résultat était juste à l'œil et faux à l'usage : un texte écrit lettre par
 * lettre n'est plus cherchable ni copiable dans un lecteur de PDF. Le
 * contrôle l'a vu — il ne retrouvait plus « Net à payer » dans le devis.
 *
 * Avec Tc, le texte reste une seule chaîne dans le fichier, et le lecteur
 * applique l'écart. On gagne les deux : l'espacement de la maquette et un
 * document où le client peut chercher un mot.
 */
function ecrireEspacement(
  ctx: Contexte,
  police: PDFFont,
  texte: string,
  x: number,
  taille: number,
  couleur: RGB,
  em: number,
  aligneADroite?: number,
) {
  const t = nettoyerPourPdf(texte)
  const ecart = em * taille
  /* Tc ajoute son écart APRÈS chaque caractère, y compris le dernier : la
     largeur visible ne compte donc que n - 1 écarts. */
  const largeur = police.widthOfTextAtSize(t, taille) + Math.max(0, [...t].length - 1) * ecart
  const posX = aligneADroite !== undefined ? aligneADroite - largeur : x
  ctx.page.pushOperators(pushGraphicsState(), setCharacterSpacing(ecart))
  ctx.page.drawText(t, { x: posX, y: ctx.y, size: taille, font: police, color: couleur })
  ctx.page.pushOperators(popGraphicsState())
  return largeur
}
/** Compose un rectangle à coins arrondis — pdf-lib ne sait pas le faire. */
function rectangleArrondi(
  page: PDFPage,
  x: number, yHaut: number, largeur: number, hauteur: number,
  couleur: RGB, rayon: number,
) {
  const r = Math.min(rayon, largeur / 2, hauteur / 2)
  const yBas = yHaut - hauteur
  page.drawRectangle({ x: x + r, y: yBas, width: largeur - 2 * r, height: hauteur, color: couleur })
  page.drawRectangle({ x, y: yBas + r, width: largeur, height: hauteur - 2 * r, color: couleur })
  const coins: [number, number][] = [
    [x + r, yBas + r], [x + largeur - r, yBas + r],
    [x + r, yHaut - r], [x + largeur - r, yHaut - r],
  ]
  for (const [cx, cy] of coins) page.drawCircle({ x: cx, y: cy, size: r, color: couleur })
}

/**
 * Le bandeau du total : fond encre, libellé en capitales espacées, montant en
 * or. C'est .fac-total du document, « background:var(--encre) ».
 *
 * Le PDF écrivait à la place « Total TTC » en noir, aligné à droite, sans
 * bandeau : le chiffre que le client cherche en premier n'avait pas la même
 * forme sur les deux documents.
 */
export function bandeauTotal(
  ctx: Contexte,
  libelle: string,
  montant: string,
  x: number,
  largeur: number,
) {
  const hauteur = px(53)
  const yHaut = ctx.y
  rectangleArrondi(ctx.page, x, yHaut, largeur, hauteur, TEXTE, px(9))
  ctx.y = yHaut - hauteur + px(19)
  ecrireEspace(ctx, libelle.toUpperCase(), x + px(18), px(11), PAPIER, 0.16)
  ecrire(ctx, montant, 0, px(23), OR, true, x + largeur - px(18))
  ctx.y = yHaut - hauteur
}

/* Les marges intérieures d'un cartouche — « padding:13px 15px » du bloc
   @media print du document. */
const BLOC_PAD_V = px(13)
const BLOC_PAD_H = px(15)

/** Ce qu'un cartouche « Prestataire » ou « Client » contient. */
export type ContenuBloc = {
  /** « Prestataire », « Client ». Écrite en capitales espacées. */
  etiquette: string
  /** La raison sociale ou le nom, en gras. */
  titre: string
  /** Métier, téléphone, adresse, e-mail — une entrée par ligne. */
  lignes: string[]
  /** Forme juridique, siège, SIRET, APE. Plus petit et plus gris. */
  legal?: string[]
}

/**
 * La hauteur qu'un cartouche occupera, mesurée sans rien dessiner.
 *
 * Elle doit être connue AVANT de peindre le fond beige : un cartouche dont le
 * fond serait dessiné après le texte le recouvrirait, et un fond dessiné à une
 * hauteur devinée laisserait l'adresse du client dépasser dessous. Les deux
 * cartouches d'un document prennent la plus grande des deux hauteurs, pour
 * qu'ils s'alignent comme la grille CSS les aligne.
 */
export function hauteurBloc(ctx: Contexte, b: ContenuBloc, largeur: number): number {
  const interieur = largeur - 2 * BLOC_PAD_H
  let h = BLOC_PAD_V + px(9.5) + px(9) + px(14.5) + px(3)
  for (const l of b.lignes) {
    h += couper(l, ctx.normal, px(13), interieur).length * px(13) * 1.65
  }
  if (b.legal?.length) {
    h += px(5)
    for (const l of b.legal) {
      h += couper(l, ctx.normal, px(11), interieur).length * px(11) * 1.6
    }
  }
  return h + BLOC_PAD_V
}

/**
 * Un cartouche d'identité — .fac-bloc du document : fond beige à coins
 * arrondis, étiquette grise espacée, nom en gras, coordonnées, mentions.
 *
 * Le PDF de la facture n'en avait aucun : il écrivait « FACTURÉ À » suivi du
 * nom, sans fond, et ne portait AUCUN bloc Prestataire — donc ni la forme
 * juridique, ni le siège, ni le code APE, que la page affichait. Deux
 * documents de la même entreprise ne montraient pas la même entreprise.
 */
export function blocIdentite(
  ctx: Contexte,
  x: number, yHaut: number, largeur: number,
  b: ContenuBloc,
  hauteurImposee?: number,
): number {
  const hauteur = hauteurImposee ?? hauteurBloc(ctx, b, largeur)
  rectangleArrondi(ctx.page, x, yHaut, largeur, hauteur, PAPIER_2, px(9))

  const xi = x + BLOC_PAD_H
  const interieur = largeur - 2 * BLOC_PAD_H

  ctx.y = yHaut - BLOC_PAD_V - px(9.5)
  ecrireEspace(ctx, b.etiquette.toUpperCase(), xi, px(9.5), TEXTE_3, 0.2)

  ctx.y -= px(9) + px(14.5)
  ecrire(ctx, b.titre, xi, px(14.5), TEXTE, true)
  ctx.y -= px(3)

  for (const l of b.lignes) {
    for (const bout of couper(l, ctx.normal, px(13), interieur)) {
      ctx.y -= px(13) * 1.65
      ecrire(ctx, bout, xi, px(13), TEXTE_2)
    }
  }
  if (b.legal?.length) {
    ctx.y -= px(5)
    for (const l of b.legal) {
      for (const bout of couper(l, ctx.normal, px(11), interieur)) {
        ctx.y -= px(11) * 1.6
        ecrire(ctx, bout, xi, px(11), TEXTE_3)
      }
    }
  }
  ctx.y = yHaut - hauteur
  return hauteur
}

/**
 * Le pied des mentions légales, filet doré compris.
 *
 * Les mentions viennent de facture-document.ts ou de devis-client.ts : elles
 * ne s'écrivent pas ici. Ce qui s'écrit ici, c'est leur mise en page — la
 * même que .fac-pied : filet doré au-dessus, 9,5 px, --encre-3.
 */
export function mentionsPied(
  ctx: Contexte,
  mentions: { fort?: string; texte: string }[],
) {
  if (mentions.length === 0) return
  const taille = px(9.5)
  const interligne = taille * 1.72
  const largeur = A4.largeur - 2 * MARGE

  /* La hauteur est mesurée AVANT d'écrire : un pied coupé en deux laisserait
     une page portant la seule fin d'une phrase de loi. */
  let lignes = 0
  for (const m of mentions) {
    lignes += couper((m.fort ?? '') + m.texte, ctx.normal, taille, largeur).length
  }
  placePour(ctx, px(18) + lignes * interligne + px(10))

  ctx.y -= px(18)
  trait(ctx, ctx.y)
  ctx.y -= px(14)
  for (const m of mentions) {
    /* L'amorce en gras, puis la suite à sa droite sur la même ligne — le
       « TVA non applicable » en gras de la maquette validée. */
    let x = MARGE
    let restante = largeur
    if (m.fort) {
      ecrire(ctx, m.fort, x, taille, TEXTE_2, true)
      const avance = ctx.gras.widthOfTextAtSize(nettoyerPourPdf(m.fort), taille)
      x += avance
      restante -= avance
    }
    for (const [i, bout] of couper(m.texte, ctx.normal, taille, restante).entries()) {
      if (i > 0) { ctx.y -= interligne; x = MARGE }
      ecrire(ctx, bout, x, taille, TEXTE_3)
    }
    ctx.y -= interligne
  }
}

/** Ce que l'en-tête d'un document affiche de l'entreprise. */
export type EnTeteDocument = {
  /** « Service de chauffeur privé », en capitales espacées sous le nom. */
  metier: string
  /** « Owise — Chantilly », en gras en haut à droite. */
  nom: string
  telephone: string | null
  email: string | null
  /** Déjà coupé en groupes — « 477 534 135 00041 ». */
  siret: string | null
}

/**
 * L'en-tête du document : sceau, OWISE, métier · coordonnées à droite.
 *
 * C'est .fac-haut de la feuille. Il vit ici, et non dans facture-pdf.ts ou
 * devis-pdf.ts, parce que les deux documents en avaient chacun une version :
 * le devis écrivait OWISE en or avec « DEVIS » à droite, la facture écrivait
 * la raison sociale en or avec « FACTURE » à droite, et la page web écrivait
 * OWISE à l'encre avec les coordonnées à droite. Trois en-têtes pour une
 * même entreprise.
 *
 * Renvoie l'ordonnée du bas de l'en-tête — la plus basse des deux colonnes.
 */
export function enTeteDocument(ctx: Contexte, e: EnTeteDocument): number {
  const haut = ctx.y
  const COTE = px(46)
  cartoucheOwise(ctx, MARGE, haut, COTE)

  /* .fac-marque centre le texte sur le carré du sceau : 27 px de nom, 5 px
     de marge, 9,5 px de métier. */
  const xNom = MARGE + COTE + px(13)
  ctx.y = haut - px(2) - px(27)
  /* Le nom est à l'ENCRE, pas en or : .fac-nom ne déclare aucune couleur et
     hérite de --encre. Les deux PDF l'écrivaient en or. */
  ecrireEspace(ctx, 'OWISE', xNom, px(27), TEXTE, 0.11, true)
  ctx.y -= px(5) + px(9.5)
  ecrireEspace(ctx, e.metier.toUpperCase(), xNom, px(9.5), TEXTE_3, 0.24)
  const basGauche = ctx.y

  const droite = A4.largeur - MARGE
  ctx.y = haut - px(11.5)
  ecrire(ctx, e.nom, 0, px(11.5), TEXTE, true, droite)
  for (const l of [e.telephone, e.email]) {
    if (!l) continue
    ctx.y -= px(11.5) * 1.85
    ecrire(ctx, l, 0, px(11.5), TEXTE_2, false, droite)
  }
  if (e.siret) {
    ctx.y -= px(12.5) * 1.85
    ecrire(ctx, 'SIRET ' + e.siret, 0, px(12.5), TEXTE, false, droite)
  }

  ctx.y = Math.min(basGauche, ctx.y)
  return ctx.y
}

/**
 * La ligne de titre : « Facture » ou « Devis » en serif, le numéro en or, et
 * les repères de date alignés à droite. Se termine par le filet doré.
 *
 * C'est .fac-titre-ligne. Le PDF de la facture n'avait AUCUN titre — le mot
 * « FACTURE » y était écrit en 10 pt en haut à droite — et le devis non plus.
 */
export function ligneTitre(
  ctx: Contexte,
  titre: string,
  numero: string,
  reperes: { libelle: string; valeur: string }[],
) {
  const droite = A4.largeur - MARGE
  ctx.y -= px(24)
  const haut = ctx.y

  ctx.y = haut - px(31)
  ecrireSerif(ctx, titre, MARGE, px(31), TEXTE, 0.01)
  ctx.y -= px(6) + px(14)
  /* Le numéro s'écrit d'un seul tenant, PAS lettre par lettre : un texte posé
     caractère par caractère n'est plus cherchable ni copiable dans un lecteur
     de PDF, et le client doit pouvoir copier le numéro de sa facture.
     L'espacement de .04em du document est de toute façon imperceptible. */
  ecrire(ctx, numero, MARGE, px(14), OR, true)
  const basTitre = ctx.y

  ctx.y = haut - px(11.5)
  for (const [i, r] of reperes.entries()) {
    if (i > 0) ctx.y -= px(11.5) * 1.9
    const tLib = px(11.5)
    const tVal = px(12)
    const texteLib = r.libelle + '  '
    const largeurLib = ctx.normal.widthOfTextAtSize(nettoyerPourPdf(texteLib), tLib)
    const largeurVal = ctx.gras.widthOfTextAtSize(nettoyerPourPdf(r.valeur), tVal)
    const x = droite - largeurLib - largeurVal
    ecrire(ctx, texteLib, x, tLib, TEXTE_3)
    ecrire(ctx, r.valeur, x + largeurLib, tVal, TEXTE, true)
  }

  ctx.y = Math.min(basTitre, ctx.y) - px(12)
  trait(ctx, ctx.y)
}
