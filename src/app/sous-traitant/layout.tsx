import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function SousTraitantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sous-traitant-login')
  if (user.app_metadata?.role !== 'sous_traitant' && user.app_metadata?.role !== 'admin') {
    redirect('/sous-traitant-login')
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F8F6F1',
      color: '#0A0A0A',
      fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
      ['--base' as any]:     '#F8F6F1',
      ['--surface' as any]:  '#FFFFFF',
      ['--elevated' as any]: '#F3F0EB',
      ['--floating' as any]: '#EDEAE4',
      ['--gb' as any]:       'rgba(0,0,0,.08)',
      ['--t1' as any]:       '#0A0A0A',
      ['--t2' as any]:       '#555555',
      ['--t3' as any]:       '#999999',
      ['--gold' as any]:     '#C9A84C',
      ['--grn' as any]:      '#3DB87A',
      ['--amb' as any]:      '#E8A030',
      ['--red' as any]:      '#D95454',
      ['--blu' as any]:      '#4D8ED4',
    }}>
      {children}
    </div>
  )
}
