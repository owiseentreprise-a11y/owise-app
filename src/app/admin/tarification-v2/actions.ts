'use server'

/**
 * Enregistrement de la grille v2 (projet « Tarification v2 », étape 2).
 *
 * N'écrit QUE dans v2_grille_vehicules et v2_bases. Ne touche ni `tarifs`, ni
 * `grilles_tarifaires`, ni `parametres` : les prix du site ne bougent pas.
 * Aucune page publique n'est revalidée, puisqu'aucune ne lit ces tables.
 */
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { VEHICULES_V2 } from '@/lib/tarification-v2/grille-db'
import type { GrilleV2 } from '@/lib/tarification-v2/grille'

const valide = (n: unknown) => typeof n === 'number' && Number.isFinite(n) && n >= 0

export async function enregistrerGrilleV2(g: GrilleV2): Promise<{ error?: string }> {
  await requireAdminClient()
  const sb = createAdminClient()

  for (const cle of VEHICULES_V2) {
    const l = g.vehicules?.[cle]
    if (!l || ![l.priseEnCharge, l.prixKm, l.prixHeure, l.minimum].every(valide)) return { error: `Valeur invalide pour ${cle}` }
  }
  for (const b of g.bases ?? []) {
    if (![b.kmInclus, b.minInclus].every(valide) || typeof b.active !== 'boolean') return { error: `Valeur invalide pour la base ${b.nom}` }
  }

  const maintenant = new Date().toISOString()
  for (const cle of VEHICULES_V2) {
    const l = g.vehicules[cle]
    /* `.select()` : une mise à jour qui ne touche aucune ligne ne renvoie pas
       d'erreur — sans relire, une saisie pourrait disparaître en silence. */
    const { data, error } = await sb.from('v2_grille_vehicules')
      .update({ prise_en_charge: l.priseEnCharge, prix_km: l.prixKm, prix_heure: l.prixHeure, minimum: l.minimum, updated_at: maintenant })
      .eq('vehicule', cle).select('vehicule')
    if (error) return { error: error.message }
    if (!data?.length) return { error: `Ligne ${cle} introuvable dans la grille v2` }
  }
  for (const b of g.bases ?? []) {
    const { data, error } = await sb.from('v2_bases')
      .update({ km_inclus: b.kmInclus, min_inclus: b.minInclus, active: b.active, updated_at: maintenant })
      .eq('nom', b.nom).select('nom')
    if (error) return { error: error.message }
    if (!data?.length) return { error: `Base ${b.nom} introuvable` }
  }

  revalidatePath('/admin/tarification-v2')
  return {}
}
