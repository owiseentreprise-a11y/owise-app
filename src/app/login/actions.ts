'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    redirect('/login?error=identifiants-incorrects')
  }

  // Rôle stocké dans app_metadata — disponible immédiatement sans query DB
  const role = data.user.app_metadata?.role as string | undefined

  if (role === 'admin') redirect('/admin')
  if (role === 'chauffeur') redirect('/chauffeur')
  redirect('/client')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
