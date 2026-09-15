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
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null

  // Filet de sécurité : tant que GBP_AUTO_PUBLISH n'est pas explicitement
  // "true", on n'envoie qu'un aperçu par email — aucune publication réelle
  // sur la fiche Google. Permet de relire les textes en conditions réelles
  // avant d'activer la publication automatique.
  if (process.env.GBP_AUTO_PUBLISH !== 'true') {
    try {
      if (resend) {
        await resend.emails.send({
          from:    'OWISE <noreply@owise.fr>',
          to:      ADMIN_EMAIL,
          subject: `[OWISE] Aperçu post GBP (non publié) : ${template.id}`,
          html:    `<p>Publication automatique désactivée — voici ce qui aurait été publié sur votre fiche Google Business Profile.</p>
                    <p><strong>Template :</strong> ${template.id}</p>
                    <pre style="white-space:pre-wrap;font-family:inherit;background:#F8F6F1;padding:16px;border-radius:8px;">${template.summary}</pre>
                    <p>Pour activer la publication automatique de ces posts, mettez la variable d'environnement <code>GBP_AUTO_PUBLISH=true</code> sur Vercel.</p>`,
        })
      }
    } catch { /* email non bloquant */ }

    return NextResponse.json({ ok: true, mode: 'preview_only', template: template.id })
  }

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

    return NextResponse.json({ ok: true, mode: 'published', template: template.id, gbpName: result.name })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erreur inconnue'
    console.error('[gbp-post] Erreur:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
