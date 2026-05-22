'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { logoutAction } from '@/app/login/actions'

const navItems = [
  {
    section: 'Exploitation',
    items: [
      { href: '/admin', label: 'Dashboard', icon: 'grid' },
      { href: '/admin/courses', label: 'Courses', icon: 'map' },
      { href: '/admin/chauffeurs', label: 'Chauffeurs', icon: 'users' },
      { href: '/admin/facturation', label: 'Facturation', icon: 'file' },
    ],
  },
  {
    section: 'Paramètres',
    items: [
      { href: '/admin/clients', label: 'Clients', icon: 'briefcase' },
      { href: '/admin/parametres', label: 'Paramètres', icon: 'settings' },
    ],
  },
]

const icons: Record<string, React.ReactNode> = {
  grid: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  map: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 13l4.553 2.276A1 1 0 0021 21.382V10.618a1 1 0 00-.553-.894L15 7m0 13V7m0 0L9 4"/></svg>,
  users: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
  file: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>,
  briefcase: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>,
  settings: <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><circle cx="12" cy="12" r="3"/></svg>,
}

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh',
      background: 'var(--surface)',
      borderRight: '1px solid var(--gb)',
      display: 'flex', flexDirection: 'column',
      position: 'relative', flexShrink: 0,
    }}>
      {/* Gold line top */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: 'linear-gradient(90deg,transparent,var(--gold),transparent)',
      }} />

      {/* Brand */}
      <div style={{
        padding: '22px 20px 18px',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 30, height: 30, borderRadius: 7,
          background: 'linear-gradient(135deg,var(--gold),#8B6A1A)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'var(--font-cormorant), serif',
          fontSize: 16, fontWeight: 600, color: 'var(--base)',
          boxShadow: '0 4px 12px rgba(201,168,76,.25)', flexShrink: 0,
        }}>O</div>
        <div>
          <div style={{
            fontFamily: 'var(--font-cormorant), serif',
            fontSize: 19, fontWeight: 500,
            letterSpacing: '.08em', color: 'var(--t1)',
          }}>OWISE</div>
          <div style={{ fontSize: 9, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--t2)' }}>
            Admin
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '10px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {navItems.map(group => (
          <div key={group.section}>
            <div style={{
              fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
              color: 'var(--t3)', fontWeight: 500,
              padding: '14px 10px 6px',
            }}>{group.section}</div>
            {group.items.map(item => {
              const isOn = pathname === item.href || (item.href !== '/admin' && pathname.startsWith(item.href))
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 8,
                    fontSize: 12.5, fontWeight: 400,
                    color: isOn ? 'var(--gold)' : 'var(--t2)',
                    background: isOn ? 'var(--gm)' : 'transparent',
                    textDecoration: 'none',
                    position: 'relative',
                    transition: 'color .15s, background .15s',
                  }}
                >
                  {isOn && (
                    <div style={{
                      position: 'absolute', left: 0, top: '50%',
                      transform: 'translateY(-50%)',
                      width: 3, height: 18,
                      background: 'var(--gold)', borderRadius: '0 2px 2px 0',
                    }} />
                  )}
                  <span style={{ opacity: isOn ? 1 : 0.7 }}>{icons[item.icon]}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer logout */}
      <div style={{ borderTop: '1px solid rgba(201,168,76,.08)', padding: '12px 14px' }}>
        <form action={logoutAction}>
          <button type="submit" style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: 11, color: 'var(--t2)',
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            padding: 0,
          }}>
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
            </svg>
            Déconnexion
          </button>
        </form>
      </div>
    </aside>
  )
}
