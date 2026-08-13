// Client Google Business Profile — gestion des tokens OAuth et publication de posts

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GBP_BASE  = 'https://mybusiness.googleapis.com/v4'

export async function getAccessToken(): Promise<string> {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     process.env.GBP_CLIENT_ID     ?? '',
      client_secret: process.env.GBP_CLIENT_SECRET ?? '',
      refresh_token: process.env.GBP_REFRESH_TOKEN ?? '',
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

export async function publishGbpPost(payload: GbpPostPayload): Promise<{ name: string }> {
  const token      = await getAccessToken()
  const accountId  = process.env.GBP_ACCOUNT_ID  ?? ''
  const locationId = process.env.GBP_LOCATION_ID ?? ''

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
