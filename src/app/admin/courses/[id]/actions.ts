'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import type { StatutCourse } from '@/lib/types'
import { envoyerNotificationChauffeur, envoyerRecuClient, envoyerAnnulation } from '@/lib/email'
import { getUserEmail } from '@/lib/supabase/admin'
import { envoyerNotifChauffeur } from '@/lib/fcm'

export async function assignerChauffeur(courseId: string, chauffeurId: string | null): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase
    .from('courses')
    .update({ chauffeur_id: chauffeurId || null })
    .eq('id', courseId)

  if (chauffeurId) {
    const [courseRes, chauffeurProfileRes, chauffeurEmail, fcmRes] = await Promise.all([
      supabase.from('courses')
        .select('adresse_depart, adresse_arrivee, date_prevue, nb_passagers, notes, clients(type_compte, entreprise_nom, profiles(prenom, nom, telephone))')
        .eq('id', courseId).single(),
      supabase.from('profiles').select('prenom').eq('id', chauffeurId).single(),
      getUserEmail(chauffeurId),
      supabase.from('chauffeurs').select('fcm_token').eq('id', chauffeurId).single(),
    ])
    const course = courseRes.data
    const chauffeurProfile = chauffeurProfileRes.data
    const fcmToken: string | null = (fcmRes.data as any)?.fcm_token ?? null

    if (course && chauffeurEmail) {
      const client = (course as any).clients
      const clientNom = client?.type_compte === 'entreprise'
        ? (client.entreprise_nom ?? '')
        : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : ''
      const refCourse = courseId.slice(-6).toUpperCase()
      const dateStr = new Date(course.date_prevue).toLocaleString('fr-FR', {
        weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
      })

      // Email + push notification en parallèle
      await Promise.all([
        envoyerNotificationChauffeur({
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
        }),
        fcmToken ? envoyerNotifChauffeur({
          fcmToken,
          title: `🚗 Nouvelle course #${refCourse}`,
          body:  `${course.adresse_depart.split(',')[0]} → ${course.adresse_arrivee.split(',')[0]} · ${dateStr}`,
          data:  { courseId, type: 'assignation' },
        }) : Promise.resolve(),
      ])
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

  // Auto-facturation immédiate si le sous-traitant est en mode "immediat"
  if (statut === 'terminee') {
    const { data: courseForST } = await supabase
      .from('courses')
      .select('id, prix_sous_traitant, sous_traitant_id, adresse_depart, adresse_arrivee, date_prevue')
      .eq('id', courseId).single()

    if (courseForST?.sous_traitant_id && courseForST?.prix_sous_traitant) {
      const { data: st } = await supabase
        .from('sous_traitants')
        .select('mode_paiement')
        .eq('id', courseForST.sous_traitant_id)
        .single()

      if (st?.mode_paiement === 'immediat') {
        const depart = courseForST.adresse_depart.split(',')[0]
        const arrivee = courseForST.adresse_arrivee.split(',')[0]
        const dateLabel = new Date(courseForST.date_prevue)
          .toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        await supabase.from('factures_sous_traitants').insert({
          sous_traitant_id: courseForST.sous_traitant_id,
          periode: `course-${courseId.slice(-8).toUpperCase()}`,
          montant_ht: courseForST.prix_sous_traitant,
          statut: 'en_attente',
          notes: `${dateLabel} · ${depart} → ${arrivee}`,
        })
        revalidatePath(`/admin/sous-traitants/${courseForST.sous_traitant_id}`)
      }
    }
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

export async function assignerSousTraitant(
  courseId: string,
  sousTraitantId: string | null,
  prixSousTraitant: number | null,
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('courses').update({
    sous_traitant_id: sousTraitantId || null,
    prix_sous_traitant: sousTraitantId ? prixSousTraitant : null,
    chauffeur_id: sousTraitantId ? null : undefined, // on retire le chauffeur si ST assigné
  }).eq('id', courseId)
  revalidatePath(`/admin/courses/${courseId}`)
  revalidatePath('/admin/courses')
}
