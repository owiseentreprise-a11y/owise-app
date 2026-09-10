import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get('email')

  if (!email || !email.includes('@')) {
    return NextResponse.redirect(new URL('/desinscription?err=invalid', req.url))
  }

  const supabase = createAdminClient()
  await supabase.from('email_optout').upsert({ email: email.toLowerCase() }, { onConflict: 'email' })

  // Marquer aussi les devis actifs avec cet email pour ne plus les relancer
  await supabase.from('devis')
    .update({ relance_j1_sent: true, relance_j4_sent: true, relance_j7_sent: true })
    .eq('email', email.toLowerCase())
    .eq('relance_j7_sent', false)

  return NextResponse.redirect(new URL('/desinscription?ok=1', req.url))
}
