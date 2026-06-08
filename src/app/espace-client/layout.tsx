import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { clientLogoutAction } from '@/app/espace-client/actions'

export default async function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/client-login')

  const role = user.app_metadata?.role
  if (role === 'admin') redirect('/admin')
  if (role === 'chauffeur') redirect('/chauffeur')

  // Récupère le profil
  const { data: profile } = await supabase
    .from('profiles')
    .select('nom, prenom')
    .eq('id', user.id)
    .single()

  const nomAffiche = profile ? `${profile.prenom} ${profile.nom}` : user.email

  // Récupère l'entreprise si collaborateur
  const { data: collab } = await supabase
    .from('collaborateurs')
    .select('poste, clients(entreprise_nom)')
    .eq('id', user.id)
    .single()

  const entrepriseNom = (collab?.clients as any)?.entreprise_nom ?? null

  return (
    <div style={{
      minHeight: '100vh', background: '#F8F6F1', display: 'flex', flexDirection: 'column',
      // Surcharge les variables CSS en thème clair pour l'espace client
      ['--base' as any]:     '#F8F6F1',
      ['--surface' as any]:  '#FFFFFF',
      ['--elevated' as any]: '#F3F0EB',
      ['--floating' as any]: '#FFFFFF',
      ['--gb' as any]:       'rgba(0,0,0,.1)',
      ['--t1' as any]:       '#0A0A0A',
      ['--t2' as any]:       '#555555',
      ['--t3' as any]:       '#999999',
      ['--gold' as any]:     '#C9A84C',
      ['--grn' as any]:      '#2E9E5E',
      ['--amb' as any]:      '#C07020',
      ['--red' as any]:      '#C03030',
      ['--blue' as any]:     '#3070C0',
      color:                  '#0A0A0A',
    }}>
      {/* Topbar */}
      <header data-noprint className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'linear-gradient(135deg,var(--gold),#8B6A1A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 15, fontWeight: 600, color: 'var(--base)',
          }}>O</div>
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 16, fontWeight: 500, color: '#0A0A0A', letterSpacing: '.06em' }}>
              OWISE
            </div>
            {entrepriseNom && (
              <div style={{ fontSize: 9, color: '#C9A84C', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: -2 }}>
                {entrepriseNom}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#0A0A0A' }}>{nomAffiche}</div>
            {collab?.poste && (
              <div style={{ fontSize: 10, color: '#999999' }}>{collab.poste}</div>
            )}
          </div>
          <form action={clientLogoutAction}>
            <button type="submit" style={{
              background: '#F3F0EB', border: '1px solid rgba(0,0,0,.12)',
              borderRadius: 7, padding: '6px 12px',
              fontSize: 11, color: '#555555', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}>
              Déconnexion
            </button>
          </form>
        </div>
      </header>

      <main style={{ flex: 1, padding: '32px', maxWidth: 900, margin: '0 auto', width: '100%' }}>
        {children}
      </main>
    </div>
  )
}
