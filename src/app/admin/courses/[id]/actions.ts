'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import type { StatutCourse } from '@/lib/types'
import { envoyerNotificationChauffeur, envoyerRecuClient, envoyerAnnulation } from '@/lib/email'
import { getUserEmail } from '@/lib/supabase/admin'

export async function assignerChauffeur(courseId: string, chauffeurId: string | null): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase
    .from('courses')
    .update({ chauffeur_id: chauffeurId || null })
    .eq('id', courseId)

  if (chauffeurId) {
    const [courseRes, chauffeurProfileRes, chauffeurEmail] = await Promise.all([
      supabase.from('courses')
        .select('adresse_depart, adresse_arrivee, date_prevue, nb_passagers, notes, clients(type_compte, entreprise_nom, profiles(prenom, nom, telephone))')
        .eq('id', courseId).single(),
      supabase.from('profiles').select('prenom').eq('id', chauffeurId).single(),
      getUserEmail(chauffeurId),
    ])
    const course = courseRes.data
    const chauffeurProfile = chauffeurProfileRes.data
    if (course && chauffeurEmail) {
      const client = (course as any).clients
      const clientNom = client?.type_compte === 'entreprise'
        ? (client.entreprise_nom ?? '')
        : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : ''
      const refCourse = courseId.slice(-6).toUpperCase()
      await envoyerNotificationChauffeur({
        chauffeurEmail,
        chauffeurPrenom: chauffeurProfile?.prenom ?? '',
        adresseDepart: course.adresse_depart,
        adresseArrivee: course.adresse_arrivee,
        datePrevue: course.date_prevue,
        clientNom,
        clientTel: client?.profiles?.telephone ?? null,
        nbPassagers: course.nb_passagers,
        notes: course.notes,
        refCourse,
      })
    }
  }

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin')
}

export async function changerStatut(courseId: string, statut: StatutCourse, chauffeurId: string | null): Promise<void> {
  const supabase = await requireAdminClient()
  const updates: Record<string, unknown> = { statut }
  if (statut === 'en_route') updates.date_debut = new Date().toISOString()
  if (statut === 'terminee') updates.date_fin = new Date().toISOString()
  await supabase.from('courses').update(updates).eq('id', courseId)

  if (chauffeurId && (statut === 'annulee' || statut === 'en_attente')) {
    await supabase.from('chauffeurs').update({ statut: 'disponible' }).eq('id', chauffeurId)
  }
  if (chauffeurId && statut === 'terminee') {
    await supabase.from('chauffeurs').update({ statut: 'disponible' }).eq('id', chauffeurId)
  }

  if (statut === 'terminee' || statut === 'annulee') {
    const { data: course } = await supabase
      .from('courses')
      .select('adresse_depart, adresse_arrivee, date_prevue, prix_final, client_id, clients(type_compte, entreprise_nom, profiles(prenom, nom)), chauffeurs(profiles(prenom, nom))')
      .eq('id', courseId).single()

    if (course) {
      const client = (course as any).clients
      const chauffeurProfile = (course as any).chauffeurs?.profiles
      const refCourse = courseId.slice(-6).toUpperCase()
      const clientPrenom = client?.profiles?.prenom ?? (client?.entreprise_nom ?? '')

      if (course.client_id) {
        const clientEmail = await getUserEmail(course.client_id)
        if (clientEmail) {
          if (statut === 'terminee' && course.prix_final) {
            await envoyerRecuClient({
              clientEmail, clientPrenom,
              adresseDepart: course.adresse_depart,
              adresseArrivee: course.adresse_arrivee,
              datePrevue: course.date_prevue,
              prixFinal: course.prix_final,
              chauffeurNom: chauffeurProfile ? `${chauffeurProfile.prenom} ${chauffeurProfile.nom}` : undefined,
              refCourse,
            })
          } else if (statut === 'annulee') {
            await envoyerAnnulation({
              destinataireEmail: clientEmail, destinatairePrenom: clientPrenom,
              role: 'client',
              adresseDepart: course.adresse_depart, adresseArrivee: course.adresse_arrivee,
              datePrevue: course.date_prevue, refCourse,
            })
          }
        }
      }

      if (statut === 'annulee' && chauffeurId) {
        const chauffeurEmail = await getUserEmail(chauffeurId)
        if (chauffeurEmail) {
          await envoyerAnnulation({
            destinataireEmail: chauffeurEmail,
            destinatairePrenom: chauffeurProfile?.prenom ?? '',
            role: 'chauffeur',
            adresseDepart: course.adresse_depart, adresseArrivee: course.adresse_arrivee,
            datePrevue: course.date_prevue, refCourse,
          })
        }
      }
    }
  }

  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin')
}

export async function setPrixFinal(courseId: string, prix: number | null): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('courses').update({ prix_final: prix }).eq('id', courseId)
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin')
}

export async function modifierNotes(courseId: string, notes: string): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('courses').update({ notes: notes || null }).eq('id', courseId)
  revalidatePath(`/admin/courses/${courseId}`)
}
