import type { Metadata } from 'next'
import MentionsLegalesClient from './MentionsLegalesClient'

export const metadata: Metadata = {
  title: 'Mentions légales — Owise',
  description: 'Mentions légales, conditions générales d\'utilisation (CGU), conditions générales de vente (CGV) et politique de confidentialité d\'Owise.',
  robots: { index: true, follow: false },
}

export default function MentionsLegalesPage() {
  return <MentionsLegalesClient />
}
