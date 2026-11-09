/**
 * L'identité d'Owise telle qu'elle s'écrit sur un document remis au client.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Elle était écrite deux fois : une dans `facture-document.ts`, une dans
 * `devis-client.ts`. Les deux copies construisaient la même phrase à partir
 * des mêmes colonnes de `parametres` — et elles avaient déjà divergé. La
 * facture écrivait « 60740 Saint-Maximin », le devis « 60740 Saint-maximin » :
 * deux documents de la même entreprise, émis le même jour pour le même
 * client, avec deux orthographes de la même commune.
 *
 * L'exploitant l'a dit mot pour mot le 2026-11-09 : « à chaque fois la mise
 * en forme du devis ou de la facture change. On voit pas les mêmes
 * informations sur l'entreprise… je voudrais que ce soit toujours identique ».
 * Une seule écriture, ici. Les documents la rendent, ils ne la redéfinissent
 * jamais.
 *
 * CONFIDENTIALITÉ
 *
 * Ce fichier porte le nom de l'exploitant et l'adresse de son siège, qui est
 * son domicile. C'est l'un des trois seuls endroits du projet où ils ont leur
 * place : un devis et une facture engagent leur émetteur et doivent porter
 * son identité (art. L441-9 du Code de commerce). Ils ne doivent apparaître
 * sur AUCUNE page publique — voir la règle dans CLAUDE.md et
 * `test-identite-privee.mjs`, qui déclare ce fichier en exception.
 */
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Nom de l'exploitant, tel qu'il figure au registre.
 *
 * La table `parametres` ne porte pas de colonne pour lui, et il n'a rien à
 * faire dans `identite-owise.ts`, qui décrit l'identité PUBLIQUE d'Owise et
 * omet volontairement le nom et la rue.
 */
export const EXPLOITANT = 'Houna Hassan'

/** L'identité d'Owise sur un devis ou une facture. */
export type Prestataire = {
  /** « Owise — Chantilly ». Le nom commercial, pas la raison sociale. */
  nom: string
  /** « Service de chauffeur privé ». */
  metier: string
  telephone: string | null
  email: string | null
  /** SIRET déjà coupé en groupes, pour l'en-tête. */
  siret: string | null
  /** Forme juridique, adresse du siège, SIRET et code APE — une ligne chacun. */
  legal: string[]
}

/** Les colonnes de `parametres` dont l'identité se construit. */
export type LigneParametres = {
  societe_nom?: string | null
  societe_siret?: string | null
  societe_naf?: string | null
  societe_adresse?: string | null
  societe_code_postal?: string | null
  societe_ville?: string | null
  societe_telephone?: string | null
  societe_email?: string | null
}

/** Les colonnes à demander à `parametres` pour construire l'identité. */
export const COLONNES_PRESTATAIRE =
  'societe_nom, societe_siret, societe_naf, societe_adresse, societe_code_postal, societe_ville, societe_telephone, societe_email'

/** « +33619106356 » → « 06 19 10 63 56 ». Laisse tel quel ce qu'il ne sait pas lire. */
export function formaterTelephone(v: string | null | undefined): string | null {
  if (!v) return null
  const chiffres = String(v).replace(/[^\d+]/g, '').replace(/^\+33/, '0')
  return /^0\d{9}$/.test(chiffres) ? chiffres.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : String(v)
}

/** « 47753413500041 » → « 477 534 135 00041 », la coupure usuelle SIREN + NIC. */
export function grouperSiret(v: string | null | undefined): string | null {
  if (!v) return null
  const n = String(v).replace(/\s/g, '')
  return /^\d{14}$/.test(n) ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : String(v)
}

/** « OWISE » → « Owise ». Les capitales conviennent à un logo, pas à une phrase. */
export function nomPropre(v: string): string {
  return /^[A-ZÀ-Ý\s-]+$/.test(v) ? v.charAt(0) + v.slice(1).toLowerCase() : v
}

/**
 * « saint-maximin » → « Saint-Maximin ». La base porte la minuscule.
 *
 * Le trait d'union compte : une capitalisation qui ne traite que la première
 * lettre rend « Saint-maximin », et c'est précisément l'écart qui existait
 * entre le devis et la facture avant ce fichier.
 */
export function capitaliserCommune(v: string | null | undefined): string | null {
  if (!v) return null
  return String(v).replace(/(^|[-\s])([a-zà-ÿ])/g, (_, s, c) => s + c.toUpperCase())
}

/**
 * L'identité, construite depuis une ligne de `parametres` déjà lue.
 *
 * Séparée du chargement pour que la facture — qui lit `parametres` une seule
 * fois, avec beaucoup d'autres colonnes — n'ait pas à faire une deuxième
 * requête pour obtenir exactement la même chose.
 */
export function construirePrestataire(p: LigneParametres | null | undefined): Prestataire {
  const siret = grouperSiret(p?.societe_siret)
  return {
    nom: `${nomPropre(p?.societe_nom ?? 'OWISE')} — Chantilly`,
    metier: 'Service de chauffeur privé',
    telephone: formaterTelephone(p?.societe_telephone),
    email: p?.societe_email ?? null,
    siret,
    legal: [
      `${EXPLOITANT} — entreprise individuelle (micro-entrepreneur)`,
      [p?.societe_adresse, [p?.societe_code_postal, capitaliserCommune(p?.societe_ville)].filter(Boolean).join(' ')]
        .filter(Boolean).join(', '),
      [siret ? `SIRET ${siret}` : null, p?.societe_naf ? `Code APE ${p.societe_naf}` : null]
        .filter(Boolean).join(' · '),
    ].filter(l => l && l.trim().length > 0),
  }
}

/** L'identité, lue depuis la base. Pour les documents qui n'ont pas déjà la ligne. */
export async function chargerPrestataire(): Promise<Prestataire> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('parametres')
    .select(COLONNES_PRESTATAIRE)
    .eq('id', true)
    .single()
  return construirePrestataire(data as LigneParametres | null)
}
