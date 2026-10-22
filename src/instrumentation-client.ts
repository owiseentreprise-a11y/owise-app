import * as Sentry from '@sentry/nextjs'
import { nettoyerEvenement, nettoyerFilDAriane } from '@/lib/sentry-confidentialite'

/**
 * Sentry côté navigateur — remonter les pannes, et rien d'autre.
 *
 * Mesuré à l'étape 91, avant cette configuration :
 *
 *   · 3 enveloppes « session » partaient à CHAQUE visite, sans la moindre
 *     erreur et avant toute réponse au bandeau cookies. Elles portaient un
 *     identifiant de visite, le navigateur complet et la version du site.
 *     C'est du suivi de santé des versions — une mesure, pas un diagnostic.
 *   · des enveloppes « transaction » partaient aussi : `tracesSampleRate`
 *     valait 0.2, donc le suivi de performance était actif.
 *   · et sur `/reserver` pré-rempli, l'adresse du client partait dans
 *     `request.url` et dans trois fils d'Ariane.
 *
 * Ce que cette configuration retient :
 *
 *   1. `tracesSampleRate: 0` — plus de suivi de performance. C'est une
 *      mesure facultative, elle n'aide pas à diagnostiquer une panne.
 *   2. `autoSessionTracking: false` — plus d'enveloppe à chaque visite.
 *      Sentry ne parle plus que lorsque quelque chose casse.
 *   3. `sendDefaultPii: false` — déclaré explicitement. C'est déjà la
 *      valeur par défaut, mais l'assistant d'installation de Sentry la met
 *      parfois à `true` : l'écrire protège d'une régression silencieuse.
 *   4. `beforeSend` / `beforeBreadcrumb` — les adresses sont coupées de
 *      leur partie interrogative avant tout envoi.
 *
 * ── Une remarque sur l'ancienne ligne `integrations: []` ─────────────────
 * Son commentaire disait « pas de session replay », et c'est vrai — le
 * rejeu n'est pas une intégration par défaut et n'était pas ajouté. Mais le
 * tableau vide ne désactivait rien : vérifié dans la source du SDK
 * (`getIntegrationsToSetup`), un tableau est CONCATÉNÉ aux intégrations par
 * défaut, il ne les remplace pas. Le fil d'Ariane, les URL de requêtes et
 * le suivi restaient donc actifs. On ne garde pas cette ligne trompeuse.
 *
 * ── Ce qui N'EST PAS conditionné au consentement, et pourquoi ────────────
 * La remontée des erreurs reste active sans accord préalable : sans elle,
 * une panne qui empêche de réserver passerait inaperçue. Savoir si cette
 * finalité est exemptée de consentement est une QUESTION JURIDIQUE, qui
 * n'est pas tranchée ici. Ce qui est tranché, c'est la proportionnalité :
 * plus aucune mesure facultative, et plus aucune adresse client.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  /* Le suivi de santé des versions se désactive en retirant l'intégration
     « BrowserSession », et non par une option : `autoSessionTracking`
     n'existe plus dans le SDK v10. Vérifié dans la source installée —
     l'intégration est l'une des intégrations par défaut, et elle appelle
     `startSession` au chargement puis à chaque changement de page. C'est
     elle qui produisait les trois enveloppes par visite.
     On passe une FONCTION et non un tableau : un tableau serait concaténé
     aux intégrations par défaut au lieu de les filtrer. */
  integrations: defauts => defauts.filter(i => i.name !== 'BrowserSession'),
  beforeSend: nettoyerEvenement,
  beforeBreadcrumb: nettoyerFilDAriane,
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
