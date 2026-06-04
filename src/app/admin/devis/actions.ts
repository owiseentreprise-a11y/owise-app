'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function supprimerDevis(id: string) {
  const supabase = createAdminClient()
  await supabase.from('devis').delete().eq('id', id)
  revalidatePath('/admin/devis')
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
  if (!devis.price) throw new Error('Prix manquant — impossible de créer une facture.')
  const supabase = createAdminClient()

  const year  = new Date().getFullYear()
  const ts    = Date.now().toString(36).toUpperCase().slice(-4)
  const numero = `F-${year}-${ts}`

  const montant_ttc = Number(devis.price)
  const montant_ht  = Math.round((montant_ttc / 1.2) * 100) / 100
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
