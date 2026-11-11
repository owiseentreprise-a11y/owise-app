'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient, trouverClientParEmail } from '@/lib/supabase/admin'
import { creerCoursesDepuisDevis } from '@/lib/devis-vers-courses'
import { requireAdminClient } from '@/lib/supabase/server'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { vehiculePourBase } from '@/lib/vehicule'
import { calculerTotal, chargerDevis, chargerPrestataire, genererNumeroDevis, type LigneDevis } from '@/lib/devis-client'
import { composerEmailAcceptation, composerEmailDevis } from '@/lib/devis-email'
import { assurerJeton, lienAcceptation } from '@/lib/devis-jeton'
import { genererDevisPdf } from '@/lib/devis-pdf'
import { genererNumeroFacture } from '@/lib/facturation'
import { envoyerDevisClient } from '@/lib/email'

/** Les champs que le formulaire renvoie. Le total n'en fait pas partie. */
export type SaisieDevis = {
  client_nom: string
  client_societe: string | null
  client_email: string | null
  client_tel: string | null
  client_adresse: string | null
  date_prestation: string | null
  date_validite: string | null
  notes: string | null
  lignes: LigneDevis[]
}

export async function creerDevis(): Promise<string> {
  await requireAdminClient()
  const supabase = createAdminClient()

  const numero = await genererNumeroDevis(supabase)
  const { data, error } = await supabase
    .from('devis_clients')
    .insert({
      numero,
      client_nom: '',
      statut: 'brouillon',
      lignes: [],
      total_ht: 0,
      /* Les conditions d'attente et d'annulation ne se reglent plus devis
         par devis : elles sont identiques partout, dans `conditions.ts`.
         Ces deux colonnes ne sont plus lues — a supprimer par migration. */
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
  return data.id as string
}

export async function enregistrerDevis(id: string, saisie: SaisieDevis) {
  await requireAdminClient()
  const supabase = createAdminClient()

  if (!saisie.client_nom.trim()) throw new Error('Le nom du client est obligatoire.')

  /* Les lignes vides sont jetees a l'enregistrement plutot qu'interdites a la
     saisie : on ajoute souvent une ligne « pour voir » avant de la remplir. */
  const lignes = saisie.lignes.filter(l =>
    l.depart.trim() || l.arrivee.trim() || Number(l.prix) > 0)

  const { error } = await supabase
    .from('devis_clients')
    .update({
      client_nom:          saisie.client_nom.trim(),
      client_societe:      saisie.client_societe?.trim() || null,
      client_email:        saisie.client_email?.trim() || null,
      client_tel:          saisie.client_tel?.trim() || null,
      client_adresse:      saisie.client_adresse?.trim() || null,
      date_prestation:     saisie.date_prestation || null,
      date_validite:       saisie.date_validite || null,
      notes:               saisie.notes?.trim() || null,
      lignes,
      total_ht:            calculerTotal(lignes),
      updated_at:          new Date().toISOString(),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
}

export async function changerStatutDevis(id: string, statut: string) {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('devis_clients')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
}

export async function supprimerDevisClient(id: string) {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase.from('devis_clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/devis-clients')
}

/**
 * Le devis accepte devient des courses — une par ligne.
 *
 * C'est le point de toute la fonctionnalite : sans ce bouton, huit transferts
 * acceptes se ressaisissent huit fois a la main.
 *
 * La facture n'est PAS creee ici : elle se monte depuis
 * /admin/facturation/nouvelle en cochant ces courses, parce qu'elle demande un
 * client enregistre, ce qu'un devis n'a pas forcement. Le devis passe en
 * « accepte » et reste consultable.
 */
export async function convertirDevisEnCourses(id: string): Promise<number> {
  await requireAdminClient()

  /* La construction des courses vit dans `devis-vers-courses.ts`, parce
     que le webhook Stripe l'emprunte aussi quand le client accepte son
     devis lui-même. Deux écritures auraient divergé sur l’heure, le
     véhicule ou la référence. */
  const { creees, dejaFait } = await creerCoursesDepuisDevis(id)
  if (dejaFait) throw new Error('Ce devis a déjà été converti.')

  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin/planning')

  return creees
}

/**
 * Envoie le devis au client, le PDF en pièce jointe, et le passe en « envoyé ».
 *
 * Le message n'est pas composé ici : `composerEmailDevis` le fabrique, et
 * l'écran d'aperçu affiche exactement ce même résultat. Composer une
 * deuxième fois à l'envoi reviendrait à faire valider un message et à en
 * expédier un autre.
 *
 * Le statut ne passe à « envoyé » qu'APRÈS un envoi réussi : `envoyerDevisClient`
 * lève si Resend refuse, et la ligne suivante n'est jamais atteinte. Un devis
 * marqué « envoyé » l'a donc réellement été.
 */
export async function envoyerDevisAction(
  id: string,
  /**
   * « moi » envoie le devis a la messagerie d'Owise au lieu du client.
   *
   * Demande de l'exploitant le 2026-11-09 : relire dans sa propre boite
   * avant d'envoyer. Le message et le PDF sont EXACTEMENT ceux que le
   * client recevrait ; seul le sujet est prefixe.
   *
   * Et le devis NE PASSE PAS en « envoye » : s'envoyer un exemplaire n'est
   * pas envoyer au client. Un statut qui mentirait ferait croire a
   * l'exploitant qu'une reponse est partie alors qu'elle attend encore.
   */
  destinataire: 'client' | 'moi' = 'client',
): Promise<string> {
  await requireAdminClient()

  const [devis, prestataire] = await Promise.all([chargerDevis(id), chargerPrestataire()])
  if (!devis) throw new Error('Devis introuvable.')

  const compose = composerEmailDevis(devis, prestataire)
  const pdf = await genererDevisPdf(id)

  const aMoi = destinataire === 'moi'
  if (aMoi && !prestataire.email) {
    throw new Error(
      'Aucune adresse e-mail d’entreprise dans Paramètres : impossible de s’envoyer un exemplaire.',
    )
  }
  const message = aMoi
    ? {
        ...compose,
        destinataire: prestataire.email as string,
        sujet: `[Exemplaire, non envoyé au client] ${compose.sujet}`,
      }
    : compose

  await envoyerDevisClient({
    message,
    pdf: pdf ? { filename: pdf.nomFichier, content: Buffer.from(pdf.contenu) } : undefined,
  })

  if (aMoi) return message.destinataire as string

  const supabase = createAdminClient()
  /* ON ENREGISTRE QUAND, ET A QUI.

     Le statut « envoyé » se posait aussi bien par ce bouton que par la
     liste déroulante de l'éditeur : impossible de savoir si un e-mail
     était réellement parti, ni vers quelle adresse. L'exploitant, le
     2026-11-11 : « j'ai pas l'information comme quoi c'est bien parti ».

     `envoye_le` n'est écrit QUE sur ce chemin, c'est-à-dire seulement
     après un envoi réussi — `envoyerDevisClient` lève si Resend refuse,
     et la ligne suivante n'est jamais atteinte. Un devis qui porte une
     date d'envoi est donc un devis réellement parti. */
  await supabase.from('devis_clients')
    .update({
      statut: 'envoye',
      envoye_le: new Date().toISOString(),
      envoye_a: message.destinataire as string,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
  revalidatePath(`/admin/devis-clients/${id}/envoi`)

  return message.destinataire as string
}

/**
 * Le PDF du devis, pour l'envoi à la main depuis sa propre messagerie.
 *
 * Il passe par une action plutôt que par une route HTTP : `requireAdminClient`
 * garde ainsi le fichier, sans avoir à raisonner sur la protection d'une URL
 * publique. Un devis pèse quelques kilo-octets, le base64 ne coûte rien.
 */
export async function telechargerDevisPdfAction(id: string): Promise<{ nom: string; base64: string }> {
  await requireAdminClient()
  const pdf = await genererDevisPdf(id)
  if (!pdf) throw new Error('Devis introuvable.')
  return { nom: pdf.nomFichier, base64: Buffer.from(pdf.contenu).toString('base64') }
}

/**
 * Le devis accepté devient une facture.
 *
 * POURQUOI CE BOUTON
 *
 * L'exploitant, le 2026-11-09 : « transformer ce devis en facture et en
 * réservation en même temps ». La réservation existait déjà
 * (`convertirDevisEnCourses`) ; la facture, non. Il fallait aller dans
 * Facturation → Nouvelle facture, retrouver le client, cocher les courses :
 * trois écrans, et surtout un chemin qui ne marchait pas, puisque les
 * courses nées d'un devis ne portent aucun client et n'apparaissaient donc
 * jamais dans cette liste.
 *
 * CE QU'ELLE FAIT
 *
 * Elle exige un client ENREGISTRÉ, retrouvé par l'adresse e-mail du devis.
 * Ce n'est pas une facilité : `factures.client_id` est la seule chose qui
 * rattache une facture à quelqu'un. Sans lui, le document imprime « — » à la
 * place du nom du client, et l'e-mail de facture refuse de partir.
 *
 * Les lignes du devis deviennent les lignes de la facture, telles quelles —
 * par le même mécanisme que la saisie à la main, décrit dans
 * `facture-document.ts`. Si des courses sont déjà nées de ce devis et ne
 * sont pas facturées, ce sont elles qui font le corps : elles portent les
 * vraies dates.
 *
 * Aucun lien de paiement Stripe n'est créé ici : le devis se règle à
 * réception de la facture, par virement, comme son bloc « Règlement » le
 * dit. L'exploitant peut en créer un depuis la facture s'il le souhaite.
 */
/**
 * Ce que la facturation d'un devis rend : la facture, ou le chemin pour
 * créer la fiche client qui manque.
 *
 * Un simple message d'erreur obligeait à retaper à la main, dans un autre
 * écran, six informations déjà saisies sur le devis.
 */
export type ResultatFacturation =
  | { factureId: string }
  | { clientManquant: string }

export async function facturerDevisAction(id: string): Promise<ResultatFacturation> {
  await requireAdminClient()
  const supabase = createAdminClient()

  const { data: devis, error: err } = await supabase
    .from('devis_clients').select('*').eq('id', id).single()
  if (err || !devis) throw new Error('Devis introuvable.')

  const lignes = (Array.isArray(devis.lignes) ? devis.lignes : []) as LigneDevis[]
  const utiles = lignes.filter(l => Number(l.prix) > 0)
  if (utiles.length === 0) {
    throw new Error('Ce devis ne porte aucune ligne chiffrée : il n’y a rien à facturer.')
  }

  /* Le client, retrouvé par son adresse. Message explicite plutôt que
     silence : sans fiche client, l'exploitant doit savoir quoi faire. */
  const email = String(devis.client_email ?? '').trim()
  if (!email) {
    throw new Error(
      'Ce devis ne porte pas d’adresse e-mail. Ajoutez-la, puis créez la fiche client.',
    )
  }
  /* Par le compte, pas par `clients.email` : cette colonne est vide pour
     presque toutes les fiches. Voir trouverClientParEmail. */
  const clientId = await trouverClientParEmail(email)
  if (!clientId) {
    /* Pas d'erreur sèche : on renvoie le formulaire client PRÉ-REMPLI avec
       ce que le devis porte déjà. Créer un compte d'office serait pire —
       c'est un vrai compte, avec un mot de passe et un accès ; il revient à
       l'exploitant de décider s'il en crée un. */
    const parts = String(devis.client_nom ?? '').trim().split(/\s+/)
    const parametres = new URLSearchParams({
      email,
      prenom: parts[0] ?? '',
      nom: parts.slice(1).join(' ') || (parts[0] ?? ''),
      telephone: String(devis.client_tel ?? ''),
      entreprise_nom: String(devis.client_societe ?? ''),
      depuis: String(devis.numero),
    })
    return { clientManquant: `/admin/clients/nouveau?${parametres.toString()}` }
  }

  /* Les courses nées de ce devis, pas encore facturées. Leur `ref` porte le
     numéro du devis — c’est `convertirDevisEnCourses` qui la pose. */
  const { data: toutesLesCourses } = await supabase
    .from('courses')
    .select('id, facture_id')
    .like('ref', `${devis.numero}-%`)

  /* DEUX FOIS LA MEME FACTURE : le bouton ne s'efface pas apres usage, et
     rien n'empechait de le cliquer a nouveau — deux factures, deux numeros,
     pour une seule prestation. C'est une erreur comptable, pas une gene.

     Ce garde ne voit que les devis DEJA convertis en courses : c'est la
     marque qu'on a, puisque rien en base ne relie une facture au devis dont
     elle vient. Un devis facture sans courses reste donc facturable deux
     fois — il faudrait une colonne `devis_id` sur `factures` pour fermer ce
     cas, ce qui touche au schema et attend une decision. */
  const dejaFacturee = (toutesLesCourses ?? []).find(c => c.facture_id)
  if (dejaFacturee) {
    throw new Error(
      'Ce devis a déjà été facturé : ses prestations sont rattachées à une facture. '
      + 'Ouvrez Facturation pour la retrouver.',
    )
  }

  const courseIds = (toutesLesCourses ?? []).map(c => c.id as string)

  const totalTtc = Math.round(Number(devis.total_ht) * 100) / 100

  /* Le taux de TVA et le délai de règlement viennent d’/admin/tarifs : on
     les lit, on ne les suppose pas. Une colonne oubliée dans un select fait
     retomber le code sur sa valeur de repli, en silence. */
  const { data: p } = await supabase
    .from('parametres').select('facture_taux_tva, facture_delai_paiement').eq('id', true).single()
  const tauxTva = Number(p?.facture_taux_tva ?? 0)
  const delai = Number(p?.facture_delai_paiement ?? 15)
  const totalHt = Math.round((totalTtc / (1 + tauxTva / 100)) * 100) / 100

  /* Le corps de la facture. Quand des courses existent, ce sont elles ; on
     n'écrit alors aucune ligne dans `notes`, sinon la facture porterait deux
     fois les mêmes prestations — une fois dans le tableau, une fois dans le
     récapitulatif. La règle est énoncée dans facture-document.ts. */
  const notes = courseIds.length > 0
    ? null
    : utiles
        .map(l => {
          const trajet = [l.depart, l.arrivee].filter(Boolean).join(' → ')
          const libelle = trajet || 'Prestation'
          return `${libelle}|${Number(l.prix)}`
        })
        .join('\n')

  const numero = await genererNumeroFacture(supabase)
  const echeance = new Date(Date.now() + delai * 24 * 60 * 60 * 1000).toISOString()

  const { data: facture, error: erreurFacture } = await supabase
    .from('factures')
    .insert({
      client_id: clientId,
      numero,
      statut: 'en_attente',
      montant_ht: totalHt,
      montant_ttc: totalTtc,
      tva: Math.round((totalTtc - totalHt) * 100) / 100,
      date_echeance: echeance,
      notes,
    })
    .select('id')
    .single()

  if (erreurFacture || !facture) {
    throw new Error(`La facture n’a pas pu être créée : ${erreurFacture?.message ?? 'erreur inconnue'}`)
  }

  if (courseIds.length > 0) {
    await supabase
      .from('courses')
      .update({ facture_id: facture.id, client_id: clientId })
      .in('id', courseIds)
  }

  revalidatePath('/admin/facturation')
  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)

  return { factureId: facture.id as string }
}

/**
 * « Nous avons accepté votre demande » : le client reçoit son lien.
 *
 * L'exploitant, le 2026-11-11 : « dès qu'on a accepté, on lui envoie
 * l'acceptation, mais elle doit mettre sa carte bleue pour valider la
 * réservation ».
 *
 * CE QUE CETTE ACTION NE FAIT PAS : passer le devis en « accepté ».
 * L'acceptation appartient désormais au CLIENT — c'est lui qui clique, et
 * c'est son clic (ou sa carte) qui la date. Marquer « accepté » ici ferait
 * croire à un engagement qui n’existe pas encore.
 */
export async function envoyerAcceptationAction(id: string): Promise<string> {
  await requireAdminClient()

  const [devis, prestataire] = await Promise.all([chargerDevis(id), chargerPrestataire()])
  if (!devis) throw new Error('Devis introuvable.')
  if (!devis.client_email) {
    throw new Error('Ce devis ne porte pas d’adresse e-mail : le client ne peut rien recevoir.')
  }

  const jeton = await assurerJeton(id)
  const message = composerEmailAcceptation(devis, prestataire, lienAcceptation(jeton))

  await envoyerDevisClient({ message })

  return message.destinataire as string
}

/**
 * Lève ou remet l'exigence de carte sur ce devis.
 *
 * « Tant qu'on ne connaît pas le client, il faut qu'il paye sa
 * réservation. À moins qu'il nous appelle, on fait connaissance, et si on
 * a jugé qu'on peut lui faire confiance » — exploitant, 2026-11-11.
 * Exigée par défaut ; levée d’un clic sur un habitué.
 */
export async function basculerCarteRequise(
  id: string,
  requise: boolean,
): Promise<void> {
  await requireAdminClient()
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('devis_clients')
    .update({ carte_requise: requise, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
  revalidatePath(`/admin/devis-clients/${id}`)
}
