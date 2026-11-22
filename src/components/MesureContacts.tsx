'use client'

/**
 * Compte les clics vers le téléphone, le WhatsApp et l'e-mail d'Owise.
 * Voir src/lib/contact-clic.ts pour ce qui est mesuré, et pourquoi.
 *
 * UN SEUL écouteur, posé sur le document : tous les boutons du site, présents
 * et futurs, sont comptés sans qu'aucun ait à le prévoir. Une liste de boutons
 * écrite à la main aurait oublié le prochain.
 *
 * Envoi par `navigator.sendBeacon` : un clic sur « Appeler » ouvre le
 * téléphone, un clic sur WhatsApp ouvre l'application — la page peut être
 * quittée dans la milliseconde, et une requête ordinaire serait coupée.
 * L'envoi ne retarde ni n'empêche jamais l'ouverture du lien.
 */
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { typeDeLien, estPageInterne, noterPage, construireMesure, libelleBouton } from '@/lib/contact-clic'
import { lireOrigine } from '@/lib/origine-visite'

export default function MesureContacts() {
  const chemin = usePathname() ?? '/'

  useEffect(() => { if (!estPageInterne(chemin)) noterPage(chemin) }, [chemin])

  useEffect(() => {
    const auClic = (ev: MouseEvent) => {
      const cible = ev.target as Element | null
      const lien = cible?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!lien) return
      const type = typeDeLien(lien.getAttribute('href'))
      const ici = window.location.pathname
      if (!type || estPageInterne(ici)) return
      try {
        const o = lireOrigine()
        const corps = JSON.stringify({
          ...construireMesure(type, libelleBouton(lien), ici),
          referent: o.referent, premiere_page: o.premierePage,
          utm_source: o.utm_source, utm_campaign: o.utm_campaign, gclid: o.gclid,
        })
        const blob = new Blob([corps], { type: 'application/json' })
        if (!navigator.sendBeacon?.('/api/contacts-clics', blob)) {
          fetch('/api/contacts-clics', { method: 'POST', body: corps, headers: { 'Content-Type': 'application/json' }, keepalive: true }).catch(() => {})
        }
      } catch { /* une mesure ratée ne doit jamais gêner le visiteur */ }
    }
    // `capture` : compté même si un composant arrête la propagation du clic.
    document.addEventListener('click', auClic, true)
    return () => document.removeEventListener('click', auClic, true)
  }, [])

  return null
}
