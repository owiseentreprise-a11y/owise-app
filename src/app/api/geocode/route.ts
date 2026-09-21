import { NextRequest, NextResponse } from 'next/server'
import { geocoderAdresse } from '@/lib/geo'

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
// La résolution elle-même vit dans @/lib/geo, partagée avec les Server Actions.
export async function GET(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q || q.length < 2) return NextResponse.json({ error: 'missing_query' }, { status: 400 })

  const point = await geocoderAdresse(q)
  return NextResponse.json(point)
}
