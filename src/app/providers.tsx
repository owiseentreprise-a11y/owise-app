'use client'

import posthog from 'posthog-js'
import { PostHogProvider } from 'posthog-js/react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, Suspense } from 'react'
import {
  analytiquesAutorisees,
  surChangementConsentement,
  effacerTracesPostHog,
} from '@/lib/consentement'

/**
 * PostHog, et le consentement.
 *
 * Constat de l'étape 88, corrigé ici : `posthog.init()` était appelé sans
 * aucune condition au montage. PostHog déposait donc son cookie
 * `ph_<clé>_posthog` et attribuait un identifiant de visiteur avant même que
 * la question ait été posée — exactement le défaut qu'on venait de corriger
 * pour Google Analytics, resté entier pour celui-ci.
 *
 * Règles tenues ici :
 *
 *  1. `init()` n'est JAMAIS appelé sans un « accepted » explicite. L'absence
 *     de réponse vaut refus : on n'initialise pas « au cas où ».
 *  2. Aucune vue de page n'est capturée tant que l'initialisation n'a pas eu
 *     lieu. `pretRef` le garantit même si un rendu passe avant l'effet.
 *  3. Un retrait en cours de visite coupe la collecte (`opt_out_capturing`),
 *     oublie l'identifiant (`reset`) et efface le cookie et l'entrée de
 *     stockage que PostHog a posés. Sans rechargement.
 *  4. Rien ici ne conditionne l'affichage : le fournisseur de contexte est
 *     toujours rendu, donc les enfants — tarifs, devis, réservation — vivent
 *     leur vie que PostHog soit actif ou non.
 */

function PageViewTracker({ actif }: { actif: boolean }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!actif) return
    const url = window.location.origin + pathname +
      (searchParams?.toString() ? `?${searchParams.toString()}` : '')
    posthog.capture('$pageview', { $current_url: url })
  }, [actif, pathname, searchParams])

  return null
}

export function PHProvider({ children }: { children: React.ReactNode }) {
  const [actif, setActif] = useState(false)
  const demarreRef = useRef(false)

  useEffect(() => {
    const cle = process.env.NEXT_PUBLIC_POSTHOG_KEY

    const appliquer = (autorise: boolean) => {
      if (autorise) {
        if (!cle) return
        if (!demarreRef.current) {
          posthog.init(cle, {
            api_host:        process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com',
            person_profiles: 'identified_only',
            capture_pageview: false,
            capture_pageleave: true,
          })
          demarreRef.current = true
        } else {
          /* Déjà initialisé plus tôt dans la visite puis coupé : on rouvre,
             et on lui rend le disque qu'on lui avait retiré. */
          try { posthog.set_config({ persistence: 'localStorage+cookie' }) } catch {}
          try { posthog.opt_in_capturing() } catch {}
        }
        setActif(true)
      } else {
        setActif(false)
        if (demarreRef.current) {
          /* L'ordre compte, et il a été trouvé par la mesure. Première
             version : couper, oublier, effacer — le cookie
             `ph_<clé>_posthog` et son entrée de stockage revenaient quand
             même. PostHog réécrit sa persistance après `reset()`, qui
             fabrique un nouvel identifiant.
             On lui retire donc le disque AVANT de le réinitialiser :
             `persistence: 'memory'` cantonne ses écritures à la mémoire de
             l'onglet, puis l'effacement porte sur un disque que plus rien
             ne réalimente. */
          try { posthog.opt_out_capturing() } catch {}
          try { posthog.set_config({ persistence: 'memory' }) } catch {}
          try { posthog.reset() } catch {}
        }
        effacerTracesPostHog()
      }
    }

    appliquer(analytiquesAutorisees())
    return surChangementConsentement(v => appliquer(v === 'accepted'))
  }, [])

  return (
    <PostHogProvider client={posthog}>
      <Suspense fallback={null}>
        <PageViewTracker actif={actif} />
      </Suspense>
      {children}
    </PostHogProvider>
  )
}
