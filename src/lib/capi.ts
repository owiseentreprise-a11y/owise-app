import { createHash } from 'crypto'

const PIXEL_ID   = '1688600002292509'
const CAPI_TOKEN = process.env.META_CAPI_ACCESS_TOKEN

function sha256(value: string) {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

interface CapiUserData {
  email?     : string
  phone?     : string
  firstName? : string
  lastName?  : string
  clientIp?  : string
  userAgent? : string
  fbp?       : string
  fbc?       : string
}

interface CapiEventParams {
  eventName    : string
  eventId      : string
  eventTime?   : number
  sourceUrl    : string
  userData?    : CapiUserData
  customData?  : Record<string, unknown>
}

export async function sendCapiEvent(params: CapiEventParams): Promise<void> {
  if (!CAPI_TOKEN) {
    console.warn('[CAPI] META_CAPI_ACCESS_TOKEN manquant — événement ignoré')
    return
  }

  const eventTime = params.eventTime ?? Math.floor(Date.now() / 1000)
  const { userData = {} } = params

  const userDataPayload: Record<string, string | undefined> = {
    em:         userData.email     ? sha256(userData.email)     : undefined,
    ph:         userData.phone     ? sha256(userData.phone)     : undefined,
    fn:         userData.firstName ? sha256(userData.firstName) : undefined,
    ln:         userData.lastName  ? sha256(userData.lastName)  : undefined,
    client_ip_address: userData.clientIp,
    client_user_agent: userData.userAgent,
    fbp:        userData.fbp,
    fbc:        userData.fbc,
  }

  // Supprimer les clés undefined
  const cleanUserData = Object.fromEntries(
    Object.entries(userDataPayload).filter(([, v]) => v !== undefined)
  )

  const body = JSON.stringify({
    data: [{
      event_name:  params.eventName,
      event_time:  eventTime,
      event_id:    params.eventId,
      event_source_url: params.sourceUrl,
      action_source: 'website',
      user_data:   cleanUserData,
      custom_data: params.customData ?? {},
    }],
  })

  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${CAPI_TOKEN}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('[CAPI] Erreur API Meta:', err)
    }
  } catch (err) {
    console.error('[CAPI] Échec envoi événement:', err)
  }
}

export function capiLead(params: {
  eventId  : string
  email?   : string
  phone?   : string
  firstName?: string
  lastName?: string
  value?   : number
  currency?: string
}) {
  return sendCapiEvent({
    eventName : 'Lead',
    eventId   : params.eventId,
    sourceUrl : 'https://owise.fr',
    userData  : {
      email     : params.email,
      phone     : params.phone,
      firstName : params.firstName,
      lastName  : params.lastName,
    },
    customData: {
      ...(params.value    !== undefined && { value: params.value }),
      ...(params.currency !== undefined && { currency: params.currency }),
      content_category: 'VTC',
    },
  })
}

export function capiPurchase(params: {
  eventId  : string
  value    : number
  currency?: string
  email?   : string
  phone?   : string
  firstName?: string
  lastName?: string
}) {
  return sendCapiEvent({
    eventName : 'Purchase',
    eventId   : params.eventId,
    sourceUrl : 'https://owise.fr/reserver',
    userData  : {
      email     : params.email,
      phone     : params.phone,
      firstName : params.firstName,
      lastName  : params.lastName,
    },
    customData: {
      value    : params.value,
      currency : params.currency ?? 'EUR',
      content_category: 'VTC',
    },
  })
}
