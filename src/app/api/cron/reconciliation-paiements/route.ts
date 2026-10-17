import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { formaterMontant } from '@/lib/montant'
import { handleNewReservation } from '@/app/api/stripe/webhook/route'
import {
  marquerPaiementConfirme, marquerRemboursement, marquerLitige,
  signalerIncident, resoudreIncident, evenementsAReprendre,
  marquerEvenementTraite, marquerEvenementEchec,
} from '@/lib/paiement'

/**
 * Réconciliation quotidienne Stripe ↔ base. Appelée par Vercel Cron à 05:00 UTC
 * (07:00 Paris), avant la journée d'exploitation.
 *
 * Pourquoi elle existe. Jusqu'au 2026-10-17, rien ne comparait l'argent
 * encaissé aux courses enregistrées. Le 7 octobre, deux clients ont payé 89 €
 * et leur course n'a jamais été créée : l'erreur était journalisée, les
 * journaux Vercel ne gardent qu'une heure, et c'est le client qui a fini par
 * téléphoner. Rien n'aurait détecté le défaut sans lui.
 *
 * Ce qu'elle fait : lire Stripe, et réparer la base pour qu'elle dise la même
 * chose. Ce qu'elle NE fait PAS, et ne doit jamais faire :
 *
 *   - aucun appel qui débite ou rembourse. Les seules méthodes Stripe
 *     utilisées ici sont des lectures (`list`, `retrieve`). Une réconciliation
 *     qui sait encaisser est une réconciliation qui peut encaisser deux fois ;
 *   - aucune suppression, aucune fusion. Un doublon est signalé à un humain :
 *     décider laquelle des deux courses a été honorée demande de savoir si un
 *     chauffeur a été affecté et si le client a été prévenu.
 *
 * Elle est sans danger à relancer autant de fois qu'on veut : la création de
 * course passe par `handleNewReservation`, protégée par l'index unique
 * `courses_stripe_pi_unique`, et les corrections de statut sont idempotentes.
 *
 * La destination webhook de production n'écoute que
 * `checkout.session.completed` et la configuration Stripe ne doit pas être
 * modifiée : les remboursements et les litiges ne nous sont donc JAMAIS
 * notifiés. Ils sont découverts ici, le lendemain au plus tard.
 */

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'owise.entreprise@gmail.com'
const JOURS = 7

type Action = { quoi: string; detail: string }

export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const depuis = Math.floor((Date.now() - JOURS * 864e5) / 1000)
  const corrections: Action[] = []
  const alertes: Action[] = []
  const lu = { sessions: 0, remboursements: 0, litiges: 0, evenements: 0 }

  try {
    // ── 1. Reprendre les événements journalisés qui n'ont pas abouti ────────
    //
    // Première chance de réparation, et la moins chère : la charge utile est
    // déjà en base, il n'y a rien à redemander à Stripe.
    for (const ev of await evenementsAReprendre(supabase)) {
      lu.evenements++
      const session = (ev.payload as { data?: { object?: Record<string, unknown> } })?.data?.object
      const meta = (session?.metadata ?? {}) as Record<string, string>
      if (ev.type !== 'checkout.session.completed' || meta.type !== 'reservation') continue
      const pi = typeof session?.payment_intent === 'string'
        ? session.payment_intent
        : (session?.payment_intent as { id?: string } | undefined)?.id ?? null
      try {
        const courseId = await handleNewReservation(meta, pi)
        await marquerEvenementTraite(supabase, ev.id, { courseId })
        if (pi) await resoudreIncident(supabase, 'paiement_sans_course', pi)
        corrections.push({ quoi: 'événement rejoué', detail: `${ev.id} → course ${courseId.slice(-6).toUpperCase()} (tentative ${ev.tentatives + 1})` })
      } catch (err) {
        await marquerEvenementEchec(supabase, ev.id, err)
        alertes.push({ quoi: 'rejeu en échec', detail: `${ev.id} — ${String((err as Error)?.message ?? err).slice(0, 160)}` })
      }
    }

    // ── 2. Stripe dit-il des paiements que la base ignore ? ─────────────────
    const sessions = await stripe.checkout.sessions.list({
      created: { gte: depuis }, limit: 100, expand: ['data.payment_intent'],
    })
    lu.sessions = sessions.data.length

    for (const s of sessions.data) {
      if (s.payment_status !== 'paid') continue
      const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id ?? null
      const meta = (s.metadata ?? {}) as Record<string, string>

      // 2a. Paiement d'une facture
      if (meta.facture_id) {
        const { data: f } = await supabase.from('factures').select('id, statut').eq('id', meta.facture_id).maybeSingle()
        if (f && f.statut !== 'payee') {
          await supabase.from('factures').update({ statut: 'payee' }).eq('id', f.id)
          corrections.push({ quoi: 'facture marquée payée', detail: `${f.id.slice(-6).toUpperCase()} (${formaterMontant((s.amount_total ?? 0) / 100)})` })
        }
        continue
      }

      // 2b. Lien de paiement envoyé pour une course existante
      if (meta.course_id) {
        const { data: c } = await supabase.from('courses')
          .select('id, paiement_statut, stripe_payment_intent_id').eq('id', meta.course_id).maybeSingle()
        if (!c) {
          if (await ouvrir(supabase, 'course_introuvable', 'elevee', meta.course_id, { session: s.id, montant: (s.amount_total ?? 0) / 100 }))
            alertes.push({ quoi: 'course introuvable', detail: `paiement reçu pour la course ${meta.course_id} qui n'existe pas` })
          continue
        }
        if (c.stripe_payment_intent_id && pi && c.stripe_payment_intent_id !== pi) {
          /* Le lien de paiement est réutilisable : il a été payé deux fois.
           * On ne touche à rien — écraser l'identifiant ferait disparaître le
           * premier paiement, qui ne serait plus remboursable depuis l'admin. */
          if (await ouvrir(supabase, 'lien_paye_deux_fois', 'critique', pi, { course_id: c.id, premier: c.stripe_payment_intent_id, second: pi, montant: (s.amount_total ?? 0) / 100 }))
            alertes.push({ quoi: 'lien payé deux fois', detail: `course ${c.id.slice(-6).toUpperCase()} — deux paiements, remboursement à décider` })
          continue
        }
        if (c.paiement_statut !== 'paye') {
          await marquerPaiementConfirme(supabase, c.id, pi)
          corrections.push({ quoi: 'statut de paiement corrigé', detail: `course ${c.id.slice(-6).toUpperCase()} → payé` })
        }
        continue
      }

      // 2c. Réservation en ligne
      if (meta.type !== 'reservation' || !pi) continue

      const { data: course } = await supabase.from('courses')
        .select('id, paiement_statut, facture_id').eq('stripe_payment_intent_id', pi).maybeSingle()

      if (!course) {
        /* Le cœur du dispositif : de l'argent encaissé, aucune course. C'est
         * l'état du 7 octobre. On la crée depuis les métadonnées, qui sont la
         * seule copie du trajet. Aucun débit n'est émis : le paiement existe
         * déjà. */
        try {
          const courseId = await handleNewReservation(meta, pi)
          await resoudreIncident(supabase, 'paiement_sans_course', pi)
          corrections.push({ quoi: 'RÉSERVATION RÉCUPÉRÉE', detail: `${formaterMontant((s.amount_total ?? 0) / 100)} → course ${courseId.slice(-6).toUpperCase()} (session ${s.id.slice(0, 18)}…)` })
          alertes.push({ quoi: 'réservation récupérée', detail: `une course a été créée après coup — vérifier qu'un chauffeur est affecté et que le client est prévenu` })
        } catch (err) {
          if (await ouvrir(supabase, 'paiement_sans_course', 'critique', pi, { session: s.id, montant: (s.amount_total ?? 0) / 100, metadata: meta, erreur: String((err as Error)?.message ?? err) }))
            alertes.push({ quoi: 'PAIEMENT SANS COURSE', detail: `${formaterMontant((s.amount_total ?? 0) / 100)} encaissés, course impossible à créer — ${String((err as Error)?.message ?? err).slice(0, 120)}` })
        }
        continue
      }

      if (course.paiement_statut !== 'paye' && course.paiement_statut !== 'remboursee' && course.paiement_statut !== 'contestee') {
        await marquerPaiementConfirme(supabase, course.id, pi)
        corrections.push({ quoi: 'statut de paiement corrigé', detail: `course ${course.id.slice(-6).toUpperCase()} → payé` })
      }
      if (!course.facture_id) {
        if (await ouvrir(supabase, 'facture_manquante', 'elevee', course.id, { course_id: course.id, montant: (s.amount_total ?? 0) / 100 }))
          alertes.push({ quoi: 'facture manquante', detail: `course ${course.id.slice(-6).toUpperCase()} encaissée sans facture` })
      } else {
        await resoudreIncident(supabase, 'facture_manquante', course.id)
      }
    }

    // ── 3. Remboursements et litiges : jamais notifiés, donc cherchés ───────
    const remboursements = await stripe.refunds.list({ created: { gte: depuis }, limit: 100 })
    lu.remboursements = remboursements.data.length
    for (const r of remboursements.data) {
      const pi = typeof r.payment_intent === 'string' ? r.payment_intent : r.payment_intent?.id
      if (!pi || r.status !== 'succeeded') continue
      const id = await marquerRemboursement(supabase, pi)
      if (id) corrections.push({ quoi: 'remboursement reporté', detail: `course ${id.slice(-6).toUpperCase()} → remboursée (${formaterMontant((r.amount ?? 0) / 100)})` })
    }

    const litiges = await stripe.disputes.list({ created: { gte: depuis }, limit: 100 })
    lu.litiges = litiges.data.length
    for (const d of litiges.data) {
      const pi = typeof d.payment_intent === 'string' ? d.payment_intent : d.payment_intent?.id
      if (!pi) continue
      const id = await marquerLitige(supabase, pi)
      if (id) alertes.push({ quoi: 'LITIGE', detail: `course ${id.slice(-6).toUpperCase()} contestée — ${formaterMontant((d.amount ?? 0) / 100)}, répondre sous 7 jours` })
    }

    // ── 4. Contrôles de cohérence sur la base seule ─────────────────────────
    const { data: toutes } = await supabase.from('courses')
      .select('id, statut, paiement_statut, stripe_payment_intent_id, facture_id, date_fin, prix_estime, prix_final')

    const parPI = new Map<string, string[]>()
    for (const c of toutes ?? []) {
      if (!c.stripe_payment_intent_id) continue
      parPI.set(c.stripe_payment_intent_id, [...(parPI.get(c.stripe_payment_intent_id) ?? []), c.id])
    }
    for (const [pi, ids] of parPI) {
      if (ids.length < 2) continue
      if (await ouvrir(supabase, 'doublon_paiement', 'critique', pi, { courses: ids }))
        alertes.push({ quoi: 'DOUBLON', detail: `${ids.length} courses pour le paiement ${pi.slice(0, 18)}… — ne rien supprimer sans vérifier laquelle a été honorée` })
    }

    const sansDateFin = (toutes ?? []).filter(c => c.statut === 'terminee' && !c.date_fin && !c.facture_id)
    if (sansDateFin.length) {
      if (await ouvrir(supabase, 'terminee_sans_date_fin', 'info', 'global', { courses: sansDateFin.map(c => c.id), total: sansDateFin.length }))
        alertes.push({ quoi: 'courses non facturables', detail: `${sansDateFin.length} course(s) terminée(s) sans date de fin — invisibles pour la facturation mensuelle` })
    } else {
      await resoudreIncident(supabase, 'terminee_sans_date_fin', 'global')
    }
  } catch (err) {
    /* La réconciliation a échoué en cours de route. On ne masque pas : une
     * réconciliation silencieusement cassée est exactement l'angle mort qu'on
     * cherche à supprimer. Ce qui a déjà été corrigé l'est pour de bon — les
     * corrections sont indépendantes et idempotentes. */
    console.error('[reconciliation] echec', err)
    await signalerIncident(supabase, {
      type: 'reconciliation_echouee', gravite: 'critique', reference: new Date().toISOString().slice(0, 10),
      detail: { erreur: String((err as Error)?.message ?? err), corrections: corrections.length, lu },
    })
    await prevenir(`[OWISE] Réconciliation des paiements EN ÉCHEC`,
      `<p>La réconciliation quotidienne s'est arrêtée sur une erreur.</p>
       <p><code>${String((err as Error)?.message ?? err).slice(0, 400)}</code></p>
       <p>${corrections.length} correction(s) avaient déjà été appliquées : elles sont valides.</p>
       <p>Relancer manuellement, ou attendre demain 07:00.</p>`)
    return NextResponse.json({ error: 'reconciliation failed', corrections: corrections.length }, { status: 500 })
  }

  // ── 5. Prévenir, seulement s'il y a quelque chose à dire ─────────────────
  if (alertes.length > 0 || corrections.length > 0) {
    const liste = (a: Action[]) => a.map(x => `<li><strong>${x.quoi}</strong> — ${x.detail}</li>`).join('')
    await prevenir(
      `[OWISE] Réconciliation — ${alertes.length} alerte(s), ${corrections.length} correction(s)`,
      `${alertes.length ? `<p><strong>À regarder :</strong></p><ul>${liste(alertes)}</ul>` : ''}
       ${corrections.length ? `<p><strong>Corrigé automatiquement :</strong></p><ul>${liste(corrections)}</ul>` : ''}
       <p style="color:#848499">Lu : ${lu.sessions} session(s), ${lu.remboursements} remboursement(s), ${lu.litiges} litige(s), ${lu.evenements} événement(s) à reprendre, sur ${JOURS} jours.</p>
       <p><a href="https://www.owise.fr/admin/courses">Voir les courses →</a></p>`)
  }

  return NextResponse.json({
    lu, corrections: corrections.length, alertes: alertes.length,
    detail: { corrections, alertes },
  })
}

/** Ouvre un incident et dit s'il est nouveau — pour ne prévenir qu'une fois. */
async function ouvrir(
  supabase: ReturnType<typeof createAdminClient>,
  type: string, gravite: 'critique' | 'elevee' | 'info',
  reference: string, detail: unknown,
): Promise<boolean> {
  const { nouveau } = await signalerIncident(supabase, { type, gravite, reference, detail })
  return nouveau
}

async function prevenir(sujet: string, html: string): Promise<void> {
  try {
    const { Resend } = await import('resend')
    if (!process.env.RESEND_API_KEY) return
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({ from: 'OWISE <noreply@owise.fr>', to: ADMIN_EMAIL, subject: sujet, html })
  } catch (e) {
    /* L'e-mail est le signal, pas la mémoire : les incidents restent en base. */
    console.error('[reconciliation] e-mail non envoye', e)
  }
}
