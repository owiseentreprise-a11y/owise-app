'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { logoutAction } from '@/app/login/actions'

const navItems = [
  {
    section: 'Exploitation',
    items: [
      { href: '/admin',               label: 'Dashboard',    icon: 'grid'      },
      { href: '/admin/planning',      label: 'Planning',     icon: 'calendar'  },
      { href: '/admin/courses',       label: 'Courses',      icon: 'map'       },
      { href: '/admin/chauffeurs',    label: 'Chauffeurs',   icon: 'users'     },
      { href: '/admin/facturation',   label: 'Facturation',  icon: 'file'      },
      { href: '/admin/stats',         label: 'Statistiques', icon: 'bar'       },
    ],
  },
  {
    section: 'Paramètres',
    items: [
      { href: '/admin/clients',        label: 'Clients',        icon: 'briefcase' },
      { href: '/admin/sous-traitants', label: 'Sous-traitants', icon: 'truck'     },
      { href: '/admin/tarifs',         label: 'Tarifs',         icon: 'tag'       },
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
}

function NavItem({ item, isActive }: { item: { href: string; label: string; icon: string }; isActive: boolean }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Link
      href={item.href}
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

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh',
      background: '#FFFFFF',
      borderRight: '1px solid rgba(0,0,0,.07)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', flexShrink: 0,
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
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
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
  )
}
