import { NextRequest, NextResponse } from 'next/server'
import { refuser, adresseVisiteur } from '@/lib/quota'
import { geocoderAdresse } from '@/lib/geo'


// GET /api/geocode?q=adresse
// Returns { lat, lng, codePostal, label }
// La résolution elle-même vit dans @/lib/geo, partagée avec les Server Actions.
export async function GET(req: NextRequest) {
  const ip = adresseVisiteur(req)
  if (refuser('geocode', ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  const q = req.nextUrl.searchParams.get('q') ?? ''
  if (!q || q.length < 2) return NextResponse.json({ error: 'missing_query' }, { status: 400 })

  const point = await geocoderAdresse(q)
  return NextResponse.json(point)
}
