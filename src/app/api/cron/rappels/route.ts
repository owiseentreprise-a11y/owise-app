import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserEmail } from '@/lib/supabase/admin'
import { envoyerConfirmationClient, envoyerNotificationChauffeur } from '@/lib/email'

// Appelé par Vercel Cron chaque jour à 8h
// Protégé par CRON_SECRET pour éviter les appels non autorisés
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Courses prévues demain (entre 00:00 et 23:59 demain)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const from = new Date(tomorrow); from.setHours(0, 0, 0, 0)
  const to   = new Date(tomorrow); to.setHours(23, 59, 59, 999)

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id, adresse_depart, adresse_arrivee, date_prevue, nb_passagers, notes, type_vehicule,
      client_id, chauffeur_id,
      clients(type_compte, entreprise_nom, profiles(prenom, nom, telephone)),
      chauffeurs(profiles(prenom, nom))
    `)
    .gte('date_prevue', from.toISOString())
    .lte('date_prevue', to.toISOString())
    .in('statut', ['en_attente', 'acceptee'])

  if (!courses || courses.length === 0) {
    return NextResponse.json({ sent: 0, message: 'Aucune course demain' })
  }

  let sent = 0

  for (const course of courses) {
    const client = (course as any).clients
    const chauffeur = (course as any).chauffeurs
    const refCourse = new Date(course.date_prevue).getTime().toString(36).toUpperCase().slice(-6)

    const clientNom = client?.type_compte === 'entreprise'
      ? (client.entreprise_nom ?? '')
      : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : ''

    // Rappel client
    if (course.client_id) {
      const clientEmail = await getUserEmail(course.client_id)
      if (clientEmail) {
        await envoyerConfirmationClient({
          clientEmail,
          clientPrenom: client?.profiles?.prenom ?? clientNom,
          adresseDepart: course.adresse_depart,
          adresseArrivee: course.adresse_arrivee,
          datePrevue: course.date_prevue,
          typeVehicule: course.type_vehicule,
          nbPassagers: course.nb_passagers,
          refCourse,
        })
        sent++
      }
    }

    // Rappel chauffeur
    if (course.chauffeur_id) {
      const chauffeurEmail = await getUserEmail(course.chauffeur_id)
      if (chauffeurEmail) {
        await envoyerNotificationChauffeur({
          chauffeurEmail,
          chauffeurPrenom: chauffeur?.profiles?.prenom ?? '',
          adresseDepart: course.adresse_depart,
          adresseArrivee: course.adresse_arrivee,
          datePrevue: course.date_prevue,
          clientNom,
          clientTel: client?.profiles?.telephone ?? null,
          nbPassagers: course.nb_passagers,
          notes: course.notes,
          refCourse,
        })
        sent++
      }
    }
  }

  return NextResponse.json({ sent, courses: courses.length })
}
