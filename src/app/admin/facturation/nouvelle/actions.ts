'use server'

import { redirect } from 'next/navigation'
import { requireAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'
import { genererNumeroFacture } from '@/lib/facturation'

export async function creerFacture(formData: FormData): Promise<void> {
  const supabase = await requireAdminClient()

  const client_id    = formData.get('client_id') as string
  const montant_ht   = parseFloat(formData.get('montant_ht') as string)
  const montant_ttc  = parseFloat(formData.get('montant_ttc') as string)
  const course_ids   = formData.getAll('course_ids[]') as string[]
  const delai        = parseInt(formData.get('delai_paiement') as string, 10) || 30
  // Facture émise après un règlement déjà encaissé (TPE à bord, espèces,
  // virement) : c'est un justificatif. Elle ne doit ni partir « en attente »
  // ni porter un lien de paiement, sinon le client risque de payer deux fois.
  const deja_reglee   = formData.get('deja_reglee') === 'on' || formData.get('deja_reglee') === 'true'
  const mode_paiement = deja_reglee ? ((formData.get('mode_paiement') as string) || null) : null

  if (deja_reglee && !mode_paiement) {
    redirect('/admin/facturation/nouvelle?error=Indiquez+le+moyen+de+paiement+re%C3%A7u')
  }

  /* ── Lignes saisies à la main ─────────────────────────────────────────
     Une prestation réservée par téléphone n'a aucune course enregistrée : la
     facture n'avait alors rien à montrer, et le document imprimait « Aucune
     course rattachée à cette facture » sur un papier remis au client.
     Constaté le 2026-11-09, sur une facture à envoyer le jour même.

     Les lignes sont écrites dans `factures.notes`, une par ligne, au format
     « libellé|montant » — le format que `lireRecap()` lit déjà, et dont
     `facture-document.ts` tire le corps de la facture quand il n'y a pas de
     course. On ne crée donc pas une deuxième façon de décrire une facture :
     on branche une interface sur celle qui existe. */
  const libelles = (formData.getAll('ligne_libelle[]') as string[]).map(s => (s ?? '').trim())
  const montants = (formData.getAll('ligne_montant[]') as string[]).map(s => Number(s))
  const lignesSaisies = libelles
    .map((libelle, i) => ({ libelle, montant: montants[i] }))
    .filter(l => l.libelle.length > 0 && isFinite(l.montant) && l.montant > 0)

  const totalSaisi = Math.round(lignesSaisies.reduce((s, l) => s + l.montant, 0) * 100) / 100

  /* Les deux sources ne se mélangent jamais : des courses cochées ET des
     lignes saisies additionneraient deux fois la même prestation. */
  if (course_ids.length > 0 && lignesSaisies.length > 0) {
    redirect('/admin/facturation/nouvelle?error=' + encodeURIComponent(
      'Choisissez soit des courses enregistrées, soit des lignes saisies — pas les deux.'))
  }

  if (course_ids.length === 0 && lignesSaisies.length === 0) {
    redirect('/admin/facturation/nouvelle?error=' + encodeURIComponent(
      'Cochez au moins une course, ou saisissez au moins une ligne (désignation et montant).'))
  }

  if (!client_id || isNaN(montant_ht) || isNaN(montant_ttc)) {
    redirect('/admin/facturation/nouvelle?error=Données+incomplètes')
  }

  /* Avec des lignes saisies, le montant VIENT des lignes, jamais du champ
     caché : `lireRecap()` n'affiche le détail que si la somme des postes fait
     exactement le total. Les faire diverger produirait une facture dont le
     corps disparaît sans un mot. */
  const htFinal  = lignesSaisies.length > 0 ? totalSaisi : montant_ht
  const ttcFinal = lignesSaisies.length > 0 ? totalSaisi : montant_ttc

  const numero = await genererNumeroFacture(supabase)

  const echeance = new Date()
  echeance.setDate(echeance.getDate() + delai)

  const { data: facture, error } = await supabase
    .from('factures')
    .insert({
      client_id,
      numero,
      statut:        deja_reglee ? 'payee' : 'en_attente',
      montant_ht:  htFinal,
      tva:   Math.round((ttcFinal - htFinal) * 100) / 100,
      montant_ttc: ttcFinal,
      /* Le récapitulatif, au format que le document sait relire. */
      notes: lignesSaisies.length > 0
        ? lignesSaisies.map(l => `${l.libelle}|${l.montant}`).join('\n')
        : null,
      // La facture porte la date à laquelle elle est émise — antidater serait
      // irrégulier. La date de la prestation apparaît sur la ligne de course.
      date_emission: new Date().toISOString().slice(0, 10),
      // Déjà réglée : l'échéance est le jour même, pas dans 30 jours.
      date_echeance: deja_reglee ? new Date().toISOString() : echeance.toISOString(),
      mode_paiement,
    })
    .select('id')
    .single()

  if (error || !facture) {
    redirect(`/admin/facturation/nouvelle?error=${encodeURIComponent(error?.message ?? 'Erreur')}`)
  }

  // Créer le Stripe Payment Link et le lier à la facture — sauf si elle est
  // déjà réglée : un lien de paiement sur une facture acquittée invite le
  // client à payer une seconde fois.
  if (!deja_reglee) try {
    const price = await stripe.prices.create({
      currency: 'eur',
      unit_amount: Math.round(ttcFinal * 100),
      product_data: { name: `Facture ${numero} – OWISE VTC` },
    })
    const link = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: { facture_id: facture.id },
      after_completion: {
        type: 'redirect',
        redirect: { url: `${process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'}/paiement/merci` },
      },
    })
    await supabase
      .from('factures')
      .update({ stripe_payment_link: link.url })
      .eq('id', facture.id)
  } catch {
    // Non bloquant — la facture existe, le lien peut être régénéré plus tard
  }

  if (course_ids.length > 0) {
    await supabase
      .from('courses')
      .update({ facture_id: facture.id })
      .in('id', course_ids)
  }

  redirect(`/admin/facturation/${facture.id}`)
}
