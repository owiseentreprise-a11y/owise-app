/**
 * Le contenu d'un devis commercial — source unique.
 *
 * Meme principe que `facture-document.ts` : le devis existe sous deux formes
 * (la page d'edition et le document remis au client), et aucune des deux ne
 * redefinit ses libelles, ses montants ou ses mentions legales. La regle de
 * CLAUDE.md tient : un document ne se definit qu'a un seul endroit.
 *
 * Ce fichier tire `createAdminClient` : ne jamais l'importer depuis un
 * composant client, la cle de service partirait dans le navigateur. Les
 * formulaires importent `formaterMontant` depuis `@/lib/montant`, qui est pur.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { jourParis } from '@/lib/heure'
import { ANNULATION_MENTION, ATTENTE_MENTION } from '@/lib/conditions'
import { formaterMontant } from '@/lib/montant'

/** Une prestation du devis. Les champs vides sont permis a la saisie. */
export type LigneDevis = {
  heure: string
  depart: string
  arrivee: string
  vehicule: string
  passagers: number | null
  prix: number
  observations: string
}

export type DevisClient = {
  id: string
  numero: string
  client_nom: string
  client_societe: string | null
  client_email: string | null
  client_tel: string | null
  client_adresse: string | null
  date_prestation: string | null
  date_validite: string | null
  statut: 'brouillon' | 'envoye' | 'accepte' | 'refuse' | 'expire'
  lignes: LigneDevis[]
  total_ht: number
  attente_offerte_min: number | null
  attente_tarif_heure: number | null
  notes: string | null
  created_at: string

  /* ── Le suivi, depuis le 2026-11-11 ─────────────────────────────────

     L'exploitant : « j'ai pas l'information comme quoi c'est bien parti »,
     et « j'ai pas le suivi des étapes du devis avant l'acceptation ».

     `chargerDevis` fait un select('*') : ces champs arrivent donc tout
     seuls. Aucun secret ne part au navigateur — ce sont les coordonnées
     du client et le jeton de SON propre lien, lus par un écran
     d'administration déjà authentifié. */

  /** Quand le devis est réellement parti. Écrit SEULEMENT après un envoi
   *  réussi : un devis qui porte cette date est un devis parti. */
  envoye_le: string | null
  /** L'adresse à laquelle il est parti. */
  envoye_a: string | null
  /** Le lien privé remis au client pour qu’il accepte lui-même. */
  jeton: string | null
  /** Quand le client a ouvert ce lien pour la première fois. */
  vu_le: string | null
  /** Quand il a accepté. */
  accepte_le: string | null
  /** « Tant qu’on ne connaît pas le client, il faut qu’il paye sa
   *  réservation » — exploitant, 2026-11-11. Levée sur un client connu. */
  carte_requise: boolean
  /** L'empreinte bancaire retenue à l'acceptation. */
  stripe_session_id: string | null
}

export const STATUTS: Record<DevisClient['statut'], string> = {
  brouillon: 'Brouillon',
  envoye:    'Envoyé',
  accepte:   'Accepté',
  refuse:    'Refusé',
  expire:    'Expiré',
}

/** Une ligne vide, telle que le formulaire en ajoute une. */
export function ligneVide(): LigneDevis {
  return { heure: '', depart: '', arrivee: '', vehicule: '', passagers: null, prix: 0, observations: '' }
}

/**
 * Le total ne se saisit jamais : il se calcule.
 *
 * Un total tape a la main diverge de ses lignes des qu'un prix change, et
 * c'est le genre d'ecart qu'on ne voit qu'une fois le devis parti.
 */
export function calculerTotal(lignes: LigneDevis[]): number {
  return lignes.reduce((somme, l) => somme + (Number(l.prix) || 0), 0)
}

/**
 * DEV-202611-0001.
 *
 * On prend le PLUS GRAND numero du mois, jamais le nombre de lignes — c'est
 * la lecon tiree des factures le 2026-10-08 : deux suppressions avaient fait
 * reattribuer un numero deja utilise.
 */
export async function genererNumeroDevis(supabase: SupabaseClient): Promise<string> {
  const now = new Date()
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefixe = `DEV-${yyyymm}-`

  const { data } = await supabase
    .from('devis_clients')
    .select('numero')
    .like('numero', `${prefixe}%`)
    .order('numero', { ascending: false })
    .limit(1)

  const dernier = data?.[0]?.numero as string | undefined
  const rang = dernier ? Number(dernier.slice(prefixe.length)) : 0
  return prefixe + String((Number.isFinite(rang) ? rang : 0) + 1).padStart(4, '0')
}

/** « 2026-11-05 » → « 05/11/2026 ». Sans fuseau : c'est une date, pas un instant. */
export function dateCourte(iso: string | null): string | null {
  if (!iso) return null
  const [a, m, j] = iso.slice(0, 10).split('-')
  return a && m && j ? `${j}/${m}/${a}` : null
}

/** « 2026-11-05 » → « jeudi 5 novembre 2026 ». */
export function dateLongue(iso: string | null): string | null {
  if (!iso) return null
  const [a, m, j] = iso.slice(0, 10).split('-').map(Number)
  if (!a || !m || !j) return null
  return new Date(Date.UTC(a, m - 1, j)).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  })
}

/**
 * Le jour ou le devis a ete emis, lu A PARIS.
 *
 * `created_at.slice(0, 10)` donnait le jour en temps universel : un devis
 * rempli a 00h30 a Paris s'annoncait « emis le » la veille, parce que le
 * serveur etait encore a 23h30. Constate le 2026-11-03 sur DEV-202611-0002.
 * C'est la regle de CLAUDE.md sur les heures, appliquee aux dates.
 */
export function jourEmission(d: Pick<DevisClient, 'created_at'>): string {
  return jourParis(d.created_at)
}

/* L'identite d'Owise vient de `prestataire.ts`, partagee avec la facture.
   Elle etait construite ici ET dans facture-document.ts, a partir des memes
   colonnes — et les deux copies avaient deja diverge : le devis ecrivait
   « 60740 Saint-maximin », la facture « 60740 Saint-Maximin ». Signale par
   l'exploitant le 2026-11-09 : « on ne voit pas les memes informations sur
   l'entreprise ». Une seule ecriture desormais. */
export type { Prestataire } from '@/lib/prestataire'
export { chargerPrestataire, formaterTelephone } from '@/lib/prestataire'

export async function chargerDevis(id: string): Promise<DevisClient | null> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.from('devis_clients').select('*').eq('id', id).single()
  if (error || !data) return null
  return { ...data, lignes: Array.isArray(data.lignes) ? data.lignes : [] } as DevisClient
}

/**
 * La clause d'attente, redigee ici et nulle part ailleurs.
 *
 * La base ne porte que les deux nombres ; la phrase remise au client est
 * ecrite une seule fois, pour qu'un devis de janvier et un devis de juin
 * disent exactement la meme chose.
 */
/**
 * La clause d'attente d'un devis — la règle de la maison, pour tous.
 *
 * Elle se construisait depuis deux colonnes propres à chaque devis
 * (`attente_offerte_min`, `attente_tarif_heure`). Ces colonnes portaient un
 * tarif HORAIRE de 70 €, que j'avais inventé : le cahier des charges §4.6
 * dit 15 minutes offertes puis 0,50 € la minute. Décision de l'exploitant du
 * 2026-11-03 — une seule règle, dans `conditions.ts`.
 *
 * Les deux colonnes ne sont plus lues, et leurs champs ont quitté le
 * formulaire : un champ qui ne produit aucun effet est pire qu'un champ
 * absent. Elles restent en base, à supprimer par une migration ultérieure.
 */
export function phraseAttente(): string {
  return ATTENTE_MENTION
}


/* ────────────────────────────────────────────────────────────────────────
   Ce que le document DIT.

   Ces libellés vivaient dans le JSX de `[id]/document/page.tsx`, seul endroit
   où le devis existait. Le PDF joint à l'e-mail en est une deuxième forme :
   les laisser dans le JSX obligeait à les recopier, et une copie dérive.
   C'est la leçon du 2026-09-20 sur les factures — « 59,00 € » d'un côté,
   « 59.00 € » de l'autre.
   ──────────────────────────────────────────────────────────────────────── */

export const TITRE_ATTENTE   = "Conditions particulières — temps d'attente"
export const TITRE_REGLEMENT = "Règlement"
export const CADRE_SIGNATURE = "Date, signature et mention « bon pour accord »"

export const LIGNES_REGLEMENT = [
  "Par virement bancaire, à réception de la facture.",
  "Les coordonnées bancaires figureront sur celle-ci.",
]

/** Le libellé de la dernière ligne des totaux. */
export const LIBELLE_NET = "Net à payer"

/** Les lignes de total, au-dessus du net à payer. */
export function lignesTotaux(
  d: Pick<DevisClient, 'lignes' | 'total_ht'>,
): { libelle: string; valeur: string }[] {
  /* Pas de ligne « Frais d'attente » ici : elle attirait l'oeil sur une
     eventualite au milieu du prix ferme. La clause descend en bas de page,
     en petit, avec les autres mentions — decision du 2026-11-03. */
  const n = d.lignes.length
  return [
    { libelle: `${n} transfert${n > 1 ? 's' : ''}`, valeur: formaterMontant(Number(d.total_ht)) },
    { libelle: "TVA", valeur: "non applicable" },
  ]
}

/** La phrase d'accord, sous le total. */
export function phraseAccord(d: Pick<DevisClient, 'date_validite'>): string {
  const validite = dateCourte(d.date_validite)
  return (validite ? `Devis valable jusqu'au ${validite}. ` : "")
    + "Pour accord, retournez ce document daté et signé, avec la mention "
    + "« bon pour accord », ou répondez par écrit à l'adresse ci-dessus."
}

/**
 * Les mentions de bas de document.
 *
 * L'indemnité forfaitaire de 40 € et les pénalités de l'article L441-10 ne
 * valent qu'ENTRE PROFESSIONNELS. Les porter sur un devis adressé à un
 * particulier annonce une pénalité qui n'existe pas — relevé le 2026-11-02,
 * sur un devis destiné à une cliente particulière. La société renseignée sert
 * d'indice : un client professionnel en porte toujours une sur un devis.
 */
export function mentionsDevis(d: Pick<DevisClient, 'client_societe'>): string[] {
  return [
    "TVA non applicable, article 293 B du Code général des impôts — le montant indiqué est net de taxe.",
    d.client_societe
      ? "En cas de retard de paiement : pénalités au taux légal en vigueur et indemnité forfaitaire "
        + "pour frais de recouvrement de 40 € (art. L441-10 du Code de commerce). "
        + "Pas d'escompte pour paiement anticipé."
      : "Devis gratuit et sans engagement. Pas d'escompte pour paiement anticipé.",
  ]
}

/** Le détail d'une prestation : véhicule, passagers, observations. */
export function detailLigne(l: LigneDevis): string {
  return [
    l.vehicule,
    l.passagers ? `${l.passagers} passager${l.passagers > 1 ? 's' : ''}` : null,
    l.observations,
  ].filter(Boolean).join(' · ')
}

/**
 * Le bas de page — tout ce qui doit figurer sans occuper la place.
 *
 * Un devis parle d'une prestation. L'identite de l'entreprise, le regime de
 * TVA, les penalites de retard et la clause d'attente sont obligatoires ou
 * utiles, mais ils ne sont pas ce que le client lit. Ils occupaient le tiers
 * de la page ; ils tiennent maintenant en quatre lignes grises en pied de
 * document — decision du 2026-11-03.
 *
 * L'ordre compte : l'annulation et l'attente d'abord, parce qu'elles
 * engagent le client ; les mentions legales ensuite.
 *
 * L'identite de l'entreprise, elle, n'est PAS ici : elle est dans le bloc
 * « Prestataire », au meme endroit que sur la facture. Ce pied recevait un
 * parametre `Prestataire` qu'il n'utilisait pas — il laissait croire qu'il
 * la portait.
 */
export function basDePage(
  d: Pick<DevisClient, 'client_societe'>,
): string[] {
  return [
    ANNULATION_MENTION,
    ATTENTE_MENTION,
    ...mentionsDevis(d),
  ]
}
