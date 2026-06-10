import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY ?? ''

const hits = new Map<string, { count: number; reset: number }>()
const LIMIT  = 120
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

// GET /api/distance?olat=&olng=&dlat=&dlng=
// Returns { km: number } — distance routière Google Distance Matrix
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const { searchParams } = req.nextUrl
  const olat = searchParams.get('olat')
  const olng = searchParams.get('olng')
  const dlat = searchParams.get('dlat')
  const dlng = searchParams.get('dlng')

  if (!olat || !olng || !dlat || !dlng) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  if (!GOOGLE_KEY) return NextResponse.json({ error: 'no_key' }, { status: 200 })

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins',      `${olat},${olng}`)
    url.searchParams.set('destinations', `${dlat},${dlng}`)
    url.searchParams.set('mode',         'driving')
    url.searchParams.set('language',     'fr')
    url.searchParams.set('key',          GOOGLE_KEY)

    const res  = await fetch(url.toString(), { next: { revalidate: 0 } })
    const json = await res.json()

    const meters = json.rows?.[0]?.elements?.[0]?.distance?.value
    if (!meters) return NextResponse.json({ error: json.rows?.[0]?.elements?.[0]?.status ?? 'no_result' }, { status: 200 })

    const km = Math.round(meters / 100) / 10
    return NextResponse.json({ km })
  } catch {
    return NextResponse.json({ error: 'fetch_error' }, { status: 200 })
  }
}
