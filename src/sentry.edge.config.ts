import * as Sentry from '@sentry/nextjs'
import { nettoyerEvenement, nettoyerFilDAriane } from '@/lib/sentry-confidentialite'

/**
 * Sentry côté edge.config.ts — mêmes règles que le navigateur.
 *
 * `tracesSampleRate` valait 0.2 : le suivi de performance était actif ici
 * aussi. Il est coupé — c'est une mesure facultative, elle n'aide pas à
 * diagnostiquer une panne. La remontée des erreurs, elle, reste entière.
 *
 * Le nettoyage est partagé avec la configuration navigateur
 * (`src/lib/sentry-confidentialite.ts`) : une seule écriture de la règle,
 * pour que les deux côtés ne divergent pas. Une erreur serveur porte elle
 * aussi l'URL de la requête, donc l'adresse du client sur `/reserver`.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeSend: nettoyerEvenement,
  beforeBreadcrumb: nettoyerFilDAriane,
})
