import { NextRequest, NextResponse } from 'next/server'
import { estAdresseBelge } from '@/lib/calcPrix'

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
    // L'API Geocoding (contrairement à Places Autocomplete) n'accepte qu'un seul
    // pays par filtre "components" — un "country:FR|country:BE" est mal interprété
    // et retombe sur "France" en entier. On tente FR d'abord (l'essentiel des
    // adresses), puis BE en repli si FR échoue ou ne renvoie qu'un match de pays
    // entier (signe que l'adresse n'est pas française — ex: une ville belge).
    async function geocodeIn(country: 'FR' | 'BE') {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('address',    q)
      url.searchParams.set('key',        GOOGLE_KEY)
      url.searchParams.set('language',   'fr')
      url.searchParams.set('components', `country:${country}`)
      const res  = await fetch(url.toString(), { next: { revalidate: 0 } })
      return res.json()
    }

    const isWeakMatch = (j: any) =>
      j.status !== 'OK' || !j.results?.[0] || (j.results[0].types ?? []).includes('country')

    // Le repli « FR d'abord, BE si FR échoue » ne suffit pas : la France a des
    // homonymes des villes belges (Bruxelles → hameau de Dammarie-sur-Loing,
    // Tournai → commune de l'Orne, Mouscron → lieu-dit de Willems). La
    // recherche française réussissait donc, et renvoyait un lieu à 400-500 km
    // de la destination réelle — prix juste par chance, adresse fausse dans la
    // course, la confirmation client et l'application chauffeur.
    // Quand le libellé désigne une destination belge desservie, on cherche en
    // Belgique en premier. (Constaté et corrigé le 2026-09-19.)
    const belge = estAdresseBelge(q)
    const [premier, second] = belge ? ['BE', 'FR'] as const : ['FR', 'BE'] as const
    let json = await geocodeIn(premier)
    // Pour un libellé belge, ne jamais se rabattre sur la France : si la
    // Belgique ne sait pas résoudre l'adresse, un homonyme français est
    // forcément faux. « Belgique » seul renvoyait ainsi un lieu-dit du Quesnoy.
    if (isWeakMatch(json) && !belge) {
      const autre = await geocodeIn(second)
      if (!isWeakMatch(autre)) json = autre
    }

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
