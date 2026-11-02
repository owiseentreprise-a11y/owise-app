'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { logoutAction } from '@/app/login/actions'

const navItems = [
  {
    section: 'Exploitation',
    items: [
      { href: '/admin',               label: 'Dashboard',    icon: 'grid'      },
      { href: '/admin/planning',      label: 'Planning',     icon: 'calendar'  },
      { href: '/admin/courses',       label: 'Courses',      icon: 'map'       },
      /* « Devis » tout court désignait les demandes venues du formulaire du
         site, et l'exploitant y a cherché un devis qu'il m'avait demandé de
         composer — 2026-11-02. Les deux entrées disent désormais ce qu'elles
         contiennent : ce qu'on reçoit, et ce qu'on envoie. */
      { href: '/admin/devis-clients', label: 'Devis clients', icon: 'file'     },
      { href: '/admin/devis',         label: 'Devis en ligne', icon: 'inbox'   },
      { href: '/admin/chauffeurs',    label: 'Chauffeurs',   icon: 'users'     },
      { href: '/admin/facturation',   label: 'Facturation',  icon: 'file'      },
      { href: '/admin/stats',         label: 'Statistiques', icon: 'bar'       },
      { href: '/admin/analytics',     label: 'Analytics',    icon: 'analytics' },
      { href: '/admin/estimations',   label: 'Estimations',  icon: 'search'    },
      { href: '/admin/funnel',        label: 'Tunnel',       icon: 'funnel'    },
    ],
  },
  {
    section: 'Paramètres',
    items: [
      { href: '/admin/clients',        label: 'Clients',        icon: 'briefcase' },
      { href: '/admin/sous-traitants', label: 'Sous-traitants', icon: 'truck'     },
      { href: '/admin/tarifs',         label: 'Tarifs',         icon: 'tag'       },
      { href: '/admin/backups',         label: 'Sauvegardes',    icon: 'backup'    },
      { href: '/admin/parametres',     label: 'Paramètres',     icon: 'settings'  },
    ],
  },
]

const ICONS: Record<string, React.ReactNode> = {
  grid:      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  map:       <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4"/></svg>,
  users:     <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  calendar:  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><rect x="3" y="4" width="18" height="18" rx="2"/><path strokeLinecap="round" strokeLinejoin="round" d="M16 2v4M8 2v4M3 10h18"/></svg>,
  file:      <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  briefcase: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  settings:  <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>,
  bar:       <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>,
  truck:     <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"/><path strokeLinecap="round" strokeLinejoin="round" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 .001M13 16H9m4 0h2m3-5l1.5 2.5M13 5h4l3 6H13V5z"/></svg>,
  tag:       <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z"/></svg>,
  inbox:     <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"/></svg>,
  search:    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/></svg>,
  analytics: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l4-4 4 4 4-6 4 3"/><path strokeLinecap="round" strokeLinejoin="round" d="M3 20h18"/></svg>,
  backup:    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"/></svg>,
  funnel:    <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}><path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16l-6.5 8.5V19l-3 1.5v-7L4 5z"/></svg>,
}

function NavItem({ item, isActive }: { item: { href: string; label: string; icon: string }; isActive: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={item.href}
      prefetch={false}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 12px', borderRadius: 8,
        fontSize: 12.5, fontWeight: isActive ? 600 : 400,
        color: isActive ? '#C9A84C' : hovered ? '#0A0A0A' : '#666666',
        background: isActive
          ? 'linear-gradient(90deg, rgba(201,168,76,.12), rgba(201,168,76,.05))'
          : hovered ? 'rgba(0,0,0,.04)' : 'transparent',
        textDecoration: 'none',
        position: 'relative',
        transition: 'color .12s, background .12s',
        letterSpacing: isActive ? '.01em' : 'normal',
      }}
    >
      {/* Indicateur actif */}
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: 3, height: 20, borderRadius: '0 3px 3px 0',
          background: 'linear-gradient(180deg, #DDB95A, #C9A84C)',
          boxShadow: '2px 0 8px rgba(201,168,76,.35)',
        }} />
      )}
      <span style={{
        color: isActive ? '#C9A84C' : hovered ? '#555555' : '#AAAAAA',
        transition: 'color .12s', flexShrink: 0,
      }}>
        {ICONS[item.icon]}
      </span>
      {item.label}
    </Link>
  )
}

export default function Sidebar() {
  const pathname = usePathname()
  const [logoutHover, setLogoutHover] = useState(false)

  /* Sur téléphone, la barre prenait 220 px sur 390 — 56 % de l'écran — et le
     contenu tombait à un ou deux mots par ligne. Mesuré le 2026-11-02 sur
     l'écran d'envoi d'un devis : inutilisable. Elle devient donc un tiroir
     en dessous de 900 px, refermé à chaque changement de page. */
  const [ouvert, setOuvert] = useState(false)
  useEffect(() => { setOuvert(false) }, [pathname])

  // Masque le sidebar le temps de deux frames après le montage : sur certaines
  // machines/navigateurs, le tout premier paint après une connexion peut
  // survenir avant que la mise en page (flex/overflow) ne soit stabilisée,
  // produisant un affichage chevauché jusqu'à un repaint ultérieur. Repousser
  // le premier paint visible de quelques millisecondes (imperceptible) laisse
  // le temps à la mise en page de se stabiliser avant que quiconque la voie.
  const [ready, setReady] = useState(false)
  useEffect(() => {
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => setReady(true))
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [])

  return (
    <>
      {/* Les règles n'existent qu'en dessous de 900 px : au-dessus, la barre
          reste exactement ce qu'elle était. `!important` est nécessaire —
          les styles de ce composant sont en ligne, et l'emportent sinon. */}
      <style>{`
        .adm-ouvrir, .adm-voile { display: none; }
        @media (max-width: 900px) {
          .adm-barre {
            position: fixed !important; top: 0; left: 0; z-index: 70;
            transform: translateX(-100%);
            transition: transform .22s ease, opacity .1s;
            box-shadow: 0 0 44px rgba(10,10,10,.22);
          }
          .adm-barre[data-ouvert="oui"] { transform: translateX(0); }
          .adm-ouvrir { display: flex !important; }
          .adm-voile  { display: block; }
          /* Laisse la place au bouton : sans cela il recouvre le premier
             lien de chaque page. */
          .adm-contenu { padding-top: 54px !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          .adm-barre { transition: none !important; }
        }
      `}</style>

      <button
        type="button"
        className="adm-ouvrir"
        onClick={() => setOuvert(o => !o)}
        aria-label={ouvert ? 'Fermer le menu' : 'Ouvrir le menu'}
        aria-expanded={ouvert}
        style={{
          position: 'fixed', top: 9, left: 9, zIndex: 80,
          width: 40, height: 40, borderRadius: 10,
          alignItems: 'center', justifyContent: 'center',
          background: '#FFFFFF', border: '1px solid rgba(0,0,0,.12)',
          boxShadow: '0 2px 10px rgba(10,10,10,.10)',
          cursor: 'pointer', color: '#0A0A0A', padding: 0,
        }}
      >
        <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
          {ouvert
            ? <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
            : <path strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>

      {ouvert && (
        <div
          className="adm-voile"
          onClick={() => setOuvert(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(10,10,10,.45)' }}
        />
      )}

    <aside className="adm-barre" data-ouvert={ouvert ? 'oui' : 'non'} style={{
      width: 220, minWidth: 220, height: '100dvh',
      background: '#FFFFFF',
      borderRight: '1px solid rgba(0,0,0,.07)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', flexShrink: 0,
      overflow: 'hidden',
      opacity: ready ? 1 : 0,
      transition: 'opacity .1s',
    }}>
      {/* Bande or en haut */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, transparent, #C9A84C 30%, #DDB95A 60%, transparent)',
      }} />

      {/* Logo */}
      <div style={{
        padding: '22px 18px 16px',
        borderBottom: '1px solid rgba(0,0,0,.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'linear-gradient(135deg, #C9A84C, #8B6A1A)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 600, color: '#fff',
            boxShadow: '0 4px 14px rgba(201,168,76,.25)',
          }}>O</div>
          <div>
            <div style={{
              fontFamily: 'Georgia, serif', fontSize: 18, fontWeight: 500,
              letterSpacing: '.1em', color: '#0A0A0A', lineHeight: 1,
            }}>OWISE</div>
            <div style={{
              fontSize: 8.5, letterSpacing: '.2em', textTransform: 'uppercase',
              color: '#BBBBBB', marginTop: 2,
            }}>Administration</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, minHeight: 0, padding: '8px 10px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(201,168,76,.25) transparent' }}>
        {navItems.map((group, gi) => (
          <div key={group.section} style={{ marginTop: gi === 0 ? 4 : 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
              color: '#CCCCCC', fontWeight: 600,
              padding: '16px 12px 6px',
            }}>
              {group.section}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {group.items.map(item => {
                const isActive = pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href))
                return <NavItem key={item.href} item={item} isActive={isActive} />
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Séparateur + Déconnexion */}
      <div style={{ borderTop: '1px solid rgba(0,0,0,.06)', padding: '12px 14px' }}>
        <form action={logoutAction}>
          <button
            type="submit"
            onMouseEnter={() => setLogoutHover(true)}
            onMouseLeave={() => setLogoutHover(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 11, color: logoutHover ? '#D95454' : '#AAAAAA',
              background: logoutHover ? 'rgba(217,84,84,.06)' : 'none',
              border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              padding: '7px 10px', borderRadius: 7,
              width: '100%', transition: 'color .12s, background .12s',
            }}
          >
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
    </>
  )
}
