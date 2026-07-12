'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { createAdminClient }   from '@/lib/supabase/admin'
import { envoyerBienvenueCollaborateur } from '@/lib/email'

export async function genererFactureGroupee(
  clientId: string,
): Promise<{ error?: string; factureId?: string }> {
  await requireAdminClient()
  const admin = createAdminClient()

  // Courses terminées sans facture liée
  const { data: courses, error: cErr } = await admin
    .from('courses')
    .select('id, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime, type_vehicule, nb_passagers')
    .eq('client_id', clientId)
    .eq('statut', 'terminee')
    .is('facture_id', null)

  if (cErr) return { error: cErr.message }
  if (!courses?.length) return { error: 'Aucune course terminée non facturée' }

  const montantTTC = courses.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  if (montantTTC <= 0) return { error: 'Montant total nul — vérifiez les prix des courses' }

  const { data: params } = await admin.from('parametres').select('facture_taux_tva').eq('id', true).single()
  const tauxTva   = (params as any)?.facture_taux_tva ?? 0
  const montantHT = Math.round((montantTTC / (1 + tauxTva / 100)) * 100) / 100
  const montantTVA = Math.round((montantTTC - montantHT) * 100) / 100

  const year     = new Date().getFullYear()
  const ts       = Date.now().toString(36).toUpperCase().slice(-5)
  const numero   = `OW-${year}-${ts}`
  const echeance = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)

  const { data: facture, error: fErr } = await admin.from('factures').insert({
    client_id:     clientId,
    numero,
    statut:        'en_attente',
    montant_ht:    montantHT,
    tva:           montantTVA,
    montant_ttc:   montantTTC,
    date_emission: new Date().toISOString().slice(0, 10),
    date_echeance: echeance,
    notes: JSON.stringify({
      type:       'groupee',
      nb_courses: courses.length,
      courses: courses.map(c => ({
        id:     c.id,
        depart: c.adresse_depart,
        arrivee: c.adresse_arrivee,
        date:   c.date_prevue,
        prix:   c.prix_final ?? c.prix_estime,
      })),
    }),
  }).select('id').single()

  if (fErr || !facture) return { error: fErr?.message ?? 'Erreur création facture' }

  // Lier chaque course à la facture
  await admin.from('courses').update({ facture_id: facture.id }).in('id', courses.map(c => c.id))

  revalidatePath(`/admin/clients/${clientId}`)
  revalidatePath('/admin/facturation')
  return { factureId: facture.id }
}

export async function addCollaborateur(
  clientId: string,
  data: { email: string; password: string; nom: string; prenom: string; telephone: string; poste: string; adresse?: string },
): Promise<{ error?: string }> {
  // Vérifie que l'appelant est admin
  await requireAdminClient()

  const admin = createAdminClient()

  // 1. Créer le compte Supabase Auth
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email:         data.email.trim(),
    password:      data.password,
    email_confirm: true,
    app_metadata: {
      provider: 'email', providers: ['email'],
      role: 'collaborateur', client_id: clientId,
    },
    user_metadata: { prenom: data.prenom, nom: data.nom },
  })
  if (authError) return { error: authError.message }

  const userId = authData.user.id

  // 2. Profil (rollback auth si échec)
  const { error: profileError } = await admin.from('profiles').upsert({
    id: userId, nom: data.nom, prenom: data.prenom,
    telephone: data.telephone || null, role: 'client',
  })
  if (profileError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: `Profil: ${profileError.message}` }
  }

  // 3. Collaborateur — colonnes directes + id auth (rollback auth si échec)
  const { error: collabError } = await admin.from('collaborateurs').insert({
    id:        userId,
    client_id: clientId,
    poste:     data.poste    || null,
    nom:       data.nom      || '',
    prenom:    data.prenom   || '',
    tel:       data.telephone || null,
    adresse:   data.adresse  || null,
  })
  if (collabError) {
    await admin.auth.admin.deleteUser(userId)
    return { error: `Collaborateur: ${collabError.message}` }
  }

  // Email de bienvenue — récupère le nom de l'entreprise
  const { data: clientData } = await admin
    .from('clients')
    .select('entreprise_nom, profiles(prenom, nom)')
    .eq('id', clientId)
    .single()
  const entrepriseNom = (clientData as any)?.entreprise_nom
    ?? ((clientData as any)?.profiles
      ? `${(clientData as any).profiles.prenom} ${(clientData as any).profiles.nom}`.trim()
      : 'OWISE')

  envoyerBienvenueCollaborateur({
    email: data.email, prenom: data.prenom, nom: data.nom,
    password: data.password, entrepriseNom, poste: data.poste || null,
  }).catch(() => {})

  revalidatePath(`/admin/clients/${clientId}`)
  return {}
}

export async function deleteCollaborateur(clientId: string, collabId: string): Promise<void> {
  await requireAdminClient()
  const admin = createAdminClient()
  await admin.from('collaborateurs').delete().eq('id', collabId)
  await admin.from('profiles').delete().eq('id', collabId)
  await admin.auth.admin.deleteUser(collabId).catch(() => {})
  revalidatePath(`/admin/clients/${clientId}`)
}

export async function updateCollaborateur(
  clientId: string,
  collabId: string,
  data: { nom: string; prenom: string; telephone: string; poste: string; adresse: string },
): Promise<{ error?: string }> {
  await requireAdminClient()
  const admin = createAdminClient()

  const [r1, r2] = await Promise.all([
    admin.from('collaborateurs').update({
      nom:     data.nom     || null,
      prenom:  data.prenom  || null,
      tel:     data.telephone || null,
      poste:   data.poste   || null,
      adresse: data.adresse || null,
    }).eq('id', collabId),
    admin.from('profiles').update({
      nom:       data.nom       || null,
      prenom:    data.prenom    || null,
      telephone: data.telephone || null,
    }).eq('id', collabId),
  ])

  if (r1.error) return { error: r1.error.message }
  if (r2.error) return { error: r2.error.message }

  revalidatePath(`/admin/clients/${clientId}`)
  return {}
}

export async function updateEmail(
  id: string,
  newEmail: string,
): Promise<{ error?: string }> {
  await requireAdminClient()
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(id, { email: newEmail.trim() })
  if (error) return { error: error.message }
  revalidatePath(`/admin/clients/${id}`)
  return {}
}

export async function updateProfile(
  id: string,
  data: { nom: string; prenom: string; telephone: string },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('profiles').update(data).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function togglePayerAbord(id: string, valeur: boolean): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({ payer_a_bord: valeur }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function updateCompte(
  id: string,
  data: { type_compte: string; entreprise_nom: string; adresse_facturation: string },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({
    type_compte: data.type_compte,
    entreprise_nom: data.entreprise_nom || null,
    adresse_facturation: data.adresse_facturation || null,
  }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
  revalidatePath('/admin/clients')
}

export async function updateFacturationMode(
  id: string,
  mode: 'mensuelle' | 'par_prestation',
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({ facturation_mode: mode }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function updateTarifClient(
  id: string,
  data: { coef_tarifaire: number; paiement_differe: boolean },
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('clients').update({
    coef_tarifaire: data.coef_tarifaire,
    paiement_differe: data.paiement_differe,
  }).eq('id', id)
  revalidatePath(`/admin/clients/${id}`)
}

export async function supprimerClient(id: string): Promise<{ error?: string }> {
  await requireAdminClient()
  const admin = createAdminClient()

  // Détacher les courses sans les supprimer (historique conservé)
  await admin.from('courses').update({ client_id: null, collaborateur_id: null }).eq('client_id', id)

  // Supprimer les comptes auth des collaborateurs
  const { data: collabs } = await admin.from('collaborateurs').select('id').eq('client_id', id)
  if (collabs?.length) {
    await Promise.all(collabs.map(c => admin.auth.admin.deleteUser(c.id).catch(() => {})))
    await admin.from('collaborateurs').delete().eq('client_id', id)
  }

  // Supprimer les factures liées
  await admin.from('factures').delete().eq('client_id', id)

  // Supprimer le client
  const { error } = await admin.from('clients').delete().eq('id', id)
  if (error) return { error: error.message }

  // Supprimer l'utilisateur auth (cascade profile)
  await admin.auth.admin.deleteUser(id).catch(() => {})

  revalidatePath('/admin/clients')
  return {}
}
