'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function creerSousTraitantAction(formData: FormData) {
  const supabase = await createClient()

  const nom = (formData.get('nom') as string)?.trim()
  if (!nom) redirect('/admin/sous-traitants/nouveau?error=nom-requis')

  const { data, error } = await supabase.from('sous_traitants').insert({
    nom,
    contact_nom: (formData.get('contact_nom') as string)?.trim() || null,
    telephone:   (formData.get('telephone') as string)?.trim() || null,
    email:       (formData.get('email') as string)?.trim() || null,
    adresse:     (formData.get('adresse') as string)?.trim() || null,
    siret:       (formData.get('siret') as string)?.trim() || null,
    notes:       (formData.get('notes') as string)?.trim() || null,
  }).select('id').single()

  if (error || !data) redirect('/admin/sous-traitants/nouveau?error=creation-echouee')
  redirect(`/admin/sous-traitants/${data.id}`)
}

export async function modifierSousTraitantAction(formData: FormData) {
  const supabase = await createClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('sous_traitants').update({
    nom:         (formData.get('nom') as string)?.trim(),
    contact_nom: (formData.get('contact_nom') as string)?.trim() || null,
    telephone:   (formData.get('telephone') as string)?.trim() || null,
    email:       (formData.get('email') as string)?.trim() || null,
    adresse:     (formData.get('adresse') as string)?.trim() || null,
    siret:       (formData.get('siret') as string)?.trim() || null,
    notes:       (formData.get('notes') as string)?.trim() || null,
    actif:       formData.get('actif') === 'true',
  }).eq('id', id)

  if (error) redirect(`/admin/sous-traitants/${id}?error=maj-echouee`)
  revalidatePath(`/admin/sous-traitants/${id}`)
  revalidatePath('/admin/sous-traitants')
  redirect(`/admin/sous-traitants/${id}?success=1`)
}
