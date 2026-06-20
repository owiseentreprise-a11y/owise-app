'use server'

import { redirect } from 'next/navigation'
import { requireAdminClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

async function logDbg(tag: string) {
  try {
    await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/parametres?id=eq.true`, {
      method: 'PATCH',
      headers: {
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ facture_mentions: tag.slice(0, 500) }),
    })
  } catch {}
}

export async function creerFacture(formData: FormData): Promise<void> {
  await logDbg('CF-start')
  try {
    const supabase = await requireAdminClient()
    await logDbg('CF-after-requireAdminClient')

    const client_id    = formData.get('client_id') as string
    const montant_ht   = parseFloat(formData.get('montant_ht') as string)
    const montant_ttc  = parseFloat(formData.get('montant_ttc') as string)
    const course_ids   = formData.getAll('course_ids[]') as string[]
    const delai        = parseInt(formData.get('delai_paiement') as string, 10) || 30

    if (!client_id || isNaN(montant_ht) || isNaN(montant_ttc)) {
      await logDbg(`CF-validation-fail-client${!!client_id}-ht${montant_ht}-ttc${montant_ttc}`)
      redirect('/admin/facturation/nouvelle?error=Données+incomplètes')
    }

    const [parametresRes, countRes] = await Promise.all([
      supabase.from('parametres').select('facture_prefixe').eq('id', true).single(),
      supabase.from('factures').select('id', { count: 'exact', head: true }),
    ])
    await logDbg(`CF-after-parametres-perr${parametresRes.error?.message ?? 'none'}-cerr${countRes.error?.message ?? 'none'}`)

    const prefixe = parametresRes.data?.facture_prefixe ?? 'OW-'
    const count = (countRes.count ?? 0) + 1
    const now = new Date()
    const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
    const numero = `${prefixe}${yyyymm}-${String(count).padStart(3, '0')}`

    const echeance = new Date()
    echeance.setDate(echeance.getDate() + delai)

    const { data: facture, error } = await supabase
      .from('factures')
      .insert({
        client_id,
        numero,
        statut:        'en_attente',
        montant_ht,
        tva:   Math.round((montant_ttc - montant_ht) * 100) / 100,
        montant_ttc,
        date_emission: new Date().toISOString().slice(0, 10),
        date_echeance: echeance.toISOString(),
      })
      .select('id')
      .single()

    await logDbg(`CF-after-insert-error${error?.message ?? 'none'}-id${facture?.id ?? 'none'}`)

    if (error || !facture) {
      redirect(`/admin/facturation/nouvelle?error=${encodeURIComponent(error?.message ?? 'Erreur')}`)
    }

    // Créer le Stripe Payment Link et le lier à la facture
    try {
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
      await logDbg('CF-after-stripe-ok')
    } catch (stripeErr: any) {
      await logDbg(`CF-stripe-failed-${stripeErr?.message ?? 'unknown'}`)
      // Non bloquant — la facture existe, le lien peut être régénéré plus tard
    }

    if (course_ids.length > 0) {
      await supabase
        .from('courses')
        .update({ facture_id: facture.id })
        .in('id', course_ids)
    }

    await logDbg(`CF-before-final-redirect-${facture.id}`)
    redirect(`/admin/facturation/${facture.id}`)
  } catch (e: any) {
    if (e?.digest === 'NEXT_REDIRECT') throw e
    await logDbg(`CF-UNCAUGHT-${e?.message ?? String(e)}`)
    throw e
  }
}
