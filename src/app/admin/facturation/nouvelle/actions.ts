'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function creerFacture(formData: FormData): Promise<void> {
  const supabase = await createClient()

  const client_id    = formData.get('client_id') as string
  const montant_ht   = parseFloat(formData.get('montant_ht') as string)
  const montant_ttc  = parseFloat(formData.get('montant_ttc') as string)
  const course_ids   = formData.getAll('course_ids[]') as string[]
  const delai        = parseInt(formData.get('delai_paiement') as string, 10) || 30

  if (!client_id || isNaN(montant_ht) || isNaN(montant_ttc)) {
    redirect('/admin/facturation/nouvelle?error=Données+incomplètes')
  }

  // Lire le préfixe et compter les factures existantes pour générer le numéro
  const [parametresRes, countRes] = await Promise.all([
    supabase.from('parametres').select('facture_prefixe').eq('id', true).single(),
    supabase.from('factures').select('id', { count: 'exact', head: true }),
  ])

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
      statut: 'en_attente',
      montant_ht,
      montant_ttc,
      date_echeance: echeance.toISOString(),
    })
    .select('id')
    .single()

  if (error || !facture) {
    redirect(`/admin/facturation/nouvelle?error=${encodeURIComponent(error?.message ?? 'Erreur')}`)
  }

  // Lier les courses à cette facture
  if (course_ids.length > 0) {
    await supabase
      .from('courses')
      .update({ facture_id: facture.id })
      .in('id', course_ids)
  }

  redirect(`/admin/facturation/${facture.id}`)
}
