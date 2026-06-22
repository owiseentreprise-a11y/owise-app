import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { CSSVarStyle } from '@/lib/types'

// Contrôle d'accès basique (rôle) géré par le proxy.
// Ce layout n'ajoute que la vérification métier spécifique aux ST.
export default async function ChauffeurLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Un compte sous_traitant peut accéder à l'app chauffeur UNIQUEMENT s'il a une ligne dans chauffeurs
  // (le proxy ne peut pas faire cette requête DB — c'est la seule vérification ici)
  if (user?.app_metadata?.role === 'sous_traitant') {
    const admin = createAdminClient()
    const { data: chauffeurRow } = await admin.from('chauffeurs').select('id').eq('id', user.id).maybeSingle()
    if (!chauffeurRow) redirect('/sous-traitant')
  }

  const style: CSSVarStyle = {
    minHeight: '100vh',
    background: '#F8F6F1',
    color: '#0A0A0A',
    fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    '--base':     '#F8F6F1',
    '--surface':  '#FFFFFF',
    '--elevated': '#F3F0EB',
    '--floating': '#EDEAE4',
    '--gb':       'rgba(0,0,0,.08)',
    '--gm':       'rgba(201,168,76,.08)',
    '--t1':       '#0A0A0A',
    '--t2':       '#555555',
    '--t3':       '#999999',
    '--gold':     '#C9A84C',
    '--gold2':    '#DDB95A',
    '--grn':      '#3DB87A',
    '--amb':      '#E8A030',
    '--red':      '#D95454',
    '--blu':      '#4D8ED4',
  }

  return (
    <div style={style}>
      {children}
    </div>
  )
}
