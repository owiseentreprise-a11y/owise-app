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
 *
 * Déplacées dans `montant.ts` le 2026-10-16 et réexportées ici : ce fichier
 * importe `createAdminClient`, et les composants qui tournent dans le
 * navigateur ne peuvent donc pas s'en servir sans embarquer du code serveur.
 * Il n'existe toujours qu'une seule écriture d'un montant dans le projet.
 */
export { formaterNombre, formaterMontant } from './montant'

export type LigneFacture = {
  /** Date de la course, déjà formatée en jj/mm. */
  date: string
  /** Commune de départ (première partie de l'adresse). */
  depart: string
  /** Commune d'arrivée. */
  arrivee: string
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
  /** Bloc « Prestataire » : identité commerciale et mentions légales. */
  prestataire: {
    nom: string
    metier: string
    telephone: string | null
    email: string | null
    legal: string[]
  }
  /** Date des prestations, jj/mm/aaaa. Nulle si elles ne tombent pas le même jour. */
  datePrestation: string | null
  /** Délai de règlement en jours, tel que réglé dans /admin/tarifs. */
  delaiPaiement: number
  /** Récapitulatif par nature affiché au-dessus du total. Peut être vide. */
  recap: { libelle: string; montant: number }[]
}

/**
 * Nom de l'exploitant, tel qu'il figure au registre.
 *
 * Écrit ici et nulle part ailleurs. La table `parametres` ne porte pas de
 * colonne pour lui, et il n'a rien à faire dans `identite-owise.ts`, qui
 * décrit l'identité PUBLIQUE d'Owise et omet volontairement le nom et la rue.
 * Une facture est le seul document qui doit les porter.
 */
const EXPLOITANT = 'Houna Hassan'

/** « +33619106356 » → « 06 19 10 63 56 ». Laisse tel quel ce qu'il ne sait pas lire. */
function formaterTelephone(v: string | null | undefined): string | null {
  if (!v) return null
  const chiffres = String(v).replace(/[^\d+]/g, '').replace(/^\+33/, '0')
  return /^0\d{9}$/.test(chiffres) ? chiffres.replace(/(\d{2})(?=\d)/g, '$1 ').trim() : String(v)
}

/** « 47753413500041 » → « 477 534 135 00041 », la coupure usuelle SIREN + NIC. */
function grouperSiret(v: string): string {
  const n = String(v).replace(/\s/g, '')
  return /^\d{14}$/.test(n) ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6, 9)} ${n.slice(9)}` : String(v)
}

/** « 2026-10-08 » → « 08/10/2026 ». Le fuseau est obligatoire : une date
 *  lue en temps universel peut tomber la veille. */
function dateChiffres(v: string | null | undefined): string {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' })
}

/** « OWISE » → « Owise ». Les capitales conviennent à un logo, pas à une phrase. */
function nomPropre(v: string): string {
  return /^[A-ZÀ-Ý\s-]+$/.test(v) ? v.charAt(0) + v.slice(1).toLowerCase() : v
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

/** « Saint-maximin » → « Saint-Maximin ». La base porte la minuscule. */
function capitaliserCommune(v: string | null | undefined): string | null {
  if (!v) return null
  return String(v).replace(/(^|[-\s])([a-zà-ÿ])/g, (_, s, c) => s + c.toUpperCase())
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
      .select('*, clients(type_compte, entreprise_nom, prenom, nom, adresse_facturation, tel, email, profiles(prenom, nom))')
      .eq('id', factureId)
      .single(),
    admin
      .from('courses')
      .select('id, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime, notes, collaborateurs(prenom, nom)')
      .eq('facture_id', factureId)
      .order('date_prevue', { ascending: true }),
    admin
      .from('parametres')
      .select('societe_nom, societe_siret, societe_tva_numero, societe_naf, societe_adresse, societe_code_postal, societe_ville, societe_telephone, societe_email, banque_nom, banque_iban, banque_bic, facture_mentions, facture_delai_paiement')
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
      telephone: formaterTelephone(c?.tel),
      email: c?.email ?? null,
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
     * C'est le SEUL endroit du projet où ces mentions ont leur place : elles
     * ne doivent apparaître sur aucune page publique — voir la règle dans
     * CLAUDE.md et `test-identite-privee.mjs`, qui déclare ce fichier en
     * exception.
     */
    prestataire: {
      /* La base porte « OWISE » en capitales — bon pour un logo, lourd dans
       * une phrase. Le document l'ecrit comme un nom propre. */
      nom:       `${nomPropre(p?.societe_nom ?? 'OWISE')} — Chantilly`,
      metier:    'Service de chauffeur privé',
      telephone: formaterTelephone(p?.societe_telephone),
      email:     p?.societe_email ?? null,
      legal: [
        `${EXPLOITANT} — entreprise individuelle (micro-entrepreneur)`,
        [p?.societe_adresse, [p?.societe_code_postal, capitaliserCommune(p?.societe_ville)].filter(Boolean).join(' ')]
          .filter(Boolean).join(', '),
        [p?.societe_siret ? `SIRET ${grouperSiret(p.societe_siret)}` : null, p?.societe_naf ? `Code APE ${p.societe_naf}` : null]
          .filter(Boolean).join(' · '),
      ].filter(l => l && l.trim().length > 0),
    },
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
    recap: lireRecap(f.notes, Number(f.montant_ttc)),
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
      detail:    detailLigne(course.notes),
    })),
  }
}
