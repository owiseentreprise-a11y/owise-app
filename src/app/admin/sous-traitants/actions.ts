'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSupabaseAdmin } from '@supabase/supabase-js'

function getAuthAdminClient() {
  return createSupabaseAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function creerSousTraitantAction(formData: FormData) {
  const supabase = await requireAdminClient()

  const nom = (formData.get('nom') as string)?.trim()
  if (!nom) redirect('/admin/sous-traitants/nouveau?error=nom-requis')

  const { data, error } = await supabase.from('sous_traitants').insert({
    nom,
    contact_nom:   (formData.get('contact_nom') as string)?.trim() || null,
    telephone:     (formData.get('telephone') as string)?.trim() || null,
    email:         (formData.get('email') as string)?.trim() || null,
    adresse:       (formData.get('adresse') as string)?.trim() || null,
    siret:         (formData.get('siret') as string)?.trim() || null,
    notes:         (formData.get('notes') as string)?.trim() || null,
    mode_paiement: (formData.get('mode_paiement') as string) || 'mensuel',
  }).select('id').single()

  if (error || !data) redirect('/admin/sous-traitants/nouveau?error=creation-echouee')
  redirect(`/admin/sous-traitants/${data.id}`)
}

export async function modifierSousTraitantAction(formData: FormData) {
  const supabase = await requireAdminClient()
  const id = formData.get('id') as string

  const { error } = await supabase.from('sous_traitants').update({
    nom:           (formData.get('nom') as string)?.trim(),
    contact_nom:   (formData.get('contact_nom') as string)?.trim() || null,
    telephone:     (formData.get('telephone') as string)?.trim() || null,
    email:         (formData.get('email') as string)?.trim() || null,
    adresse:       (formData.get('adresse') as string)?.trim() || null,
    siret:         (formData.get('siret') as string)?.trim() || null,
    notes:         (formData.get('notes') as string)?.trim() || null,
    actif:         formData.get('actif') === 'true',
    mode_paiement: (formData.get('mode_paiement') as string) || 'mensuel',
  }).eq('id', id)

  if (error) redirect(`/admin/sous-traitants/${id}?error=maj-echouee`)
  revalidatePath(`/admin/sous-traitants/${id}`)
  revalidatePath('/admin/sous-traitants')
  redirect(`/admin/sous-traitants/${id}?success=1`)
}

export async function creerCompteSTAction(formData: FormData) {
  const supabase = createAdminClient()
  const authAdmin = getAuthAdminClient()
  const sous_traitant_id = formData.get('sous_traitant_id') as string
  const email            = (formData.get('email') as string)?.trim()
  const password         = (formData.get('password') as string)?.trim()

  if (!email || !password) redirect(`/admin/sous-traitants/${sous_traitant_id}?error=champs-requis`)

  // Créer l'utilisateur auth
  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'sous_traitant' },
  })

  if (authError || !authData.user) {
    redirect(`/admin/sous-traitants/${sous_traitant_id}?error=compte-existant`)
  }

  // Créer le profil
  await supabase.from('profiles').upsert({
    id:     authData.user.id,
    role:   'sous_traitant',
    nom:    '',
    prenom: '',
  })

  // Lier au sous-traitant
  await supabase.from('sous_traitants')
    .update({ user_id: authData.user.id })
    .eq('id', sous_traitant_id)

  revalidatePath(`/admin/sous-traitants/${sous_traitant_id}`)
  redirect(`/admin/sous-traitants/${sous_traitant_id}?success=compte-cree`)
}

export async function supprimerCompteSTAction(formData: FormData) {
  const supabase  = createAdminClient()
  const authAdmin = getAuthAdminClient()
  const sous_traitant_id = formData.get('sous_traitant_id') as string
  const user_id          = formData.get('user_id') as string

  await authAdmin.auth.admin.deleteUser(user_id)
  await supabase.from('sous_traitants').update({ user_id: null }).eq('id', sous_traitant_id)

  revalidatePath(`/admin/sous-traitants/${sous_traitant_id}`)
  redirect(`/admin/sous-traitants/${sous_traitant_id}`)
}

export async function genererFactureSTAction(formData: FormData) {
  const supabase = createAdminClient()
  const sous_traitant_id = formData.get('sous_traitant_id') as string
  const mode = (formData.get('mode_paiement') as string) || 'mensuel'

  const now = new Date()
  let periode: string
  let debut: string
  let fin: string

  if (mode === 'hebdomadaire') {
    // Semaine ISO courante (lundi → dimanche)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay() // 1=lun, 7=dim
    const lundi = new Date(now)
    lundi.setDate(now.getDate() - dayOfWeek + 1)
    lundi.setHours(0, 0, 0, 0)
    const dimanche = new Date(lundi)
    dimanche.setDate(lundi.getDate() + 6)
    dimanche.setHours(23, 59, 59, 999)

    // Semaine ISO : YYYY-WNN
    const onejan = new Date(now.getFullYear(), 0, 1)
    const weekNum = Math.ceil(((now.getTime() - onejan.getTime()) / 86400000 + onejan.getDay() + 1) / 7)
    periode = `${now.getFullYear()}-S${String(weekNum).padStart(2, '0')}`
    debut = lundi.toISOString()
    fin   = dimanche.toISOString()
  } else {
    // Mensuel
    periode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    debut = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    fin   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()
  }

  const { data: courses } = await supabase
    .from('courses')
    .select('prix_sous_traitant')
    .eq('sous_traitant_id', sous_traitant_id)
    .eq('statut', 'terminee')
    .gte('date_prevue', debut)
    .lte('date_prevue', fin)

  const montant = (courses ?? []).reduce((s: number, c: any) => s + (c.prix_sous_traitant ?? 0), 0)

  await supabase.from('factures_sous_traitants').upsert({
    sous_traitant_id,
    periode,
    montant_ht: montant,
    statut: 'en_attente',
    notes: `${(courses ?? []).length} course(s) terminée(s)`,
  }, { onConflict: 'sous_traitant_id,periode' })

  revalidatePath(`/admin/sous-traitants/${sous_traitant_id}`)
  redirect(`/admin/sous-traitants/${sous_traitant_id}`)
}

export async function marquerFactureSTPayeeAction(formData: FormData) {
  const supabase = createAdminClient()
  const facture_id      = formData.get('facture_id') as string
  const sous_traitant_id = formData.get('sous_traitant_id') as string

  await supabase.from('factures_sous_traitants').update({
    statut: 'payee',
    date_paiement: new Date().toISOString(),
  }).eq('id', facture_id)

  revalidatePath(`/admin/sous-traitants/${sous_traitant_id}`)
  redirect(`/admin/sous-traitants/${sous_traitant_id}`)
}
