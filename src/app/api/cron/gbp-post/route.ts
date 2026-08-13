import { NextRequest, NextResponse } from 'next/server'
import { publishGbpPost } from '@/lib/gbpClient'
import { pickTemplate }   from '@/lib/gbpTemplates'
import { Resend }         from 'resend'

export const dynamic     = 'force-dynamic'
export const maxDuration = 30

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'

export async function GET(req: NextRequest) {
  const auth   = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Les 4 variables GBP sont obligatoires
  const missing = ['GBP_CLIENT_ID', 'GBP_CLIENT_SECRET', 'GBP_REFRESH_TOKEN', 'GBP_ACCOUNT_ID', 'GBP_LOCATION_ID']
    .filter(k => !process.env[k])
  if (missing.length > 0) {
    return NextResponse.json({ error: `Variables manquantes: ${missing.join(', ')}` }, { status: 503 })
  }

  const template = pickTemplate()

  try {
    const result = await publishGbpPost({
      languageCode: 'fr',
      topicType:    'STANDARD',
      summary:      template.summary,
      callToAction: {
        actionType: template.cta,
        url:        template.url,
      },
    })

    // Email de confirmation
    try {
      const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
      if (resend) {
        await resend.emails.send({
          from:    'OWISE <noreply@owise.fr>',
          to:      ADMIN_EMAIL,
          subject: `[OWISE] Post GBP publié : ${template.id}`,
          html:    `<p>Un nouveau post a été publié sur votre fiche Google Business Profile.</p>
                    <p><strong>Template :</strong> ${template.id}</p>
                    <p><strong>Extrait :</strong> ${template.summary.slice(0, 120)}…</p>
                    <p><strong>Nom GBP :</strong> ${result.name}</p>`,
        })
      }
    } catch { /* email non bloquant */ }

    return NextResponse.json({ ok: true, template: template.id, gbpName: result.name })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[gbp-post] Erreur:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
