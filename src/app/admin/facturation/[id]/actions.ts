'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { getUserEmail } from '@/lib/supabase/admin'
import { envoyerLienPaiementClient } from '@/lib/email'

export async function changerStatutFacture(
  factureId: string,
  statut: 'payee' | 'retard' | 'en_attente',
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('factures').update({ statut }).eq('id', factureId)
  revalidatePath(`/admin/facturation/${factureId}`)
  revalidatePath('/admin/facturation')
}

export async function envoyerLienPaiement(
  factureId: string,
): Promise<{ error?: string }> {
  const supabase = await requireAdminClient()

  const { data: facture } = await supabase
    .from('factures')
    .select('numero, montant_ttc, stripe_payment_link, client_id, date_echeance, clients(type_compte, entreprise_nom, profiles(prenom, nom))')
    .eq('id', factureId)
    .single()

  if (!facture?.stripe_payment_link) return { error: 'Pas de lien Stripe sur cette facture' }
  if (!facture.client_id) return { error: 'Pas de client associé à cette facture' }

  const email = await getUserEmail(facture.client_id)
  if (!email) return { error: 'Email client introuvable' }

  const client = (facture as any).clients
  const prenom = client?.profiles?.prenom ?? ''

  await envoyerLienPaiementClient({
    clientEmail: email,
    clientPrenom: prenom,
    numeroFacture: facture.numero,
    montantTTC: facture.montant_ttc,
    dateEcheance: facture.date_echeance ?? null,
    lienPaiement: facture.stripe_payment_link,
  })

  return {}
}
