/**
 * Rend un devis en PDF, pour le joindre à l'e-mail envoyé au client.
 *
 * Pourquoi : jusqu'ici le devis n'existait qu'en page web, à imprimer depuis
 * le navigateur. Il fallait donc être devant un ordinateur, enregistrer un
 * fichier, puis le joindre à la main dans Gmail — trois manipulations qui
 * rendaient la réponse à une demande WhatsApp plus lente que de taper le
 * message soi-même. C'est ce qui a produit, le 2026-11-02, un e-mail parti
 * chez une cliente avec « [à compléter selon vos conditions] » dedans.
 *
 * Trois règles tiennent ce fichier :
 *
 *  - il ne DESSINE pas son papier : marges, palette, en-tête, cartouches,
 *    bandeau du total et pied viennent de pdf-feuille.ts, partagé avec la
 *    facture. Un devis et la facture qui le suit sont le même papier ;
 *  - il n'ÉCRIT aucun libellé : chaque phrase vient de devis-client.ts, qui
 *    la donne aussi à la page web ;
 *  - ce qu'il ajoute est ce qu'une facture n'a pas, et rien d'autre : la
 *    colonne des heures, et le cadre de signature.
 *
 * Réécrit le 2026-11-09 : il composait son propre en-tête (OWISE en or,
 * « DEVIS » en haut à droite), ses propres blocs sans fond, et son propre pied
 * en 6,5 pt — trois choix que ni la page web ni la facture ne faisaient.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { formaterMontant } from '@/lib/montant'
import {
  A4, MARGE, MARGE_HAUT, OR, TEXTE, TEXTE_2, TEXTE_3,
  bandeauTotal, blocIdentite, couper, ecrire, ecrireEspace, enTeteDocument,
  feuilleNeuve, hauteurBloc, ligneTitre, mentionsPied, nettoyerPourPdf,
  piedDePage, placePour, px, traitLigne,
  type Contexte,
} from '@/lib/pdf-feuille'
import {
  CADRE_SIGNATURE, LIBELLE_NET, LIGNES_REGLEMENT, TITRE_REGLEMENT, basDePage,
  chargerDevis, chargerPrestataire, dateCourte, dateLongue, detailLigne,
  jourEmission, lignesTotaux, phraseAccord,
  type DevisClient, type Prestataire,
} from '@/lib/devis-client'

const DROITE = A4.largeur - MARGE
const CONTENU = DROITE - MARGE

export function rendreDevisPdf(d: DevisClient, p: Prestataire): Promise<Uint8Array> {
  return (async () => {
    const doc = await PDFDocument.create()
    doc.setTitle(`Devis ${d.numero}`)
    doc.setSubject(`Devis ${d.numero} — ${d.client_societe || d.client_nom}`)
    doc.setProducer('Owise')
    doc.setCreator('Owise')

    const ctx: Contexte = {
      doc,
      page: feuilleNeuve(doc),
      y: A4.hauteur - MARGE_HAUT,
      normal: await doc.embedFont(StandardFonts.Helvetica),
      gras:   await doc.embedFont(StandardFonts.HelveticaBold),
      serif:  await doc.embedFont(StandardFonts.TimesRoman),
    }

    // ── .fac-haut ────────────────────────────────────────────────────────
    enTeteDocument(ctx, {
      metier: p.metier,
      nom: p.nom,
      telephone: p.telephone,
      email: p.email,
      siret: p.siret,
    })

    // ── .fac-titre-ligne ─────────────────────────────────────────────────
    /* dateCourte() peut rendre null : on la lit une fois dans une variable,
       sinon TypeScript ne peut pas savoir que le test et la valeur portent
       sur le meme appel. */
    const jourPrestation = dateCourte(d.date_prestation)
    const jourValidite = dateCourte(d.date_validite)
    ligneTitre(ctx, 'Devis', d.numero, [
      ...(jourPrestation
        ? [{ libelle: 'Prestations prévues le', valeur: jourPrestation }]
        : []),
      { libelle: 'Devis émis le', valeur: dateCourte(jourEmission(d)) ?? '—' },
      ...(jourValidite
        ? [{ libelle: "Valable jusqu'au", valeur: jourValidite }]
        : []),
    ])

    // ── .fac-parties ─────────────────────────────────────────────────────
    const largeurBloc = (CONTENU - px(20)) / 2
    const blocPrestataire = {
      etiquette: 'Prestataire',
      titre: p.nom,
      lignes: [
        p.metier,
        [p.telephone, p.email].filter(Boolean).join(' · '),
      ].filter(l => l.trim().length > 0),
      legal: p.legal,
    }
    const blocClient = {
      etiquette: 'Client',
      titre: d.client_societe || d.client_nom,
      lignes: [
        d.client_societe ? `À l'attention de ${d.client_nom}` : null,
        ...(d.client_adresse ? d.client_adresse.split(',').map(m => m.trim()) : []),
        d.client_tel,
        d.client_email,
      ].filter((l): l is string => Boolean(l && l.trim())),
    }

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
    /* Ce qu'une facture n'a pas : l'heure de prise en charge. Elle occupe la
       colonne que la facture réserve à la date — .fac-date de la feuille, même
       largeur, même police. */
    const xHeure = MARGE + px(28) + px(10)
    const xTrajet = xHeure + px(72)
    const largeurTrajet = DROITE - px(98) - xTrajet

    const jour = dateLongue(d.date_prestation)
    ctx.y -= px(24)
    ecrireEspace(ctx, (jour ? `Prestations du ${jour}` : 'Prestations').toUpperCase(),
      MARGE, px(9.5), TEXTE_3, 0.2)

    ctx.y -= px(11) + px(9.5)
    ecrireEspace(ctx, 'HEURE', xHeure, px(9.5), TEXTE_3, 0.14, true)
    ecrireEspace(ctx, 'TRAJET', xTrajet, px(9.5), TEXTE_3, 0.14, true)
    ecrireEspace(ctx, 'MONTANT', 0, px(9.5), TEXTE_3, 0.14, true, DROITE)
    ctx.y -= px(9)
    traitLigne(ctx, ctx.y)

    for (const [i, l] of d.lignes.entries()) {
      const detail = detailLigne(l)
      const bouts = couper(`${l.depart} → ${l.arrivee}`, ctx.gras, px(13.5), largeurTrajet)
      const hauteurLigne = px(10) + bouts.length * px(13.5) * 1.3
        + (detail ? px(3) + px(12) * 1.55 : 0) + px(10)
      placePour(ctx, hauteurLigne + px(20))

      const haut = ctx.y
      ctx.y = haut - px(12) - px(11.5)
      ecrire(ctx, String(i + 1).padStart(2, '0'), MARGE, px(11.5), OR)

      ctx.y = haut - px(10) - px(12.5)
      ecrire(ctx, l.heure || '—', xHeure, px(12.5), TEXTE)

      ctx.y = haut - px(10) - px(13.5)
      ecrire(ctx, formaterMontant(Number(l.prix)), 0, px(13.5), TEXTE, true, DROITE)
      for (const [j, bout] of bouts.entries()) {
        if (j > 0) ctx.y -= px(13.5) * 1.3
        ecrire(ctx, bout, xTrajet, px(13.5), TEXTE, true)
      }
      if (detail) {
        for (const bout of couper(detail, ctx.normal, px(12), largeurTrajet)) {
          ctx.y -= px(3) + px(12) * 1.55
          ecrire(ctx, bout, xTrajet, px(12), TEXTE_3)
        }
      }

      ctx.y -= px(10)
      traitLigne(ctx, ctx.y)
    }

    if (d.lignes.length === 0) {
      ctx.y -= px(10) + px(12.5)
      ecrire(ctx, 'Aucune prestation sur ce devis.', xTrajet, px(12.5), TEXTE_3)
      ctx.y -= px(10)
      traitLigne(ctx, ctx.y)
    }

    // ── .fac-bas ─────────────────────────────────────────────────────────
    const totaux = lignesTotaux(d)
    const largeurDroite = px(296)
    const xDroiteBas = DROITE - largeurDroite
    const largeurGauche = xDroiteBas - px(30) - MARGE

    placePour(ctx, totaux.length * px(24.5) + px(12) + px(53) + px(50))
    ctx.y -= px(20)
    const hautBas = ctx.y

    ecrireEspace(ctx, TITRE_REGLEMENT.toUpperCase(), MARGE, px(9.5), TEXTE_3, 0.2)
    ctx.y -= px(7)
    for (const l of LIGNES_REGLEMENT) {
      for (const bout of couper(l, ctx.normal, px(12), largeurGauche)) {
        ctx.y -= px(12) * 1.8
        ecrire(ctx, bout, MARGE, px(12), TEXTE_2)
      }
    }
    const basReglement = ctx.y

    ctx.y = hautBas
    for (const t of totaux) {
      ctx.y -= px(6) + px(12.5)
      ecrire(ctx, t.libelle, xDroiteBas, px(12.5), TEXTE_2)
      ecrire(ctx, t.valeur, 0, px(12.5), TEXTE_2, false, DROITE)
      ctx.y -= px(6)
    }
    ctx.y -= px(12)

    bandeauTotal(ctx, LIBELLE_NET, formaterMontant(Number(d.total_ht)), xDroiteBas, largeurDroite)

    ctx.y = Math.min(basReglement, ctx.y)

    // ── .dv-signature : ce qu'une facture n'a pas ────────────────────────
    const accord = couper(phraseAccord(d), ctx.normal, px(11.5), largeurGauche)
    const cadreLargeur = px(240)
    const cadreHauteur = px(62)
    placePour(ctx, px(34) + Math.max(accord.length * px(11.5) * 1.8, cadreHauteur) + px(20))

    ctx.y -= px(34)
    const hautAccord = ctx.y
    for (const bout of accord) {
      ctx.y -= px(11.5) * 1.8
      ecrire(ctx, bout, MARGE, px(11.5), TEXTE_2)
    }

    /* Le cadre pointillé de .dv-cadre. pdf-lib ne trace pas de pointillés :
       un filet continu très clair rend la même intention sur du papier. */
    ctx.page.drawRectangle({
      x: DROITE - cadreLargeur, y: hautAccord - cadreHauteur,
      width: cadreLargeur, height: cadreHauteur,
      borderColor: TEXTE, borderOpacity: 0.22, borderWidth: 0.8,
    })
    ctx.y = hautAccord - px(14)
    for (const bout of couper(CADRE_SIGNATURE, ctx.normal, px(10), cadreLargeur - px(20))) {
      ecrire(ctx, bout, DROITE - cadreLargeur + px(10), px(10), TEXTE_3)
      ctx.y -= px(10) * 1.5
    }

    ctx.y = Math.min(ctx.y, hautAccord - cadreHauteur)

    // ── .fac-pied ────────────────────────────────────────────────────────
    /* basDePage() donne les mentions dans l'ordre, et la page web rend la
       même liste. Pas de gras ici : contrairement à la facture, la maquette
       du devis n'en met pas. */
    mentionsPied(ctx, basDePage(d).map(texte => ({ texte })))

    piedDePage(ctx, '')

    return doc.save()
  })()
}

/** Charge le devis puis le rend. Renvoie null si le devis n'existe pas. */
export async function genererDevisPdf(
  devisId: string,
): Promise<{ nomFichier: string; contenu: Uint8Array } | null> {
  const [devis, prestataire] = await Promise.all([chargerDevis(devisId), chargerPrestataire()])
  if (!devis) return null
  return {
    nomFichier: `${devis.numero.replace(/[^A-Za-z0-9._-]/g, '-')}.pdf`,
    contenu: await rendreDevisPdf(devis, prestataire),
  }
}

export { nettoyerPourPdf }
