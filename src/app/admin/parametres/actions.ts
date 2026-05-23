'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'

export async function sauvegarderParametres(formData: FormData): Promise<{ error?: string }> {
  const supabase = await requireAdminClient()

  const payload = {
    societe_nom:            (formData.get('societe_nom') as string) || null,
    societe_siret:          (formData.get('societe_siret') as string) || null,
    societe_tva_numero:     (formData.get('societe_tva_numero') as string) || null,
    societe_naf:            (formData.get('societe_naf') as string) || null,
    societe_adresse:        (formData.get('societe_adresse') as string) || null,
    societe_code_postal:    (formData.get('societe_code_postal') as string) || null,
    societe_ville:          (formData.get('societe_ville') as string) || null,
    societe_telephone:      (formData.get('societe_telephone') as string) || null,
    societe_email:          (formData.get('societe_email') as string) || null,
    facture_prefixe:        (formData.get('facture_prefixe') as string) || 'OW-',
    facture_taux_tva:       parseFloat(formData.get('facture_taux_tva') as string) || 20,
    facture_delai_paiement: parseInt(formData.get('facture_delai_paiement') as string, 10) || 30,
    facture_mentions:       (formData.get('facture_mentions') as string) || null,
    banque_iban:            (formData.get('banque_iban') as string) || null,
    banque_bic:             (formData.get('banque_bic') as string) || null,
    banque_nom:             (formData.get('banque_nom') as string) || null,
  }

  const { error } = await supabase
    .from('parametres')
    .update(payload)
    .eq('id', true)

  if (error) return { error: error.message }

  revalidatePath('/admin/parametres')
  return {}
}
