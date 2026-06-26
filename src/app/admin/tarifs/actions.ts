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

export async function updatePrixGrille(
  zoneDepart: string,
  zoneArrivee: string,
  prix: number
): Promise<void> {
  await requireAdminClient()
  const supabase = createAdminClient()
  await supabase
    .from('grilles_tarifaires')
    .update({ prix_berline: prix, updated_at: new Date().toISOString() })
    .eq('zone_depart_id', zoneDepart)
    .eq('zone_arrivee_id', zoneArrivee)
  revalidatePath('/admin/tarifs')
  revalidatePagesPubliques()
}

export async function updateParametresTarifs(formData: FormData): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('parametres').update({
    tarif_frais_pec:        Number(formData.get('tarif_frais_pec')),
    tarif_pec_actif:        formData.get('tarif_pec_actif') === 'true',
    supplement_nuit:        Number(formData.get('supplement_nuit')),
    supplement_weekend:     Number(formData.get('supplement_weekend')),
    supplement_ferie:       Number(formData.get('supplement_ferie')),
    coef_berline:           Number(formData.get('coef_berline')),
    coef_berline_premium:   Number(formData.get('coef_berline_premium')),
    coef_van:               Number(formData.get('coef_van')),
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
