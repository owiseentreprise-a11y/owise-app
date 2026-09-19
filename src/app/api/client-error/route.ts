import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Reçoit les erreurs JavaScript survenues dans l'interface admin et les écrit
 * dans les logs serveur, où elles deviennent visibles dans Vercel.
 *
 * Raison d'être : un plantage côté navigateur ne laisse aucune trace côté
 * serveur. Sans ce relais, un bug intermittent est indiagnosticable — on ne
 * peut que reconstituer après coup, ce qui n'a pas marché.
 *
 * Réservé aux utilisateurs authentifiés : sinon l'endpoint devient un moyen
 * de polluer les logs depuis l'extérieur.
 */

const MAX_CHAMP = 2000

// Limite grossière par instance, suffisante pour éviter une boucle d'erreur
// qui inonderait les logs (une erreur dans un rendu peut se répéter sans fin).
let fenetre = { debut: Date.now(), compte: 0 }
const MAX_PAR_MINUTE = 20

function tronquer(v: unknown): string {
  return typeof v === 'string' ? v.slice(0, MAX_CHAMP) : ''
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false }, { status: 401 })

  const maintenant = Date.now()
  if (maintenant - fenetre.debut > 60_000) fenetre = { debut: maintenant, compte: 0 }
  if (++fenetre.compte > MAX_PAR_MINUTE) return NextResponse.json({ ok: true, ignore: true })

  let corps: Record<string, unknown>
  try {
    corps = await req.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }

  // Un seul console.error par erreur : c'est ce que Vercel remonte dans
  // « Runtime Errors », consultable ensuite sans accès au navigateur.
  console.error('[ERREUR CLIENT ADMIN]', JSON.stringify({
    type:      tronquer(corps.type),
    message:   tronquer(corps.message),
    url:       tronquer(corps.url),
    pile:      tronquer(corps.stack),
    userAgent: tronquer(req.headers.get('user-agent') ?? ''),
    user:      user.id,
    horodate:  new Date().toISOString(),
  }))

  return NextResponse.json({ ok: true })
}
