import { NextResponse } from 'next/server'
import { createAdminClient, getUserEmail } from '@/lib/supabase/admin'
import { trierRelances, type Reservation } from '@/lib/relances-devis'
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

  /* Les réservations des 10 derniers jours (le palier J+7 regarde jusqu'à
     8 jours) : une demande qui a abouti ne se relance plus. Voir
     `relances-devis.ts` pour le défaut constaté le 2026-11-19. */
  const { data: coursesRecentes } = await supabase.from('courses')
    .select('devis_id, created_at, passager_email, passager_tel, client_id, clients(profiles(telephone))')
    .gte('created_at', daysAgo(10))
  const emailsComptes = new Map<string, string | null>()
  for (const id of new Set((coursesRecentes ?? []).map(c => c.client_id).filter(Boolean) as string[])) {
    emailsComptes.set(id, await getUserEmail(id))
  }
  const reservations: Reservation[] = (coursesRecentes ?? []).flatMap(c => [
    { devis_id: c.devis_id, email: c.passager_email, tel: c.passager_tel, created_at: c.created_at },
    {
      devis_id: null,
      email: c.client_id ? emailsComptes.get(c.client_id) ?? null : null,
      tel: (c as any).clients?.profiles?.telephone ?? null,
      created_at: c.created_at,
    },
  ])

  // Fenêtre de 24h pour chaque palier (J+1 = entre 1 et 2 jours, etc.)
  const [j1brut, j4brut, j7brut] = await Promise.all([
    // J+1 : créés il y a entre 1 et 2 jours, relance J+1 pas encore envoyée
    supabase.from('devis')
      .select('id, created_at, nom, email, tel, origin, destination, price, vehicle, date_course')
      .eq('relance_j1_sent', false)
      .lt('created_at', daysAgo(1))
      .gte('created_at', daysAgo(2))
      .not('email', 'is', null),

    // J+4 : créés il y a entre 4 et 5 jours, relance J+4 pas encore envoyée
    supabase.from('devis')
      .select('id, created_at, nom, email, tel, origin, destination, price, date_course')
      .eq('relance_j4_sent', false)
      .lt('created_at', daysAgo(4))
      .gte('created_at', daysAgo(5))
      .not('email', 'is', null),

    // J+7 : créés il y a entre 7 et 8 jours, relance J+7 pas encore envoyée
    supabase.from('devis')
      .select('id, created_at, nom, email, tel, origin, destination, price')
      .eq('relance_j7_sent', false)
      .lt('created_at', daysAgo(7))
      .gte('created_at', daysAgo(8))
      .not('email', 'is', null),
  ])

  /* Par palier : une seule relance par adresse, aucune à qui a réservé.
     Les doublons sont marqués « envoyés » pour ce palier ; une demande qui a
     abouti est marquée sur les trois paliers, pour ne plus jamais revenir. */
  const tri = {
    j1: trierRelances(j1brut.data ?? [], reservations),
    j4: trierRelances(j4brut.data ?? [], reservations),
    j7: trierRelances(j7brut.data ?? [], reservations),
  }
  const marquer = async (ids: string[], champs: Record<string, boolean>) => {
    if (ids.length) await supabase.from('devis').update(champs).in('id', ids)
  }
  await Promise.all([
    marquer(tri.j1.doublons.map(d => d.id), { relance_j1_sent: true }),
    marquer(tri.j4.doublons.map(d => d.id), { relance_j4_sent: true }),
    marquer(tri.j7.doublons.map(d => d.id), { relance_j7_sent: true }),
    marquer([...tri.j1.dejaReservees, ...tri.j4.dejaReservees, ...tri.j7.dejaReservees].map(d => d.id),
      { relance_j1_sent: true, relance_j4_sent: true, relance_j7_sent: true }),
  ])
  const j1sent = { data: tri.j1.aRelancer }
  const j4sent = { data: tri.j4.aRelancer }
  const j7sent = { data: tri.j7.aRelancer }

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
