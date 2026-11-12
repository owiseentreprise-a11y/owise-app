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
    /* DEUX CLASSES, ET C'EST VOULU.

       `adm-shell` dit la STRUCTURE : c'est elle que visent les règles
       d'impression de `document-feuille.ts`, qui doivent neutraliser la
       hauteur d'écran et masquer la barre latérale pour qu'une facture tienne
       sur plusieurs pages. Elles ciblaient `.theme-light` jusqu'au
       2026-11-12 — renommer le thème aurait cassé l'impression des factures
       en silence, sans qu'aucune compilation ne s'en plaigne.

       `theme-cockpit` dit la COULEUR, et rien d'autre. On peut la changer
       sans rien casser d'autre que l'apparence. */
    <div className="adm-shell theme-cockpit" style={{ display: 'flex', height: '100dvh', overflow: 'hidden', background: 'var(--base)' }}>
      <ErrorReporter />
      <Sidebar />
      <main className="adm-contenu" style={{
        flex: 1, minHeight: 0,
        overflowY: 'auto', overflowX: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: 'var(--base)',
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
