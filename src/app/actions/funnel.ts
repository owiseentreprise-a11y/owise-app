'use server'

import { createAdminClient } from '@/lib/supabase/admin'

export async function logFunnelEvent(params: {
  sessionId: string
  step: string
  page?: string
  meta?: Record<string, unknown>
}) {
  const admin = createAdminClient()
  // Best-effort : le tracking ne doit jamais faire échouer le parcours réel.
  await admin.from('funnel_events').insert({
    session_id: params.sessionId,
    step:       params.step,
    page:       params.page ?? null,
    meta:       params.meta ?? null,
  }).then(() => {}, () => {})
}
