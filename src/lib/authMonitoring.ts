import * as Sentry from '@sentry/nextjs'
import type { AuthError } from '@supabase/supabase-js'

/**
 * Capture les échecs de connexion anormaux (clé API désactivée, rate limit,
 * panne Supabase...) sans bruiter Sentry avec les mauvais mots de passe normaux.
 * Né de l'incident du 2026-06-22 : une clé anon legacy désactivée en prod a
 * bloqué tous les logins admin sans qu'aucune alerte ne se déclenche.
 */
export function reportAuthFailureIfAbnormal(error: AuthError | null, context: string) {
  if (!error) return
  if (error.message === 'Invalid login credentials') return
  Sentry.captureMessage(`Échec de connexion anormal (${context}): ${error.message}`, {
    level: 'error',
    extra: { status: error.status, code: error.code, context },
  })
}
