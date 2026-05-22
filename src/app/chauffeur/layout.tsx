import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function ChauffeurLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.app_metadata?.role !== 'chauffeur') redirect('/login')

  return <>{children}</>
}
