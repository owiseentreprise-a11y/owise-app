import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  envoyerRelanceDevisJ1,
  envoyerRelanceDevisJ4,
  envoyerRelanceDevisJ7,
} from '@/lib/email'

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  function daysAgo(n: number) {
    const d = new Date(now)
    d.setDate(d.getDate() - n)
    return d.toISOString()
  }

  // Charger la liste des emails opt-out
  const { data: optouts } = await supabase.from('email_optout').select('email')
  const optoutSet = new Set((optouts ?? []).map(o => o.email.toLowerCase()))

  // Fenêtre de 24h pour chaque palier (J+1 = entre 1 et 2 jours, etc.)
  const [j1sent, j4sent, j7sent] = await Promise.all([
    // J+1 : créés il y a entre 1 et 2 jours, relance J+1 pas encore envoyée
    supabase.from('devis')
      .select('id, nom, email, origin, destination, price, vehicle, date_course')
      .eq('relance_j1_sent', false)
      .lt('created_at', daysAgo(1))
      .gte('created_at', daysAgo(2))
      .not('email', 'is', null),

    // J+4 : créés il y a entre 4 et 5 jours, relance J+4 pas encore envoyée
    supabase.from('devis')
      .select('id, nom, email, origin, destination, price, date_course')
      .eq('relance_j4_sent', false)
      .lt('created_at', daysAgo(4))
      .gte('created_at', daysAgo(5))
      .not('email', 'is', null),

    // J+7 : créés il y a entre 7 et 8 jours, relance J+7 pas encore envoyée
    supabase.from('devis')
      .select('id, nom, email, origin, destination, price')
      .eq('relance_j7_sent', false)
      .lt('created_at', daysAgo(7))
      .gte('created_at', daysAgo(8))
      .not('email', 'is', null),
  ])

  let sentJ1 = 0, sentJ4 = 0, sentJ7 = 0

  await Promise.all([
    // Relances J+1
    ...(j1sent.data ?? []).map(async (d) => {
      if (!d.email || !d.nom) return
      if (optoutSet.has(d.email.toLowerCase())) return
      await envoyerRelanceDevisJ1({
        email: d.email,
        nom: d.nom,
        origin: d.origin ?? '',
        destination: d.destination ?? '',
        price: d.price,
        vehicle: d.vehicle,
        date_course: d.date_course,
      }).catch(() => {})
      await supabase.from('devis').update({ relance_j1_sent: true }).eq('id', d.id)
      sentJ1++
    }),

    // Relances J+4
    ...(j4sent.data ?? []).map(async (d) => {
      if (!d.email || !d.nom) return
      if (optoutSet.has(d.email.toLowerCase())) return
      await envoyerRelanceDevisJ4({
        email: d.email,
        nom: d.nom,
        origin: d.origin ?? '',
        destination: d.destination ?? '',
        price: d.price,
        date_course: d.date_course,
      }).catch(() => {})
      await supabase.from('devis').update({ relance_j4_sent: true }).eq('id', d.id)
      sentJ4++
    }),

    // Relances J+7
    ...(j7sent.data ?? []).map(async (d) => {
      if (!d.email || !d.nom) return
      if (optoutSet.has(d.email.toLowerCase())) return
      await envoyerRelanceDevisJ7({
        email: d.email,
        nom: d.nom,
        origin: d.origin ?? '',
        destination: d.destination ?? '',
        price: d.price,
      }).catch(() => {})
      await supabase.from('devis').update({ relance_j7_sent: true }).eq('id', d.id)
      sentJ7++
    }),
  ])

  return NextResponse.json({
    ok: true,
    relances: { j1: sentJ1, j4: sentJ4, j7: sentJ7 },
    total: sentJ1 + sentJ4 + sentJ7,
  })
}
