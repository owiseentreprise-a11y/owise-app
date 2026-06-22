import type { CSSVarStyle } from '@/lib/types'

// Auth gérée exclusivement par le proxy (src/proxy.ts) pour éviter les boucles
// de redirections quand la session expire entre le proxy et le layout.
export default async function SousTraitantLayout({ children }: { children: React.ReactNode }) {
  const style: CSSVarStyle = {
    minHeight: '100vh',
    background: '#F8F6F1',
    color: '#0A0A0A',
    fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    '--base':     '#F8F6F1',
    '--surface':  '#FFFFFF',
    '--elevated': '#F3F0EB',
    '--floating': '#EDEAE4',
    '--gb':       'rgba(0,0,0,.08)',
    '--t1':       '#0A0A0A',
    '--t2':       '#555555',
    '--t3':       '#999999',
    '--gold':     '#C9A84C',
    '--grn':      '#3DB87A',
    '--amb':      '#E8A030',
    '--red':      '#D95454',
    '--blu':      '#4D8ED4',
  }

  return (
    <div style={style}>
      {children}
    </div>
  )
}
