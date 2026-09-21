import { estAdresseBelge } from '@/lib/calcPrix'

/**
 * Géocodage et distances routières — implémentation unique.
 *
 * Les routes `/api/geocode` et `/api/distance` sont de simples guichets HTTP
 * au-dessus de ces fonctions ; les Server Actions les appellent directement.
 * Une seule implémentation, pour qu'un prix calculé côté serveur repose
 * exactement sur les mêmes adresses et les mêmes distances que celui affiché
 * au client.
 */

const GOOGLE_KEY = process.env.GOOGLE_MAPS_KEY ?? ''

export type PointGeo = { lat: number; lng: number; codePostal: string; label: string }

/**
 * Résout une adresse écrite en toutes lettres.
 *
 * La France abrite des homonymes des villes belges desservies (Bruxelles →
 * hameau de Dammarie-sur-Loing, Tournai → commune de l'Orne). Chercher en
 * France d'abord réussissait donc, et renvoyait un lieu à 400–500 km de la
 * destination réelle. Quand le libellé désigne une destination belge, on
 * cherche en Belgique en premier et on ne se rabat jamais sur la France.
 */
export async function geocoderAdresse(q: string): Promise<PointGeo | { error: string }> {
  if (!q || q.length < 2) return { error: 'missing_query' }
  if (!GOOGLE_KEY) return { error: 'no_key' }

  try {
    // L'API Geocoding n'accepte qu'un seul pays par filtre « components » —
    // un « country:FR|country:BE » est mal interprété et retombe sur la France.
    async function geocodeIn(country: 'FR' | 'BE') {
      const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
      url.searchParams.set('address',    q)
      url.searchParams.set('key',        GOOGLE_KEY)
      url.searchParams.set('language',   'fr')
      url.searchParams.set('components', `country:${country}`)
      const res = await fetch(url.toString(), { next: { revalidate: 0 } })
      return res.json()
    }

    const isWeakMatch = (j: any) =>
      j.status !== 'OK' || !j.results?.[0] || (j.results[0].types ?? []).includes('country')

    const belge = estAdresseBelge(q)
    const [premier, second] = belge ? ['BE', 'FR'] as const : ['FR', 'BE'] as const
    let json = await geocodeIn(premier)
    if (isWeakMatch(json) && !belge) {
      const autre = await geocodeIn(second)
      if (!isWeakMatch(autre)) json = autre
    }

    if (json.status !== 'OK' || !json.results?.[0]) return { error: json.status ?? 'no_result' }

    const result = json.results[0]
    const lat = result.geometry?.location?.lat ?? null
    const lng = result.geometry?.location?.lng ?? null
    const cpComp = (result.address_components ?? []).find((c: any) => c.types.includes('postal_code'))
    let codePostal = cpComp?.long_name ?? ''

    // Une requête « ville » ne porte pas de code postal : on le retrouve par
    // géocodage inverse sur les coordonnées.
    if (!codePostal && lat && lng) {
      try {
        const rUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json')
        rUrl.searchParams.set('latlng',      `${lat},${lng}`)
        rUrl.searchParams.set('key',         GOOGLE_KEY)
        rUrl.searchParams.set('language',    'fr')
        rUrl.searchParams.set('result_type', 'postal_code')
        const rJson = await (await fetch(rUrl.toString(), { next: { revalidate: 0 } })).json()
        const cp = (rJson.results?.[0]?.address_components ?? []).find((c: any) => c.types.includes('postal_code'))
        if (cp) codePostal = cp.long_name
      } catch {}
    }

    if (lat === null || lng === null) return { error: 'no_result' }
    return { lat, lng, codePostal, label: result.formatted_address ?? q }
  } catch {
    return { error: 'fetch_error' }
  }
}

/** Distance routière entre deux points, en kilomètres, ou `null` si Google ne répond pas. */
export async function distanceRoutiereKm(
  depart: { lat: number; lng: number },
  arrivee: { lat: number; lng: number },
): Promise<number | null> {
  if (!GOOGLE_KEY) return null
  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json')
    url.searchParams.set('origins',      `${depart.lat},${depart.lng}`)
    url.searchParams.set('destinations', `${arrivee.lat},${arrivee.lng}`)
    url.searchParams.set('mode',         'driving')
    url.searchParams.set('language',     'fr')
    url.searchParams.set('key',          GOOGLE_KEY)
    const json = await (await fetch(url.toString(), { next: { revalidate: 0 } })).json()
    const metres = json.rows?.[0]?.elements?.[0]?.distance?.value
    if (!metres) return null
    return Math.round(metres / 100) / 10
  } catch {
    return null
  }
}

/**
 * Kilomètres qu'un ou plusieurs arrêts ajoutent réellement au trajet :
 * (somme des tronçons) − (trajet direct). Renvoie `null` si une distance
 * manque, pour que l'appelant sache qu'il ne peut pas la facturer.
 */
export async function detourKm(
  depart: string, etapes: string[], arrivee: string,
): Promise<{ directe: number; troncons: number[] } | null> {
  const points = await Promise.all([depart, ...etapes, arrivee].map(geocoderAdresse))
  if (points.some(p => 'error' in p)) return null
  const ok = points as PointGeo[]

  const [troncons, directe] = await Promise.all([
    Promise.all(ok.slice(0, -1).map((p, i) => distanceRoutiereKm(p, ok[i + 1]))),
    distanceRoutiereKm(ok[0], ok[ok.length - 1]),
  ])
  if (directe === null || troncons.some(d => d === null)) return null
  return { directe, troncons: troncons as number[] }
}
