import { partRetour } from '@/lib/calcPrix'
import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { stripe, nettoyerCleEnv } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { creerCoursesDepuisDevis } from '@/lib/devis-vers-courses'
import { envoyerConfirmationClient, envoyerNotificationAdmin, envoyerBienvenueClient, envoyerDemandeBloquee } from '@/lib/email'
import { enregistrerParrainage } from '@/app/espace-client/actions-parrainage'
import { capiPurchase } from '@/lib/capi'
import { uploadGoogleAdsConversion, type AdsConsent } from '@/lib/googleAdsConversion'
import { genererNumeroFacture } from '@/lib/facturation'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { vehiculePourBase } from '@/lib/vehicule'
import { formaterMontant } from '@/lib/montant'
import {
  enregistrerEvenement, marquerEvenementTraite, marquerEvenementEchec,
  marquerPaiementConfirme, signalerIncident, resoudreIncident, VIOLATION_UNICITE,
} from '@/lib/paiement'

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

  /* ── Journal des événements : l'idempotence passe par la base ─────────
   *
   * `stripe_events.id` est la clé primaire et vaut l'identifiant d'événement
   * Stripe. Un événement déjà TRAITÉ est refusé ici, par la base, et non par
   * une lecture préalable que deux traitements simultanés franchiraient tous
   * les deux.
   *
   * C'est la correction du 8 octobre : les événements avaient été renvoyés à
   * la main depuis le tableau de bord Stripe pour récupérer deux réservations
   * perdues, et chaque renvoi avait recréé une course ET une facture. Le même
   * renvoi est désormais sans effet.
   *
   * Un événement déjà connu mais NON traité (première livraison journalisée
   * puis échouée) est retraité : refuser serait remplacer un doublon par une
   * perte. */
  const journal = createAdminClient()
  const suite = await enregistrerEvenement(journal, event, event)
  if (suite.action === 'ignorer') {
    console.log(`[webhook] ${event.id} déjà traité — rien à faire`)
    return NextResponse.json({ received: true, deja_traite: true })
  }

  // ── Paiement confirmé ──────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    /* Une réservation « à valider » est BLOQUÉE, pas payée.
     *
     * Mesuré chez Stripe le 2026-11-07, en mode test : une session créée avec
     * `capture_method: manual` et réglée par le client rend
     * `status: complete` mais `payment_status: UNPAID`, son PaymentIntent
     * étant en `requires_capture` — 201 € autorisés, 0 € encaissé.
     *
     * Sans cette exception, la condition ci-dessous l'écartait en silence :
     * la carte du client restait bloquée et AUCUNE course n'était créée.
     * C'est exactement l'incident des réservations perdues du 2026-10-07, où
     * deux clients ont payé sans que leur course existe.
     *
     * Le drapeau `a_valider` vient de nous (`reserver/actions.ts`) : on
     * n'accepte pas n'importe quelle session non payée, seulement celles
     * qu'on a nous-mêmes créées en blocage. */
    const estBlocageAValider =
      session.payment_status === 'unpaid' && session.metadata?.a_valider === '1'

    if (session.payment_status !== 'paid' && !estBlocageAValider) {
      await marquerEvenementTraite(journal, event.id)
      return NextResponse.json({ received: true })
    }

    if (session.metadata?.facture_id) {
      const supabase = createAdminClient()
      const factureId = session.metadata.facture_id
      /* L'erreur de cette mise à jour n'était pas regardée : si elle échouait,
       * l'événement était marqué « traité » et Stripe recevait 200. Le client
       * avait payé, la facture restait « en attente », et plus rien ne le
       * disait. On ne peut pas annoncer un succès qu'on n'a pas constaté. */
      const { data: majFacture, error: erreurFacture } = await supabase
        .from('factures').update({ statut: 'payee' }).eq('id', factureId).select('id')
      if (erreurFacture || !majFacture?.length) {
        await marquerEvenementEchec(journal, event.id, erreurFacture ?? new Error('facture introuvable'))
        await signalerIncident(supabase, {
          type: 'facture_non_marquee_payee', gravite: 'critique', reference: factureId,
          detail: { facture_id: factureId, session: session.id, montant: (session.amount_total ?? 0) / 100, erreur: erreurFacture?.message ?? 'aucune ligne mise à jour' },
        })
        return NextResponse.json({ error: 'facture update failed' }, { status: 500 })
      }
      await marquerEvenementTraite(journal, event.id, { factureId })
      return NextResponse.json({ received: true })
    }

    // Lien de paiement envoyé pour une course déjà créée (réservation prise par
    // téléphone/WhatsApp) — met à jour la course existante, n'en crée pas une nouvelle.
    if (session.metadata?.course_id) {
      const supabase = createAdminClient()
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
      const courseId = session.metadata.course_id
      try {
        /* `paiement_statut` est écrit ici, contrairement à ce que faisait ce
         * fichier jusqu'au 2026-10-17. Sans lui, la course restait « en
         * attente » alors que l'argent était encaissé — et la facturation
         * mensuelle, qui se protège du double débit avec ce champ, aurait
         * refacturé un client entreprise le 1er du mois suivant. */
        await marquerPaiementConfirme(supabase, courseId, paymentIntentId)
      } catch (err) {
        console.error('[webhook] paiement par lien non enregistre', err)
        await marquerEvenementEchec(journal, event.id, err)
        await signalerIncident(supabase, {
          type: 'paiement_lien_non_enregistre', gravite: 'critique',
          reference: paymentIntentId ?? courseId,
          detail: { course_id: courseId, session: session.id, erreur: String((err as Error)?.message ?? err) },
        })
        return NextResponse.json({ error: 'course update failed' }, { status: 500 })
      }
      await marquerEvenementTraite(journal, event.id, { courseId })
      return NextResponse.json({ received: true })
    }

    /* ── UN DEVIS ACCEPTÉ PAR LE CLIENT ────────────────────────────────

       Le client a ouvert son lien privé, cliqué « Confirmer ma
       réservation » et laissé sa carte. Stripe l’a AUTORISÉE sans la
       débiter : la session est `complete` mais `payment_status: unpaid`,
       et c’est le drapeau `a_valider` qui la fait passer le garde
       ci-dessus.

       C'EST ICI, ET NULLE PART AILLEURS, que la course est créée. Tant que
       Stripe n’a pas confirmé la retenue, rien n’entre dans le planning —
       et une retenue sans course est l'incident du 2026-10-07, deux
       clients débités sans trajet. Les deux faces doivent tomber ensemble.

       La construction des courses est celle de l’administration, mot pour
       mot : `creerCoursesDepuisDevis`. */
    if (session.metadata?.type === 'devis' && session.metadata?.devis_id) {
      const supabase = createAdminClient()
      const devisId = session.metadata.devis_id
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id ?? null

      try {
        const { creees, dejaFait } = await creerCoursesDepuisDevis(devisId)

        /* On date l’acceptation et on range la session, même si les courses
           existaient déjà : Stripe peut rejouer le même événement, et la
           seconde fois ne doit rien casser. */
        const { error: erreurDevis } = await supabase
          .from('devis_clients')
          .update({
            accepte_le: new Date().toISOString(),
            stripe_session_id: session.id,
            updated_at: new Date().toISOString(),
          })
          .eq('id', devisId)

        if (erreurDevis) {
          await marquerEvenementEchec(journal, event.id, erreurDevis)
          await signalerIncident(supabase, {
            type: 'devis_accepte_non_enregistre', gravite: 'critique', reference: devisId,
            detail: erreurDevis.message,
          })
          return NextResponse.json({ error: 'devis update failed' }, { status: 500 })
        }

        /* La carte est RETENUE, pas encaissée : on le dit à l’exploitant,
           sinon il croira la course payée. */
        envoyerNotificationAdmin({
          adresseDepart:  session.metadata.devis_numero ?? devisId,
          adresseArrivee: `${creees} course${creees > 1 ? 's' : ''} créée${creees > 1 ? 's' : ''}`,
          datePrevue:     new Date().toISOString(),
          clientNom:      session.customer_details?.name ?? session.customer_email ?? '—',
          typeVehicule:   'devis accepté par le client',
          refCourse:      session.metadata.devis_numero ?? '—',
          aValider:       true,
        }).catch(e => console.error('[DEVIS ACCEPTE — ALERTE NON PARTIE]', devisId, e))

        /* Le journal ne range que course_id et facture_id : un devis n’a
           pas sa colonne, et en ajouter une pour une trace ne vaut pas une
           migration. L’identifiant reste dans les métadonnées Stripe et
           dans le journal applicatif ci-dessous. */
        console.log(`[DEVIS ACCEPTE] ${devisId} · ${creees} course(s)` +
          `${dejaFait ? " (deja converti)" : ""} · ${paymentIntentId ?? "sans intent"}`)
        await marquerEvenementTraite(journal, event.id)
        return NextResponse.json({ received: true })
      } catch (err) {
        /* La carte du client est bloquée et aucune course n’existe : le pire
           état possible. On le signale et on répond 500 pour que Stripe
           rejoue — plutôt que d’annoncer un succès qu’on n’a pas constaté. */
        await marquerEvenementEchec(journal, event.id, err)
        await signalerIncident(supabase, {
          type: 'devis_accepte_sans_course', gravite: 'critique', reference: devisId,
          detail: err instanceof Error ? err.message : String(err),
        })
        return NextResponse.json({ error: 'devis conversion failed' }, { status: 500 })
      }
    }

    if (session.metadata?.type === 'reservation') {
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
      let courseId: string | null = null
      try {
        courseId = await handleNewReservation(session.metadata, paymentIntentId)
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
        await marquerEvenementEchec(journal, event.id, err)
        /* L'e-mail d'alerte n'a qu'une seule chance : il sort silencieusement
         * si RESEND_API_KEY manque. L'incident, lui, est encore là demain —
         * et la réconciliation quotidienne le retrouvera. */
        await signalerIncident(journal, {
          type: 'paiement_sans_course', gravite: 'critique',
          reference: paymentIntentId ?? session.id,
          detail: { session: session.id, montant: (session.amount_total ?? 0) / 100, metadata: session.metadata, erreur: String((err as Error)?.message ?? err) },
        })
        await alerterEchecReservation(session, paymentIntentId, err)
        return NextResponse.json({ error: 'reservation failed' }, { status: 500 })
      }
      await marquerEvenementTraite(journal, event.id, { courseId })
      if (paymentIntentId) await resoudreIncident(journal, 'paiement_sans_course', paymentIntentId)
      return NextResponse.json({ received: true })
    }

    /* Une session PAYÉE dont aucune métadonnée ne nous est connue.
     *
     * Ce cas tombait jusqu'ici dans le `return { received: true }` de fin de
     * fonction : Stripe recevait un succès, rien n'était créé, aucun incident
     * n'était ouvert, et l'événement restait « recu » sans que personne ne le
     * sache. C'est la forme la plus discrète du défaut du 7 octobre.
     *
     * On répond 200 et non 500, à dessein : réessayer ne peut rien changer,
     * les métadonnées ne se corrigeront pas d'elles-mêmes. Trois jours de
     * tentatives inutiles n'aideraient personne. Ce qui rend le cas visible,
     * c'est l'incident en base et l'e-mail — pas un code HTTP. */
    const supabase = createAdminClient()
    const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null
    console.error('[webhook] session payee sans metadonnee reconnue', session.id)
    await signalerIncident(supabase, {
      type: 'metadonnees_inconnues', gravite: 'critique', reference: pi ?? session.id,
      detail: { session: session.id, montant: (session.amount_total ?? 0) / 100, metadata: session.metadata ?? {} },
    })
    await alerterEchecReservation(session, pi, new Error('aucune metadonnee reconnue : ni facture_id, ni course_id, ni type=reservation'))
    await marquerEvenementEchec(journal, event.id, new Error('metadonnees inconnues'))
    return NextResponse.json({ received: true, incident: 'metadonnees_inconnues' })
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

  /* Fin de parcours : l'événement a été vu, et soit traité par un des blocs
   * ci-dessus, soit d'un type sur lequel nous n'agissons pas.
   *
   * Il faut le marquer. Sans cela il restait « recu » indéfiniment, et la
   * reconciliation quotidienne le reprenait chaque jour pendant 72 heures pour
   * finalement l'ignorer — du bruit, et une lecture fausse de l'état du
   * journal : « non traité » alors qu'il n'y avait rien à faire.
   *
   * `traite` pour ceux dont un bloc s'est occupé, `ignore` pour les autres. */
  const TYPES_AGIS = ['charge.refunded', 'payment_intent.payment_failed', 'checkout.session.expired']
  await marquerEvenementTraite(journal, event.id)
  if (!TYPES_AGIS.includes(event.type)) {
    await createAdminClient().from('stripe_events').update({ statut: 'ignore' }).eq('id', event.id)
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
             <p><strong>Montant :</strong> ${formaterMontant((session?.amount_total ?? 0) / 100)}<br>
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

/**
 * Crée la réservation payée. Rend l'identifiant de la course.
 *
 * Exportée depuis le 2026-10-17 pour que la réconciliation quotidienne puisse
 * récupérer un paiement confirmé dont la course n'a jamais été créée, en
 * repartant des mêmes métadonnées — sans dupliquer cette logique ailleurs.
 */
export async function handleNewReservation(
  meta: Record<string, string>,
  paymentIntentId: string | null,
): Promise<string> {
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
  /* Aller-retour : Stripe encaisse UNE fois, et deux courses doivent se
     partager ce montant exactement. Le partage est decide dans
     `reserver/actions.ts` (voir `partRetour` de calcPrix.ts) et transmis ici,
     pour qu'il n'existe qu'un seul endroit qui en decide. */
  const estAllerRetour = meta.aller_retour === 'true' && Boolean(meta.date_retour)
  /* `prix_retour` n'existe dans les metadonnees que depuis le 2026-11-04. Une
     session de paiement ouverte avant ce jour-la et reglee apres ne l'a pas :
     on recalcule alors la meme part avec la meme regle, plutot que de donner
     0 EUR au retour et le total a l'aller. */
  const prixRetour     = !estAllerRetour ? 0
    : (parseFloat(meta.prix_retour) || partRetour(prix))
  const prixAller      = Math.round(prix - prixRetour)
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

    /* Le compte vient d'etre cree avec un mot de passe aleatoire que le client
     * n'a jamais vu. Sans cet e-mail, il ne peut PAS se connecter : la page de
     * remerciement propose « voir ma reservation », qui mene a l'ecran de
     * connexion, et il reste devant.
     *
     * Constate le 2026-10-08 en testant une vraie reservation en production.
     * L'e-mail existait depuis longtemps — il n'etait envoye que lorsque
     * l'exploitant creait un client depuis l'admin, jamais lors d'une
     * reservation en ligne. */
    envoyerBienvenueClient({
      email, prenom, nom, password,
      typeCompte: 'particulier',
    }).catch(err => console.error('[webhook] bienvenue client', err))

    // Créer profil et client (upsert pour éviter les doublons)
    await Promise.all([
      supabase.from('profiles').upsert({ id: userId, nom, prenom, telephone }, { onConflict: 'id' }),
      supabase.from('clients').upsert({ id: userId, type_compte: 'particulier' }, { onConflict: 'id' }),
    ])
  }

  /* 2. La course existe-t-elle deja pour ce paiement ?
   *
   * Stripe reessaie un evenement en echec pendant trois jours. Le 2026-10-08,
   * apres avoir remis la bonne cle de signature, les tentatives encore en file
   * ont abouti les unes apres les autres : DEUX courses et DEUX factures pour
   * le meme paiement, chez M. Galligan comme chez M. Sillers.
   *
   * J'avais ecrit dans ce fichier qu'une nouvelle tentative etait « sans
   * danger » parce que le client est retrouve au lieu d'etre recree. C'etait
   * faux : la course, elle, etait reinseree.
   *
   * L'identifiant de paiement est unique par reservation : il sert de verrou.
   *
   * Depuis le 2026-10-17, cette lecture n'est plus la garantie : elle évite
   * seulement du travail inutile. La garantie est l'index unique partiel
   * `courses_stripe_pi_unique`, qui refuse la seconde insertion même si deux
   * traitements simultanés ont tous les deux lu « rien » ici. */
  if (paymentIntentId) {
    const { data: deja } = await supabase
      .from('courses').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
    if (deja) {
      console.log(`[webhook] course deja creee pour ${paymentIntentId} — rien a faire`)
      return deja.id
    }
  }

  // Créer la course
  const { data: course, error: courseErr } = await supabase.from('courses').insert({
    client_id:       userId,
    adresse_depart:  adresseDepart,
    adresse_arrivee: adresseArrivee,
    date_prevue:     datePrevue,
    type_vehicule:   vehiculePourBase(typeVehicule),
    nb_passagers:    nbPassagers,
    /* Sa part, pas le total. Jusqu'au 2026-11-04 cette ligne ecrivait `prix`,
       le montant encaisse en entier, tandis qu'une seconde course portait
       deja la moitie : 283 EUR encaisses devenaient 425 EUR enregistres. */
    prix_estime:     prixAller,
    etapes:          etapes.length > 0 ? etapes : null,
    // Vol ou train d'arrivee, quand le client les a renseignes.
    num_vol_train:     meta.num_vol_train || null,
    terminal:          meta.terminal || null,
    heure_arrivee_vol: meta.heure_arrivee_vol || null,
    // « Comment nous avez-vous connus ? ». Faute de colonne dediee, la reponse
    // va dans les notes, la ou l'exploitant la lit deja. Elle repond a la
    // seule question que les outils de mesure ne savent pas trancher : d'ou
    // vient un visiteur classe « direct ».
    notes:           meta.origine ? `Connu par : ${meta.origine}` : null,
    statut:          'en_attente',
    mode_paiement:   'stripe',
    /* Le paiement est confirmé par Stripe au moment où cet événement arrive :
     * la course naît donc payée. Jusqu'au 2026-10-17 cette colonne n'était
     * jamais écrite, et les quatre courses encaissées d'octobre affichaient
     * « en attente » — ce qui désarmait le garde-fou de la facturation
     * mensuelle contre le double débit. */
    /* « autorise » quand la carte est seulement BLOQUÉE — Grand Van 8
       places, dont la disponibilité doit être validée à la main. La somme
       n'est pas encore chez Owise : l'annoncer « payée » ferait croire à une
       recette qui n'existe pas, et désarmerait le garde-fou de la
       facturation mensuelle dans l'autre sens. Elle deviendra « paye » au
       moment où l'exploitant encaisse. */
    paiement_statut: meta.a_valider === '1' ? 'autorise' : 'paye',
    stripe_payment_intent_id: paymentIntentId,
  }).select('id').single()

  /* Une violation d'unicité ici veut dire qu'un autre traitement du même
   * paiement a gagné la course de vitesse. Ce n'est pas une erreur : c'est
   * exactement ce que l'index est là pour faire. On récupère la course
   * existante et on s'arrête — sans facture en double, sans e-mail en double. */
  if (courseErr?.code === VIOLATION_UNICITE && paymentIntentId) {
    const { data: gagnante } = await supabase
      .from('courses').select('id').eq('stripe_payment_intent_id', paymentIntentId).maybeSingle()
    if (gagnante) {
      console.log(`[webhook] course deja creee par un traitement concurrent pour ${paymentIntentId}`)
      return gagnante.id
    }
  }

  if (courseErr || !course) {
    throw new Error(`Impossible de créer la course: ${courseErr?.message}`)
  }

  const refCourse = course.id.slice(-6).toUpperCase()

  /* Le retour d'un aller-retour — cree ICI, apres encaissement.
   *
   * Il etait cree par `reserver/actions.ts` AVANT d'ouvrir la page de
   * paiement. Trois consequences, toutes constatees sur la course de
   * M. Soter Ranguin du 2026-11-02 : un client qui renonce au paiement
   * laissait une course fantome dans le planning ; le retour naissait
   * « paiement en attente » alors qu'il venait d'etre paye, au risque qu'on
   * redemande l'argent ; et il n'etait rattache ni au compte du client ni a
   * la facture.
   *
   * Non bloquant : l'aller existe et le client est servi. Mais l'echec est
   * journalise, jamais avale en silence. */
  const idsCourses: string[] = [course.id]
  if (estAllerRetour) {
    try {
      const dateRetourParsed = instantDepuisSaisieParis(meta.date_retour)
      if (isNaN(dateRetourParsed.getTime())) {
        throw new Error(`date de retour illisible : « ${meta.date_retour} »`)
      }
      const dateRetour = dateRetourParsed.toISOString()
      /* Les sessions ouvertes avant le 2026-11-04 ont deja cree leur retour,
         avant le paiement, par l'ancien chemin. En creer un second ferait
         trois courses pour un aller-retour. On regarde donc d'abord. */
      const { data: dejaLa } = await supabase.from('courses')
        .select('id')
        .eq('date_prevue', dateRetour)
        .eq('adresse_depart', adresseArrivee)
        .is('stripe_payment_intent_id', null)
        .maybeSingle()
      if (dejaLa) {
        /* Il existe : on le rattrape au lieu de le doubler — sa part, son
           statut de paiement, son client, et la facture plus bas. */
        await supabase.from('courses').update({
          client_id: userId, prix_estime: prixRetour, paiement_statut: 'paye',
        }).eq('id', dejaLa.id)
        idsCourses.push(dejaLa.id)
        console.log(`[webhook] retour deja cree avant paiement (${dejaLa.id}) — repris, pas duplique`)
        throw { dejaTraite: true }
      }
      const { data: retour, error: retourErr } = await supabase.from('courses').insert({
        client_id:       userId,
        adresse_depart:  adresseArrivee,
        adresse_arrivee: meta.adresse_arrivee_retour || adresseDepart,
        date_prevue:     dateRetour,
        type_vehicule:   vehiculePourBase(typeVehicule),
        nb_passagers:    nbPassagers,
        prix_estime:     prixRetour,
        notes:           'Retour',
        statut:          'en_attente',
        mode_paiement:   'stripe',
        /* Paye en meme temps que l'aller, par le meme encaissement. */
        paiement_statut: 'paye',
        passager_prenom: prenom || null,
        passager_nom:    nom || null,
        passager_tel:    telephone,
        /* Pas de `stripe_payment_intent_id` : l'index unique partiel
           `courses_stripe_pi_unique` n'accepte qu'une course par paiement, et
           c'est l'aller qui le porte. */
      }).select('id').single()
      if (retourErr || !retour) throw new Error(retourErr?.message ?? 'insertion du retour sans resultat')
      idsCourses.push(retour.id)
    } catch (err) {
      if ((err as { dejaTraite?: boolean })?.dejaTraite) {
        /* Pas un echec : le retour existait deja et vient d'etre repris. */
      } else {
      console.error('[webhook] retour non cree pour', paymentIntentId, String((err as Error)?.message ?? err))
      await signalerIncident(supabase, {
        type: 'retour_non_cree', gravite: 'elevee', reference: paymentIntentId,
        detail: {
          course_aller: course.id, date_retour: meta.date_retour,
          prix_retour: prixRetour, prix_encaisse: prix,
          erreur: String((err as Error)?.message ?? err),
        },
      }).catch(() => {})
      }
    }
  }

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
      /* Les deux trajets d'un aller-retour sont rattaches a la meme facture :
         son total est celui qu'a paye le client, et ses lignes doivent donc
         le composer. Le retour n'y figurait pas. */
      await supabase.from('courses').update({ facture_id: facture.id }).in('id', idsCourses)
    } else {
      throw new Error('insertion de la facture sans resultat')
    }
  } catch (err) {
    /* On ne relance PAS : la course existe et le client est servi, lui faire
     * perdre sa réservation pour une facture manquante serait disproportionné.
     *
     * Mais ce `catch` était muet jusqu'au 2026-10-17, et c'était le pire des
     * deux mondes : la course restait sans facture, le webhook répondait 200,
     * Stripe ne réessayait jamais, et au réessai suivant la garde
     * d'idempotence sortait AVANT d'arriver ici — la facture n'était donc
     * jamais créée. L'état partiel était définitif et invisible.
     *
     * Désormais il laisse une trace que la réconciliation quotidienne
     * retrouve et répare. */
    console.error('[webhook] facture creation error', err)
    await signalerIncident(supabase, {
      type: 'facture_manquante', gravite: 'elevee', reference: course.id,
      detail: { course_id: course.id, client_id: userId, montant: prix, erreur: String((err as Error)?.message ?? err) },
    })
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

  /* Une réservation bloquée n'est PAS confirmée : le client reçoit un
     message qui le dit, avec le montant retenu et le délai de réponse.
     Lui envoyer la confirmation habituelle lui ferait croire sa course
     réservée — il cesserait de chercher une autre solution et le
     découvrirait trop tard. */
  if (meta.a_valider === '1') {
    await Promise.all([
      envoyerDemandeBloquee({
        clientEmail: email,
        clientPrenom: prenom,
        adresseDepart,
        adresseArrivee,
        datePrevue,
        typeVehicule,
        nbPassagers,
        montantBloque: prix,
        refCourse,
      }),
      envoyerNotificationAdmin({
        adresseDepart,
        adresseArrivee,
        datePrevue,
        clientNom: `${prenom} ${nom}`.trim(),
        typeVehicule,
        refCourse,
        /* L'exploitant doit voir du premier coup d'œil que celle-ci attend
           une décision de sa part, et non qu'elle est acquise. */
        aValider: true,
      }),
    ])
    return course.id
  }

  await Promise.all([
    envoyerConfirmationClient({
      /* La langue de la RÉSERVATION, relue dans les métadonnées Stripe. Un
         client venu de /en/book recevait sinon une confirmation en français
         pour une course qu'il venait de payer en anglais. Les e-mails de
         l'exploitant et du chauffeur, juste en dessous, restent français :
         c'est leur langue. */
      langue: meta.langue === 'en' ? 'en' : 'fr',
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

  return course.id
}
