'use client'

import { useEffect, useState } from 'react'
import Script from 'next/script'
import { GA_ID, AW_ID } from '@/lib/ga'
import {
  analytiquesAutorisees,
  surChangementConsentement,
  verrouillerSiPasDeConsentement,
} from '@/lib/consentement'

/**
 * Avant l'étape 88, ce composant était rendu côté serveur et posait les
 * balises gtag sans aucune condition : Google Analytics se chargeait dès la
 * première milliseconde, avant que le visiteur ait vu la question, et un
 * refus n'y changeait rien — le bandeau se contentait de disparaître.
 *
 * Désormais les balises ne sont rendues qu'après un « accepted » explicite.
 * Trois précautions :
 *
 *  1. Au premier rendu, `autorise` vaut false. Rien n'est injecté tant que
 *     le choix enregistré n'a pas été relu — et l'absence de choix vaut
 *     refus.
 *  2. `verrouillerSiPasDeConsentement()` lève le drapeau `ga-disable-<ID>`
 *     avant tout, au cas où un autre chemin chargerait gtag.
 *  3. On reste abonné : un retrait du consentement en cours de visite
 *     démonte les balises, lève le drapeau et efface les cookies déjà posés,
 *     sans rechargement.
 */
export default function GoogleAnalytics() {
  const [autorise, setAutorise] = useState(false)

  useEffect(() => {
    verrouillerSiPasDeConsentement()
    setAutorise(analytiquesAutorisees())
    return surChangementConsentement(v => setAutorise(v === 'accepted'))
  }, [])

  if (!GA_ID || !autorise) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { anonymize_ip: true, send_page_view: false });
          ${AW_ID ? `gtag('config', '${AW_ID}');` : ''}
        `}
      </Script>
    </>
  )
}
