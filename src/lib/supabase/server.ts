import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}

export async function requireAdminClient() {
  const supabase = await createClient()
  const cookieStore = await cookies()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (user?.app_metadata?.role !== 'admin') {
    const dbg = JSON.stringify({ u: !!user, r: user?.app_metadata?.role, e: error?.message, c: cookieStore.getAll().length })
    redirect(`/login?dbg=${encodeURIComponent(dbg)}`)
  }
  return supabase
}
