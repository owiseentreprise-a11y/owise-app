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
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
  }

  const body = await req.json()
  const admin = createAdminClient()
  const { data, error } = await admin.from('courses').insert({
    adresse_depart:      body.adresse_depart      ?? '60100 Creil, France',
    adresse_arrivee:     body.adresse_arrivee     ?? 'Aéroport CDG Terminal 2',
    date_prevue:         body.date_prevue         ?? new Date(Date.now() + 7 * 86400_000).toISOString(),
    type_vehicule:       body.type_vehicule       ?? 'berline',
    nb_passagers:        body.nb_passagers        ?? 2,
    prix_estime:         body.prix_estime         ?? null,
    statut:              body.statut              ?? 'en_attente',
    sous_traitant_id:    body.sous_traitant_id    ?? null,
    prix_sous_traitant:  body.prix_sous_traitant  ?? null,
    chauffeur_id:        body.chauffeur_id        ?? null,
    etapes: null,
  }).select('id').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true, courseId: data.id })
}
