'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { vehiculePourBase } from '@/lib/vehicule'
import { calculerTotal, chargerDevis, chargerPrestataire, genererNumeroDevis, type LigneDevis } from '@/lib/devis-client'
import { composerEmailDevis } from '@/lib/devis-email'
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

/** « 10h15 », « 10:15 », « 02h15 (nuit) » → « 10:15 ». Rien d'exploitable → null. */
function heureVersHhMm(brut: string): string | null {
  const m = String(brut).match(/(\d{1,2})\s*[h:]\s*(\d{2})?/)
  if (!m) return null
  const h = String(Math.min(23, Number(m[1]))).padStart(2, '0')
  const min = String(Math.min(59, Number(m[2] ?? 0))).padStart(2, '0')
  return `${h}:${min}`
}

/** « 1 van + 1 berline » → la categorie que porte la base. */
function vehiculeDepuisLibelle(libelle: string): string {
  const t = libelle.toLowerCase()
  if (t.includes('grand van') || t.includes('8 place')) return 'grand_van'
  if (t.includes('van'))                                return 'van'
  if (t.includes('premium'))                            return 'berline_premium'
  return 'berline'
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
  const supabase = createAdminClient()

  const { data: devis, error: err } = await supabase
    .from('devis_clients').select('*').eq('id', id).single()
  if (err || !devis) throw new Error('Devis introuvable.')
  if (devis.statut === 'accepte') throw new Error('Ce devis a déjà été converti.')

  const lignes = (Array.isArray(devis.lignes) ? devis.lignes : []) as LigneDevis[]
  const utiles = lignes.filter(l => l.depart?.trim() && l.arrivee?.trim())
  if (utiles.length === 0) throw new Error('Aucune ligne exploitable : il faut un départ et une arrivée.')

  const parts = String(devis.client_nom ?? '').trim().split(/\s+/)
  const prenom = parts[0] ?? ''
  const nomFamille = parts.slice(1).join(' ') || prenom

  const notes = [
    `Devis ${devis.numero}`,
    devis.client_email ? `Email: ${devis.client_email}` : '',
    devis.client_societe ? `Société: ${devis.client_societe}` : '',
  ].filter(Boolean).join(' | ')

  const aInserer = utiles.map((l, i) => {
    /* L'heure saisie est une heure de Paris, jamais un instant : sur Vercel,
       qui tourne en temps universel, `new Date('...T14:00')` donnerait 16:00. */
    const hhmm = heureVersHhMm(l.heure ?? '')
    const date_prevue = devis.date_prestation && hhmm
      ? instantDepuisSaisieParis(`${devis.date_prestation}T${hhmm}:00`).toISOString()
      : devis.date_prestation
        ? instantDepuisSaisieParis(`${devis.date_prestation}T00:00:00`).toISOString()
        : new Date().toISOString()

    return {
      adresse_depart:  l.depart.trim(),
      adresse_arrivee: l.arrivee.trim(),
      date_prevue,
      statut:          'en_attente',
      prix_estime:     Number(l.prix) || null,
      type_vehicule:   vehiculePourBase(vehiculeDepuisLibelle(l.vehicule ?? '')),
      nb_passagers:    l.passagers ?? null,
      passager_prenom: prenom,
      passager_nom:    nomFamille,
      passager_tel:    devis.client_tel ?? null,
      paiement_statut: 'a_percevoir',
      source:          'devis',
      ref:             `${devis.numero}-${String(i + 1).padStart(2, '0')}`,
      notes:           [notes, l.observations?.trim()].filter(Boolean).join(' | ') || null,
    }
  })

  const { error } = await supabase.from('courses').insert(aInserer)
  if (error) throw new Error(error.message)

  await supabase.from('devis_clients')
    .update({ statut: 'accepte', updated_at: new Date().toISOString() })
    .eq('id', id)

  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)
  revalidatePath('/admin/courses')
  revalidatePath('/admin/planning')

  return aInserer.length
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
  await supabase.from('devis_clients')
    .update({ statut: 'envoye', updated_at: new Date().toISOString() })
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
  const { data: client } = await supabase
    .from('clients').select('id').ilike('email', email).maybeSingle()
  if (!client) {
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
  const { data: coursesDuDevis } = await supabase
    .from('courses')
    .select('id')
    .like('ref', `${devis.numero}-%`)
    .is('facture_id', null)
  const courseIds = (coursesDuDevis ?? []).map(c => c.id as string)

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
      client_id: client.id,
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
      .update({ facture_id: facture.id, client_id: client.id })
      .in('id', courseIds)
  }

  revalidatePath('/admin/facturation')
  revalidatePath('/admin/devis-clients')
  revalidatePath(`/admin/devis-clients/${id}`)

  return { factureId: facture.id as string }
}

