import { NextRequest, NextResponse } from 'next/server'
import { distanceRoutiereKm } from '@/lib/geo'

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
// Returns { km: number } — distance routière Google Distance Matrix.
// La mesure elle-même vit dans @/lib/geo, partagée avec les Server Actions.
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

  const km = await distanceRoutiereKm(
    { lat: Number(olat), lng: Number(olng) },
    { lat: Number(dlat), lng: Number(dlng) },
  )
  if (km === null) return NextResponse.json({ error: 'no_result' }, { status: 200 })
  return NextResponse.json({ km })
}
