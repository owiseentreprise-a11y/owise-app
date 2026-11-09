import { createAdminClient, getUserEmail } from '@/lib/supabase/admin'
import {
  COLONNES_PRESTATAIRE, capitaliserCommune, construirePrestataire,
  formaterTelephone, grouperSiret, nomPropre,
  type LigneParametres, type Prestataire,
} from '@/lib/prestataire'

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
 *
 * Déplacées dans `montant.ts` le 2026-10-16 et réexportées ici : ce fichier
 * importe `createAdminClient`, et les composants qui tournent dans le
 * navigateur ne peuvent donc pas s'en servir sans embarquer du code serveur.
 * Il n'existe toujours qu'une seule écriture d'un montant dans le projet.
 */
import { formaterMontant } from './montant'
export { formaterNombre } from './montant'
export { formaterMontant }

export type LigneFacture = {
  /** Date de la course, déjà formatée en jj/mm. Vide sur une ligne saisie. */
  date: string
  /** Commune de départ (première partie de l'adresse). */
  depart: string
  /** Commune d'arrivée. */
  arrivee: string
  /**
   * Désignation d'une ligne SAISIE À LA MAIN, quand la facture ne repose sur
   * aucune course enregistrée — une prestation réservée par téléphone, par
   * exemple. Présente, elle remplace « départ → arrivée » à l'affichage.
   *
   * Les trois surfaces qui rendent une facture doivent écrire
   * `ligne.libelle ?? « départ → arrivée »`, et rien d'autre : c'est la seule
   * règle, et elle est énoncée ici.
   */
  libelle: string | null
  montantHt: number | null
  /**
   * Le décompte de la ligne : « Transfert 110 € · attente 70 € · 1 arrêt
   * 20 € ». Tiré des notes de la course, dont on retire la partie
   * administrative — elle sert à l'exploitation, pas au client.
   */
  detail: string | null
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
  /** « 08/10/2026 ». La maquette de facture ecrit les reperes en chiffres. */
  dateEmissionCourte: string
  /** « 23/10/2026 », ou null si la facture est deja reglee. */
  echeanceCourte: string | null
  montantHt: number
  tva: number
  montantTtc: number
  client: { nom: string; adresse: string | null; contact: string | null; telephone: string | null; email: string | null }
  societe: { nom: string; siret: string | null; siretGroupe: string | null; tvaNumero: string | null }
  /** Coordonnées bancaires — null sur une facture acquittée, pour ne pas
   *  inviter le client à payer une seconde fois. */
  banque: { nom: string | null; iban: string | null; bic: string | null } | null
  mentions: string | null
  lignes: LigneFacture[]
  /** Bloc « Prestataire » : identité commerciale et mentions légales.
   *  Décrite dans `prestataire.ts`, partagée mot pour mot avec le devis. */
  prestataire: Prestataire
  /** Date des prestations, jj/mm/aaaa. Nulle si elles ne tombent pas le même jour. */
  datePrestation: string | null
  /** Délai de règlement en jours, tel que réglé dans /admin/tarifs. */
  delaiPaiement: number
  /**
   * Récapitulatif affiché au-dessus du total.
   *
   * Le devis en a toujours un — « 1 transfert … 201,00 € » — et la facture
   * n'en avait un que si l'exploitant avait saisi un récapitulatif à la main.
   * Sur la facture d'Isabelle Rivere, le cadre du total ne portait donc que
   * « NET À PAYER », quand le devis du même jour portait trois lignes.
   * Il se calcule maintenant à défaut, depuis les prestations.
   */
  recap: { libelle: string; montant: number }[]
  /** Ce qui s'écrit en face de « TVA », à côté du total. Comme sur le devis. */
  mentionTva: string
}

/** « 2026-10-08 » → « 08/10/2026 ». Le fuseau est obligatoire : une date
 *  lue en temps universel peut tomber la veille. */
function dateChiffres(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Le représentant chez le client, pour la ligne « À l'attention de … ».
 *
 * Nommé seulement si toutes les courses de la facture désignent le même
 * collaborateur. Sur une facture mensuelle qui regroupe les trajets de
 * plusieurs salariés, en désigner un seul serait arbitraire et trompeur.
 */
function contactUnique(courses: { collaborateurs?: unknown }[] | null): string | null {
  /* PostgREST rend une relation imbriquée sous forme de tableau quand elle
   * peut en contenir plusieurs, et d'objet sinon. On accepte les deux plutôt
   * que de dépendre de la forme qu'il choisit. */
  const prenom = (v: unknown): string => {
    const o = Array.isArray(v) ? v[0] : v
    return typeof o === 'object' && o !== null && 'prenom' in o ? String((o as { prenom?: unknown }).prenom ?? '').trim() : ''
  }
  const noms = (courses ?? []).map(c => prenom(c.collaborateurs)).filter(n => n.length > 0)
  if (noms.length === 0 || noms.length !== (courses ?? []).length) return null
  return new Set(noms).size === 1 ? noms[0] : null
}

/**
 * La date des prestations, avec son année — « 07/10/2026 ».
 *
 * `dateCourte` ne rend que le jour et le mois : suffisant dans un tableau
 * dont l'année est connue, insuffisant en tête de facture, où c'est la date
 * qui engage. Rendue seulement si toutes les courses tombent le même jour.
 */
function datePrestations(courses: { date_prevue?: string | null }[] | null): string | null {
  const jours = (courses ?? []).map(c => c.date_prevue).filter(Boolean) as string[]
  if (!jours.length) return null
  const formate = (v: string) => new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })
  const distinctes = new Set(jours.map(formate))
  return distinctes.size === 1 ? [...distinctes][0] : null
}

/**
 * Le décompte d'une ligne, extrait des notes de la course.
 *
 * Les notes portent aussi une partie administrative — « prestation du 7
 * octobre 2026, heure non communiquée (facture …) » — qui regarde
 * l'exploitation et pas le client. On ne garde que ce qui précède le premier
 * tiret cadratin.
 */
function detailLigne(notes: string | null | undefined): string | null {
  if (!notes) return null
  const avant = String(notes).split(' — ')[0].trim()
  return avant.length > 0 && avant.length < 160 ? avant : null
}

/**
 * Lit le récapitulatif déclaré dans `factures.notes`, une ligne par poste au
 * format « libellé|montant ». Toute ligne qui ne respecte pas ce format est
 * ignorée : mieux vaut un récapitulatif absent qu'un récapitulatif faux.
 *
 * Garde-fou : si la somme des postes ne fait pas le montant de la facture, on
 * ne l'affiche pas du tout. Un décompte qui ne tombe pas juste sur une
 * facture est pire que pas de décompte.
 */
function lireRecap(notes: string | null | undefined, montantTtc: number): { libelle: string; montant: number }[] {
  if (!notes) return []
  const lignes = String(notes).split('\n')
    .map(l => l.split('|'))
    .filter(p => p.length === 2 && p[0].trim() && !isNaN(Number(p[1])))
    .map(p => ({ libelle: p[0].trim(), montant: Number(p[1]) }))
  if (!lignes.length) return []
  const somme = Math.round(lignes.reduce((s, l) => s + l.montant, 0) * 100) / 100
  return somme === Math.round(montantTtc * 100) / 100 ? lignes : []
}

/** Format identique à celui des pages facture, pour que les trois concordent. */
function dateLongue(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

/**
 * Date d'une course sur une ligne de facture. Le fuseau est obligatoire : une
 * course du 25 a 00:30 heure de Paris est un instant du 24 en temps universel,
 * et la facture aurait annonce la veille.
 */
function dateCourte(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit' })
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
      .select('*, clients(type_compte, entreprise_nom, prenom, nom, adresse_facturation, tel, email, profiles(prenom, nom, telephone))')
      .eq('id', factureId)
      .single(),
    admin
      .from('courses')
      .select('id, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime, notes, collaborateurs(prenom, nom)')
      .eq('facture_id', factureId)
      .order('date_prevue', { ascending: true }),
    admin
      .from('parametres')
      /* Les colonnes de l'identite viennent de `prestataire.ts`. Les ecrire a la
         main ici, c'etait la garantie qu'une colonne ajoutee la-bas serait
         oubliee ici — et une colonne oubliee dans un `select` fait retomber le
         code sur sa valeur de repli, sans un mot (regle de CLAUDE.md). */
      .select(`${COLONNES_PRESTATAIRE}, societe_tva_numero, banque_nom, banque_iban, banque_bic, facture_mentions, facture_delai_paiement`)
      .eq('id', true)
      .single(),
  ])

  const f = factureRes.data
  if (!f) return null

  const p = parametresRes.data
  const c = (f as Record<string, any>).clients

  /* L'adresse du compte, en dernier recours pour le bloc « Client ».
     `getUserEmail` existe deja et sait se rabattre sur l'API d'administration :
     on ne reecrit pas cette lecture ici. */
  const compteEmail = f.client_id ? await getUserEmail(String(f.client_id)) : null

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
    dateEmissionCourte: dateChiffres(f.date_emission),
    echeanceCourte: payee ? null : dateChiffres(f.date_echeance),
    montantHt:  Number(f.montant_ht),
    tva:        Number(f.tva),
    montantTtc: Number(f.montant_ttc),
    client: {
      nom: nomClient,
      adresse: c?.adresse_facturation ?? null,
      /* « À l'attention de … » : le représentant chez le client. On ne le
       * nomme que si TOUTES les courses de la facture pointent le même, sinon
       * désigner quelqu'un serait arbitraire. */
      contact: contactUnique(coursesRes.data),
      /* Repli sur le PROFIL — constat du 2026-11-09.
         `clients.tel` et `clients.email` sont vides pour toute fiche creee
         depuis /admin/clients/nouveau : ce formulaire ecrit le telephone dans
         `profiles` et l'e-mail dans le compte, jamais dans `clients`. La
         facture n'affichait donc ni l'un ni l'autre, la ou le DEVIS les
         montre — l'exploitant a vu deux documents differents pour la meme
         entreprise, et il avait raison.
         On lit la table `clients` d'abord (une adresse de facturation peut
         differer volontairement du contact), puis le profil. */
      telephone: formaterTelephone(c?.tel ?? c?.profiles?.telephone),
      email: c?.email ?? compteEmail ?? null,
    },
    societe: {
      nom:        p?.societe_nom ?? 'OWISE',
      siret:      p?.societe_siret ?? null,
      /* « 477 534 135 00041 » : la coupure usuelle, celle qu'on lit sur un
       * document. Le brut reste disponible pour qui en a besoin. */
      siretGroupe: p?.societe_siret ? grouperSiret(p.societe_siret) : null,
      tvaNumero:  p?.societe_tva_numero ?? null,
    },
    /**
     * Le bloc « Prestataire » du document.
     *
     * L'adresse du siège et le nom de l'exploitant étaient volontairement
     * absents des factures depuis le 2026-09-20. Ils sont revenus le
     * 2026-10-08 : **le comptable d'un client les a exigés**, et il avait
     * raison — sans l'identité de l'émetteur et l'adresse de son siège, une
     * facture est irrégulière et ne peut pas être passée en charge
     * (art. L441-9 du Code de commerce). L'exploitant a validé le document
     * ainsi le 2026-10-16.
     *
     * Le texte exact vit dans `prestataire.ts`, partagé avec le devis : il
     * était écrit deux fois, et les deux copies avaient déjà divergé sur
     * l'orthographe de la commune. Ces mentions ne doivent apparaître sur
     * aucune page publique — voir la règle dans CLAUDE.md et
     * `test-identite-privee.mjs`.
     */
    prestataire: construirePrestataire(p as LigneParametres | null),
    datePrestation: datePrestations(coursesRes.data),
    delaiPaiement: Number(p?.facture_delai_paiement ?? 15),
    /**
     * Récapitulatif par nature, au-dessus du total : « 5 transferts × 110 € »,
     * « Attentes », « 6 arrêts supplémentaires × 20 € ».
     *
     * Il ne se déduit pas des courses : la base ne distingue pas, dans le prix
     * d'une course, ce qui vient du transfert, de l'attente ou des arrêts. Il
     * se déclare donc dans `factures.notes`, une ligne par poste, au format
     * « libellé|montant ». Absent, le document affiche le total seul — ce qui
     * reste une facture correcte.
     */
    /* Vidé quand le récapitulatif A DÉJÀ SERVI de corps à la facture : sans
       cela, les mêmes postes s'impriment deux fois sur le même document, une
       fois dans le tableau et une fois à côté du règlement. Constaté à
       l'écran le 2026-11-09, sur la première facture saisie à la main.
       La décision est prise ICI, une fois : les surfaces se contentent de
       rendre ce qu'on leur donne. */
    recap: recapDuDocument(coursesRes.data, f.notes, Number(f.montant_ttc), Number(f.montant_ht)),
    /* « non applicable » en toutes lettres plutot que « 0,00 € » : c'est ce
       qu'ecrit le devis, et un zero en euros se lit comme un oubli. */
    mentionTva: Number(f.tva) === 0 ? 'non applicable' : formaterMontant(Number(f.tva)),
    banque: payee ? null : {
      nom:  p?.banque_nom ?? null,
      iban: p?.banque_iban ?? null,
      bic:  p?.banque_bic ?? null,
    },
    mentions: p?.facture_mentions ?? null,
    /**
     * Les lignes du corps de la facture.
     *
     * Normalement, une par course rattachée. Mais une prestation réservée par
     * téléphone et jamais saisie n'a aucune course — et le document imprimait
     * alors « Aucune course rattachée à cette facture », en toutes lettres,
     * sur un document remis à un client. Constaté le 2026-11-09, sur une
     * facture qui devait partir le jour même.
     *
     * Dans ce cas seulement, on prend le récapitulatif déclaré dans les notes
     * (« libellé|montant »), celui-là même que l'exploitant utilisait déjà à
     * la main. Il ne sert donc qu'en l'absence de course : jamais à côté, pour
     * qu'un montant ne puisse pas être compté deux fois.
     *
     * Le garde-fou de `lireRecap` protège l'ensemble : si la somme des postes
     * ne fait pas le total de la facture, il ne rend rien — et le corps reste
     * vide plutôt que faux.
     */
    lignes: lignesDuDocument(coursesRes.data, f.notes, Number(f.montant_ttc)),
  }
}

/**
 * Le recapitulatif affiche a cote du total.
 *
 * Trois cas, dans cet ordre :
 *
 *  1. le recapitulatif saisi a la main a DEJA servi de corps a la facture
 *     (aucune course rattachee) — on ne le repete pas a cote du total ;
 *  2. un recapitulatif a ete saisi ET des courses existent — on l'affiche,
 *     c'est le detail par nature voulu par l'exploitant ;
 *  3. ni l'un ni l'autre — on compte les prestations. C'est le cas courant,
 *     et c'etait justement celui ou la facture n'affichait rien du tout,
 *     quand le devis du meme jour affichait « 1 transfert · 201,00 € ».
 */
function recapDuDocument(
  courses: CourseDeFacture[] | null,
  notes: string | null | undefined,
  montantTtc: number,
  montantHt: number,
): { libelle: string; montant: number }[] {
  const nb = (courses ?? []).length
  if (nb === 0) return []
  const saisi = lireRecap(notes, montantTtc)
  if (saisi.length > 0) return saisi
  /* « transfert », le mot qu'emploie le devis pour la meme chose. Deux mots
     differents pour un meme poste sur deux documents consecutifs, c'est
     exactement ce que l'exploitant reproche. */
  return [{ libelle: `${nb} transfert${nb > 1 ? 's' : ''}`, montant: montantHt }]
}

/** Ce que le document a besoin de savoir d'une course, et rien de plus. */
type CourseDeFacture = {
  adresse_depart: string
  adresse_arrivee: string
  date_prevue?: string | null
  prix_final?: number | null
  prix_estime?: number | null
  notes?: string | null
}

/** Les lignes du corps : les courses, ou, à défaut, le récapitulatif saisi. */
function lignesDuDocument(
  courses: CourseDeFacture[] | null,
  notes: string | null | undefined,
  montantTtc: number,
): LigneFacture[] {
  const desCourses = (courses ?? []).map(course => ({
    date:      dateCourte(course.date_prevue),
    depart:    premierSegment(course.adresse_depart),
    arrivee:   premierSegment(course.adresse_arrivee),
    libelle:   null,
    montantHt: course.prix_final ?? course.prix_estime ?? null,
    detail:    detailLigne(course.notes),
  }))
  if (desCourses.length > 0) return desCourses

  return lireRecap(notes, montantTtc).map(r => ({
    date:      '',
    depart:    '',
    arrivee:   '',
    libelle:   r.libelle,
    montantHt: r.montant,
    detail:    null,
  }))
}
