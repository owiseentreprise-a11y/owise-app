/**
 * Transforme un devis accepté en courses.
 *
 * POURQUOI CE FICHIER
 *
 * Deux chemins mènent désormais ici, et ils doivent produire EXACTEMENT les
 * mêmes courses :
 *
 *   · l'exploitant clique « Accepté → créer les courses » dans
 *     l'administration ;
 *   · le client accepte lui-même son devis et laisse sa carte, et c'est le
 *     webhook Stripe qui crée les courses une fois la retenue confirmée.
 *
 * Écrire deux fois cette construction, c'est se garantir que les deux
 * divergeront — sur l'heure, sur le véhicule, sur la référence. Une facture
 * a existé en quatre dessins sur ce projet ; une course ne doit pas suivre
 * le même chemin.
 *
 * CE FICHIER NE VÉRIFIE AUCUN DROIT. L'appelant s'en charge :
 * `requireAdminClient()` côté administration, la signature Stripe côté
 * webhook. Il ne doit jamais être appelé depuis une page publique.
 */
import { createAdminClient } from '@/lib/supabase/admin'
import { instantDepuisSaisieParis } from '@/lib/heure'
import { vehiculePourBase } from '@/lib/vehicule'
import { type LigneDevis } from '@/lib/devis-client'

/* Ces deux lectures vivaient dans les actions d’administration, un
   fichier 'use server' dont on ne peut rien importer de synchrone. Elles
   descendent ici, où les deux chemins les partagent. */
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
 * L'ARGENT DEJA RETENU, quand le client a laisse sa carte.
 *
 * Sans ces deux valeurs, les courses naissent en « a_percevoir » et sans
 * identifiant de paiement — et `validerReservationAction` REFUSE alors
 * d'encaisser (« Aucun paiement Stripe associe »). La carte du client
 * reste bloquee sept jours, puis Stripe libere la somme tout seul :
 * la course est faite et rien n'est encaisse.
 *
 * C'est le defaut du 2026-10-07 dans l'autre sens, et il a ete trouve
 * ici en relisant le code avant de le livrer, pas apres.
 */
export type RetenueCarte = { paymentIntentId: string | null }

export type ResultatConversion = { creees: number; dejaFait: boolean }

/**
 * Crée une course par ligne du devis, et passe le devis en « accepté ».
 *
 * Ne lève pas si le devis est déjà accepté : le webhook peut recevoir deux
 * fois le même événement, et deux appels ne doivent pas produire deux jeux de
 * courses. C'est l'appelant qui décide quoi en dire.
 */
export async function creerCoursesDepuisDevis(
  devisId: string,
  retenue?: RetenueCarte,
): Promise<ResultatConversion> {
  const supabase = createAdminClient()

  const { data: devis, error: err } = await supabase
    .from('devis_clients').select('*').eq('id', devisId).single()
  if (err || !devis) throw new Error('Devis introuvable.')

  /* Déjà converti : on ne refait rien. Le garde est ici, et pas seulement
     chez l'appelant, parce que les deux chemins doivent en bénéficier. */
  if (devis.statut === 'accepte') {
    const { count } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .like('ref', `${devis.numero}-%`)
    if ((count ?? 0) > 0) return { creees: 0, dejaFait: true }
  }

  const lignes = (Array.isArray(devis.lignes) ? devis.lignes : []) as LigneDevis[]
  const utiles = lignes.filter(l => l.depart?.trim() && l.arrivee?.trim())
  if (utiles.length === 0) {
    throw new Error('Aucune ligne exploitable : il faut un départ et une arrivée.')
  }

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
       qui tourne en temps universel, `new Date('...T14:00')` donnerait 16:00.
       Règle de @/lib/heure. */
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
      /* « AUTORISE » : l'argent est retenu chez Stripe, pas encaisse.

         LE PAIEMENT N'EST PAS RECOPIE ICI, et ce n'est pas un oubli : un
         index unique (`courses_stripe_pi_unique`, octobre 2026) interdit
         qu'un meme paiement Stripe appartienne a deux courses. Il protege
         contre les doublons d'un rejeu, et il a raison.

         Or un devis porte PLUSIEURS prestations et UNE SEULE retenue. La
         retenue appartient donc au devis, qui garde sa session Stripe, et
         l'encaissement se fait depuis le devis — en une fois, pour toutes
         ses courses. Essayer de la poser sur chaque course faisait echouer
         l'insertion sur la deuxieme ligne : carte bloquee, aucune course.
         Trouve au banc d’essai le 2026-11-11, avant tout client. */
      paiement_statut: retenue?.paymentIntentId ? 'autorise' : 'a_percevoir',
      source:          'devis',
      ref:             `${devis.numero}-${String(i + 1).padStart(2, '0')}`,
      notes:           [notes, l.observations?.trim()].filter(Boolean).join(' | ') || null,
    }
  })

  const { error } = await supabase.from('courses').insert(aInserer)
  if (error) throw new Error(error.message)

  await supabase.from('devis_clients')
    .update({ statut: 'accepte', updated_at: new Date().toISOString() })
    .eq('id', devisId)

  return { creees: aInserer.length, dejaFait: false }
}
