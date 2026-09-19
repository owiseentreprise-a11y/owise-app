'use client'

import { useEffect } from 'react'

/**
 * Remonte au serveur les erreurs JavaScript de l'interface admin.
 *
 * Trois sources, choisies pour couvrir ce qu'un plantage silencieux produit
 * réellement : une exception non rattrapée, une promesse rejetée sans catch,
 * et un échec d'hydratation React — ce dernier n'étant qu'un console.error,
 * il n'apparaît dans aucun gestionnaire d'erreur standard.
 *
 * Volontairement muet à l'écran : on collecte, on ne dérange pas l'admin.
 */

const MOTIFS_HYDRATATION = [
  'Hydration failed',
  'hydration',
  'did not match',
  'Text content does not match',
  'server rendered HTML',
]

export default function ErrorReporter() {
  useEffect(() => {
    // Même erreur répétée = un seul envoi, sinon une erreur dans un rendu
    // boucle et inonde les logs.
    const dejaVues = new Set<string>()

    const envoyer = (type: string, message: string, stack?: string) => {
      const cle = `${type}|${message}`.slice(0, 300)
      if (dejaVues.has(cle)) return
      dejaVues.add(cle)

      // keepalive : l'envoi survit à une navigation ou à un rechargement,
      // ce qui est précisément ce qui arrive quand la page « plante ».
      fetch('/api/client-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, message, stack, url: location.href }),
        keepalive: true,
      }).catch(() => {})
    }

    const surErreur = (e: ErrorEvent) => {
      envoyer('exception', e.message, e.error?.stack)
    }

    const surRejet = (e: PromiseRejectionEvent) => {
      const r = e.reason
      envoyer('promesse-rejetee', r?.message ?? String(r), r?.stack)
    }

    // React signale les échecs d'hydratation par console.error uniquement.
    const consoleErrorOrigine = console.error
    console.error = (...args: unknown[]) => {
      consoleErrorOrigine.apply(console, args as [])
      try {
        const texte = args.map(a => (a instanceof Error ? a.message : String(a))).join(' ')
        if (MOTIFS_HYDRATATION.some(m => texte.toLowerCase().includes(m.toLowerCase()))) {
          envoyer('hydratation', texte.slice(0, 1500))
        }
      } catch { /* ne jamais casser console.error */ }
    }

    window.addEventListener('error', surErreur)
    window.addEventListener('unhandledrejection', surRejet)

    return () => {
      window.removeEventListener('error', surErreur)
      window.removeEventListener('unhandledrejection', surRejet)
      console.error = consoleErrorOrigine
    }
  }, [])

  return null
}
