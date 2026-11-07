'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { revalidatePath } from 'next/cache'
import { genererNumeroFacture } from '@/lib/facturation'
import { vehiculePourBase } from '@/lib/vehicule'
import { genererNumeroDevis } from '@/lib/devis-client'
import { cleDepuisLibelle, vehiculeParDefaut, NOM_PAR_BASE } from '@/lib/gamme'
/* La confirmation passe par le module d'e-mail du projet, jamais par un
   message écrit à la main : c'est la règle depuis qu'un numéro de téléphone
   inventé est parti à une vraie cliente. Ce module porte les libellés, le
   format des montants et l'heure de Paris — trois choses qu'une rédaction
   improvisée se trompe une fois sur deux. */
import { envoyerConfirmationClient, envoyerRefusDevis } from '@/lib/email'

/**
 * Refuser une demande, et le DIRE au client.
 *
 * `supprimerDevis` existe toujours à côté, et garde son rôle : faire
 * disparaître une ligne sans écrire à personne — un essai, un doublon, un
 * robot. Les deux boutons ne font pas la même chose, et l'écran le dit.
 *
 * Jusqu'au 2026-11-07, « supprimer » était le SEUL moyen de refuser : la
 * ligne disparaissait et le client n'était prévenu de rien. Il attendait une
 * réponse qui ne viendrait jamais.
 */
export async function refuserDevis(devis: {
  id: string
  nom: string | null
  email: string | null
  origin: string | null
  destination: string | null
  date_course: string | null
  heure: string | null
}, motif?: string | null): Promise<{ courrielEnvoye: boolean; motifCourriel: string }> {
  await requireAdminClient()
  const supabase = createAdminClient()

  let courrielEnvoye = false
  let motifCourriel = ''
  if (!devis.email) {
    motifCourriel = 'le devis ne porte aucune adresse e-mail'
  } else {
    try {
      /* Même conversion que pour une acceptation : la date du devis est une
         date de Paris, pas un instant. Sans `instantDepuisSaisieParis`, le
         client lirait une date décalée dans le message qui le refuse. */
      const quand = devis.date_course
        ? instantDepuisSaisieParis(`${devis.date_course}T${devis.heure ?? '00:00'}:00`).toISOString()
        : null
      courrielEnvoye = await envoyerRefusDevis({
        clientEmail:    devis.email,
        clientPrenom:   (devis.nom ?? '').trim().split(/\s+/)[0] || 'Madame, Monsieur',
        adresseDepart:  devis.origin ?? '—',
        adresseArrivee: devis.destination ?? '—',
        datePrevue:     quand,
        motif:          motif?.trim() || null,
      })
      if (!courrielEnvoye) motifCourriel = 'le serveur de courrier a refusé l’envoi — voir les journaux'
    } catch (e) {
      motifCourriel = e instanceof Error ? e.message : String(e)
    }
  }

  /* La demande n'est retirée qu'APRÈS la tentative d'envoi : si le courrier
     échoue, l'exploitant garde sous les yeux la ligne et les coordonnées
     pour rappeler lui-même. Une demande refusée et effacée sans prévenir
     personne est exactement ce qu'on vient de corriger. */
  if (courrielEnvoye || !devis.email) {
    await supabase.from('devis').delete().eq('id', devis.id)
  }
  revalidatePath('/admin/devis')
  return { courrielEnvoye, motifCourriel }
}

export async function supprimerDevis(id: string) {
  await requireAdminClient()
  const supabase = createAdminClient()
  await supabase.from('devis').delete().eq('id', id)
  revalidatePath('/admin/devis')
}

/**
 * Quel vehicule, pour ce devis ?
 *
 * Trois cas, et aucun qui invente :
 *   - un libelle connu (actuel ou historique) → sa cle ;
 *   - aucun libelle → le vehicule que le nombre de passagers impose ;
 *   - un libelle present mais inconnu → on refuse la conversion.
 *
 * La version precedente ecrivait `VH_MAP[devis.vehicle] ?? 'berline'`, et sa
 * table ne connaissait que « Grand Van ». Depuis que les libelles derivent de
 * `gamme.ts`, un devis 8 places s'enregistre « Grand Van 8 places » : il se
 * serait converti en course BERLINE, pour huit personnes, sans un mot.
 */
function vehiculeDuDevis(libelle: string | null, pax: number | null): string {
  const cle = cleDepuisLibelle(libelle)
  if (cle) return cle
  if (!String(libelle ?? '').trim()) {
    const parDefaut = vehiculeParDefaut(pax ?? 1)
    if (parDefaut) return parDefaut.cle
  }
  throw new Error(
    `Véhicule « ${libelle} » non reconnu : la course n'a pas été créée. `
    + `Corrigez le véhicule du devis avant de le convertir.`,
  )
}

export async function convertirEnCourse(devis: {
  id: string
  nom: string | null
  tel: string | null
  email: string | null
  societe: string | null
  price: number | null
  origin: string | null
  destination: string | null
  date_course: string | null
  heure: string | null
  vehicle: string | null
  pax: number | null
}) {
  await requireAdminClient()
  if (!devis.origin || !devis.destination) throw new Error('Adresses manquantes.')

  const supabase = createAdminClient()

  // Date + heure du devis → instant reel. `new Date('2026-09-24T14:00')` lit
  // la chaine dans le fuseau de la machine : sur le serveur Vercel, qui tourne
  // en temps universel, un devis a 14:00 devenait une course a 16:00.
  let date_prevue: string
  if (devis.date_course) {
    const h = devis.heure ?? '00:00'
    date_prevue = instantDepuisSaisieParis(`${devis.date_course}T${h}:00`).toISOString()
  } else {
    date_prevue = new Date().toISOString()
  }

  const ts  = Date.now().toString(36).toUpperCase().slice(-5)
  const ref = `DEV-${ts}`

  // Décompose nom → prénom + nom de famille
  const parts    = (devis.nom ?? '').trim().split(/\s+/)
  const prenom   = parts[0] ?? ''
  const nomFamille = parts.slice(1).join(' ') || prenom

  const notes = [
    devis.email  ? `Email: ${devis.email}`   : '',
    devis.societe ? `Société: ${devis.societe}` : '',
  ].filter(Boolean).join(' | ')

  const { error } = await supabase.from('courses').insert({
    adresse_depart:   devis.origin,
    adresse_arrivee:  devis.destination,
    date_prevue,
    statut:           'en_attente',
    prix_estime:      devis.price ?? null,
    type_vehicule:    vehiculePourBase(vehiculeDuDevis(devis.vehicle, devis.pax)),
    nb_passagers:     devis.pax ?? null,
    passager_prenom:  prenom,
    passager_nom:     nomFamille,
    passager_tel:     devis.tel ?? null,
    paiement_statut:  'a_percevoir',
    source:           'devis',
    devis_id:         devis.id,
    ref,
    notes:            notes || null,
  })

  if (error) throw new Error(error.message)

  /* ── Prévenir le client ────────────────────────────────────────────────
     Jusqu'au 2026-11-07, ce bouton créait la course et n'envoyait RIEN :
     l'adresse du client était seulement recopiée dans une note interne.
     L'exploitant cliquait « accepter », la course existait chez lui, et le
     client n'en savait rien — il attendait une réponse qui ne venait pas.
     C'est tout l'intérêt du bouton : accepter, c'est le dire.

     L'envoi ne peut PAS annuler la course. Si l'e-mail échoue, la course
     reste — on rend l'information à l'exploitant pour qu'il reprenne
     contact lui-même, plutôt que de perdre une réservation acceptée. */
  let courrielEnvoye = false
  let motifCourriel = ''
  if (!devis.email) {
    motifCourriel = 'le devis ne porte aucune adresse e-mail'
  } else {
    try {
      /* On LIT la réponse. `send()` n'a jamais levé d'exception — un e-mail
         raté ne doit pas faire perdre une course — donc ce `try` seul ne
         prouvait rien : il affichait « client prévenu » même quand rien
         n'était parti. Défaut constaté le 2026-11-07, le lendemain de sa
         propre mise en ligne. */
      const parti = await envoyerConfirmationClient({
        clientEmail:     devis.email,
        clientPrenom:    prenom || 'Madame, Monsieur',
        adresseDepart:   devis.origin,
        adresseArrivee:  devis.destination,
        /* L'instant déjà converti, pas la saisie : `date_prevue` est passé
           par `instantDepuisSaisieParis` plus haut. Donner la chaîne brute
           ferait réapparaître le décalage de deux heures qui a fait
           annoncer 11:30 pour une course de 09:30. */
        datePrevue:      date_prevue,
        typeVehicule:    NOM_PAR_BASE[vehiculePourBase(vehiculeDuDevis(devis.vehicle, devis.pax))] ?? 'Berline',
        nbPassagers:     devis.pax ?? 1,
        prixEstime:      devis.price ?? null,
        refCourse:       ref,
      })
      courrielEnvoye = parti
      if (!parti) motifCourriel = 'le serveur de courrier a refusé l’envoi — voir les journaux'
    } catch (e) {
      motifCourriel = e instanceof Error ? e.message : String(e)
    }
  }

  await supabase.from('devis').delete().eq('id', devis.id)
  revalidatePath('/admin/devis')
  revalidatePath('/admin/courses')

  return { ref, courrielEnvoye, motifCourriel }
}

export async function convertirEnFacture(devis: {
  id: string
  nom: string | null
  tel: string | null
  email: string | null
  societe: string | null
  price: number | null
  origin: string | null
  destination: string | null
  date_course: string | null
  heure: string | null
  vehicle: string | null
  pax: number | null
}) {
  await requireAdminClient()
  if (!devis.price) throw new Error('Prix manquant — impossible de créer une facture.')
  const supabase = createAdminClient()

  const numero = await genererNumeroFacture(supabase)

  const { data: parametres } = await supabase.from('parametres').select('facture_taux_tva').eq('id', true).single()
  const tauxTva = parametres?.facture_taux_tva ?? 0

  const montant_ttc = Number(devis.price)
  const montant_ht  = Math.round((montant_ttc / (1 + tauxTva / 100)) * 100) / 100
  const tva = Math.round((montant_ttc - montant_ht) * 100) / 100

  const date_emission = new Date().toISOString().slice(0, 10)
  const date_echeance = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)

  // Stocker toutes les infos du devis dans notes (JSON)
  const notes = JSON.stringify({
    nom:         devis.nom,
    tel:         devis.tel,
    email:       devis.email,
    societe:     devis.societe,
    depart:      devis.origin,
    arrivee:     devis.destination,
    vehicule:    devis.vehicle,
    pax:         devis.pax,
    date_course: devis.date_course,
    heure:       devis.heure,
  })

  const { error } = await supabase.from('factures').insert({
    numero,
    statut:       'en_attente',
    montant_ht,
    tva,
    montant_ttc,
    date_emission,
    date_echeance,
    notes,
    client_id:    null,
  })

  if (error) throw new Error(error.message)

  // Supprimer le devis une fois converti
  await supabase.from('devis').delete().eq('id', devis.id)
  revalidatePath('/admin/devis')
  revalidatePath('/admin/facturation')

  return numero
}

/**
 * La demande reçue devient un devis à chiffrer.
 *
 * Il manquait le chaînon : une demande arrivait ici avec « Course » et
 * « Facture » pour seules actions. Or une demande de groupe — 8 places, un
 * séminaire — appelle d'abord un DEVIS, qu'on chiffre et qu'on envoie.
 * L'exploitant devait tout ressaisir dans /admin/devis-clients.
 *
 * La demande n'est PAS supprimée : tant que le devis n'est pas parti, elle
 * reste la trace de ce que le client a demandé. À supprimer à la main une
 * fois la réponse envoyée.
 */
export async function convertirEnDevisClient(devis: {
  id: string
  nom: string | null
  tel: string | null
  email: string | null
  societe: string | null
  price: number | null
  origin: string | null
  destination: string | null
  date_course: string | null
  heure: string | null
  vehicle: string | null
  pax: number | null
}): Promise<string> {
  await requireAdminClient()
  const supabase = createAdminClient()

  const numero = await genererNumeroDevis(supabase)

  /* Le prix de la demande n'est qu'un point de départ, et il est souvent
     absent — c'est le cas sur les demandes « sur devis ». L'exploitant le
     fixe lui-même dans l'éditeur. */
  const prix = Number(devis.price) || 0

  const ligne = {
    heure:        devis.heure ?? '',
    depart:       devis.origin ?? '',
    arrivee:      devis.destination ?? '',
    vehicule:     devis.vehicle ?? '',
    passagers:    devis.pax ?? null,
    prix,
    observations: '',
  }

  /* Deux semaines de validité : le délai d'usage, modifiable dans l'éditeur. */
  const validite = new Date()
  validite.setDate(validite.getDate() + 14)

  const { data, error } = await supabase
    .from('devis_clients')
    .insert({
      numero,
      client_nom:      devis.nom ?? '',
      client_societe:  devis.societe || null,
      client_email:    devis.email || null,
      client_tel:      devis.tel || null,
      date_prestation: devis.date_course || null,
      date_validite:   validite.toISOString().slice(0, 10),
      statut:          'brouillon',
      lignes:          [ligne],
      total_ht:        prix,
      notes:           `Demande reçue depuis le site le ${new Date().toLocaleDateString('fr-FR')}.`,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/admin/devis')
  revalidatePath('/admin/devis-clients')
  return data.id as string
}
