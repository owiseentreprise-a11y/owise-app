'use client'

/**
 * La navigation basse de l'administration, sur téléphone.
 *
 * Quatre destinations et un accès au reste. Le choix n'est pas esthétique :
 * ce sont les trois gestes que l'exploitant a nommés quand il travaille
 * dehors — consulter le planning, permuter un chauffeur, répondre à un devis —
 * plus le tableau de bord, qui répond à « où en est-on aujourd'hui ».
 *
 * Pourquoi en bas. Le pouce atteint le bas d'un téléphone ; il n'atteint pas
 * le coin haut-gauche sans changer de prise. Le tiroir reste disponible par
 * « Plus » et par le bouton de la barre du haut — mais aucun geste courant
 * n'en dépend plus.
 *
 * Les quinze autres pages restent dans le tiroir. Une barre à neuf onglets
 * n'est pas une navigation, c'est une liste illisible.
 */
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { basculerMenu, useMenuOuvert } from './adminMenu'

const DESTINATIONS = [
  {
    href: '/admin', label: 'Accueil',
    icone: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  },
  {
    href: '/admin/planning', label: 'Planning',
    icone: <><rect x="3" y="4" width="18" height="18" rx="2" /><path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" /></>,
  },
  {
    href: '/admin/courses', label: 'Courses',
    icone: <path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4" />,
  },
  {
    href: '/admin/devis-clients', label: 'Devis',
    icone: <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />,
  },
]

export default function AdminMobileNav() {
  const chemin = usePathname()
  const menuOuvert = useMenuOuvert()

  /* « Accueil » ne doit s'allumer que sur /admin exactement, sinon il reste
     actif partout — toutes les pages commencent par /admin. */
  const estActif = (href: string) =>
    href === '/admin' ? chemin === '/admin' : chemin.startsWith(href)

  return (
    <nav className="adm-nav-basse" aria-label="Navigation principale">
      {DESTINATIONS.map(d => {
        const actif = estActif(d.href)
        return (
          <Link
            key={d.href}
            href={d.href}
            prefetch={false}
            aria-current={actif ? 'page' : undefined}
          >
            <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={actif ? 2 : 1.6} aria-hidden="true">
              {d.icone}
            </svg>
            {d.label}
          </Link>
        )
      })}

      <button
        type="button"
        onClick={basculerMenu}
        aria-expanded={menuOuvert}
        aria-label={menuOuvert ? 'Fermer le menu complet' : 'Ouvrir le menu complet'}
      >
        <svg width="21" height="21" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.6} aria-hidden="true">
          <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
        Plus
      </button>
    </nav>
  )
}
