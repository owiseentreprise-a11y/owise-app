import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Contenu d'une facture, tel qu'il doit apparaître sur le document — quelle
 * que soit la forme finale (page admin, page espace client, PDF joint au mail).
 *
 * Ce fichier existe parce que ce projet s'est déjà fait avoir par des rendus
 * divergents de la même donnée : trois calculs de prix incompatibles avaient
 * cohabité pendant plusieurs sessions. Une facture a la même exposition —
 * un montant ou une mention légale qui diffère entre l'écran et le PDF envoyé
 * au client est une erreur comptable, pas un défaut d'affichage.
 *
 * Toute nouvelle façon d'afficher une facture doit partir d'ici.
 *
 * ATTENTION : la lecture se fait avec le client admin (le cron de facturation
 * et l'envoi d'e-mail n'ont pas de session utilisateur). Cette fonction ne
 * vérifie donc AUCUN droit d'accès — n'appelez jamais depuis une route
 * publique sans avoir contrôlé l'identité de l'appelant au préalable.
 */

/** Moyens de paiement, tels qu'ils s'écrivent sur la facture. */
export const MODE_PAIEMENT_LABEL: Record<string, string> = {
  tpe_bord: 'carte bancaire au TPE à bord',
  especes:  'espèces',
  virement: 'virement',
  cheque:   'chèque',
  stripe:   'paiement en ligne',
}

export const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  payee:      'Payée',
  retard:     'En retard',
}

/**
 * Écriture des montants sur une facture française : virgule décimale, deux
 * décimales toujours.
 *
 * Il existait deux écritures pour le même montant — « 59,00 € » sur la page
 * admin, « 59.00 € » sur la copie remise au client. La seconde est fautive en
 * français. Une seule définition ici, pour que l'écran, le document imprimé et
 * le PDF joint à l'e-mail écrivent la même somme de la même façon.
 */
export function formaterNombre(v: number): string {
  return v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function formaterMontant(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : `${formaterNombre(Number(v))} €`
}

export type LigneFacture = {
  /** Date de la course, déjà formatée en jj/mm. */
  date: string
  /** Commune de départ (première partie de l'adresse). */
  depart: string
  /** Commune d'arrivée. */
  arrivee: string
  montantHt: number | null
}

export type DocumentFacture = {
  id: string
  numero: string
  statut: string
  statutLabel: string
  payee: boolean
  /** « Réglée par carte bancaire au TPE à bord », ou null si la facture est due. */
  reglement: string | null
  /** Date d'échéance formatée, ou null si la facture est déjà réglée. */
  echeance: string | null
  dateEmission: string
  montantHt: number
  tva: number
  montantTtc: number
  client: { nom: string; adresse: string | null }
  societe: { nom: string; siret: string | null; tvaNumero: string | null }
  /** Coordonnées bancaires — null sur une facture acquittée, pour ne pas
   *  inviter le client à payer une seconde fois. */
  banque: { nom: string | null; iban: string | null; bic: string | null } | null
  mentions: string | null
  lignes: LigneFacture[]
}

/** Format identique à celui des pages facture, pour que les trois concordent. */
function dateLongue(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function dateCourte(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
}

/** « 14 Rue des Coteaux, 60870 Villers-Saint-Paul, France » → « 14 Rue des Coteaux » */
function premierSegment(adresse: string | null | undefined): string {
  return (adresse ?? '').split(',')[0].trim() || '—'
}

export async function chargerDocumentFacture(factureId: string): Promise<DocumentFacture | null> {
  const admin = createAdminClient()

  const [factureRes, coursesRes, parametresRes] = await Promise.all([
    admin
      .from('factures')
      .select('*, clients(type_compte, entreprise_nom, prenom, nom, adresse_facturation, profiles(prenom, nom))')
      .eq('id', factureId)
      .single(),
    admin
      .from('courses')
      .select('id, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime')
      .eq('facture_id', factureId)
      .order('date_prevue', { ascending: true }),
    admin
      .from('parametres')
      .select('societe_nom, societe_siret, societe_tva_numero, banque_nom, banque_iban, banque_bic, facture_mentions')
      .eq('id', true)
      .single(),
  ])

  const f = factureRes.data
  if (!f) return null

  const p = parametresRes.data
  const c = (f as Record<string, any>).clients

  const nomClient = c?.type_compte === 'entreprise'
    ? (c.entreprise_nom ?? '—')
    : `${c?.prenom || c?.profiles?.prenom || ''} ${c?.nom || c?.profiles?.nom || ''}`.trim() || '—'

  const payee = f.statut === 'payee'
  const libelleMode = MODE_PAIEMENT_LABEL[f.mode_paiement as string]

  return {
    id: f.id,
    numero: f.numero,
    statut: f.statut,
    statutLabel: STATUT_LABEL[f.statut] ?? f.statut,
    payee,
    reglement: payee ? `Réglée${libelleMode ? ` par ${libelleMode}` : ''}` : null,
    echeance: payee ? null : dateLongue(f.date_echeance),
    dateEmission: dateLongue(f.date_emission),
    montantHt:  Number(f.montant_ht),
    tva:        Number(f.tva),
    montantTtc: Number(f.montant_ttc),
    client: {
      nom: nomClient,
      adresse: c?.adresse_facturation ?? null,
    },
    societe: {
      nom:        p?.societe_nom ?? 'OWISE',
      siret:      p?.societe_siret ?? null,
      tvaNumero:  p?.societe_tva_numero ?? null,
      // Adresse volontairement absente des factures, à la demande de
      // l'exploitant (2026-09-20). Ne pas la réintroduire ici non plus.
    },
    banque: payee ? null : {
      nom:  p?.banque_nom ?? null,
      iban: p?.banque_iban ?? null,
      bic:  p?.banque_bic ?? null,
    },
    mentions: p?.facture_mentions ?? null,
    lignes: (coursesRes.data ?? []).map(course => ({
      date:      dateCourte(course.date_prevue),
      depart:    premierSegment(course.adresse_depart),
      arrivee:   premierSegment(course.adresse_arrivee),
      montantHt: course.prix_final ?? course.prix_estime ?? null,
    })),
  }
}
