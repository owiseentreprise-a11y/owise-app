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

// GET /api/geocode?q=adresse
// Returns { lat, lng, codePostal, label }
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q || q.length < 2) return NextResponse.json({ error: 'missing_query' }, { status: 400 })

  if (!GOOGLE_KEY) return NextResponse.json({ error: 'no_key' }, { status: 200 })

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address',    q)
    url.searchParams.set('key',        GOOGLE_KEY)
    url.searchParams.set('language',   'fr')
    url.searchParams.set('components', 'country:FR')

    const res  = await fetch(url.toString(), { next: { revalidate: 0 } })
    const json = await res.json()

    if (json.status !== 'OK' || !json.results?.[0]) {
      return NextResponse.json({ error: json.status ?? 'no_result' }, { status: 200 })
    }

    const result = json.results[0]
    const lat = result.geometry?.location?.lat ?? null
    const lng = result.geometry?.location?.lng ?? null
    const cpComp = (result.address_components ?? []).find(
      (c: any) => c.types.includes('postal_code')
    )
    let codePostal = cpComp?.long_name ?? ''

    // Si pas de code postal sur la réponse directe (requête ville ex: "Creil, France"),
    // on fait un reverse-geocode sur les coordonnées pour récupérer le code postal
    if (!codePostal && lat && lng) {
      try {
        const rUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
        rUrl.searchParams.set('latlng',      `${lat},${lng}`)
        rUrl.searchParams.set('key',         GOOGLE_KEY)
        rUrl.searchParams.set('language',    'fr')
        rUrl.searchParams.set('result_type', 'postal_code')
        const rRes  = await fetch(rUrl.toString(), { next: { revalidate: 0 } })
        const rJson = await rRes.json()
        if (rJson.results?.[0]) {
          const cp = (rJson.results[0].address_components ?? []).find(
            (c: any) => c.types.includes('postal_code')
          )
          if (cp) codePostal = cp.long_name
        }
      } catch {}
    }

    return NextResponse.json({ lat, lng, codePostal, label: result.formatted_address ?? q })
  } catch {
    return NextResponse.json({ error: 'fetch_error' }, { status: 200 })
  }
}
