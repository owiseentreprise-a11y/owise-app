import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ['firebase'],
  turbopack: {},

  async rewrites() {
    return [
      { source: '/', destination: '/vitrine.html' },
    ]
  },

  async headers() {
    return [
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
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://connect.facebook.net https://cdn.jsdelivr.net https://*.posthog.com https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: blob: https: http:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://maps.googleapis.com https://www.facebook.com https://connect.facebook.net https://fcm.googleapis.com https://firebaseinstallations.googleapis.com https://*.posthog.com https://va.vercel-scripts.com https://vercel.live",
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

export default nextConfig;
