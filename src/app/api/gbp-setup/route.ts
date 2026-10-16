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

  /**
   * Décrit un réglage sans jamais le révéler : sa longueur, s'il traîne un
   * espace ou un retour à la ligne, et si sa forme est celle attendue.
   *
   * Pourquoi c'est nécessaire. Ces trois réglages sont marqués « sensibles »
   * dans Vercel : ni le tableau de bord ni l'API ne peuvent les relire. Quand
   * Google répond « invalid_grant » — ce qu'il fait depuis le 2026-10-08 — rien
   * ne permet de distinguer une valeur mal recopiée d'un jeton rattaché à un
   * autre client. Trois formes sont reconnaissables à l'œil nu sans divulguer
   * quoi que ce soit : un identifiant client finit par
   * « .apps.googleusercontent.com », un secret commence par « GOCSPX- », un
   * jeton de rafraîchissement commence par « 1//». Deux champs intervertis ou
   * une valeur tronquée se voient immédiatement.
   *
   * Aucune valeur, aucun extrait, aucune empreinte n'est renvoyé.
   */
  const decrire = (nom: string, attendu: RegExp) => {
    const brut = process.env[nom] ?? ''
    const net  = brut.trim()
    return {
      longueur:        net.length,
      espaces_autour:  brut.length !== net.length,
      forme_attendue:  attendu.test(net),
    }
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
    return NextResponse.json({
      error: msg,
      /* Uniquement en cas d'échec, et uniquement des métadonnées. */
      diagnostic: {
        GBP_CLIENT_ID:     decrire('GBP_CLIENT_ID',     /\.apps\.googleusercontent\.com$/),
        GBP_CLIENT_SECRET: decrire('GBP_CLIENT_SECRET', /^GOCSPX-/),
        GBP_REFRESH_TOKEN: decrire('GBP_REFRESH_TOKEN', /^1\/\//),
      },
    }, { status: 500 })
  }
}
