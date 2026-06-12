import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const hits = new Map<string, { count: number; reset: number }>()
const LIMIT  = 10
const WINDOW = 60

function isRateLimited(ip: string): boolean {
  const now = Math.floor(Date.now() / 1000)
  const entry = hits.get(ip)
  if (!entry || entry.reset <= now) {
    hits.set(ip, { count: 1, reset: now + WINDOW })
    return false
  }
  entry.count++
  return entry.count > LIMIT
}

const VEHICULES_VALIDES = ['berline', 'berline_premium', 'van', 'grand_van']

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const { adresse_depart, adresse_arrivee, vehicule, prix, source } = body as Record<string, unknown>

  if (typeof adresse_depart !== 'string' || typeof adresse_arrivee !== 'string') {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const dep = adresse_depart.trim().slice(0, 500)
  const arr = adresse_arrivee.trim().slice(0, 500)

  if (dep.length < 3 || arr.length < 3) {
    return NextResponse.json({ error: 'too_short' }, { status: 400 })
  }

  const prixNum = typeof prix === 'number' && isFinite(prix) && prix >= 0 ? Math.round(prix) : null
  const vehiculeVal = typeof vehicule === 'string' && VEHICULES_VALIDES.includes(vehicule) ? vehicule : null
  const sourceVal = source === 'reservation' ? 'reservation' : 'vitrine'

  const supabase = createAdminClient()
  await supabase.from('estimations').insert({
    adresse_depart:  dep,
    adresse_arrivee: arr,
    vehicule:        vehiculeVal,
    prix:            prixNum,
    source:          sourceVal,
  })

  return NextResponse.json({ ok: true }, { status: 201 })
}
