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

  // Récupère tous les emails en parallèle (évite N+1 séquentiels)
  const emailResults = await Promise.all(
    courses.map(course => Promise.all([
      course.client_id ? getUserEmail(course.client_id) : Promise.resolve(null),
      course.chauffeur_id ? getUserEmail(course.chauffeur_id) : Promise.resolve(null),
    ]))
  )

  let sent = 0

  await Promise.all(courses.map(async (course, i) => {
    const [clientEmail, chauffeurEmail] = emailResults[i]
    const client = (course as any).clients
    const chauffeur = (course as any).chauffeurs
    const refCourse = course.id.slice(-6).toUpperCase()

    const clientNom = client?.type_compte === 'entreprise'
      ? (client.entreprise_nom ?? '')
      : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : ''

    const sends: Promise<void>[] = []

    if (clientEmail) {
      sends.push(envoyerConfirmationClient({
        clientEmail,
        clientPrenom: client?.profiles?.prenom ?? clientNom,
        adresseDepart: course.adresse_depart,
        adresseArrivee: course.adresse_arrivee,
        datePrevue: course.date_prevue,
        typeVehicule: course.type_vehicule,
        nbPassagers: course.nb_passagers,
        refCourse,
      }))
      sent++
    }

    if (chauffeurEmail) {
      sends.push(envoyerNotificationChauffeur({
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
      }))
      sent++
    }

    await Promise.all(sends)
  }))

  return NextResponse.json({ sent, courses: courses.length })
}
