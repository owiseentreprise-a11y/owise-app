import Stripe from 'stripe'

/**
 * Nettoie une clé venant d'une variable d'environnement.
 *
 * Une clé collée dans l'interface Vercel ou recopiée depuis un fichier peut
 * traîner un BOM en tête, ou une espace / un retour à la ligne en fin. Ces
 * caractères sont invisibles mais interdits dans un en-tête HTTP : la requête
 * part en `TypeError: Invalid character in header content ["Authorization"]`,
 * que le SDK Stripe présente comme une banale erreur de connexion.
 *
 * Constaté en production le 2026-09-13 sur genererLienPaiementAction
 * (/admin/courses/[id]) : 2 échecs de génération de lien de paiement. Le BOM
 * seul était retiré depuis le 2026-05-31 ; la fin de chaîne, non.
 */
export function nettoyerCleEnv(brut: string | undefined): string {
  return (brut ?? '').replace(/^﻿/, '').trim()
}

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(nettoyerCleEnv(process.env.STRIPE_SECRET_KEY), {
      apiVersion: '2025-01-27.acacia' as any,
    })
  }
  return _stripe
}

// Proxy pour garder la syntaxe `stripe.xxx` dans les fichiers existants
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop) {
    return getStripe()[prop as keyof Stripe]
  },
})
