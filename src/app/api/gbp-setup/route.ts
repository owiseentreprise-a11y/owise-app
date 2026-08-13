// Endpoint one-shot pour découvrir le Account ID et Location ID GBP
// Usage : GET /api/gbp-setup?secret=TON_CRON_SECRET
// À désactiver / supprimer après la configuration initiale

import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/gbpClient'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const secret = process.env.CRON_SECRET
  if (secret && searchParams.get('secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const missing = ['GBP_CLIENT_ID', 'GBP_CLIENT_SECRET', 'GBP_REFRESH_TOKEN'].filter(k => !process.env[k])
  if (missing.length > 0) {
    return NextResponse.json({ error: `Variables manquantes: ${missing.join(', ')}` }, { status: 503 })
  }

  try {
    const token = await getAccessToken()

    // Lister les comptes GBP
    const accountsRes = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
      headers: { Authorization: `Bearer ${token}` },
    })
    const accountsData = await accountsRes.json() as { accounts?: Array<{ name: string; accountName: string }> }

    if (!accountsData.accounts?.length) {
      return NextResponse.json({ error: 'Aucun compte GBP trouvé', raw: accountsData }, { status: 404 })
    }

    const accountName = accountsData.accounts[0].name
    const accountId   = accountName.replace('accounts/', '')

    // Lister les établissements
    const locRes = await fetch(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${accountName}/locations?readMask=name,title`,
      { headers: { Authorization: `Bearer ${token}` } },
    )
    const locData = await locRes.json() as { locations?: Array<{ name: string; title: string }> }

    const locations = (locData.locations ?? []).map(l => ({
      title:      l.title,
      locationId: l.name.replace(`${accountName}/locations/`, ''),
      fullName:   l.name,
    }))

    return NextResponse.json({
      accountId,
      accountName,
      locations,
      nextSteps: {
        GBP_ACCOUNT_ID:  accountId,
        GBP_LOCATION_ID: locations[0]?.locationId ?? '???',
        instructions: 'Ajoutez ces deux variables dans Vercel → Settings → Environment Variables',
      },
    })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
