import { createClient } from '@supabase/supabase-js'

// Client service-role — uniquement côté serveur, jamais exposé au client
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/**
 * Retrouve la fiche client qui porte cette adresse e-mail.
 *
 * POURQUOI ELLE NE LIT PAS `clients.email`
 *
 * La colonne existe, et elle est VIDE : 17 fiches sur 18 l'avaient à null
 * le 2026-11-09, parce que `createClientAccount` ne la renseigne pas. Une
 * recherche sur cette colonne ne trouve donc presque jamais personne — et
 * elle ne le dit pas : elle rend « aucun client », ce qui ressemble à une
 * réponse normale.
 *
 * L'adresse qui fait foi est celle du compte, dans auth.users. On parcourt
 * donc les comptes, puis on vérifie que celui trouvé est bien une fiche
 * client — un chauffeur ou un sous-traitant porte aussi une adresse.
 *
 * Trouvé en testant la chaîne devis → facture avec un vrai profil : le
 * bouton renvoyait vers « créer la fiche client » alors que la fiche
 * existait.
 */
export async function trouverClientParEmail(email: string): Promise<string | null> {
  const recherche = (email ?? '').trim().toLowerCase()
  if (!recherche) return null
  const admin = createAdminClient()

  /* L'API d'administration pagine. 200 par page couvre largement le
     carnet d'adresses d'Owise ; la boucle s'arrête dès qu'une page est
     incomplète, donc elle ne tourne pas dans le vide. */
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error || !data?.users?.length) return null

    const trouve = data.users.find(u => (u.email ?? '').toLowerCase() === recherche)
    if (trouve) {
      const { data: fiche } = await admin
        .from('clients').select('id').eq('id', trouve.id).maybeSingle()
      return fiche ? (fiche.id as string) : null
    }
    if (data.users.length < 200) return null
  }
  return null
}
export async function getUserEmail(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  // Utilise le RPC SECURITY DEFINER — plus fiable que l'Admin API côté serveur
  const { data, error } = await admin.rpc('get_user_email', { p_user_id: userId })
  if (error || !data) {
    // Fallback : Admin API
    const { data: authData } = await admin.auth.admin.getUserById(userId)
    return authData?.user?.email ?? null
  }
  return data as string
}
