import type { SupabaseClient } from '@supabase/supabase-js'

// Numérotation unique des factures, partagée par tous les chemins de création
// (manuel, groupé, conversion de devis, paiement en ligne, génération
// chauffeur "par prestation"). Format : PREFIXE-AAAAMM-NNNN, séquentiel par
// mois — condition légale française de continuité de la numérotation.
//
// Non utilisé par le cron facturation-mensuelle, qui crée plusieurs factures
// en parallèle dans un même run : il incrémente son propre compteur local en
// mémoire pour éviter que deux comptages concurrents ne lisent le même
// total avant qu'aucun insert n'ait eu lieu.
export async function genererNumeroFacture(supabase: SupabaseClient): Promise<string> {
  const { data: parametres } = await supabase.from('parametres').select('facture_prefixe').eq('id', true).single()
  const prefixe = parametres?.facture_prefixe ?? 'OW-'

  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`

  const { count } = await supabase
    .from('factures')
    .select('id', { count: 'exact', head: true })
    .like('numero', `${prefixe}${yyyymm}-%`)

  const seq = String((count ?? 0) + 1).padStart(4, '0')
  return `${prefixe}${yyyymm}-${seq}`
}
