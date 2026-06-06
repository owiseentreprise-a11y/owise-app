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

  // Tenter de créer l'utilisateur auth
  const { data: authData, error: authError } = await authAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'sous_traitant' },
  })

  let userId: string

  if (authError || !authData?.user) {
    // Email déjà utilisé → chercher l'utilisateur existant
    const { data: usersData } = await authAdmin.auth.admin.listUsers()
    const existing = usersData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!existing) {
      redirect(`/admin/sous-traitants/${sous_traitant_id}?error=creation-echouee`)
    }

    // Vérifier que ce compte n'est pas déjà lié à un AUTRE sous-traitant
    const { data: dejaLie } = await supabase
      .from('sous_traitants')
      .select('id, nom')
      .eq('user_id', existing.id)
      .neq('id', sous_traitant_id)
      .single()

    if (dejaLie) {
      redirect(`/admin/sous-traitants/${sous_traitant_id}?error=email-autre-st`)
    }

    // Compte existant libre → mettre à jour le rôle + mot de passe + lier
    await authAdmin.auth.admin.updateUserById(existing.id, {
      password,
      app_metadata: { role: 'sous_traitant' },
    })

    userId = existing.id
  } else {
    userId = authData.user.id
  }

  // Créer/mettre à jour le profil
  await supabase.from('profiles').upsert({
    id:     userId,
    role:   'sous_traitant',
    nom:    '',
    prenom: '',
  })

  // Lier au sous-traitant
  await supabase.from('sous_traitants')
    .update({ user_id: userId })
    .eq('id', sous_traitant_id)

  revalidatePath(`/admin/sous-traitants/${sous_traitant_id}`)
  redirect(`/admin/sous-traitants/${sous_traitant_id}?success=compte-cree`)
}

export async function supprimerCompteSTAction(formData: FormData) {
  await requireAdminClient()
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
  await requireAdminClient()
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
  await requireAdminClient()
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

export async function toggleActifSTAction(id: string, actif: boolean): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('sous_traitants').update({ actif }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/admin/sous-traitants')
  return {}
}

export async function supprimerSTAction(id: string): Promise<{ error?: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()

  // Bloquer si en course physiquement
  const { data: coursesEnCours } = await supabase
    .from('courses')
    .select('id')
    .eq('sous_traitant_id', id)
    .in('statut', ['en_route', 'prise_en_charge'])
    .limit(1)
  if (coursesEnCours && coursesEnCours.length > 0) {
    return { error: 'Le sous-traitant est en course en ce moment. Impossible de le supprimer.' }
  }

  // Libérer les courses en attente/acceptées → retour dans le panier
  await supabase
    .from('courses')
    .update({ sous_traitant_id: null, chauffeur_id: null, statut: 'en_attente' })
    .eq('sous_traitant_id', id)
    .in('statut', ['en_attente', 'acceptee'])

  const { error } = await supabase.from('sous_traitants').delete().eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/sous-traitants')
  revalidatePath('/admin')
  return {}
}
