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

  /* On prend le PLUS GRAND numero du mois, pas le NOMBRE de factures.
   *
   * Compter les lignes supposait qu'aucune ne disparait jamais. Le 2026-10-08,
   * deux factures en double ont du etre supprimees (OW-202610-0003 et 0004) :
   * octobre contenait alors 0001, 0002 et 0005, soit trois lignes. La fonction
   * aurait rendu 0004 — un numero deja utilise puis retire — puis 0005, qui
   * existe encore. Deux factures auraient porte le meme numero.
   *
   * Une numerotation de factures ne doit jamais reculer ni se repeter. */
  const { data: existantes } = await supabase
    .from('factures')
    .select('numero')
    .like('numero', `${prefixe}${yyyymm}-%`)

  const dernier = (existantes ?? []).reduce((max, { numero }) => {
    const n = Number(String(numero).split('-').pop())
    return Number.isFinite(n) && n > max ? n : max
  }, 0)

  const seq = String(dernier + 1).padStart(4, '0')
  return `${prefixe}${yyyymm}-${seq}`
}
