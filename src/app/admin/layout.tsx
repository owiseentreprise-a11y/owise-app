import Sidebar from '@/components/Sidebar'

// L'auth est déjà vérifiée par proxy.ts (matcher '/admin/:path*') sur CHAQUE requête —
// pas besoin d'un 2e appel getUser() indépendant ici, ça ne ferait que dupliquer le
// contrôle sans bénéfice de sécurité réel.
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
