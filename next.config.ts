import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  transpilePackages: ['firebase'],
  turbopack: { root: __dirname },

  async rewrites() {
    return [
      { source: '/', destination: '/vitrine.html' },
    ]
  },

  async headers() {
    return [
      /* ── LES PAGES PRIVEES SORTENT DE L'INDEX PAR `noindex`, PAS PAR robots.txt ──
         Search Console, 2026-11-16 : `/client-login` « Indexee malgre le
         blocage par le fichier robots.txt ». La page portait pourtant
         `<meta name="robots" content="noindex">` — mais robots.txt
         INTERDISAIT a Google d'y entrer, donc il ne pouvait jamais lire ce
         noindex. Il connaissait l'adresse par les 40 pages qui menent a
         `/espace-client` (redirige vers `/client-login`), ne pouvait pas la
         visiter, et l'indexait a l'aveugle.

         Google le documente : robots.txt regle l'EXPLORATION, pas
         l'INDEXATION ; une page bloquee mais liee peut apparaitre dans les
         resultats. Pour sortir une page de l'index il faut `noindex`, ET
         laisser entrer.

         D'ou cet en-tete, pose en UN SEUL endroit sur toutes les zones
         privees et leurs sous-pages (`:path*` couvre aussi l'adresse nue).
         Il vaut meme pour une page qui oublierait sa balise. Rien de prive
         n'est expose pour autant : un visiteur anonyme — robot compris —
         est redirige vers une page de connexion par `src/proxy.ts`.
         Controle : `node test-noindex-prive.mjs [url]`. */
      ...['/login', '/client-login', '/sous-traitant-login', '/espace-client',
          '/admin', '/chauffeur', '/sous-traitant', '/paiement'].map(base => ({
        source: `${base}/:path*`,
        headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
      })),
      {
        // Chaque page ville ou trajet annonce sa version Markdown. Un agent la
        // decouvre sans deviner l'adresse ; la plupart n'executent pas
        // JavaScript et n'ont que faire de la mise en page.
        source: '/:slug(vtc-[a-z0-9-]+)',
        headers: [
          { key: 'Link', value: '</md/:slug>; rel="alternate"; type="text/markdown"' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          // Empêche le clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Empêche le MIME sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Active HTTPS strict (1 an)
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          // Désactive les infos de référent cross-origin
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restreint les fonctionnalités navigateur inutilisées
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          // CSP permissive mais bloque les sources inattendues
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://connect.facebook.net https://cdn.jsdelivr.net https://*.posthog.com https://va.vercel-scripts.com https://www.googletagmanager.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://www.facebook.com https://connect.facebook.net https://fcm.googleapis.com https://firebaseinstallations.googleapis.com https://*.posthog.com https://va.vercel-scripts.com https://vercel.live https://*.sentry.io https://*.google-analytics.com https://*.analytics.google.com https://analytics.google.com https://www.googletagmanager.com https://stats.g.doubleclick.net https://www.google.com https://www.googleadservices.com https://googleads.g.doubleclick.net https://ad.doubleclick.net",
              "frame-src 'self' https://js.stripe.com https://hooks.stripe.com",
              "worker-src 'self' blob:",
              "media-src 'self' blob:",
            ].join('; '),
          },
        ],
      },
    ]
  },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  // tunnelRoute, disableLogger, automaticVercelMonitors retirés : non supportés
  // sous Turbopack (seul bundler utilisé par ce projet, cf. turbopack:{} ci-dessus).
});
