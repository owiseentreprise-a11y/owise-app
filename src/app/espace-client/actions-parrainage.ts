'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'OWR-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function getOrCreateParrainageCode(): Promise<{ code: string | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { code: null, error: 'Non connecté' }

  const admin = createAdminClient()

  // Code existant ?
  const { data: existing } = await admin
    .from('codes_parrainage')
    .select('code')
    .eq('client_id', user.id)
    .single()

  if (existing?.code) return { code: existing.code }

  // Générer un code unique
  let code = genCode()
  let attempts = 0
  while (attempts < 10) {
    const { data: conflict } = await admin
      .from('codes_parrainage')
      .select('id')
      .eq('code', code)
      .single()
    if (!conflict) break
    code = genCode()
    attempts++
  }

  const { error } = await admin
    .from('codes_parrainage')
    .insert({ client_id: user.id, code })

  if (error) return { code: null, error: error.message }
  return { code }
}

export async function getParrainageStats(): Promise<{
  code: string | null
  nbFilleuls: number
  credits: { montant: number; statut: string; created_at: string }[]
  totalDispo: number
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { code: null, nbFilleuls: 0, credits: [], totalDispo: 0 }

  const admin = createAdminClient()

  const [{ data: codeRow }, { data: credits }] = await Promise.all([
    admin.from('codes_parrainage').select('code, nb_utilisations').eq('client_id', user.id).single(),
    admin.from('credits_parrainage').select('montant, statut, created_at').eq('client_id', user.id).order('created_at', { ascending: false }),
  ])

  const totalDispo = (credits ?? [])
    .filter(c => c.statut === 'disponible')
    .reduce((sum, c) => sum + Number(c.montant), 0)

  return {
    code: codeRow?.code ?? null,
    nbFilleuls: codeRow?.nb_utilisations ?? 0,
    credits: credits ?? [],
    totalDispo,
  }
}

// Appelé depuis le webhook Stripe après paiement d'un filleul
export async function enregistrerParrainage(code: string, filleulEmail: string): Promise<void> {
  const admin = createAdminClient()

  const { data: codeRow } = await admin
    .from('codes_parrainage')
    .select('id, client_id, nb_utilisations')
    .eq('code', code.toUpperCase())
    .eq('actif', true)
    .single()

  if (!codeRow) return

  await Promise.all([
    // Incrémenter le compteur
    admin.from('codes_parrainage')
      .update({ nb_utilisations: codeRow.nb_utilisations + 1 })
      .eq('id', codeRow.id),
    // Crédit pour le parrain (10€)
    admin.from('credits_parrainage')
      .insert({
        client_id: codeRow.client_id,
        montant: 10,
        statut: 'disponible',
        code_source: code,
        filleul_email: filleulEmail,
      }),
  ])

  revalidatePath('/espace-client')
}

// Valider un code (public — appelé depuis /reserver)
export async function validerCodeParrainage(code: string): Promise<{ valid: boolean; discount: number }> {
  if (!code || code.length < 6) return { valid: false, discount: 0 }

  const admin = createAdminClient()
  const { data } = await admin
    .from('codes_parrainage')
    .select('id, actif')
    .eq('code', code.toUpperCase().trim())
    .single()

  if (!data?.actif) return { valid: false, discount: 0 }
  return { valid: true, discount: 10 } // -10%
}
