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
  return `${debut} est facturée ${tarif} par heure, toute heure commencée étant due. `
    + `Ces frais ne sont pas compris dans le montant ci-dessous : ils ne s'appliquent que s'ils sont constatés, `
    + `et figureront alors sur la facture.`
}
