/**
 * tarification-v2/grille-db.ts — LIRE LA GRILLE V2 ET LES MESURES EN BASE.
 *
 * Projet « Tarification v2 » (c:\websitebuilding\TARIFICATION-V2.md).
 * N'EST BRANCHÉ À AUCUNE PAGE PUBLIQUE : seulement /admin/tarification-v2 et
 * les scripts du projet. Les tables lues (v2_*) sont fermées au public (RLS
 * sans politique) : il faut la clé de service.
 *
 * Aucune valeur de repli : une grille incomplète est une ERREUR, jamais une
 * grille de départ silencieuse (leçon du `supplement_etape` du 2026-09-21).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CleVehiculeV2, GrilleV2, MesuresTrajet, Mesure } from './grille'

export const VEHICULES_V2: CleVehiculeV2[] = ['berline', 'berline_premium', 'van', 'grand_van']

export const NOM_VEHICULE_V2: Record<CleVehiculeV2, string> = {
  berline: 'Berline', berline_premium: 'Berline Premium', van: 'Van 7 places', grand_van: 'Grand Van 8 places',
}

export type TarificationEnService = 'actuelle' | 'v2'

export async function lireGrilleV2(sb: SupabaseClient): Promise<GrilleV2> {
  const [v, b] = await Promise.all([
    sb.from('v2_grille_vehicules').select('vehicule, prise_en_charge, prix_km, prix_heure, minimum'),
    sb.from('v2_bases').select('nom, adresse, km_inclus, min_inclus, active, ordre').order('ordre'),
  ])
  if (v.error) throw new Error('v2_grille_vehicules : ' + v.error.message)
  if (b.error) throw new Error('v2_bases : ' + b.error.message)
  const vehicules = {} as GrilleV2['vehicules']
  for (const cle of VEHICULES_V2) {
    const l = v.data.find(r => r.vehicule === cle)
    if (!l) throw new Error(`v2_grille_vehicules : la ligne « ${cle} » manque`)
    vehicules[cle] = { priseEnCharge: Number(l.prise_en_charge), prixKm: Number(l.prix_km), prixHeure: Number(l.prix_heure), minimum: Number(l.minimum) }
  }
  return {
    vehicules,
    bases: b.data.map(r => ({ nom: r.nom, adresse: r.adresse, kmInclus: Number(r.km_inclus), minInclus: Number(r.min_inclus), active: r.active })),
  }
}

export async function lireTarificationEnService(sb: SupabaseClient): Promise<TarificationEnService> {
  const { data, error } = await sb.from('v2_reglages').select('tarification_en_service').eq('id', 1).single()
  if (error) throw new Error('v2_reglages : ' + error.message)
  return data.tarification_en_service as TarificationEnService
}

export type LigneMesure = {
  course_id: string
  trajet_km: number | string; trajet_min: number | string
  retour_km: number | string; retour_min: number | string
  approches: Record<string, Mesure | null>
  mise_de_cote: string | null
}

export function mesuresDepuisLigne(l: LigneMesure): MesuresTrajet {
  return {
    trajet: { km: Number(l.trajet_km), min: Number(l.trajet_min) },
    retour: { km: Number(l.retour_km), min: Number(l.retour_min) },
    approches: l.approches,
  }
}
