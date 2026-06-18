'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function supprimerDevis(id: string) {
  await requireAdminClient()
  const supabase = createAdminClient()
  await supabase.from('devis').delete().eq('id', id)
  revalidatePath('/admin/devis')
}

const VH_MAP: Record<string, string> = {
  'Berline':         'berline',
  'Berline Premium': 'berline_premium',
  'Van 7 places':    'van',
  'Grand Van':       'grand_van',
}

export async function convertirEnCourse(devis: {
  id: string
  nom: string | null
  tel: string | null
  email: string | null
  societe: string | null
  price: number | null
  origin: string | null
  destination: string | null
  date_course: string | null
  heure: string | null
  vehicle: string | null
  pax: number | null
}) {
  await requireAdminClient()
  if (!devis.origin || !devis.destination) throw new Error('Adresses manquantes.')

  const supabase = createAdminClient()

  // Combine date + heure → timestamp Paris
  let date_prevue: string
  if (devis.date_course) {
    const h = devis.heure ?? '00:00'
    date_prevue = new Date(`${devis.date_course}T${h}:00`).toISOString()
  } else {
    date_prevue = new Date().toISOString()
  }

  const ts  = Date.now().toString(36).toUpperCase().slice(-5)
  const ref = `DEV-${ts}`

  // Décompose nom → prénom + nom de famille
  const parts    = (devis.nom ?? '').trim().split(/\s+/)
  const prenom   = parts[0] ?? ''
  const nomFamille = parts.slice(1).join(' ') || prenom

  const notes = [
    devis.email  ? `Email: ${devis.email}`   : '',
    devis.societe ? `Société: ${devis.societe}` : '',
  ].filter(Boolean).join(' | ')

  const { error } = await supabase.from('courses').insert({
    adresse_depart:   devis.origin,
    adresse_arrivee:  devis.destination,
    date_prevue,
    statut:           'en_attente',
    prix_estime:      devis.price ?? null,
    type_vehicule:    VH_MAP[devis.vehicle ?? ''] ?? 'berline',
    nb_passagers:     devis.pax ?? null,
    passager_prenom:  prenom,
    passager_nom:     nomFamille,
    passager_tel:     devis.tel ?? null,
    paiement_statut:  'a_percevoir',
    source:           'devis',
    devis_id:         devis.id,
    ref,
    notes:            notes || null,
  })

  if (error) throw new Error(error.message)

  await supabase.from('devis').delete().eq('id', devis.id)
  revalidatePath('/admin/devis')
  revalidatePath('/admin/courses')

  return ref
}

export async function convertirEnFacture(devis: {
  id: string
  nom: string | null
  tel: string | null
  email: string | null
  societe: string | null
  price: number | null
  origin: string | null
  destination: string | null
  date_course: string | null
  heure: string | null
  vehicle: string | null
  pax: number | null
}) {
  await requireAdminClient()
  if (!devis.price) throw new Error('Prix manquant — impossible de créer une facture.')
  const supabase = createAdminClient()

  const year  = new Date().getFullYear()
  const ts    = Date.now().toString(36).toUpperCase().slice(-4)
  const numero = `F-${year}-${ts}`

  const { data: parametres } = await supabase.from('parametres').select('facture_taux_tva').eq('id', true).single()
  const tauxTva = parametres?.facture_taux_tva ?? 0

  const montant_ttc = Number(devis.price)
  const montant_ht  = Math.round((montant_ttc / (1 + tauxTva / 100)) * 100) / 100
  const tva = Math.round((montant_ttc - montant_ht) * 100) / 100

  const date_emission = new Date().toISOString().slice(0, 10)
  const date_echeance = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)

  // Stocker toutes les infos du devis dans notes (JSON)
  const notes = JSON.stringify({
    nom:         devis.nom,
    tel:         devis.tel,
    email:       devis.email,
    societe:     devis.societe,
    depart:      devis.origin,
    arrivee:     devis.destination,
    vehicule:    devis.vehicle,
    pax:         devis.pax,
    date_course: devis.date_course,
    heure:       devis.heure,
  })

  const { error } = await supabase.from('factures').insert({
    numero,
    statut:       'en_attente',
    montant_ht,
    tva,
    montant_ttc,
    date_emission,
    date_echeance,
    notes,
    client_id:    null,
  })

  if (error) throw new Error(error.message)

  // Supprimer le devis une fois converti
  await supabase.from('devis').delete().eq('id', devis.id)
  revalidatePath('/admin/devis')
  revalidatePath('/admin/facturation')

  return numero
}
