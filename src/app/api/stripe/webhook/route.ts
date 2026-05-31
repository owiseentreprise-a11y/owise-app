import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerConfirmationClient, envoyerNotificationAdmin } from '@/lib/email'

export async function POST(req: Request) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const rawSecret = process.env.STRIPE_WEBHOOK_SECRET ?? ''
  const webhookSecret = rawSecret.charCodeAt(0) === 0xFEFF ? rawSecret.slice(1) : rawSecret

  let event
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err: any) {
    console.error('[webhook] signature error:', err?.message)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    // ── Paiement facture existante ──
    if (session.metadata?.facture_id) {
      const supabase = createAdminClient()
      await supabase.from('factures').update({ statut: 'payee' }).eq('id', session.metadata.facture_id)
      return NextResponse.json({ received: true })
    }

    // ── Nouvelle réservation publique ──
    if (session.metadata?.type === 'reservation') {
      try {
        await handleNewReservation(session.metadata)
      } catch (err) {
        console.error('[webhook] reservation error', err)
      }
      return NextResponse.json({ received: true })
    }
  }

  return NextResponse.json({ received: true })
}

async function handleNewReservation(meta: Record<string, string>) {
  const supabase = createAdminClient()

  const email     = meta.email
  const nom       = meta.nom
  const prenom    = meta.prenom
  const telephone = meta.telephone || null
  const adresseDepart  = meta.adresse_depart
  const adresseArrivee = meta.adresse_arrivee
  const datePrevue     = meta.date_prevue
  const typeVehicule   = meta.type_vehicule
  const nbPassagers    = parseInt(meta.nb_passagers, 10) || 1
  const prix           = parseFloat(meta.prix) || 0

  // 1. Trouver ou créer l'utilisateur
  const { data: existingId } = await supabase.rpc('find_user_by_email', { p_email: email })

  let userId: string

  if (existingId) {
    userId = existingId
    // Mettre à jour le profil si les champs sont vides
    await supabase.from('profiles')
      .upsert({ id: userId, nom, prenom, telephone }, { onConflict: 'id', ignoreDuplicates: false })
  } else {
    // Créer le compte (mot de passe aléatoire — le client utilisera un magic link)
    const password = Math.random().toString(36).slice(2, 10)
      + Math.random().toString(36).slice(2, 10).toUpperCase()
      + '!1'

    const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { role: 'client' },
    })

    if (createErr || !newUser?.user?.id) {
      throw new Error(`Impossible de créer l'utilisateur: ${createErr?.message}`)
    }

    userId = newUser.user.id

    // Créer profil et client (upsert pour éviter les doublons)
    await Promise.all([
      supabase.from('profiles').upsert({ id: userId, nom, prenom, telephone }, { onConflict: 'id' }),
      supabase.from('clients').upsert({ id: userId, type_compte: 'particulier' }, { onConflict: 'id' }),
    ])
  }

  // 2. Créer la course
  const { data: course, error: courseErr } = await supabase.from('courses').insert({
    client_id:       userId,
    adresse_depart:  adresseDepart,
    adresse_arrivee: adresseArrivee,
    date_prevue:     datePrevue,
    type_vehicule:   typeVehicule,
    nb_passagers:    nbPassagers,
    prix_estime:     prix,
    statut:          'en_attente',
  }).select('id').single()

  if (courseErr || !course) {
    throw new Error(`Impossible de créer la course: ${courseErr?.message}`)
  }

  const refCourse = course.id.slice(-6).toUpperCase()

  // 3. Emails
  await Promise.all([
    envoyerConfirmationClient({
      clientEmail: email,
      clientPrenom: prenom,
      adresseDepart,
      adresseArrivee,
      datePrevue,
      typeVehicule,
      nbPassagers,
      prixEstime: prix,
      refCourse,
    }),
    envoyerNotificationAdmin({
      adresseDepart,
      adresseArrivee,
      datePrevue,
      clientNom: `${prenom} ${nom}`.trim(),
      typeVehicule,
      refCourse,
    }),
  ])
}
