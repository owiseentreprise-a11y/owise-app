import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 })
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (s) => s.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()

  // Récupérer un client existant si non fourni
  let clientId = body.client_id ?? null
  if (!clientId) {
    const { data: clients } = await admin.from('clients').select('id').limit(1)
    clientId = clients?.[0]?.id ?? null
  }

  const montant_ht  = body.montant_ht  ?? 100
  const montant_ttc = body.montant_ttc ?? 120

  // Numéro de facture
  const { count } = await admin.from('factures').select('id', { count: 'exact', head: true })
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const numero = `OW-TEST-${yyyymm}-${String((count ?? 0) + 1).padStart(3, '0')}`

  const echeance = new Date()
  echeance.setDate(echeance.getDate() + 30)

  const { data, error } = await admin.from('factures').insert({
    client_id:     clientId,
    numero,
    statut:        'en_attente',
    montant_ht,
    tva:           Math.round((montant_ttc - montant_ht) * 100) / 100,
    montant_ttc,
    date_emission: now.toISOString().slice(0, 10),
    date_echeance: echeance.toISOString(),
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, factureId: data.id, numero })
}
