import Sidebar from '@/components/Sidebar'
import AdminMobileNav from '@/components/AdminMobileNav'
/* La couche mobile de l'administration. Tout y est sous `@media (max-width:
   900px)` : au-dessus, l'écran large ne change pas d'un pixel. */
import './mobile.css'
import ErrorReporter from './ErrorReporter'

// L'auth est déjà vérifiée par proxy.ts (matcher '/admin/:path*') sur CHAQUE requête —
// pas besoin d'un 2e appel getUser() indépendant ici, ça ne ferait que dupliquer le
// contrôle sans bénéfice de sécurité réel.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="theme-light" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: '#F8F6F1' }}>
      <ErrorReporter />
      <Sidebar />
      <main className="adm-contenu" style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: '#F8F6F1',
        /* Réserve la hauteur du bandeau cookies, qui sinon recouvre le bas de
           page — y compris les boutons de validation des formulaires. Sur
           téléphone, `mobile.css` y ajoute la navigation basse. */
        paddingBottom: 'var(--bandeau-cookies, 0px)',
      }}>
        {children}
      </main>
      <AdminMobileNav />
    </div>
  )
}
