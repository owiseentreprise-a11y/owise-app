import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.2,
  // Pas de session replay — données clients sensibles (adresses, paiement) sur ces pages
  integrations: [],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
