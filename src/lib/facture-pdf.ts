import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { chargerDocumentFacture, formaterMontant, type DocumentFacture } from '@/lib/facture-document'

/**
 * Rend une facture en PDF, pour la joindre à l'e-mail envoyé au client.
 *
 * Pourquoi une pièce jointe : jusqu'ici l'e-mail ne contenait qu'un lien vers
 * l'espace client, protégé par mot de passe. Un client qui ne se connecte
 * jamais — le cas le plus courant sur une réservation prise par téléphone —
 * n'avait donc aucun moyen d'obtenir son justificatif.
 *
 * Le document reprend la palette d'impression de globals.css (@media print),
 * pour que le PDF et la page imprimée depuis le navigateur se ressemblent.
 */

// Palette papier — identique au bloc @media print de globals.css.
const OR      = rgb(0x9a / 255, 0x7a / 255, 0x2a / 255)
const TEXTE   = rgb(0x11 / 255, 0x11 / 255, 0x11 / 255)
const TEXTE_2 = rgb(0x44 / 255, 0x44 / 255, 0x44 / 255)
const TEXTE_3 = rgb(0x88 / 255, 0x88 / 255, 0x88 / 255)
const TRAIT   = rgb(0xdd / 255, 0xdd / 255, 0xdd / 255)
const VERT    = rgb(0x1a / 255, 0x7a / 255, 0x40 / 255)

const A4 = { largeur: 595.28, hauteur: 841.89 }
const MARGE = 52
const BAS_DE_PAGE = 84

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

/** Une seule écriture des montants pour les trois documents. */
const montant = formaterMontant

type Contexte = { doc: PDFDocument; page: PDFPage; y: number; normal: PDFFont; gras: PDFFont }

function nouvellePage(ctx: Contexte) {
  ctx.page = ctx.doc.addPage([A4.largeur, A4.hauteur])
  ctx.y = A4.hauteur - MARGE
}

function placePour(ctx: Contexte, hauteur: number) {
  if (ctx.y - hauteur < BAS_DE_PAGE) nouvellePage(ctx)
}

function ecrire(
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

function trait(ctx: Contexte, y: number) {
  ctx.page.drawLine({
    start: { x: MARGE, y },
    end:   { x: A4.largeur - MARGE, y },
    thickness: 0.7,
    color: TRAIT,
  })
}

/** Découpe un texte pour qu'aucune ligne ne dépasse `largeur`. */
function couper(texte: string, police: PDFFont, taille: number, largeur: number): string[] {
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

export function rendreFacturePdf(f: DocumentFacture): Promise<Uint8Array> {
  return (async () => {
    const doc = await PDFDocument.create()
    doc.setTitle(`Facture ${f.numero}`)
    doc.setSubject(`Facture ${f.numero} — ${f.societe.nom}`)
    doc.setProducer('Owise')
    doc.setCreator('Owise')

    const ctx: Contexte = {
      doc,
      page: doc.addPage([A4.largeur, A4.hauteur]),
      y: A4.hauteur - MARGE,
      normal: await doc.embedFont(StandardFonts.Helvetica),
      gras:   await doc.embedFont(StandardFonts.HelveticaBold),
    }
    const droite = A4.largeur - MARGE

    // ── En-tête ───────────────────────────────────────────────────────────
    const hautEntete = ctx.y
    // Raison sociale telle qu'elle est enregistrée, sans retouche : c'est
    // elle qui figure déjà sur les pages facture et sur les documents légaux.
    ecrire(ctx, f.societe.nom, MARGE, 20, OR, true)
    ctx.y = hautEntete
    ecrire(ctx, 'FACTURE', 0, 10, TEXTE_2, true, droite)

    ctx.y = hautEntete - 20
    if (f.societe.siret) {
      const mention = `SIRET ${f.societe.siret}${f.societe.tvaNumero ? ` - TVA ${f.societe.tvaNumero}` : ''}`
      ecrire(ctx, mention, MARGE, 8, TEXTE_3)
    }
    ecrire(ctx, f.numero, 0, 16, OR, true, droite)

    ctx.y = hautEntete - 38
    ecrire(ctx, f.statutLabel, 0, 9, f.payee ? VERT : TEXTE_2, true, droite)

    ctx.y = hautEntete - 56
    trait(ctx, ctx.y)

    // ── Destinataire et dates ─────────────────────────────────────────────
    ctx.y -= 24
    const hautBloc = ctx.y
    ecrire(ctx, 'FACTURÉ À', MARGE, 7, TEXTE_3)
    ctx.y -= 14
    ecrire(ctx, f.client.nom, MARGE, 12, TEXTE, true)
    if (f.client.adresse) {
      for (const ligne of couper(f.client.adresse, ctx.normal, 9, 230)) {
        ctx.y -= 12
        ecrire(ctx, ligne, MARGE, 9, TEXTE_2)
      }
    }
    const basGauche = ctx.y

    const colonneDates = MARGE + 300
    ctx.y = hautBloc
    ecrire(ctx, "DATE D'ÉMISSION", colonneDates, 7, TEXTE_3)
    ctx.y -= 13
    ecrire(ctx, f.dateEmission, colonneDates, 10, TEXTE)

    ctx.y -= 20
    ecrire(ctx, f.payee ? 'RÈGLEMENT' : 'ÉCHÉANCE', colonneDates, 7, TEXTE_3)
    ctx.y -= 13
    ecrire(ctx, f.reglement ?? f.echeance ?? '-', colonneDates, 10, f.payee ? VERT : TEXTE)

    ctx.y = Math.min(basGauche, ctx.y) - 22
    trait(ctx, ctx.y)

    // ── Détail des courses ────────────────────────────────────────────────
    if (f.lignes.length) {
      ctx.y -= 18
      ecrire(ctx, 'DATE', MARGE, 7, TEXTE_3)
      ecrire(ctx, 'TRAJET', MARGE + 60, 7, TEXTE_3)
      ecrire(ctx, 'MONTANT HT', 0, 7, TEXTE_3, false, droite)
      ctx.y -= 8
      trait(ctx, ctx.y)

      for (const ligne of f.lignes) {
        placePour(ctx, 34)
        ctx.y -= 18
        const hautLigne = ctx.y
        ecrire(ctx, ligne.date, MARGE, 9, TEXTE_3)
        ecrire(ctx, ligne.depart, MARGE + 60, 10, TEXTE, true)
        ecrire(ctx, montant(ligne.montantHt), 0, 10, TEXTE, false, droite)
        ctx.y -= 12
        ecrire(ctx, `vers ${ligne.arrivee}`, MARGE + 60, 9, TEXTE_2)
        ctx.y = hautLigne - 20
        trait(ctx, ctx.y)
      }
    }

    // ── Totaux ────────────────────────────────────────────────────────────
    placePour(ctx, 86)
    const gaucheTotaux = droite - 200
    ctx.y -= 22
    ecrire(ctx, 'Total HT', gaucheTotaux, 10, TEXTE_2)
    ecrire(ctx, montant(f.montantHt), 0, 10, TEXTE, false, droite)
    ctx.y -= 16
    ecrire(ctx, 'TVA', gaucheTotaux, 10, TEXTE_2)
    ecrire(ctx, montant(f.tva), 0, 10, TEXTE_2, false, droite)
    ctx.y -= 12
    ctx.page.drawLine({
      start: { x: gaucheTotaux, y: ctx.y }, end: { x: droite, y: ctx.y },
      thickness: 0.7, color: TRAIT,
    })
    ctx.y -= 20
    ecrire(ctx, 'Total TTC', gaucheTotaux, 12, TEXTE, true)
    ecrire(ctx, montant(f.montantTtc), 0, 15, OR, true, droite)

    // ── Règlement et mentions ─────────────────────────────────────────────
    const banque = f.banque
    if (banque && (banque.iban || banque.bic)) {
      placePour(ctx, 70)
      ctx.y -= 34
      ecrire(ctx, 'COORDONNÉES BANCAIRES', MARGE, 7, TEXTE_3)
      for (const l of [banque.nom, banque.iban && `IBAN : ${banque.iban}`, banque.bic && `BIC : ${banque.bic}`]) {
        if (!l) continue
        ctx.y -= 13
        ecrire(ctx, l, MARGE, 9, TEXTE_2)
      }
    }

    if (f.payee) {
      placePour(ctx, 30)
      ctx.y -= 30
      ecrire(ctx, "Facture acquittée — aucun paiement n'est attendu.", MARGE, 9, VERT, true)
    }

    if (f.mentions) {
      placePour(ctx, 40)
      ctx.y -= 26
      for (const l of couper(f.mentions, ctx.normal, 8, A4.largeur - 2 * MARGE)) {
        ecrire(ctx, l, MARGE, 8, TEXTE_3)
        ctx.y -= 11
      }
    }

    // ── Pied de page sur chaque page ──────────────────────────────────────
    const pages = doc.getPages()
    pages.forEach((page, i) => {
      const pied = nettoyerPourPdf(`${f.societe.nom} · Service VTC · Paris & Île-de-France · owise.fr`)
      page.drawText(pied, {
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

    return doc.save()
  })()
}

/** Charge la facture puis la rend. Renvoie null si la facture n'existe pas. */
export async function genererFacturePdf(
  factureId: string,
): Promise<{ nomFichier: string; contenu: Uint8Array } | null> {
  const f = await chargerDocumentFacture(factureId)
  if (!f) return null
  return {
    nomFichier: `${f.numero.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`,
    contenu: await rendreFacturePdf(f),
  }
}
