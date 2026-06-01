import { NextResponse } from 'next/server'
import { createAdminClient, getUserEmail } from '@/lib/supabase/admin'
import {
  envoyerConfirmationClient,
  envoyerNotificationChauffeur,
  envoyerRelanceFacture,
} from '@/lib/email'

// Appelé par Vercel Cron chaque jour à 8h
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  const now = new Date()

  // ── 1. Rappels courses J-1 ─────────────────────────────────────────────────
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const from = new Date(tomorrow); from.setHours(0, 0, 0, 0)
  const to   = new Date(tomorrow); to.setHours(23, 59, 59, 999)

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, notes, type_vehicule,
      client_id, chauffeur_id,
      clients(type_compte, entreprise_nom, nom, prenom, tel),
      chauffeurs(profiles(prenom, nom))
    `)
    .gte('date_prevue', from.toISOString())
    .lte('date_prevue', to.toISOString())
    .in('statut', ['en_attente', 'acceptee'])

  let sentCourses = 0

  if (courses && courses.length > 0) {
    const emailResults = await Promise.all(
      courses.map(course => Promise.all([
        course.client_id ? getUserEmail(course.client_id) : Promise.resolve(null),
        course.chauffeur_id ? getUserEmail(course.chauffeur_id) : Promise.resolve(null),
      ]))
    )

    await Promise.all(courses.map(async (course, i) => {
      const [clientEmail, chauffeurEmail] = emailResults[i]
      const client = (course as any).clients
      const chauffeur = (course as any).chauffeurs
      const refCourse = course.id.slice(-6).toUpperCase()

      const clientNom = client?.type_compte === 'entreprise'
        ? (client.entreprise_nom ?? '')
        : `${client?.prenom ?? ''} ${client?.nom ?? ''}`.trim() || ''
      const clientTel = client?.tel ?? null

      const sends: Promise<void>[] = []

      if (clientEmail) {
        sends.push(envoyerConfirmationClient({
          clientEmail,
          clientPrenom: client?.prenom ?? clientNom,
          adresseDepart: course.adresse_depart,
          adresseArrivee: course.adresse_arrivee,
          datePrevue: course.date_prevue,
          typeVehicule: course.type_vehicule,
          nbPassagers: course.nb_passagers,
          refCourse,
        }))
        sentCourses++
      }

      if (chauffeurEmail) {
        sends.push(envoyerNotificationChauffeur({
          chauffeurEmail,
          chauffeurPrenom: chauffeur?.profiles?.prenom ?? '',
          adresseDepart: course.adresse_depart,
          adresseArrivee: course.adresse_arrivee,
          datePrevue: course.date_prevue,
          clientNom,
          clientTel,
          nbPassagers: course.nb_passagers,
          notes: course.notes,
          refCourse,
        }))
        sentCourses++
      }

      await Promise.all(sends)
    }))
  }

  // ── 2. Détection & relance factures en retard ──────────────────────────────
  const { data: facturesRetard } = await supabase
    .from('factures')
    .select('id, numero, montant_ttc, date_echeance, statut, client_id, stripe_payment_link')
    .in('statut', ['en_attente', 'retard'])
    .lt('date_echeance', now.toISOString())
    .not('date_echeance', 'is', null)

  let sentRelances = 0
  let updatedRetard = 0

  if (facturesRetard && facturesRetard.length > 0) {
    // Passer toutes les en_attente dépassées → retard
    const idsAMarquer = facturesRetard
      .filter(f => f.statut === 'en_attente')
      .map(f => f.id)

    if (idsAMarquer.length > 0) {
      await supabase.from('factures')
        .update({ statut: 'retard' })
        .in('id', idsAMarquer)
      updatedRetard = idsAMarquer.length
    }

    // Relances : envoyer uniquement les retards (pas trop fréquent — 1 relance max/j via cron)
    await Promise.all(facturesRetard.map(async (facture) => {
      if (!facture.client_id || !facture.date_echeance) return

      const clientEmail = await getUserEmail(facture.client_id)
      if (!clientEmail) return

      const echeance = new Date(facture.date_echeance)
      const joursRetard = Math.floor((now.getTime() - echeance.getTime()) / 86400000)
      if (joursRetard <= 0) return

      // Envoyer relance à J+1, J+7, J+15, J+30
      const relanceDays = [1, 7, 15, 30]
      if (!relanceDays.includes(joursRetard)) return

      const { data: clientData } = await supabase
        .from('clients')
        .select('nom, prenom, entreprise_nom, type_compte')
        .eq('id', facture.client_id)
        .single()

      const clientNom = clientData?.type_compte === 'entreprise'
        ? (clientData.entreprise_nom ?? clientEmail)
        : `${clientData?.prenom ?? ''} ${clientData?.nom ?? ''}`.trim() || clientEmail

      await envoyerRelanceFacture({
        clientEmail,
        clientNom,
        factureNumero: facture.numero,
        montantTtc: facture.montant_ttc,
        dateEcheance: facture.date_echeance,
        joursRetard,
        lienFacture: facture.stripe_payment_link ?? `${siteUrl}/espace-client`,
      })
      sentRelances++
    }))
  }

  return NextResponse.json({
    courses: courses?.length ?? 0,
    sentRappelsCourses: sentCourses,
    facturesRetardMisesAJour: updatedRetard,
    relancesEnvoyees: sentRelances,
  })
}
