'use client'

import { useEffect, useState } from 'react'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { analytiquesAutorisees, surChangementConsentement } from '@/lib/consentement'

/**
 * Vercel Analytics et Speed Insights, sous condition de consentement.
 *
 * ── Pourquoi, alors qu'ils ne posent aucun cookie ──────────────────────
 *
 * Mesuré à l'étape 90 : ni cookie, ni localStorage, ni sessionStorage, dans
 * aucun des deux environnements. Mais « sans cookie » ne prouve pas qu'une
 * mesure soit exemptée de consentement, et trois constats empêchent de
 * conclure à l'exemption :
 *
 *  1. La bibliothèque A L'INTENTION d'envoyer : en production,
 *     `window.vaq` contient une vue de page en attente
 *     (`[["pageview",{"route":"/","path":"/"}]]`).
 *  2. Je n'ai jamais pu CAPTURER un envoi réel — en local les deux scripts
 *     sont bien injectés mais répondent 404 faute de passerelle Vercel ; en
 *     production, dans ma fenêtre d'observation, aucune balise n'était
 *     injectée et aucune requête ne partait. Je n'explique pas cet écart, et
 *     je ne l'invente pas. N'ayant pas vu la charge utile, je ne peux rien
 *     affirmer sur ce qu'elle contient.
 *  3. Ce que Vercel dérive côté serveur (notamment un identifiant de
 *     visiteur calculé à partir de l'adresse IP et du navigateur) n'est pas
 *     observable depuis le navigateur. L'absence de preuve n'est pas une
 *     preuve d'absence.
 *
 * Le projet ne porte par ailleurs aucune configuration documentée
 * d'exemption : pas de `beforeSend`, pas de mode restreint.
 *
 * Faute de pouvoir établir l'exemption, on applique le choix prudent : rien
 * avant acceptation, rien après refus, fonctionnement normal après accord.
 * Ce composant ne touche ni l'hébergement Vercel ni le déploiement — il ne
 * décide que du rendu de deux balises de mesure.
 */
export default function MesureVercel() {
  const [autorise, setAutorise] = useState(false)

  useEffect(() => {
    setAutorise(analytiquesAutorisees())
    return surChangementConsentement(v => setAutorise(v === 'accepted'))
  }, [])

  if (!autorise) return null

  return (
    <>
      <Analytics />
      <SpeedInsights />
    </>
  )
}
