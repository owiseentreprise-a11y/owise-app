'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function clientLoginAction(formData: FormData) {
  const supabase = await createClient()
  const email    = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) redirect('/client-login?error=identifiants-incorrects')

  const role = data.user.app_metadata?.role as string | undefined
  if (role === 'admin')    redirect('/admin')
  if (role === 'chauffeur') redirect('/chauffeur')
  redirect('/espace-client')
}

export async function clientRegisterAction(formData: FormData) {
  const email    = (formData.get('email') as string).trim()
  const password = formData.get('password') as string
  const prenom   = (formData.get('prenom') as string).trim()
  const nom      = (formData.get('nom') as string).trim()

  if (!email || !password || !prenom || !nom) {
    redirect('/client-login?tab=register&error=champs-manquants')
  }
  if (password.length < 8) {
    redirect('/client-login?tab=register&error=mot-de-passe-court')
  }

  const admin = createAdminClient()

  // Créer le compte via admin (confirme l'email immédiatement)
  const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'client' },
    user_metadata: { prenom, nom },
  })

  if (createErr) {
    const code = createErr.message.includes('already registered') ? 'email-deja-utilise' : 'erreur-creation'
    redirect(`/client-login?tab=register&error=${code}`)
  }

  const userId = newUser.user?.id
  if (!userId) redirect('/client-login?tab=register&error=erreur-creation')

  // Créer profil + client
  await Promise.all([
    admin.from('profiles').insert({ id: userId, nom, prenom }),
    admin.from('clients').insert({ id: userId, type_compte: 'particulier' }),
  ])

  // Connexion automatique
  const supabase = await createClient()
  await supabase.auth.signInWithPassword({ email, password })
  redirect('/espace-client')
}
