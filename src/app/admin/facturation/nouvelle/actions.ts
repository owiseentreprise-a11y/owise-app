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

  if (!client_id || isNaN(montant_ht) || isNaN(montant_ttc)) {
    redirect('/admin/facturation/nouvelle?error=Données+incomplètes')
  }

  const numero = await genererNumeroFacture(supabase)

  const echeance = new Date()
  echeance.setDate(echeance.getDate() + delai)

  const { data: facture, error } = await supabase
    .from('factures')
    .insert({
      client_id,
      numero,
      statut:        deja_reglee ? 'payee' : 'en_attente',
      montant_ht,
      tva:   Math.round((montant_ttc - montant_ht) * 100) / 100,
      montant_ttc,
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
      unit_amount: Math.round(montant_ttc * 100),
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
