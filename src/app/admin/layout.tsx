import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')
  if (user.app_metadata?.role !== 'admin') redirect('/login')

  return (
    <div className="theme-light" style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#F8F6F1' }}>
      <Sidebar />
      <main style={{
        flex: 1, height: '100vh',
        overflowY: 'auto',
        display: 'flex', flexDirection: 'column',
        background: '#F8F6F1',
      }}>
        {children}
      </main>
    </div>
  )
}
