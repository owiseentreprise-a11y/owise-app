import { NextRequest, NextResponse } from 'next/server'

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY ?? process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY ?? ''

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get('place_id') ?? ''
  const token   = req.nextUrl.searchParams.get('sessiontoken') ?? ''

  if (!placeId || !GOOGLE_KEY) {
    return NextResponse.json({ error: 'missing_params' }, { status: 400 })
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
    url.searchParams.set('place_id', placeId)
    url.searchParams.set('key',      GOOGLE_KEY)
    url.searchParams.set('fields',   'geometry,formatted_address,address_components')
    url.searchParams.set('language', 'fr')
    if (token) url.searchParams.set('sessiontoken', token)

    const res  = await fetch(url.toString(), { next: { revalidate: 0 } })
    const json = await res.json()

    if (json.status !== 'OK') {
      return NextResponse.json({ error: json.status }, { status: 200 })
    }

    const result = json.result
    const lat = result.geometry?.location?.lat ?? null
    const lng = result.geometry?.location?.lng ?? null

    // Extraire le code postal depuis address_components
    const cpComp = (result.address_components ?? []).find(
      (c: any) => c.types.includes('postal_code')
    )
    const codePostal = cpComp?.long_name ?? ''

    return NextResponse.json({ lat, lng, codePostal, address: result.formatted_address ?? '' })
  } catch {
    return NextResponse.json({ error: 'fetch_error' }, { status: 200 })
  }
}
