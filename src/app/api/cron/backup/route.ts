import { NextRequest, NextResponse } from 'next/server'
import { runBackup } from '@/lib/backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await runBackup()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error('[backup-cron]', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// Manual trigger from admin (server action calls this internally)
export async function POST(req: NextRequest) {
  // Reuse same auth check — admin pages call with the secret
  const secret = process.env.CRON_SECRET
  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  return GET(req)
}
