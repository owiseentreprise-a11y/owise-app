import type { Metadata } from 'next'
import MentionsLegalesClient from './MentionsLegalesClient'

export const metadata: Metadata = {
  title: 'Mentions légales — Owise',
  description: 'Mentions légales, conditions générales d\'utilisation (CGU), conditions générales de vente (CGV) et politique de confidentialité d\'Owise.',
  /* Seule page publique du site qui n'en déclarait aucune, mesuré le
   * 2026-10-29. Même forme littérale que /reserver, /faq et /blog. */
  alternates: { canonical: 'https://www.owise.fr/mentions-legales' },
  robots: { index: true, follow: false },
}

export default function MentionsLegalesPage() {
  return <MentionsLegalesClient />
}
