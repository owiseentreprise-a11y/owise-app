'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Rafraîchit immédiatement les pages publiques qui affichent des prix
// (sans ça, /admin/tarifs se met à jour mais le site public garde le
// prix en cache jusqu'à la prochaine revalidation ISR, jusqu'à 1h plus tard).
function revalidatePagesPubliques() {
  revalidatePath('/')
  revalidatePath('/[destination]', 'page')
}

export async function updateTarifVehicule(
  id: string,
  data: { prise_en_charge: number; prix_km: number }
): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('tarifs').update({ ...data, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
  return {}
}

/**
 * Enregistre un prix de grille pour une paire de zones.
 *
 * Trois défauts corrigés le 2026-09-19, chacun ayant réellement produit un prix
 * faux en production :
 *  - un seul sens était écrit, alors que calculerPrix() lit indifféremment l'un
 *    ou l'autre : la valeur périmée du sens opposé pouvait l'emporter ;
 *  - un UPDATE sur une paire absente de la table ne touchait aucune ligne et ne
 *    remontait aucune erreur — la saisie disparaissait en silence ;
 *  - le retour était `void`, donc l'interface ne pouvait rien signaler.
 *
 * Pas d'upsert : la table n'a pas de contrainte d'unicité sur la paire de zones.
 */
export async function updatePrixGrille(
  zoneDepart: string,
  zoneArrivee: string,
  prix: number
): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()

  if (!Number.isFinite(prix) || prix < 0) return { error: 'Prix invalide.' }
  if (zoneDepart === zoneArrivee) return { error: 'Départ et arrivée identiques.' }

  const maintenant = new Date().toISOString()

  for (const [dep, arr] of [[zoneDepart, zoneArrivee], [zoneArrivee, zoneDepart]]) {
    const { data: majs, error: errMaj } = await supabase
      .from('grilles_tarifaires')
      .update({ prix_berline: prix, updated_at: maintenant })
      .eq('zone_depart_id', dep)
      .eq('zone_arrivee_id', arr)
      .select('id')

    if (errMaj) return { error: `Enregistrement impossible : ${errMaj.message}` }

    if (!majs || majs.length === 0) {
      const { error: errIns } = await supabase
        .from('grilles_tarifaires')
        .insert({ zone_depart_id: dep, zone_arrivee_id: arr, prix_berline: prix, updated_at: maintenant })
      if (errIns) return { error: `Création impossible : ${errIns.message}` }
    }
  }

  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
  return {}
}

export async function updateParametresTarifs(formData: FormData): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('parametres').update({
    tarif_frais_pec:        Number(formData.get('tarif_frais_pec')),
    tarif_pec_actif:        formData.get('tarif_pec_actif') === 'true',
    supplement_etape:       Number(formData.get('supplement_etape')),
    supplement_nuit:        Number(formData.get('supplement_nuit')),
    supplement_weekend:     Number(formData.get('supplement_weekend')),
    supplement_ferie:       Number(formData.get('supplement_ferie')),
    coef_berline:           Number(formData.get('coef_berline')),
    coef_berline_premium:   Number(formData.get('coef_berline_premium')),
    coef_van:               Number(formData.get('coef_van')),
    supplement_bagages_actif: formData.get('supplement_bagages_actif') === 'true',
    supplement_bagages_prix:  Number(formData.get('supplement_bagages_prix')),
    supplement_panneau_actif: formData.get('supplement_panneau_actif') === 'true',
    supplement_panneau_prix:  Number(formData.get('supplement_panneau_prix')),
    supplement_animaux_actif: formData.get('supplement_animaux_actif') === 'true',
    supplement_animaux_prix:  Number(formData.get('supplement_animaux_prix')),
    supplement_siege_enfant_actif: formData.get('supplement_siege_enfant_actif') === 'true',
    supplement_siege_enfant_prix:  Number(formData.get('supplement_siege_enfant_prix')),
  }).eq('id', true)
  if (error) return { error: error.message }
  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
  return {}
}

export async function updateZone(
  id: string,
  data: { nom: string; code: string; type: string; prefixes: string },
): Promise<void> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const prefixes = data.prefixes
    ? data.prefixes.split(',').map(p => p.trim()).filter(Boolean)
    : []
  await supabase.from('zones').update({
    nom:              data.nom,
    code:             data.code.toUpperCase().trim(),
    type:             data.type,
    prefixes_postaux: prefixes,
  }).eq('id', id)
  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
}

export async function toggleZoneActive(id: string, active: boolean): Promise<void> {
  await requireAdminClient()
  const supabase = createAdminClient()
  await supabase.from('zones').update({ active }).eq('id', id)
  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
}

export async function deleteZone(id: string): Promise<void> {
  await requireAdminClient()
  const supabase = createAdminClient()
  // Supprimer les cellules de grille liées
  await supabase.from('grilles_tarifaires')
    .delete()
    .or(`zone_depart_id.eq.${id},zone_arrivee_id.eq.${id}`)
  await supabase.from('zones').delete().eq('id', id)
  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
}

export async function addZone(formData: FormData): Promise<void> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const nom = formData.get('nom') as string
  const code = (formData.get('code') as string).toUpperCase().trim()
  const type = formData.get('type') as string
  const prefixesRaw = formData.get('prefixes') as string

  if (!nom || !code) return

  const prefixes = prefixesRaw
    ? prefixesRaw.split(',').map(p => p.trim()).filter(Boolean)
    : []

  const { data: newZone } = await supabase
    .from('zones')
    .insert({ nom, code, type, prefixes_postaux: prefixes })
    .select('id')
    .single()

  if (!newZone) return

  // Crée les cellules de grille pour la nouvelle zone (avec toutes les zones existantes)
  const { data: zones } = await supabase.from('zones').select('id').neq('id', newZone.id)
  if (!zones) return

  const rows = []
  for (const z of zones) {
    rows.push({ zone_depart_id: newZone.id, zone_arrivee_id: z.id, prix_berline: 0 })
    rows.push({ zone_depart_id: z.id, zone_arrivee_id: newZone.id, prix_berline: 0 })
  }
  if (rows.length > 0) {
    await supabase.from('grilles_tarifaires').insert(rows)
  }

  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
}
