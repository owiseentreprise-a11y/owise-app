'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerResetPassword } from '@/lib/email'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error || !data.user) {
    console.error(`DBGSTATUS=${error?.status}|${(error?.message ?? '').slice(0, 25)}`)
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
  const email = formData.get('email') as string
  if (!email) redirect('/login/reset-password?error=email-requis')

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const admin  = createAdminClient()

  // Générer le lien de reset via Supabase Admin
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origin}/auth/callback?next=/login/update-password` },
  })

  if (error || !data?.properties?.action_link) {
    // L'email n'existe pas ou autre erreur — on fait semblant d'envoyer pour ne pas révéler les comptes
    redirect('/login/reset-password?success=1')
  }

  // Envoyer un email brandé Owise via Resend
  await envoyerResetPassword({ email, lien: data.properties.action_link })
  redirect('/login/reset-password?success=1')
}

export async function updatePasswordAction(formData: FormData) {
  const supabase = await createClient()
  const password = formData.get('password') as string
  const confirm = formData.get('confirm') as string

  if (!password || password.length < 6) redirect('/login/update-password?error=mot-de-passe-court')
  if (password !== confirm) redirect('/login/update-password?error=mots-de-passe-differents')

  const { data: { user }, error } = await supabase.auth.updateUser({ password })
  if (error) {
    // Détecter si on vient du flow client ou admin selon le referrer
    const role = user?.app_metadata?.role
    const base = (role && role !== 'admin' && role !== 'chauffeur') ? '/client-login' : '/login'
    redirect(`${base}/update-password?error=mise-a-jour-echouee`)
  }
  const role = user?.app_metadata?.role
  if (role === 'admin' || role === 'chauffeur') {
    redirect('/login?success=mot-de-passe-mis-a-jour')
  }
  redirect('/client-login?success=mot-de-passe-mis-a-jour')
}
