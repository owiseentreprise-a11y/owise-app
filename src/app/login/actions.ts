'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function loginAction(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    redirect('/login?error=identifiants-incorrects')
  }

  // Récupérer le rôle pour rediriger au bon endroit
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?error=connexion-echouee')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.role === 'chauffeur') redirect('/chauffeur')
  redirect('/client')
}

export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
