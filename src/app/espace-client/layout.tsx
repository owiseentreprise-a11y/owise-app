import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { logoutAction } from '@/app/login/actions'

export default async function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

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
    <div style={{ minHeight: '100vh', background: 'var(--base)', display: 'flex', flexDirection: 'column' }}>
      {/* Topbar */}
      <header data-noprint className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(9,9,26,.95)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.1)',
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
            <div style={{ fontFamily: 'var(--font-cormorant), serif', fontSize: 16, fontWeight: 500, color: 'var(--t1)', letterSpacing: '.06em' }}>
              OWISE
            </div>
            {entrepriseNom && (
              <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: -2 }}>
                {entrepriseNom}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{nomAffiche}</div>
            {collab?.poste && (
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>{collab.poste}</div>
            )}
          </div>
          <form action={logoutAction}>
            <button type="submit" style={{
              background: 'var(--elevated)', border: '1px solid var(--t3)',
              borderRadius: 7, padding: '6px 12px',
              fontSize: 11, color: 'var(--t2)', cursor: 'pointer',
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
