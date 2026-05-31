'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { stripe } from '@/lib/stripe'

export async function payerFactureAction(factureId: string): Promise<{ error: string } | never> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Sécurité : vérifier que la facture appartient à ce client
  const { data: facture } = await supabase
    .from('factures')
    .select('id, numero, montant_ttc, statut, client_id')
    .eq('id', factureId)
    .eq('client_id', user.id)
    .single()

  if (!facture) return { error: 'Facture introuvable' }
  if (facture.statut === 'payee') return { error: 'Cette facture est déjà payée' }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://owise.fr'

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(facture.montant_ttc) * 100),
          product_data: {
            name: `Facture ${facture.numero}`,
            description: 'Règlement de facture OWISE',
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      facture_id: factureId,
    },
    success_url: `${appUrl}/espace-client/factures/${factureId}?paid=1`,
    cancel_url: `${appUrl}/espace-client/factures/${factureId}`,
  })

  redirect(session.url!)
}
