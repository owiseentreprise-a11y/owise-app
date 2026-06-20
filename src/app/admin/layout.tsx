import Sidebar from '@/components/Sidebar'

// L'auth est déjà vérifiée par proxy.ts (matcher '/admin/:path*') sur CHAQUE requête.
// Un 2e contrôle getUser() ici crée un appel Supabase indépendant qui peut échouer
// (rotation de refresh token) alors que celui du proxy a réussi sur la même requête,
// provoquant une redirection /login intempestive après une Server Action réussie.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#F8F6F1' }}>
      <Sidebar />
      <main style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: '#F8F6F1',
      }}>
        {children}
      </main>
    </div>
  )
}
