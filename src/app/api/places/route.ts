import { NextRequest, NextResponse } from 'next/server'
import { refuser, adresseVisiteur } from '@/lib/quota'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY ?? ''

// Rate limiting simple en mémoire (réinitialisé à chaque cold start — suffisant pour limiter les abus)

export async function GET(req: NextRequest) {
  const ip = adresseVisiteur(req)
  if (refuser('places', ip)) {
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
    // FR + BE : élargi pour les trajets longue distance Nord/Belgique (zones LILLE/BXL)
    url.searchParams.set('components',  'country:fr|country:be')
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
