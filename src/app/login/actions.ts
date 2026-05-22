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
  if (role === 'collaborateur') redirect('/espace-client')
  redirect('/espace-client')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

export async function resetPasswordAction(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  if (!email) redirect('/login/reset-password?error=email-requis')

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/login/update-password`,
  })

  if (error) redirect('/login/reset-password?error=envoi-echoue')
  redirect('/login/reset-password?success=1')
}

export async function updatePasswordAction(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 6) redirect('/login/update-password?error=mot-de-passe-court')
  if (password !== confirm) redirect('/login/update-password?error=mots-de-passe-differents')

  const { error } = await supabase.auth.updateUser({ password })
  if (error) redirect('/login/update-password?error=mise-a-jour-echouee')
  redirect('/login?success=mot-de-passe-mis-a-jour')
}
