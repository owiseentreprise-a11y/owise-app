'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient, getUserEmail } from '@/lib/supabase/admin'
import {
  envoyerChauffeurAssigne,
  envoyerRefusChauffeur,
  envoyerRecuClient,
  envoyerNouvelleFacture,
} from '@/lib/email'

async function getChauffeurUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function accepterCourseAction(courseId: string): Promise<void> {
  const user = await getChauffeurUser()
  if (!user) return

  const admin = createAdminClient()

  await Promise.all([
    admin.from('courses').update({ statut: 'acceptee' }).eq('id', courseId),
    admin.from('chauffeurs').update({ statut: 'en_course' }).eq('id', user.id),
  ])

  // Notifier le client
  const [courseRes, chauffeurProfileRes] = await Promise.all([
    admin.from('courses')
      .select('adresse_depart, date_prevue, client_id, clients(type_compte, entreprise_nom, profiles(prenom, nom))')
      .eq('id', courseId).single(),
    admin.from('profiles').select('prenom, nom').eq('id', user.id).single(),
  ])

  const course = courseRes.data
  const chauffeurProfile = chauffeurProfileRes.data
  if (course?.client_id && chauffeurProfile) {
    const clientEmail = await getUserEmail(course.client_id)
    const client = (course as any).clients
    const clientPrenom = client?.profiles?.prenom ?? (client?.entreprise_nom ?? '')
    if (clientEmail && clientPrenom) {
      await envoyerChauffeurAssigne({
        clientEmail, clientPrenom,
        chauffeurPrenom: chauffeurProfile.prenom ?? '',
        chauffeurNom: chauffeurProfile.nom ?? '',
        adresseDepart: course.adresse_depart,
        datePrevue: course.date_prevue,
        refCourse: courseId.slice(-6).toUpperCase(),
      })
    }
  }

  revalidatePath('/chauffeur')
}

export async function refuserCourseAction(courseId: string): Promise<void> {
  const user = await getChauffeurUser()
  if (!user) return

  const admin = createAdminClient()

  // Récupérer les infos avant de désassigner
  const [courseRes, chauffeurProfileRes] = await Promise.all([
    admin.from('courses')
      .select('adresse_depart, adresse_arrivee, date_prevue')
      .eq('id', courseId).single(),
    admin.from('profiles').select('prenom, nom').eq('id', user.id).single(),
  ])

  await admin.from('courses')
    .update({ statut: 'en_attente', chauffeur_id: null })
    .eq('id', courseId)

  const course = courseRes.data
  const chauffeurProfile = chauffeurProfileRes.data
  if (course && chauffeurProfile) {
    await envoyerRefusChauffeur({
      chauffeurNom: `${chauffeurProfile.prenom ?? ''} ${chauffeurProfile.nom ?? ''}`.trim(),
      adresseDepart: course.adresse_depart,
      adresseArrivee: course.adresse_arrivee,
      datePrevue: course.date_prevue,
      refCourse: courseId.slice(-6).toUpperCase(),
    })
  }

  revalidatePath('/chauffeur')
}

export async function progresserCourseAction(
  courseId: string,
  nextStatut: 'en_route' | 'prise_en_charge' | 'terminee',
): Promise<void> {
  const user = await getChauffeurUser()
  if (!user) return

  const admin = createAdminClient()

  const updates: Record<string, unknown> = { statut: nextStatut }
  if (nextStatut === 'en_route')  updates.date_debut = new Date().toISOString()
  if (nextStatut === 'terminee')  updates.date_fin   = new Date().toISOString()

  await admin.from('courses').update(updates).eq('id', courseId)

  if (nextStatut === 'terminee') {
    await admin.from('chauffeurs').update({ statut: 'disponible' }).eq('id', user.id)

    // Reçu client
    const [courseRes, chauffeurProfileRes] = await Promise.all([
      admin.from('courses')
        .select('adresse_depart, adresse_arrivee, date_prevue, prix_final, client_id, facture_id, clients(type_compte, entreprise_nom, nom, prenom, facturation_mode)')
        .eq('id', courseId).single(),
      admin.from('profiles').select('prenom, nom').eq('id', user.id).single(),
    ])

    const course = courseRes.data
    const chauffeurProfile = chauffeurProfileRes.data
    const client = (course as any).clients
    const isEntreprise = client?.type_compte === 'entreprise'
    const clientPrenom = client?.prenom ?? (client?.entreprise_nom ?? '')
    const clientNom = isEntreprise
      ? (client?.entreprise_nom ?? '')
      : `${client?.prenom ?? ''} ${client?.nom ?? ''}`.trim()

    if (course?.client_id) {
      const clientEmail = await getUserEmail(course.client_id)

      // Reçu pour clients particuliers (pas de facture auto)
      if (clientEmail && course.prix_final && !isEntreprise) {
        await envoyerRecuClient({
          clientEmail, clientPrenom,
          adresseDepart: course.adresse_depart,
          adresseArrivee: course.adresse_arrivee,
          datePrevue: course.date_prevue,
          prixFinal: course.prix_final,
          chauffeurNom: chauffeurProfile
            ? `${chauffeurProfile.prenom ?? ''} ${chauffeurProfile.nom ?? ''}`.trim()
            : undefined,
          refCourse: courseId.slice(-6).toUpperCase(),
        })
      }

      // Auto-génération de facture uniquement si mode "par_prestation"
      const factMode = client?.facturation_mode ?? 'mensuelle'
      if (isEntreprise && factMode === 'par_prestation' && course.prix_final && !course.facture_id) {
        const prixFinal = Number(course.prix_final)
        const montantTtc = prixFinal
        const montantHt  = Math.round((prixFinal / 1.2) * 100) / 100
        const tva        = Math.round((prixFinal - montantHt) * 100) / 100

        // Numéro de facture : OW-YYYYMM-XXXX
        const now = new Date()
        const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
        const { count } = await admin
          .from('factures')
          .select('*', { count: 'exact', head: true })
          .like('numero', `OW-${yyyymm}-%`)
        const seq = String((count ?? 0) + 1).padStart(4, '0')
        const numero = `OW-${yyyymm}-${seq}`

        const dateEcheance = new Date(now)
        dateEcheance.setDate(dateEcheance.getDate() + 30)

        const { data: newFacture } = await admin.from('factures').insert({
          client_id:      course.client_id,
          numero,
          statut:         'en_attente',
          montant_ht:     montantHt,
          montant_ttc:    montantTtc,
          tva,
          date_emission:  now.toISOString(),
          date_echeance:  dateEcheance.toISOString(),
          mode_paiement:  'virement',
        }).select('id').single()

        if (newFacture) {
          // Lier la course à la facture
          await admin.from('courses')
            .update({ facture_id: newFacture.id })
            .eq('id', courseId)

          // Email au client
          const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
          if (clientEmail) {
            await envoyerNouvelleFacture({
              clientEmail,
              clientNom,
              factureNumero:  numero,
              montantHt,
              montantTtc,
              dateEcheance:   dateEcheance.toISOString(),
              refCourse:      courseId.slice(-6).toUpperCase(),
              lienFacture:    `${siteUrl}/espace-client/factures/${newFacture.id}`,
            })
          }
        }
      }
    }
  }

  revalidatePath('/chauffeur')
}
