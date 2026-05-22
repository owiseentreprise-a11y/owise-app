import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Rôle depuis app_metadata (JWT) — pas de query DB
  if (user.app_metadata?.role !== 'admin') redirect('/login')

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <main style={{
        flex: 1, height: '100vh',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
      }}>
        {children}
      </main>
    </div>
  )
}
