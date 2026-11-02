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
 * Deux règles tiennent ce fichier :
 *
 *  - il ne DESSINE pas son papier : marges, palette et tracé viennent de
 *    `pdf-feuille.ts`, partagé avec la facture ;
 *  - il n'ÉCRIT aucun libellé : chaque phrase vient de `devis-client.ts`,
 *    qui la donne aussi à la page web. Un devis imprimé et le même devis en
 *    pièce jointe doivent dire exactement la même chose.
 */
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { formaterMontant } from '@/lib/montant'
import {
  A4, MARGE, OR, TEXTE, TEXTE_2, TEXTE_3, TRAIT,
  couper, ecrire, nettoyerPourPdf, piedDePage, placePour, trait,
  type Contexte,
} from '@/lib/pdf-feuille'
import {
  CADRE_SIGNATURE, LIBELLE_NET, LIGNES_REGLEMENT, TITRE_ATTENTE, TITRE_REGLEMENT,
  chargerDevis, chargerPrestataire, dateCourte, dateLongue, detailLigne,
  lignesTotaux, mentionsDevis, phraseAccord, phraseAttente,
  type DevisClient, type Prestataire,
} from '@/lib/devis-client'

export function rendreDevisPdf(d: DevisClient, p: Prestataire): Promise<Uint8Array> {
  return (async () => {
    const doc = await PDFDocument.create()
    doc.setTitle(`Devis ${d.numero}`)
    doc.setSubject(`Devis ${d.numero} — ${d.client_societe || d.client_nom}`)
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
    ecrire(ctx, 'OWISE', MARGE, 20, OR, true)
    ecrire(ctx, 'DEVIS', 0, 10, TEXTE_2, true, droite)

    ctx.y = hautEntete - 20
    ecrire(ctx, p.metier, MARGE, 9, TEXTE_3)
    ecrire(ctx, d.numero, 0, 16, OR, true, droite)

    ctx.y = hautEntete - 56
    trait(ctx, ctx.y)

    // ── Prestataire, client, dates ────────────────────────────────────────
    ctx.y -= 24
    const hautBloc = ctx.y
    const colonneClient = MARGE + 270

    ecrire(ctx, 'PRESTATAIRE', MARGE, 7, TEXTE_3)
    ctx.y -= 14
    ecrire(ctx, p.nom, MARGE, 11, TEXTE, true)
    for (const l of [
      p.metier,
      [p.telephone, p.email].filter(Boolean).join(' · '),
      ...p.legal,
    ].filter(Boolean)) {
      for (const bout of couper(String(l), ctx.normal, 8.5, 240)) {
        ctx.y -= 11
        ecrire(ctx, bout, MARGE, 8.5, TEXTE_2)
      }
    }
    const basPrestataire = ctx.y

    ctx.y = hautBloc
    ecrire(ctx, 'CLIENT', colonneClient, 7, TEXTE_3)
    ctx.y -= 14
    ecrire(ctx, d.client_societe || d.client_nom, colonneClient, 11, TEXTE, true)
    const lignesClient = [
      d.client_societe ? `À l'attention de ${d.client_nom}` : null,
      ...(d.client_adresse ? d.client_adresse.split(',').map(m => m.trim()).filter(Boolean) : []),
      d.client_tel,
      d.client_email,
    ].filter(Boolean)
    for (const l of lignesClient) {
      for (const bout of couper(String(l), ctx.normal, 8.5, 230)) {
        ctx.y -= 11
        ecrire(ctx, bout, colonneClient, 8.5, TEXTE_2)
      }
    }

    ctx.y = Math.min(basPrestataire, ctx.y) - 22

    // Les repères de date, en une ligne sous les deux blocs.
    const reperes = [
      dateCourte(d.date_prestation) ? `Prestations prévues le ${dateCourte(d.date_prestation)}` : null,
      `Devis émis le ${dateCourte(d.created_at.slice(0, 10))}`,
      dateCourte(d.date_validite) ? `Valable jusqu'au ${dateCourte(d.date_validite)}` : null,
    ].filter(Boolean).join('   ·   ')
    ecrire(ctx, reperes, MARGE, 9, TEXTE_2)

    ctx.y -= 14
    trait(ctx, ctx.y)

    // ── Prestations ───────────────────────────────────────────────────────
    const jour = dateLongue(d.date_prestation)
    if (jour) {
      ctx.y -= 20
      ecrire(ctx, `Prestations du ${jour}`, MARGE, 10, TEXTE, true)
    }

    ctx.y -= 20
    ecrire(ctx, 'HEURE', MARGE + 26, 7, TEXTE_3)
    ecrire(ctx, 'TRAJET', MARGE + 80, 7, TEXTE_3)
    ecrire(ctx, 'MONTANT', 0, 7, TEXTE_3, false, droite)
    ctx.y -= 8
    trait(ctx, ctx.y)

    d.lignes.forEach((l, i) => {
      const detail = detailLigne(l)
      const trajet = couper(`${l.depart} vers ${l.arrivee}`, ctx.gras, 9.5, 290)
      placePour(ctx, 24 + trajet.length * 12 + (detail ? 12 : 0))

      ctx.y -= 18
      const hautLigne = ctx.y
      ecrire(ctx, String(i + 1).padStart(2, '0'), MARGE, 9, TEXTE_3)
      ecrire(ctx, l.heure || '—', MARGE + 26, 9, TEXTE_2)
      ecrire(ctx, formaterMontant(Number(l.prix)), 0, 10, TEXTE, false, droite)

      trajet.forEach((bout, k) => {
        if (k > 0) ctx.y -= 12
        ecrire(ctx, bout, MARGE + 80, 9.5, TEXTE, true)
      })
      if (detail) {
        for (const bout of couper(detail, ctx.normal, 8.5, 290)) {
          ctx.y -= 11
          ecrire(ctx, bout, MARGE + 80, 8.5, TEXTE_3)
        }
      }

      ctx.y = Math.min(hautLigne, ctx.y) - 12
      trait(ctx, ctx.y)
    })

    if (d.lignes.length === 0) {
      ctx.y -= 18
      ecrire(ctx, 'Aucune prestation sur ce devis.', MARGE, 9, TEXTE_3)
      ctx.y -= 12
      trait(ctx, ctx.y)
    }

    // ── Conditions d'attente ──────────────────────────────────────────────
    const attente = phraseAttente(d)
    if (attente) {
      const lignes = couper(attente, ctx.normal, 8.5, A4.largeur - 2 * MARGE)
      placePour(ctx, 30 + lignes.length * 12)
      ctx.y -= 26
      ecrire(ctx, TITRE_ATTENTE.toUpperCase(), MARGE, 7, TEXTE_3)
      for (const bout of lignes) {
        ctx.y -= 12
        ecrire(ctx, bout, MARGE, 8.5, TEXTE_2)
      }
    }

    // ── Règlement et totaux ───────────────────────────────────────────────
    const totaux = lignesTotaux(d)
    placePour(ctx, 60 + totaux.length * 16)
    ctx.y -= 30
    const hautTotaux = ctx.y
    const gaucheTotaux = droite - 215

    ecrire(ctx, TITRE_REGLEMENT.toUpperCase(), MARGE, 7, TEXTE_3)
    for (const l of LIGNES_REGLEMENT) {
      for (const bout of couper(l, ctx.normal, 8.5, 230)) {
        ctx.y -= 12
        ecrire(ctx, bout, MARGE, 8.5, TEXTE_2)
      }
    }
    const basReglement = ctx.y

    ctx.y = hautTotaux
    for (const t of totaux) {
      ecrire(ctx, t.libelle, gaucheTotaux, 9.5, TEXTE_2)
      ecrire(ctx, t.valeur, 0, 9.5, TEXTE, false, droite)
      ctx.y -= 16
    }
    ctx.page.drawLine({
      start: { x: gaucheTotaux, y: ctx.y + 4 }, end: { x: droite, y: ctx.y + 4 },
      thickness: 0.7, color: TRAIT,
    })
    ctx.y -= 10
    ecrire(ctx, LIBELLE_NET, gaucheTotaux, 11, TEXTE, true)
    ecrire(ctx, formaterMontant(Number(d.total_ht)), 0, 15, OR, true, droite)

    ctx.y = Math.min(basReglement, ctx.y) - 30

    // ── Accord et signature ───────────────────────────────────────────────
    const accord = couper(phraseAccord(d), ctx.normal, 8.5, 290)
    placePour(ctx, 24 + Math.max(accord.length * 12, 74))
    const hautAccord = ctx.y
    for (const bout of accord) {
      ecrire(ctx, bout, MARGE, 8.5, TEXTE_2)
      ctx.y -= 12
    }

    const cadreHaut = hautAccord + 8
    const cadreLargeur = 190
    const cadreHauteur = 70
    ctx.page.drawRectangle({
      x: droite - cadreLargeur, y: cadreHaut - cadreHauteur,
      width: cadreLargeur, height: cadreHauteur,
      borderColor: TRAIT, borderWidth: 0.8,
    })
    const legende = couper(CADRE_SIGNATURE, ctx.normal, 7.5, cadreLargeur - 16)
    let yLegende = cadreHaut - 14
    for (const bout of legende) {
      ctx.page.drawText(nettoyerPourPdf(bout), {
        x: droite - cadreLargeur + 8, y: yLegende, size: 7.5,
        font: ctx.normal, color: TEXTE_3,
      })
      yLegende -= 10
    }

    ctx.y = Math.min(ctx.y, cadreHaut - cadreHauteur) - 24

    // ── Mentions légales ──────────────────────────────────────────────────
    for (const mention of mentionsDevis(d)) {
      const lignes = couper(mention, ctx.normal, 7.5, A4.largeur - 2 * MARGE)
      placePour(ctx, lignes.length * 10 + 8)
      for (const bout of lignes) {
        ecrire(ctx, bout, MARGE, 7.5, TEXTE_3)
        ctx.y -= 10
      }
      ctx.y -= 4
    }

    piedDePage(ctx, `${p.nom} · Service VTC · Paris & Île-de-France · owise.fr`)

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
