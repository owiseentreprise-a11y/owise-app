/**
 * Rend une facture en PDF, pour la joindre à l'e-mail envoyé au client.
 *
 * Pourquoi une pièce jointe : jusqu'ici l'e-mail ne contenait qu'un lien vers
 * l'espace client, protégé par mot de passe. Un client qui ne se connecte
 * jamais — le cas le plus courant sur une réservation prise par téléphone —
 * n'avait donc aucun moyen d'obtenir son justificatif.
 *
 * Le papier lui-même — palette, marges, polices, tracé — vit dans
 * `pdf-feuille.ts`, que le devis partage. Les deux documents sont le même
 * papier à en-tête : les dessiner séparément les ferait diverger.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { chargerDocumentFacture, formaterMontant, type DocumentFacture } from '@/lib/facture-document'
import {
  A4, MARGE, OR, TEXTE, TEXTE_2, TEXTE_3, TRAIT, VERT,
  couper, ecrire, nettoyerPourPdf, piedDePage, placePour, trait,
  type Contexte,
} from '@/lib/pdf-feuille'

/* Réexporté parce que `scripts/test-facture-pdf.mts` le lit ici. */
export { nettoyerPourPdf }

/** Une seule écriture des montants pour les trois documents. */
const montant = formaterMontant

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
    piedDePage(ctx, `${f.societe.nom} · Service VTC · Paris & Île-de-France · owise.fr`)

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
