import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerConfirmationClient, envoyerNotificationAdmin } from '@/lib/email'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'

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

  // ── Paiement confirmé ──────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    if (session.metadata?.facture_id) {
      const supabase = createAdminClient()
      await supabase.from('factures').update({ statut: 'payee' }).eq('id', session.metadata.facture_id)
      return NextResponse.json({ received: true })
    }

    if (session.metadata?.type === 'reservation') {
      try {
        await handleNewReservation(session.metadata)
      } catch (err) {
        console.error('[webhook] reservation error', err)
      }
      return NextResponse.json({ received: true })
    }
  }

  // ── Remboursement ──────────────────────────────────────────────────────────
  if (event.type === 'charge.refunded') {
    const charge = event.data.object
    const montant = (charge.amount_refunded / 100).toFixed(2)
    const supabase = createAdminClient()

    // Cas 1 : remboursement d'une facture → remettre en attente
    const factureId = (charge.metadata as any)?.facture_id
    if (factureId) {
      await supabase.from('factures').update({ statut: 'en_attente' }).eq('id', factureId)
      console.log(`[webhook] Facture ${factureId} remboursée (${montant} €)`)
    }

    // Notif admin dans tous les cas
    try {
      const { Resend } = await import('resend')
      const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
      if (resend) {
        await resend.emails.send({
          from: 'OWISE <noreply@owise.fr>',
          to: ADMIN_EMAIL,
          subject: `[OWISE] Remboursement Stripe — ${montant} €`,
          html: `<p>Un remboursement de <strong>${montant} €</strong> a été effectué sur Stripe.</p>
                 <p>Charge ID : <code>${charge.id}</code></p>
                 ${factureId ? `<p>Facture : <code>${factureId}</code> → remise en attente</p>` : ''}
                 <p><a href="https://dashboard.stripe.com/charges/${charge.id}">Voir sur Stripe →</a></p>`,
        })
      }
    } catch { /* ne pas planter si email échoue */ }
  }

  // ── Paiement échoué ────────────────────────────────────────────────────────
  if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object
    const montant = ((pi.amount ?? 0) / 100).toFixed(2)
    const raison = pi.last_payment_error?.message ?? 'Raison inconnue'
    console.warn(`[webhook] Paiement échoué — ${montant} € — ${raison} — PI: ${pi.id}`)
  }

  // ── Session expirée (abandon panier) ─────────────────────────────────────
  if (event.type === 'checkout.session.expired') {
    const session = event.data.object
    console.log(`[webhook] Session expirée — ${session.id} — type: ${session.metadata?.type ?? 'inconnu'}`)
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

  // 3. Créer la facture liée au paiement
  try {
    const year     = new Date().getFullYear()
    const ts       = Date.now().toString(36).toUpperCase().slice(-5)
    const numero   = `OW-${year}-${ts}`
    const prixTtc  = prix
    const prixHt   = Math.round((prixTtc / 1.2) * 100) / 100
    const prixTva  = Math.round((prixTtc - prixHt) * 100) / 100
    const echeance = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    await supabase.from('factures').insert({
      client_id:     userId,
      numero,
      statut:        'payee',
      montant_ht:    prixHt,
      montant_tva:   prixTva,
      montant_ttc:   prixTtc,
      date_emission: new Date().toISOString().slice(0, 10),
      date_echeance: echeance,
    })
  } catch (err) {
    console.error('[webhook] facture creation error', err)
  }

  // 4. Emails
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
