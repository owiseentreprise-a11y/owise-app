/**
 * Rend une facture en PDF, pour la joindre à l'e-mail envoyé au client.
 *
 * POURQUOI UNE PIÈCE JOINTE
 *
 * Jusqu'ici l'e-mail ne contenait qu'un lien vers l'espace client, protégé par
 * mot de passe. Un client qui ne se connecte jamais — le cas le plus courant
 * sur une réservation prise par téléphone — n'avait aucun moyen d'obtenir son
 * justificatif.
 *
 * CE QUE CE FICHIER DESSINE, ET CE QU'IL NE DÉCIDE PAS
 *
 * Il dessine le MÊME document que /admin/facturation/[id]/document, dont la
 * feuille est document-feuille.ts. Chaque mesure vient de là, convertie par
 * px() : la feuille est écrite en pixels CSS, un PDF compte en points.
 *
 * Il ne décide d'AUCUN contenu. Libellés, montants, mentions légales et
 * identité du prestataire viennent de chargerDocumentFacture().
 *
 * L'ÉCART QU'IL COMBLE (2026-11-09)
 *
 * L'exploitant : « à chaque fois la mise en forme de la facture change, on
 * voit pas les mêmes informations sur l'entreprise ». Il regardait le document
 * à l'écran ; son client recevait celui-ci, qui était un autre document :
 *
 *   - page BLANCHE, quand la charte interdit le blanc pur et que le document
 *     imprimé est crème ;
 *   - AUCUNE mention légale — ni le régime de TVA (art. 293 B du CGI), ni les
 *     pénalités de retard et l'indemnité de 40 € (art. L441-10 du Code de
 *     commerce), que la loi impose sur une facture ;
 *   - aucun cartouche « Prestataire » : ni forme juridique, ni siège, ni code
 *     APE, alors que la page les affichait ;
 *   - aucun sceau Owise, quand le PDF du devis en portait un ;
 *   - aucun titre « Facture » : le mot était écrit en 10 pt en haut à droite ;
 *   - un or différent (#9A7A2A au lieu de #C9A84C) ;
 *   - « Total TTC » aligné à droite au lieu du bandeau encre et or ;
 *   - aucune colonne de numéro de ligne ;
 *   - des marges de 18,3 mm au lieu des 14 mm du document imprimé.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { chargerDocumentFacture, formaterMontant, type DocumentFacture } from '@/lib/facture-document'
import {
  A4, MARGE, MARGE_HAUT, OR, TEXTE, TEXTE_2, TEXTE_3,
  bandeauTotal, blocIdentite, couper, ecrire, ecrireEspace, enTeteDocument,
  feuilleNeuve, hauteurBloc, ligneTitre, mentionsPied, nettoyerPourPdf,
  piedDePage, placePour, px, traitLigne,
  type Contexte,
} from '@/lib/pdf-feuille'

/* Réexporté parce que scripts/test-facture-pdf.mts le lit ici. */
export { nettoyerPourPdf }

/** Une seule écriture des montants pour les trois formes du document. */
const montant = formaterMontant

const DROITE = A4.largeur - MARGE
const CONTENU = DROITE - MARGE

export function rendreFacturePdf(f: DocumentFacture): Promise<Uint8Array> {
  return (async () => {
    const doc = await PDFDocument.create()
    doc.setTitle(`Facture ${f.numero}`)
    doc.setSubject(`Facture ${f.numero} — ${f.societe.nom}`)
    doc.setProducer('Owise')
    doc.setCreator('Owise')

    const ctx: Contexte = {
      doc,
      page: feuilleNeuve(doc),
      y: A4.hauteur - MARGE_HAUT,
      normal: await doc.embedFont(StandardFonts.Helvetica),
      gras:   await doc.embedFont(StandardFonts.HelveticaBold),
      /* Le document compose son titre en Cormorant Garamond. L'embarquer
         demanderait de livrer le fichier de police dans le dépôt ; à défaut,
         une serif standard reste bien plus proche de la maquette qu'une
         Helvetica. */
      serif:  await doc.embedFont(StandardFonts.TimesRoman),
    }

    // ── .fac-haut ────────────────────────────────────────────────────────
    enTeteDocument(ctx, {
      metier: f.prestataire.metier,
      nom: f.prestataire.nom,
      telephone: f.prestataire.telephone,
      email: f.prestataire.email,
      siret: f.societe.siretGroupe ?? f.societe.siret,
    })

    // ── .fac-titre-ligne ─────────────────────────────────────────────────
    ligneTitre(ctx, 'Facture', f.numero, [
      ...(f.datePrestation
        ? [{ libelle: 'Prestations réalisées le', valeur: f.datePrestation }]
        : []),
      { libelle: 'Facture émise le', valeur: f.dateEmissionCourte },
      f.payee
        ? { libelle: 'Statut', valeur: f.reglement ?? 'Réglée' }
        : { libelle: 'Échéance', valeur: f.echeanceCourte ?? '—' },
    ])

    // ── .fac-parties : les deux cartouches d'identité ────────────────────
    const largeurBloc = (CONTENU - px(20)) / 2
    const blocPrestataire = {
      etiquette: 'Prestataire',
      titre: f.prestataire.nom,
      lignes: [
        f.prestataire.metier,
        [f.prestataire.telephone, f.prestataire.email].filter(Boolean).join(' · '),
      ].filter(l => l.trim().length > 0),
      legal: f.prestataire.legal,
    }
    const blocClient = {
      etiquette: 'Client',
      titre: f.client.nom,
      lignes: [
        f.client.contact ? `À l'attention de ${f.client.contact}` : null,
        ...(f.client.adresse ? f.client.adresse.split(',').map(m => m.trim()) : []),
        f.client.telephone,
        f.client.email,
      ].filter((l): l is string => Boolean(l && l.trim())),
    }

    /* La grille CSS donne la même hauteur aux deux cartouches : on prend donc
       la plus grande des deux, sinon l'un flotterait au-dessus de l'autre. */
    const hauteurParties = Math.max(
      hauteurBloc(ctx, blocPrestataire, largeurBloc),
      hauteurBloc(ctx, blocClient, largeurBloc),
    )
    ctx.y -= px(24)
    placePour(ctx, hauteurParties + px(40))
    const hautParties = ctx.y
    blocIdentite(ctx, MARGE, hautParties, largeurBloc, blocPrestataire, hauteurParties)
    blocIdentite(ctx, MARGE + largeurBloc + px(20), hautParties, largeurBloc, blocClient, hauteurParties)
    ctx.y = hautParties - hauteurParties

    // ── Le tableau des prestations ───────────────────────────────────────
    /* Vrai quand TOUTES les lignes sont saisies à la main : il n'y a alors
       aucune date de course à montrer, et « Trajet » devient « Désignation ».
       La règle est celle de la page — déclarée une fois, lue par l'en-tête et
       par les lignes, pour qu'ils ne puissent pas diverger. */
    const toutSaisi = f.lignes.length > 0 && f.lignes.every(l => l.libelle)

    const xDate = MARGE + px(28) + px(10)
    const xTrajet = toutSaisi ? xDate : xDate + px(72)
    const largeurTrajet = DROITE - px(98) - xTrajet

    ctx.y -= px(24)
    ecrireEspace(ctx, 'PRESTATIONS RÉALISÉES', MARGE, px(9.5), TEXTE_3, 0.2)

    ctx.y -= px(11) + px(9.5)
    if (!toutSaisi) ecrireEspace(ctx, 'DATE', xDate, px(9.5), TEXTE_3, 0.14, true)
    ecrireEspace(ctx, toutSaisi ? 'DÉSIGNATION' : 'TRAJET', xTrajet, px(9.5), TEXTE_3, 0.14, true)
    ecrireEspace(ctx, 'MONTANT', 0, px(9.5), TEXTE_3, 0.14, true, DROITE)
    ctx.y -= px(9)
    traitLigne(ctx, ctx.y)

    for (const [i, ligne] of f.lignes.entries()) {
      /* « départ → arrivée », ou la désignation seule sur une ligne saisie.
         La règle est énoncée une fois, dans LigneFacture : les trois surfaces
         écrivent « ligne.libelle ?? départ → arrivée », et rien d'autre. */
      const trajet = ligne.libelle ?? `${ligne.depart} → ${ligne.arrivee}`
      const bouts = couper(trajet, ctx.gras, px(13.5), largeurTrajet)
      const hauteurLigne = px(10) + bouts.length * px(13.5) * 1.3
        + (ligne.detail ? px(3) + px(12) * 1.55 : 0) + px(10)
      placePour(ctx, hauteurLigne + px(20))

      const haut = ctx.y
      ctx.y = haut - px(12) - px(11.5)
      ecrire(ctx, String(i + 1).padStart(2, '0'), MARGE, px(11.5), OR)

      if (!toutSaisi) {
        ctx.y = haut - px(10) - px(12.5)
        ecrire(ctx, ligne.date, xDate, px(12.5), TEXTE)
      }

      ctx.y = haut - px(10) - px(13.5)
      ecrire(ctx, montant(ligne.montantHt), 0, px(13.5), TEXTE, true, DROITE)
      for (const [j, bout] of bouts.entries()) {
        if (j > 0) ctx.y -= px(13.5) * 1.3
        ecrire(ctx, bout, xTrajet, px(13.5), TEXTE, true)
      }
      if (ligne.detail) {
        for (const bout of couper(ligne.detail, ctx.normal, px(12), largeurTrajet)) {
          ctx.y -= px(3) + px(12) * 1.55
          ecrire(ctx, bout, xTrajet, px(12), TEXTE_3)
        }
      }

      ctx.y -= px(10)
      traitLigne(ctx, ctx.y)
    }

    if (f.lignes.length === 0) {
      ctx.y -= px(10) + px(12.5)
      ecrire(ctx, 'Aucune prestation détaillée sur cette facture.', xTrajet, px(12.5), TEXTE_3)
      ctx.y -= px(10)
      traitLigne(ctx, ctx.y)
    }

    // ── .fac-bas : règlement à gauche, total à droite ────────────────────
    const largeurDroite = px(296)
    const xDroiteBas = DROITE - largeurDroite
    const largeurGauche = xDroiteBas - px(30) - MARGE

    /* Hauteur du bloc de droite : le récapitulatif, la ligne de TVA, puis le
       bandeau. Mesurée pour qu'il ne se coupe jamais en deux. */
    const hauteurTotaux = (f.recap.length + 1) * px(24.5) + px(12) + px(53)
    placePour(ctx, hauteurTotaux + px(50))

    ctx.y -= px(20)
    const hautBas = ctx.y

    ecrireEspace(ctx, 'RÈGLEMENT', MARGE, px(9.5), TEXTE_3, 0.2)
    ctx.y -= px(7)
    const texteReglement = f.payee
      ? (f.reglement ?? 'Facture acquittée.')
      : `Par virement bancaire, sous ${f.delaiPaiement} jours.`
    for (const bout of couper(texteReglement, ctx.normal, px(12), largeurGauche)) {
      ctx.y -= px(12) * 1.8
      ecrire(ctx, bout, MARGE, px(12), TEXTE_2)
    }
    /* Aucun IBAN sur une facture acquittée : le client pourrait payer deux
       fois. La décision est prise dans facture-document.ts, qui met `banque`
       à null — on ne la reprend pas ici. */
    for (const l of [f.banque?.iban, f.banque?.bic && `BIC ${f.banque.bic}`]) {
      if (!l) continue
      ctx.y -= px(12.5) * 1.8
      ecrire(ctx, l, MARGE, px(12.5), TEXTE)
    }
    const basReglement = ctx.y

    ctx.y = hautBas
    for (const r of [...f.recap, { libelle: 'TVA', montant: null as number | null }]) {
      ctx.y -= px(6) + px(12.5)
      ecrire(ctx, r.libelle, xDroiteBas, px(12.5), TEXTE_2)
      ecrire(
        ctx,
        r.montant === null ? f.mentionTva : montant(r.montant),
        0, px(12.5), TEXTE_2, false, DROITE,
      )
      ctx.y -= px(6)
    }
    ctx.y -= px(12)

    bandeauTotal(
      ctx,
      f.payee ? 'Montant réglé' : 'Net à payer',
      montant(f.montantTtc),
      xDroiteBas,
      largeurDroite,
    )

    // ── .fac-pied : les mentions légales ─────────────────────────────────
    ctx.y = Math.min(basReglement, ctx.y)
    mentionsPied(ctx, f.mentionsLegales)

    /* Le numéro de page seulement, quand il y en a plusieurs. La mention
       d'identité qui l'accompagnait est devenue inutile : elle est maintenant
       dans le cartouche « Prestataire », au même endroit et dans les mêmes
       termes que sur la page. */
    piedDePage(ctx, '')

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
