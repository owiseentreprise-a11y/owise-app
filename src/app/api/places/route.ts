import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY ?? ''

// Rate limiting simple en mémoire (réinitialisé à chaque cold start — suffisant pour limiter les abus)
const hits = new Map<string, { count: number; reset: number }>()
const LIMIT = 60   // requêtes max
const WINDOW = 60  // secondes

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

export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return NextResponse.json({ predictions: [], error: 'rate_limited' }, { status: 429 })
  }

  const q     = req.nextUrl.searchParams.get('q') ?? ''
  const token = req.nextUrl.searchParams.get('sessiontoken') ?? ''

  if (!q || q.length < 2) {
    return NextResponse.json({ predictions: [] })
  }

  if (!GOOGLE_KEY) {
    return NextResponse.json({ predictions: [], error: 'no_key' }, { status: 200 })
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
    url.searchParams.set('input',       q)
    url.searchParams.set('key',         GOOGLE_KEY)
    url.searchParams.set('language',    'fr')
    url.searchParams.set('components',  'country:fr')
    url.searchParams.set('types',       'geocode|establishment')
    if (token) url.searchParams.set('sessiontoken', token)

    const res  = await fetch(url.toString(), { next: { revalidate: 0 } })
    const json = await res.json()

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
      return NextResponse.json({ predictions: [], error: json.status }, { status: 200 })
    }

    return NextResponse.json({
      predictions: (json.predictions ?? []).map((p: any) => ({
        place_id:     p.place_id,
        description:  p.description,
        main:         p.structured_formatting?.main_text ?? p.description,
        secondary:    p.structured_formatting?.secondary_text ?? '',
        types:        p.types ?? [],
      })),
    })
  } catch {
    return NextResponse.json({ predictions: [], error: 'fetch_error' }, { status: 200 })
  }
}
