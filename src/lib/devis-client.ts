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

/** L'identite d'Owise sur le document, lue la ou les factures la lisent. */
export type Prestataire = {
  nom: string
  metier: string
  telephone: string | null
  email: string | null
  siret: string | null
  legal: string[]
}

const EXPLOITANT = 'Houna Hassan'

function grouperSiret(v: string | null): string | null {
  if (!v) return null
  const n = String(v).replace(/\s/g, '')
  return /^\d{14}$/.test(n) ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : v
}

function formaterTelephone(v: string | null): string | null {
  if (!v) return null
  const n = String(v).replace(/[^\d+]/g, '').replace(/^\+33/, '0')
  return /^0\d{9}$/.test(n) ? n.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : v
}

export async function chargerPrestataire(): Promise<Prestataire> {
  const supabase = createAdminClient()
  const { data: p } = await supabase
    .from('parametres')
    .select('societe_nom, societe_siret, societe_naf, societe_adresse, societe_code_postal, societe_ville, societe_telephone, societe_email')
    .eq('id', true)
    .single()

  const ville = p?.societe_ville
    ? String(p.societe_ville).charAt(0).toUpperCase() + String(p.societe_ville).slice(1).toLowerCase()
    : null

  return {
    nom: 'Owise — Chantilly',
    metier: 'Service de chauffeur privé',
    telephone: formaterTelephone(p?.societe_telephone ?? null),
    email: p?.societe_email ?? null,
    siret: grouperSiret(p?.societe_siret ?? null),
    legal: [
      `${EXPLOITANT} — entreprise individuelle (micro-entrepreneur)`,
      [p?.societe_adresse, [p?.societe_code_postal, ville].filter(Boolean).join(' ')].filter(Boolean).join(', '),
      [grouperSiret(p?.societe_siret ?? null) ? `SIRET ${grouperSiret(p?.societe_siret ?? null)}` : null,
       p?.societe_naf ? `Code APE ${p.societe_naf}` : null].filter(Boolean).join(' · '),
    ].filter(l => l && l.trim().length > 0),
  }
}

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
export function phraseAttente(d: Pick<DevisClient, 'attente_offerte_min' | 'attente_tarif_heure'>): string | null {
  if (d.attente_tarif_heure == null) return null
  const offertes = d.attente_offerte_min ?? 0
  const tarif = formaterMontant(Number(d.attente_tarif_heure))
  const debut = offertes > 0
    ? `Les ${offertes} premières minutes d'attente sont offertes sur chaque prise en charge. Au-delà, l'attente`
    : `L'attente`
  /* « ci-dessous » a été retiré le 2026-11-02 : la phrase sert maintenant
     trois mises en page — le document, le PDF (où un devis long renvoie le
     total en page 2) et la réponse e-mail (où le montant est AU-DESSUS).
     Une phrase qui désigne une position se trompe dès qu'on la déplace. */
  return `${debut} est facturée ${tarif} par heure, toute heure commencée étant due. `
    + `Ces frais ne sont pas compris dans le montant indiqué : ils ne s'appliquent que s'ils sont constatés, `
    + `et figureront alors sur la facture.`
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

/**
 * L'annulation, telle qu'elle est annoncée sur un devis.
 *
 * ATTENTION — cette règle n'est PAS celle des CGV publiées sur owise.fr,
 * qui prévoient : gratuit avant attribution du chauffeur, puis 3 € sous dix
 * minutes, 8 € au-delà, et no-show = prise en charge + cinq minutes.
 *
 * Décision de l'exploitant du 2026-11-03, pour les devis : une règle simple
 * et plus protectrice, que le client lit en une phrase. Des conditions
 * PARTICULIÈRES inscrites sur un devis signé priment sur des conditions
 * générales — mais tant que les deux coexistent, un client peut opposer
 * celles du site. Les CGV restent à aligner.
 */
export const MENTION_ANNULATION =
  "Annulation — sans frais jusqu'à 24 heures avant la prise en charge. "
  + "Passé ce délai, la totalité de la course est due."
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
  d: Pick<DevisClient, 'lignes' | 'total_ht' | 'attente_offerte_min' | 'attente_tarif_heure'>,
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
 * L'ordre compte : la clause d'attente d'abord, parce qu'elle engage le
 * client ; l'identite ensuite ; les mentions legales en dernier.
 */
export function basDePage(
  d: Pick<DevisClient, 'client_societe' | 'attente_offerte_min' | 'attente_tarif_heure'>,
  p: Prestataire,
): string[] {
  const attente = phraseAttente(d)
  return [
    MENTION_ANNULATION,
    ...(attente ? [`Temps d'attente — ${attente}`] : []),
    [p.nom, ...p.legal].filter(Boolean).join(' · '),
    ...mentionsDevis(d),
  ]
}
