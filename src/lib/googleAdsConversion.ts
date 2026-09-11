const CLIENT_ID            = process.env.GOOGLE_ADS_CLIENT_ID
const CLIENT_SECRET        = process.env.GOOGLE_ADS_CLIENT_SECRET
const REFRESH_TOKEN        = process.env.GOOGLE_ADS_REFRESH_TOKEN
const CUSTOMER_ID          = process.env.GOOGLE_ADS_CUSTOMER_ID          // 4214247131 (owise ads)
const CONVERSION_ACTION_ID = process.env.GOOGLE_ADS_CONVERSION_ACTION_ID // 7755290851 ("Réservation VTC payée")

export type AdsConsent = 'accepted' | 'refused' | 'unknown'

function toConsentStatus(consent: AdsConsent | undefined) {
  if (consent === 'accepted') return 'CONSENT_GRANTED'
  if (consent === 'refused')  return 'CONSENT_DENIED'
  return 'CONSENT_STATUS_UNSPECIFIED'
}

async function getAccessToken(): Promise<string | null> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     CLIENT_ID!,
      client_secret: CLIENT_SECRET!,
      refresh_token: REFRESH_TOKEN!,
      grant_type:    'refresh_token',
    }),
  })
  const json = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    console.error('[GoogleAdsConversion] Échec refresh token:', json.error, json.error_description)
    return null
  }
  return json.access_token
}

/**
 * Remonte une conversion "achat" à Google Ads via la Data Manager API
 * (POST /v1/events:ingest), à partir du gclid capturé au clic sur l'annonce
 * et stocké avec la commande.
 *
 * Complète (ne remplace pas) le tag gtag côté client de PurchaseEvent.tsx, qui
 * lui ne se déclenche que si le visiteur a explicitement accepté les cookies.
 * Ici, la conversion est systématiquement remontée avec le statut de consentement
 * réel (accepted/refused/unknown) via le champ `consent` — conforme aux règles
 * Google Ads sur le reporting de conversions serveur en Europe.
 *
 * Remplace l'ancienne ConversionUploadService (Google Ads API), fermée aux
 * nouvelles intégrations depuis le 15 juin 2026 au profit de cette API unifiée.
 * Le refresh token doit avoir été obtenu avec les scopes "adwords" ET
 * "datamanager" ensemble (voir GOOGLE_ADS_REFRESH_TOKEN).
 */
export async function uploadGoogleAdsConversion(params: {
  gclid: string | null | undefined
  value: number
  currency?: string
  conversionDateTime: Date
  orderId?: string
  consent?: AdsConsent
}): Promise<void> {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN || !CUSTOMER_ID || !CONVERSION_ACTION_ID) {
    console.warn('[GoogleAdsConversion] Variables GOOGLE_ADS_* manquantes — upload ignoré')
    return
  }
  if (!params.gclid) {
    // Pas de gclid = la commande ne vient pas d'un clic Google Ads, rien à remonter
    return
  }

  try {
    const accessToken = await getAccessToken()
    if (!accessToken) return

    const consentStatus = toConsentStatus(params.consent)
    const body = {
      destinations: [{
        operatingAccount: { accountType: 'GOOGLE_ADS', accountId: CUSTOMER_ID },
        productDestinationId: CONVERSION_ACTION_ID,
      }],
      events: [{
        adIdentifiers:  { gclid: params.gclid },
        conversionValue: params.value,
        currency:        params.currency ?? 'EUR',
        eventTimestamp:  params.conversionDateTime.toISOString(),
        transactionId:   params.orderId ?? `owise-${Date.now()}`,
        eventSource:     'WEB',
      }],
      consent: {
        adUserData:       consentStatus,
        adPersonalization: consentStatus,
      },
      validateOnly: false,
    }

    const res = await fetch('https://datamanager.googleapis.com/v1/events:ingest', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[GoogleAdsConversion] Échec ingest:', res.status, err)
      return
    }
    const json = await res.json()
    if (json.fieldWarnings?.length) {
      console.warn('[GoogleAdsConversion] Avertissements:', JSON.stringify(json.fieldWarnings))
    }
  } catch (err) {
    console.error('[GoogleAdsConversion] Échec upload:', err)
  }
}
