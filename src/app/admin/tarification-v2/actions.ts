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
import { VEHICULES_V2, lireGrilleV2 } from '@/lib/tarification-v2/grille-db'
import type { CleVehiculeV2, GrilleV2, MesuresTrajet } from '@/lib/tarification-v2/grille'
import { mesurerTrajet } from '@/lib/tarification-v2/mesures-google'
import { prixActuel, chargerTarificationActuelle, type PrixActuel } from '@/lib/tarification-v2/prix-actuel'

export type ResultatSimulation =
  | { erreur: string }
  | {
      depart: { saisie: string; libelleGoogle: string }
      arrivee: { saisie: string; libelleGoogle: string }
      mesures: MesuresTrajet
      actuel: Record<CleVehiculeV2, PrixActuel>
    }

/**
 * Le simulateur : un trajet quelconque, mesuré par Google, chiffré au prix
 * ACTUEL du site (pour les 4 véhicules). Le prix v2 est calculé dans le
 * navigateur à partir des mesures, pour suivre la grille en direct.
 * N'écrit RIEN en base.
 */
export async function simulerTrajet(depart: string, arrivee: string): Promise<ResultatSimulation> {
  await requireAdminClient()
  const d = (depart ?? '').trim(), a = (arrivee ?? '').trim()
  if (d.length < 3 || a.length < 3) return { erreur: 'Indiquez un départ et une arrivée.' }
  if (d.length > 200 || a.length > 200) return { erreur: 'Adresse trop longue.' }
  const sb = createAdminClient()
  const [grille, tarification] = await Promise.all([lireGrilleV2(sb), chargerTarificationActuelle(sb)])
  const m = await mesurerTrajet(d, a, grille.bases)
  if ('erreur' in m) return { erreur: m.erreur }
  const actuel = Object.fromEntries(VEHICULES_V2.map(v => [v,
    prixActuel({ label: m.depart.saisie, cp: m.depart.cp }, { label: m.arrivee.saisie, cp: m.arrivee.cp }, m.distanceKm, v, tarification),
  ])) as Record<CleVehiculeV2, PrixActuel>
  return {
    depart: { saisie: d, libelleGoogle: m.depart.libelleGoogle },
    arrivee: { saisie: a, libelleGoogle: m.arrivee.libelleGoogle },
    mesures: m.mesures, actuel,
  }
}

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
