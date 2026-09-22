'use server'

import { revalidatePath } from 'next/cache'
import { requireAdminClient } from '@/lib/supabase/server'
import { getUserEmail } from '@/lib/supabase/admin'
import { envoyerLienPaiementClient, envoyerNouvelleFacture } from '@/lib/email'
import { dateCourse } from '@/lib/heure'

/**
 * Envoie la facture elle-même au client, réglée ou non.
 *
 * Il n'existait que « Envoyer lien de paiement », masqué dès que la facture
 * était payée : une facture émise après un règlement au TPE ne pouvait donc
 * pas être transmise depuis l'application. L'e-mail renvoie vers l'espace
 * client, où la facture est consultable et imprimable.
 */
export async function envoyerFactureParEmail(
  factureId: string,
): Promise<{ error?: string; envoyeA?: string }> {
  const supabase = await requireAdminClient()

  const [{ data: facture }, { data: parametres }] = await Promise.all([
    supabase
      .from('factures')
      .select('numero, montant_ht, montant_ttc, tva, statut, mode_paiement, date_echeance, client_id, clients(type_compte, entreprise_nom, nom, prenom, profiles(prenom, nom))')
      .eq('id', factureId)
      .single(),
    supabase.from('parametres').select('facture_taux_tva').eq('id', true).single(),
  ])

  if (!facture) return { error: 'Facture introuvable' }
  if (!facture.client_id) return { error: 'Aucun client rattaché à cette facture' }

  const email = await getUserEmail(facture.client_id)
  if (!email) return { error: "Ce client n'a pas d'adresse e-mail enregistrée" }

  const c = (facture as any).clients
  const clientNom = c?.type_compte === 'entreprise'
    ? (c.entreprise_nom ?? '—')
    : `${c?.prenom ?? c?.profiles?.prenom ?? ''} ${c?.nom ?? c?.profiles?.nom ?? ''}`.trim() || 'Madame, Monsieur'

  // Décrire les courses facturées plutôt qu'une référence unique : une facture
  // peut en regrouper plusieurs.
  const { data: courses } = await supabase
    .from('courses')
    .select('id, date_prevue, adresse_depart, adresse_arrivee')
    .eq('facture_id', factureId)
    .order('date_prevue')

  const refCourse = !courses?.length
    ? facture.numero
    : courses.length === 1
      ? `${dateCourse(courses[0].date_prevue, { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${courses[0].adresse_depart} → ${courses[0].adresse_arrivee}`
      : `${courses.length} courses`

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'
  try {
    await envoyerNouvelleFacture({
      clientEmail: email,
      clientNom,
      factureNumero: facture.numero,
      montantHt:  Number(facture.montant_ht),
      montantTtc: Number(facture.montant_ttc),
      tauxTva:    Number(parametres?.facture_taux_tva ?? 0),
      dateEcheance: facture.date_echeance ?? new Date().toISOString(),
      refCourse,
      lienFacture: `${siteUrl}/espace-client/factures/${factureId}`,
      dejaReglee: facture.statut === 'payee',
      modePaiement: facture.mode_paiement ?? null,
      factureId,
    })
  } catch (e) {
    return { error: `Envoi impossible : ${(e as Error).message}` }
  }

  revalidatePath(`/admin/facturation/${factureId}`)
  return { envoyeA: email }
}

export async function changerStatutFacture(
  factureId: string,
  statut: 'payee' | 'retard' | 'en_attente',
): Promise<void> {
  const supabase = await requireAdminClient()
  await supabase.from('factures').update({ statut }).eq('id', factureId)
  revalidatePath(`/admin/facturation/${factureId}`)
  revalidatePath('/admin/facturation')
}

export async function envoyerLienPaiement(
  factureId: string,
): Promise<{ error?: string }> {
  const supabase = await requireAdminClient()

  const { data: facture } = await supabase
    .from('factures')
    .select('numero, montant_ttc, stripe_payment_link, client_id, date_echeance, clients(type_compte, entreprise_nom, profiles(prenom, nom))')
    .eq('id', factureId)
    .single()

  if (!facture?.stripe_payment_link) return { error: 'Pas de lien Stripe sur cette facture' }
  if (!facture.client_id) return { error: 'Pas de client associé à cette facture' }

  const email = await getUserEmail(facture.client_id)
  if (!email) return { error: 'Email client introuvable' }

  const client = (facture as any).clients
  const prenom = client?.profiles?.prenom ?? ''

  await envoyerLienPaiementClient({
    clientEmail: email,
    clientPrenom: prenom,
    numeroFacture: facture.numero,
    montantTTC: facture.montant_ttc,
    dateEcheance: facture.date_echeance ?? null,
    lienPaiement: facture.stripe_payment_link,
  })

  return {}
}
