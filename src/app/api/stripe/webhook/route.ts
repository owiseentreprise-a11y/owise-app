import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { stripe, nettoyerCleEnv } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { envoyerConfirmationClient, envoyerNotificationAdmin } from '@/lib/email'
import { enregistrerParrainage } from '@/app/espace-client/actions-parrainage'
import { capiPurchase } from '@/lib/capi'
import { uploadGoogleAdsConversion, type AdsConsent } from '@/lib/googleAdsConversion'
import { genererNumeroFacture } from '@/lib/facturation'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { vehiculePourBase } from '@/lib/vehicule'

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'

export async function POST(req: Request) {
  const body      = await req.text()
  const signature = req.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 })
  }

  const webhookSecret = nettoyerCleEnv(process.env.STRIPE_WEBHOOK_SECRET)

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

    // Lien de paiement envoyé pour une course déjà créée (réservation prise par
    // téléphone/WhatsApp) — met à jour la course existante, n'en crée pas une nouvelle.
    if (session.metadata?.course_id) {
      const supabase = createAdminClient()
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
      // Même convention que handleNewReservation ci-dessous pour un paiement Stripe
      // réussi : mode_paiement + stripe_payment_intent_id, sans toucher paiement_statut
      // (réservé au suivi des remboursements ailleurs dans le code).
      await supabase.from('courses').update({
        mode_paiement: 'stripe',
        stripe_payment_intent_id: paymentIntentId,
      }).eq('id', session.metadata.course_id)
      return NextResponse.json({ received: true })
    }

    if (session.metadata?.type === 'reservation') {
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
      try {
        await handleNewReservation(session.metadata, paymentIntentId)
      } catch (err) {
        /* Une erreur ici veut dire : l'argent est encaisse et la course
         * n'existe pas. C'est le pire etat possible, et il etait jusqu'ici
         * simplement journalise — donc invisible.
         *
         * Le 2026-10-07, deux clients ont paye 89 EUR chacun pour un van et
         * n'ont jamais eu de course : le type de vehicule envoye (`van`)
         * n'existe pas dans l'enum de la base (`van_7`). Le webhook repondait
         * « recu » a Stripe, personne n'etait prevenu, et la seule copie de
         * leur trajet restait dans les metadonnees Stripe.
         *
         * Desormais : un e-mail part avec TOUTES les metadonnees, de quoi
         * recreer la reservation a la main ; et on repond 500 pour que Stripe
         * reessaie et que l'echec soit visible dans son tableau de bord.
         * handleNewReservation retrouve un client existant au lieu de le
         * recreer, une nouvelle tentative est donc sans danger. */
        console.error('[webhook] reservation error', err)
        await alerterEchecReservation(session, paymentIntentId, err)
        return NextResponse.json({ error: 'reservation failed' }, { status: 500 })
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

/**
 * Prevenir un humain quand un paiement aboutit sans course.
 *
 * L'e-mail porte l'integralite des metadonnees Stripe : c'est la seule copie
 * du trajet demande, et sans elle la reservation est irrecuperable.
 */
async function alerterEchecReservation(session: any, paymentIntentId: string | null, err: unknown) {
  try {
    const { Resend } = await import('resend')
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
    if (!resend) return

    const meta = session?.metadata ?? {}
    const lignes = Object.entries(meta)
      .map(([k, v]) => `<tr><td style="padding:3px 12px 3px 0;color:#848499">${k}</td><td style="padding:3px 0"><strong>${String(v)}</strong></td></tr>`)
      .join('')

    await resend.emails.send({
      from:    'OWISE <noreply@owise.fr>',
      to:      ADMIN_EMAIL,
      subject: `[OWISE] URGENT — paiement encaisse SANS course creee`,
      html: `<p><strong>Un client a paye et sa course n'a pas pu etre enregistree.</strong></p>
             <p>Il n'a recu aucune confirmation et aucun chauffeur ne lui est affecte.
                Les informations ci-dessous sont la seule copie de sa demande.</p>
             <p><strong>Montant :</strong> ${((session?.amount_total ?? 0) / 100).toFixed(2)} €<br>
                <strong>Paiement :</strong> <code>${paymentIntentId ?? '—'}</code><br>
                <strong>Session :</strong> <code>${session?.id ?? '—'}</code></p>
             <p><strong>Erreur :</strong> <code>${String((err as any)?.message ?? err).slice(0, 400)}</code></p>
             <table style="border-collapse:collapse;font-family:monospace;font-size:13px">${lignes}</table>
             <p><a href="https://dashboard.stripe.com/payments/${paymentIntentId ?? ''}">Voir le paiement sur Stripe →</a></p>`,
    })
  } catch (e) {
    console.error('[webhook] alerte echec reservation non envoyee', e)
  }
}

async function handleNewReservation(meta: Record<string, string>, paymentIntentId: string | null) {
  const supabase = createAdminClient()

  const email     = meta.email
  const nom       = meta.nom
  const prenom    = meta.prenom
  const telephone = meta.telephone || null
  const adresseDepart  = meta.adresse_depart
  const adresseArrivee = meta.adresse_arrivee
  // `meta.date_prevue` est la saisie du formulaire de reservation (heure de
  // Paris, sans fuseau). Ecrite telle quelle, Postgres la lisait comme une
  // heure universelle : toute reservation en ligne avancait de deux heures.
  const datePrevue     = instantDepuisSaisieParis(meta.date_prevue).toISOString()
  const typeVehicule   = meta.type_vehicule
  const nbPassagers    = parseInt(meta.nb_passagers, 10) || 1
  const prix           = parseFloat(meta.prix) || 0
  // Arrêts demandés à la réservation et déjà facturés : sans cette reprise, le
  // client paie l'étape et le chauffeur n'en voit aucune trace.
  let etapes: string[] = []
  try {
    const brut = JSON.parse(meta.etapes ?? '[]')
    if (Array.isArray(brut)) etapes = brut.filter((e: unknown) => typeof e === 'string' && e.trim()).slice(0, 2)
  } catch {}

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
    type_vehicule:   vehiculePourBase(typeVehicule),
    nb_passagers:    nbPassagers,
    prix_estime:     prix,
    etapes:          etapes.length > 0 ? etapes : null,
    // Vol ou train d'arrivee, quand le client les a renseignes.
    num_vol_train:     meta.num_vol_train || null,
    terminal:          meta.terminal || null,
    heure_arrivee_vol: meta.heure_arrivee_vol || null,
    statut:          'en_attente',
    mode_paiement:   'stripe',
    stripe_payment_intent_id: paymentIntentId,
  }).select('id').single()

  if (courseErr || !course) {
    throw new Error(`Impossible de créer la course: ${courseErr?.message}`)
  }

  const refCourse = course.id.slice(-6).toUpperCase()

  // 3. Créer la facture liée au paiement
  try {
    const numero   = await genererNumeroFacture(supabase)
    const { data: parametres } = await supabase.from('parametres').select('facture_taux_tva').eq('id', true).single()
    const tauxTva  = parametres?.facture_taux_tva ?? 0
    const prixTtc  = prix
    const prixHt   = Math.round((prixTtc / (1 + tauxTva / 100)) * 100) / 100
    const prixTva  = Math.round((prixTtc - prixHt) * 100) / 100
    const echeance = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)
    const { data: facture } = await supabase.from('factures').insert({
      client_id:     userId,
      numero,
      statut:        'payee',
      montant_ht:    prixHt,
      tva:   prixTva,
      montant_ttc:   prixTtc,
      date_emission: new Date().toISOString().slice(0, 10),
      date_echeance: echeance,
    }).select('id').single()

    if (facture) {
      await supabase.from('courses').update({ facture_id: facture.id }).eq('id', course.id)
    }
  } catch (err) {
    console.error('[webhook] facture creation error', err)
  }

  // 4. Parrainage — créditer le parrain si un code a été utilisé
  if (meta.code_parrainage) {
    await enregistrerParrainage(meta.code_parrainage, email).catch(() => {})
  }

  // 4b. Parrainage — consommer les crédits appliqués à cette réservation
  // (marqués "disponible" côté client, maintenant que le paiement est confirmé)
  if (meta.credit_parrainage_ids) {
    const ids = meta.credit_parrainage_ids.split(',').filter(Boolean)
    if (ids.length > 0) {
      try {
        await supabase.from('credits_parrainage')
          .update({ statut: 'utilise' })
          .in('id', ids)
          .eq('statut', 'disponible')
      } catch { /* non bloquant */ }
    }
  }

  // 5. CAPI Purchase + conversion Google Ads + Emails (en parallèle, ne bloquent pas si l'un échoue)
  capiPurchase({
    eventId   : randomUUID(),
    value     : prix,
    currency  : 'EUR',
    email,
    phone     : telephone ?? undefined,
    firstName : prenom,
    lastName  : nom,
  }).catch(() => {})

  if (meta.gclid) {
    uploadGoogleAdsConversion({
      gclid             : meta.gclid,
      value             : prix,
      currency          : 'EUR',
      conversionDateTime: new Date(),
      orderId           : course.id,
      consent           : (meta.ads_consent as AdsConsent) ?? 'unknown',
    }).catch(() => {})
  }

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
      etapes: etapes.length > 0 ? etapes : null,
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
