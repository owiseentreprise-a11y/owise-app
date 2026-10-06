// Client Google Business Profile — gestion des tokens OAuth et publication de posts

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GBP_BASE  = 'https://mybusiness.googleapis.com/v4'

export async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      // .trim() pour la meme raison que GBP_AUTO_PUBLISH : un reglage recopie
      // a la main peut arriver avec un espace ou un retour a la ligne en plus,
      // et un jeton ainsi suivi est refuse par Google sans explication utile.
      client_id:     (process.env.GBP_CLIENT_ID     ?? '').trim(),
      client_secret: (process.env.GBP_CLIENT_SECRET ?? '').trim(),
      refresh_token: (process.env.GBP_REFRESH_TOKEN ?? '').trim(),
      grant_type:    'refresh_token',
    }),
  })
  if (!res.ok) throw new Error(`Token refresh failed: ${await res.text()}`)
  const json = await res.json() as { access_token: string }
  return json.access_token
}

export type GbpPostPayload = {
  summary:       string
  callToAction?: { actionType: 'BOOK' | 'CALL' | 'LEARN_MORE' | 'ORDER'; url?: string }
  topicType:     'STANDARD' | 'EVENT' | 'OFFER'
  languageCode:  string
}

/**
 * Retire le prefixe « accounts/ » ou « locations/ » s'il est deja la.
 *
 * Google affiche ces identifiants sous leur forme complete — « accounts/123 »,
 * « locations/456 » — et c'est donc sous cette forme qu'ils ont ete recopies
 * dans les reglages. Le code recollait son propre prefixe par-dessus et
 * appelait /accounts/accounts/123/locations/locations/456 : un 404 systematique.
 *
 * Mesure du 2026-10-06 : l'adresse recollee repond 404, la meme sans le
 * doublon repond 200 et rend les 13 publications de la fiche. On accepte donc
 * les deux ecritures plutot que de dependre de la facon dont un reglage a ete
 * recopie un jour.
 */
export function idNu(valeur: string | undefined): string {
  return (valeur ?? '').trim().replace(/^(?:accounts|locations)\//, '')
}

export async function publishGbpPost(payload: GbpPostPayload): Promise<{ name: string }> {
  const token      = await getAccessToken()
  const accountId  = idNu(process.env.GBP_ACCOUNT_ID)
  const locationId = idNu(process.env.GBP_LOCATION_ID)

  const res = await fetch(
    `${GBP_BASE}/accounts/${accountId}/locations/${locationId}/localPosts`,
    {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    }
  )
  if (!res.ok) throw new Error(`GBP post failed: ${await res.text()}`)
  return res.json() as Promise<{ name: string }>
}
