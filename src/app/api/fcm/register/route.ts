import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { token } = await req.json()
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'token_required' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Chauffeurs et comptes sous_traitant qui ont une ligne chauffeur peuvent enregistrer un token FCM
  const role = user.app_metadata?.role
  if (role !== 'chauffeur' && role !== 'sous_traitant') {
    return NextResponse.json({ error: 'not_chauffeur' }, { status: 403 })
  }
  if (role === 'sous_traitant') {
    const { data: hasChauffeurRow } = await admin.from('chauffeurs').select('id').eq('id', user.id).maybeSingle()
    if (!hasChauffeurRow) return NextResponse.json({ error: 'not_chauffeur' }, { status: 403 })
  }

  await admin.from('chauffeurs').update({ fcm_token: token }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  await admin.from('chauffeurs').update({ fcm_token: null }).eq('id', user.id)

  return NextResponse.json({ ok: true })
}
