import { searchLieux, LieuSuggestion } from './lieux'

export type AddressSuggestion = {
  label:      string
  sublabel:   string
  isLieu:     boolean
  placeId?:   string       // Google place_id (pour fetchDetails)
  isGoogle:   boolean
  lat?:       number
  lng?:       number
  codePostal?: string
}

export type AddressDetails = {
  label:      string
  codePostal: string
  lat?:       number
  lng?:       number
}

let _sessionToken = ''
function getSessionToken() {
  if (!_sessionToken) _sessionToken = Math.random().toString(36).slice(2)
  return _sessionToken
}
function resetSessionToken() { _sessionToken = '' }

// ── Recherche principale ────────────────────────────────────────────────────
export async function searchAddresses(q: string): Promise<AddressSuggestion[]> {
  if (q.length < 2) return []

  // 1. Landmarks locaux en priorité (instantané, pas d'API)
  const lieux: AddressSuggestion[] = searchLieux(q).map(l => ({
    label:      l.label,
    sublabel:   l.sublabel,
    isLieu:     true,
    isGoogle:   false,
    lat:        l.lat,
    lng:        l.lng,
    codePostal: l.codePostal,
  }))

  // 2. Google Places via proxy
  const googleResults = await fetchGooglePlaces(q)
  return [...lieux, ...googleResults].slice(0, 7)
}

// ── Récupérer lat/lng + code postal d'un lieu Google ───────────────────────
export async function fetchPlaceDetails(placeId: string): Promise<AddressDetails | null> {
  try {
    const token = getSessionToken()
    resetSessionToken()  // Nouveau token après sélection (billing session)
    const res  = await fetch(`/api/places/details?place_id=${encodeURIComponent(placeId)}&sessiontoken=${token}`)
    const json = await res.json()
    if (json.error) return null
    return { label: json.address, codePostal: json.codePostal ?? '', lat: json.lat, lng: json.lng }
  } catch {
    return null
  }
}

// ── Google Places Autocomplete (via proxy) ──────────────────────────────────
async function fetchGooglePlaces(q: string): Promise<AddressSuggestion[]> {
  try {
    const token = getSessionToken()
    const res   = await fetch(`/api/places?q=${encodeURIComponent(q)}&sessiontoken=${token}`)
    const json  = await res.json()
    if (json.error === 'no_key' || !json.predictions?.length) return []

    return json.predictions.map((p: any) => ({
      label:    p.description,
      sublabel: p.secondary ?? '',
      isLieu:   isLieuType(p.types),
      placeId:  p.place_id,
      isGoogle: true,
    }))
  } catch {
    return []
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────
function isLieuType(types: string[]): boolean {
  return types?.some(t => ['airport', 'train_station', 'transit_station', 'stadium',
    'amusement_park', 'point_of_interest', 'establishment'].includes(t)) ?? false
}

export function getSuggestionIcon(s: AddressSuggestion): string {
  if (!s.isGoogle && s.isLieu) {
    const l = s.label.toLowerCase()
    if (l.includes('aéroport') || l.includes('aeroport')) return '✈️'
    if (l.includes('gare')) return '🚆'
    return '📍'
  }
  if (s.isGoogle && s.isLieu) return '📍'
  return '📍'
}
