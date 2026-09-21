import { NextRequest, NextResponse } from 'next/server'
import { refuser, adresseVisiteur } from '@/lib/quota'
import { distanceRoutiereKm } from '@/lib/geo'


// GET /api/distance?olat=&olng=&dlat=&dlng=
// Returns { km: number } — distance routière Google Distance Matrix.
// La mesure elle-même vit dans @/lib/geo, partagée avec les Server Actions.
export async function GET(req: NextRequest) {
  const ip = adresseVisiteur(req)
  if (refuser('distance', ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

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
