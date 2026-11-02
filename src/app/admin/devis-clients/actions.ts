'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { vehiculePourBase } from '@/lib/vehicule'
import { calculerTotal, genererNumeroDevis, type LigneDevis } from '@/lib/devis-client'

/** Les champs que le formulaire renvoie. Le total n'en fait pas partie. */
export type SaisieDevis = {
  client_nom: string
  client_societe: string | null
  client_email: string | null
  client_tel: string | null
  client_adresse: string | null
  date_prestation: string | null
  date_validite: string | null
  attente_offerte_min: number | null
  attente_tarif_heure: number | null
  notes: string | null
  lignes: LigneDevis[]
}

export async function creerDevis(): Promise<string> {
  await requireAdminClient()
  const supabase = createAdminClient()

  const numero = await genererNumeroDevis(supabase)
  const { data, error } = await supabase
    .from('devis_clients')
    .insert({
      numero,
      client_nom: '',
      statut: 'brouillon',
      lignes: [],
      total_ht: 0,
      /* Les valeurs d'usage d'Owise, modifiables devis par devis. */
      attente_offerte_min: 15,
      attente_tarif_heure: 70,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
  return data.id as string
}

export async function enregistrerDevis(id: string, saisie: SaisieDevis) {
  await requireAdminClient()
  const supabase = createAdminClient()

  if (!saisie.client_nom.trim()) throw new Error('Le nom du client est obligatoire.')

  /* Les lignes vides sont jetees a l'enregistrement plutot qu'interdites a la
     saisie : on ajoute souvent une ligne « pour voir » avant de la remplir. */
  const lignes = saisie.lignes.filter(l =>
    l.depart.trim() || l.arrivee.trim() || Number(l.prix) > 0)

  const { error } = await supabase
    .from('devis_clients')
    .update({
      client_nom:          saisie.client_nom.trim(),
      client_societe:      saisie.client_societe?.trim() || null,
      client_email:        saisie.client_email?.trim() || null,
      client_tel:          saisie.client_tel?.trim() || null,
      client_adresse:      saisie.client_adresse?.trim() || null,
      date_prestation:     saisie.date_prestation || null,
      date_validite:       saisie.date_validite || null,
      attente_offerte_min: saisie.attente_offerte_min,
      attente_tarif_heure: saisie.attente_tarif_heure,
      notes:               saisie.notes?.trim() || null,
      lignes,
      total_ht:            calculerTotal(lignes),
      updated_at:          new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
}

export async function changerStatutDevis(id: string, statut: string) {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('devis_clients')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
}

export async function supprimerDevisClient(id: string) {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('devis_clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
}

/** « 10h15 », « 10:15 », « 02h15 (nuit) » → « 10:15 ». Rien d'exploitable → null. */
function heureVersHhMm(brut: string): string | null {
  const m = String(brut).match(/(\d{1,2})\s*[h:]\s*(\d{2})?/)
  if (!m) return null
  const h = String(Math.min(23, Number(m[1]))).padStart(2, '0')
  const min = String(Math.min(59, Number(m[2] ?? 0))).padStart(2, '0')
  return `${h}:${min}`
}

/** « 1 van + 1 berline » → la categorie que porte la base. */
function vehiculeDepuisLibelle(libelle: string): string {
  const t = libelle.toLowerCase()
  if (t.includes('grand van') || t.includes('8 place')) return 'grand_van'
  if (t.includes('van'))                                return 'van'
  if (t.includes('premium'))                            return 'berline_premium'
  return 'berline'
}

/**
 * Le devis accepte devient des courses — une par ligne.
 *
 * C'est le point de toute la fonctionnalite : sans ce bouton, huit transferts
 * acceptes se ressaisissent huit fois a la main.
 *
 * La facture n'est PAS creee ici : elle se monte depuis
 * /admin/facturation/nouvelle en cochant ces courses, parce qu'elle demande un
 * client enregistre, ce qu'un devis n'a pas forcement. Le devis passe en
 * « accepte » et reste consultable.
 */
export async function convertirDevisEnCourses(id: string): Promise<number> {
  await requireAdminClient()
  const supabase = createAdminClient()

  const { data: devis, error: err } = await supabase
    .from('devis_clients').select('*').eq('id', id).single()
  if (err || !devis) throw new Error('Devis introuvable.')
  if (devis.statut === 'accepte') throw new Error('Ce devis a déjà été converti.')

  const lignes = (Array.isArray(devis.lignes) ? devis.lignes : []) as LigneDevis[]
  const utiles = lignes.filter(l => l.depart?.trim() && l.arrivee?.trim())
  if (utiles.length === 0) throw new Error('Aucune ligne exploitable : il faut un départ et une arrivée.')

  const parts = String(devis.client_nom ?? '').trim().split(/\s+/)
  const prenom = parts[0] ?? ''
  const nomFamille = parts.slice(1).join(' ') || prenom

  const notes = [
    `Devis ${devis.numero}`,
    devis.client_email ? `Email: ${devis.client_email}` : '',
    devis.client_societe ? `Société: ${devis.client_societe}` : '',
  ].filter(Boolean).join(' | ')

  const aInserer = utiles.map((l, i) => {
    /* L'heure saisie est une heure de Paris, jamais un instant : sur Vercel,
       qui tourne en temps universel, `new Date('...T14:00')` donnerait 16:00. */
    const hhmm = heureVersHhMm(l.heure ?? '')
    const date_prevue = devis.date_prestation && hhmm
      ? instantDepuisSaisieParis(`${devis.date_prestation}T${hhmm}:00`).toISOString()
      : devis.date_prestation
        ? instantDepuisSaisieParis(`${devis.date_prestation}T00:00:00`).toISOString()
        : new Date().toISOString()

    return {
      adresse_depart:  l.depart.trim(),
      adresse_arrivee: l.arrivee.trim(),
      date_prevue,
      statut:          'en_attente',
      prix_estime:     Number(l.prix) || null,
      type_vehicule:   vehiculePourBase(vehiculeDepuisLibelle(l.vehicule ?? '')),
      nb_passagers:    l.passagers ?? null,
      passager_prenom: prenom,
      passager_nom:    nomFamille,
      passager_tel:    devis.client_tel ?? null,
      paiement_statut: 'a_percevoir',
      source:          'devis',
      ref:             `${devis.numero}-${String(i + 1).padStart(2, '0')}`,
      notes:           [notes, l.observations?.trim()].filter(Boolean).join(' | ') || null,
    }
  })

  const { error } = await supabase.from('courses').insert(aInserer)
  if (error) throw new Error(error.message)

  await supabase.from('devis_clients')
    .update({ statut: 'accepte', updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin/planning')

  return aInserer.length
}
