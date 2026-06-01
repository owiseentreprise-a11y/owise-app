import { createClient } from '@supabase/supabase-js'

// Client service-role — uniquement côté serveur, jamais exposé au client
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
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
