import type { Metadata } from 'next'
import MesureVercel from '@/components/MesureVercel'
import { PHProvider } from './providers'
import CookieBanner from '@/components/CookieBanner'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import GAPageView from '@/components/GAPageView'
import OrigineVisite from '@/components/OrigineVisite'
/* AVANT globals.css : les @font-face et les variables --font-* doivent
   exister quand le reste des styles s'en sert. Fichier ECRIT PAR
   `recuperer-polices.mjs`, jamais a la main. */
import './polices.css'
import './globals.css'

/* ── LES POLICES SONT DANS LE DEPOT, PAS CHEZ GOOGLE ──────────────────────

   Ce fichier employait `next/font/google`, qui ne declare pas une police :
   il la TELECHARGE pendant la compilation. Quand ce telechargement echoue,
   ou qu'un cache de construction en garde une trace incomplete, Vercel
   s'arrete sur « Module not found: …/internal/font/google/<police> » et la
   mise en ligne n'a pas lieu — sans que rien ne previenne. C'est arrive
   CINQ fois entre le 2026-10-27 et le 2026-11-12, dont quatre envois perdus
   d'affilee, production figee des heures.

   LES @font-face SONT ECRITS A LA MAIN, dans `globals.css`, et pointent sur
   `public/fonts/`. Deux raisons de ne pas passer par `next/font/local` :

   1. NEXT NOMME LA FAMILLE D'APRES LA VARIABLE JAVASCRIPT. `next/font/google`
      la nommait « DM Sans » ou « Cormorant Garamond » ; `next/font/local`
      l'aurait nommee « dmSans » ou « cormorant ». Or ce projet ecrit les
      vrais noms EN CLAIR a une centaine d'endroits — 48 fois dans
      `vitrine.css`, et tout le blog pose `fontFamily: "'Cormorant Garamond',
      serif"` SANS variable. Ces pages seraient retombees sur le serif du
      systeme, sur 140 articles, sans une erreur.
   2. Ecrits a la main, les noms sont ceux du dessin, pas ceux d'une variable.
      Plus rien ne peut les desaccorder.

   Les familles « … Fallback » et leurs corrections de metriques viennent de
   ce que Next produisait : meme comportement au chargement, meme absence de
   saut de mise en page.

   Pour ajouter une graisse : l'ajouter dans `recuperer-polices.mjs`, relancer
   le script, puis ecrire son @font-face dans `globals.css`.
   ──────────────────────────────────────────────────────────────────────── */

export const metadata: Metadata = {
  metadataBase: new URL('https://www.owise.fr'),
  title: 'Owise — Chauffeur privé VTC',
  description: 'Chauffeur privé VTC à Paris, Île-de-France et dans l\'Oise. Tarif fixe garanti, disponible 24h/24.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className="h-full">
      <body className="h-full">
        <PHProvider>
          {children}
        </PHProvider>
        <GoogleAnalytics />
        <GAPageView />
        {/* Relève le canal d'arrivée à l'ouverture de l'onglet. Doit être sur
            TOUTES les pages : le référent n'est juste qu'à la première, et une
            page d'arrivée manquante ferait passer du trafic Google ou ChatGPT
            pour du trafic direct. */}
        <OrigineVisite />
        <CookieBanner />
        {/* Étape 90 : les deux mesures Vercel passent par un composant qui
            attend le consentement. Voir MesureVercel.tsx pour le détail des
            constats — l'hébergement et le déploiement ne sont pas touchés. */}
        <MesureVercel />
      </body>
    </html>
  )
}
