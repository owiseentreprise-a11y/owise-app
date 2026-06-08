import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export default async function ChauffeurLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const role = user.app_metadata?.role
  if (role !== 'chauffeur' && role !== 'sous_traitant') redirect('/login')

  // Un compte sous_traitant peut accéder à l'app chauffeur UNIQUEMENT s'il a une ligne dans chauffeurs
  // (cas où le gérant d'un ST est aussi chauffeur)
  if (role === 'sous_traitant') {
    const admin = createAdminClient()
    const { data: chauffeurRow } = await admin.from('chauffeurs').select('id').eq('id', user.id).maybeSingle()
    if (!chauffeurRow) redirect('/sous-traitant')
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
      ['--gm' as any]:       'rgba(201,168,76,.08)',
      ['--t1' as any]:       '#0A0A0A',
      ['--t2' as any]:       '#555555',
      ['--t3' as any]:       '#999999',
      ['--gold' as any]:     '#C9A84C',
      ['--gold2' as any]:    '#DDB95A',
      ['--grn' as any]:      '#3DB87A',
      ['--amb' as any]:      '#E8A030',
      ['--red' as any]:      '#D95454',
      ['--blu' as any]:      '#4D8ED4',
    }}>
      {children}
    </div>
  )
}
