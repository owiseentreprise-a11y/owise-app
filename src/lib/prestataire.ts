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
 * Ce fichier ne porte AUCUNE donnée personnelle : ni le nom de l'exploitant,
 * ni l'adresse de son siège, qui est son domicile. Deux décisions distinctes
 * du même exploitant, prises en connaissance de cause — l'adresse le
 * 2026-09-20 et confirmée le 2026-11-09, le nom le 2026-11-12.
 *
 * L'art. L441-9 du Code de commerce impose l'un et l'autre sur une facture.
 * Les factures d'Owise sont donc incomplètes au regard de cet article. Ce
 * n'est pas un défaut à corriger : c'est ce qui a été demandé, deux fois,
 * après qu'on en a dit la conséquence.
 *
 * Un document d'Owise se présente désormais avec exactement ce que porte sa
 * vitrine : le nom commercial, le téléphone, l'e-mail, le SIRET.
 */
import { createAdminClient } from '@/lib/supabase/admin'

/* LE NOM DE L'EXPLOITANT N'EST PLUS ÉCRIT ICI, et ce n'est pas un oubli.
   Il y figurait jusqu'au 2026-11-12 sous la forme d'une constante
   `EXPLOITANT`, rendue sur chaque devis et chaque facture. L'exploitant a
   demandé ce jour-là qu'il n'apparaisse ni sur l'un ni sur l'autre — voir
   `construirePrestataire` plus bas pour la décision et sa conséquence
   légale. Ne pas réintroduire cette constante : ce fichier ne doit plus
   porter aucune donnée personnelle, et `test-identite-privee.mjs` n'a plus
   besoin de le déclarer en exception. */

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

/**
 * Les colonnes de `parametres` dont l'identité se construit.
 *
 * L'ADRESSE DU SIÈGE N'EN FAIT PAS PARTIE, et ce n'est pas un oubli.
 * L'exploitant l'a demandé le 2026-09-20, puis confirmé le 2026-11-09 : son
 * siège est son domicile, il ne doit figurer sur aucun document remis à un
 * client. La conséquence est assumée et lui a été dite : l'article L441-9 du
 * Code de commerce exige l'adresse de l'émetteur sur une facture, donc ces
 * factures sont incomplètes au regard de la loi.
 *
 * Elle est retirée de la REQUÊTE, pas seulement de l'affichage. Un commentaire
 * « ne pas réintroduire » ne protège rien : il en existait un sur la page de
 * l'espace client, et l'adresse est quand même apparue sur trois autres
 * surfaces — la page d'administration depuis le 2026-10-16, le devis depuis le
 * 2026-11-02, son PDF depuis le 2026-11-09. Une colonne qu'on ne demande pas
 * ne peut pas s'afficher.
 */
export type LigneParametres = {
  societe_nom?: string | null
  societe_siret?: string | null
  societe_naf?: string | null
  societe_telephone?: string | null
  societe_email?: string | null
}

/** Les colonnes à demander à `parametres` pour construire l'identité. */
export const COLONNES_PRESTATAIRE =
  'societe_nom, societe_siret, societe_naf, societe_telephone, societe_email'

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

/* `capitaliserCommune()` vivait ici : la base porte « saint-maximin » et le
   devis l'écrivait « Saint-maximin » quand la facture écrivait
   « Saint-Maximin ». La fonction a disparu avec la ligne qu'elle servait —
   l'adresse du siège n'est plus affichée nulle part, donc il n'y a plus de
   commune à capitaliser, et plus d'orthographe à faire diverger. */

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
    /* Le SIRET et le code APE, et RIEN D'AUTRE.

       NI le nom de l'exploitant, NI l'adresse de son siège : deux décisions
       distinctes du même exploitant, prises en connaissance de cause.
       L'adresse le 2026-09-20, confirmée le 2026-11-09. Le nom le
       2026-11-12, en découvrant sa mention nominative de forme juridique
       sur la page de devis que son client ouvre : « il faut pas que ce soit
       affiché dans les devis ni facture ».

       Conséquence dite et acceptée : l'art. L441-9 du Code de commerce
       impose le nom et l'adresse du vendeur sur une facture, et pour une
       entreprise individuelle ce nom est celui de la personne. Les factures
       d'Owise sont donc incomplètes au regard de cet article. Ce n'est pas
       un oubli à « corriger ». */
    legal: [
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
