/**
 * estimation-anonyme.ts — ce qu'on garde d'une adresse quand on l'enregistre
 * pour une statistique, et rien de plus.
 *
 * Constat de l'étape 85 : la table `estimations` recevait le libellé complet
 * renvoyé par Google, numéro et rue compris — « 12 Rue de Paris, 60500
 * Chantilly, France ». Ces estimations ne servent qu'à mesurer la demande :
 * d'où partent les gens, où vont-ils, dans quel véhicule, à quel prix. Le
 * numéro et la rue n'y apportent rien, et ce sont eux qui rendent la ligne
 * identifiante.
 *
 * Ce qu'on garde désormais : la zone tarifaire quand elle est reconnue, et
 * la commune. Jamais le numéro, jamais la rue, jamais de coordonnées.
 *
 * ── Forme produite ───────────────────────────────────────────────────────
 *   « CHA, 60500 Chantilly »        zone reconnue + commune
 *   « CDG, 95700 Roissy-en-France »
 *   « 75116 Paris »                 commune seule, aucune zone reconnue
 *   « CDG, 95700 »                  code postal seul : situe, mais ne nomme pas
 *   « Z1, commune non précisée »    zone reconnue, commune introuvable
 *   « commune non précisée »        rien d'exploitable
 *
 * ── Le défaut du 2026-10-22, trouvé le 2026-11-08 ────────────────────────
 * Ce module a été écrit pour cesser d'enregistrer les adresses complètes, et
 * il l'a fait. Mais son filet serveur ne reconnaissait pas « CDG, 95700 »
 * comme une valeur déjà généralisée : il exigeait « NNNNN Commune ». Il
 * tentait donc de la raboter, n'y trouvait aucune commune, et écrivait
 * « commune non précisée ». Or c'est exactement la forme que produisait tout
 * lieu choisi dans la liste des suggestions — aéroports, gares, Disneyland —
 * puisque leur libellé ne contient pas de code postal.
 *
 * Conséquence mesurée en base : du 2026-10-24 au 2026-11-08, chaque
 * estimation touchant un aéroport ou une gare a perdu non seulement sa
 * commune mais aussi sa zone tarifaire. Les 2, 6, 7 et 8 novembre, la quasi-
 * totalité des lignes. Le prix, lui, est toujours resté juste : il ne passe
 * pas par ici.
 *
 * Deux corrections, et une leçon. `estDejaGeneralise` accepte désormais un
 * code postal nu, et `generaliserLieu` garde un code postal plutôt que de
 * tout jeter — un filet de confidentialité doit dégrader, jamais détruire.
 * Et `lieux.ts` déclare la commune de chaque lieu connu, pour que ces
 * estimations portent un nom de ville et pas un numéro.
 *
 * La virgule n'est pas décorative : /admin/estimations découpe sur la virgule
 * et cherche « NNNNN Commune » dans les morceaux. Cette forme s'y lit donc
 * sans modifier l'écran, et les anciennes lignes continuent de s'y lire aussi.
 *
 * ── Un seul import, et seulement des données ─────────────────────────────
 * Ce module est appelé depuis le navigateur (vitrine et /reserver) ET depuis
 * la route serveur, qui s'en sert de filet. Il ne peut donc dépendre de rien
 * qui n'existe que d'un côté : pas de client Supabase, pas de `next/*`, pas
 * de React. `lieux.ts` est un tableau de constantes sans aucun import — il
 * se charge aussi bien des deux côtés.
 */

import { LIEUX_CONNUS } from './lieux'

export const LIEU_INCONNU = 'commune non précisée'

/** « 12 Rue de Paris, 60500 Chantilly, France » → « 60500 Chantilly ». */
export function communeDepuisLibelle(libelle: string | null | undefined): string | null {
  if (!libelle) return null
  const m = libelle.match(/\b(\d{5})\s+([^,]+)/)
  if (!m) return null
  const commune = m[2].trim().replace(/\s+/g, ' ')
  if (!commune) return null
  return `${m[1]} ${commune.slice(0, 60)}`
}

/**
 * La commune d'un lieu connu, reconnu par son libellé exact.
 *
 * Un lieu de `LIEUX_CONNUS` est choisi dans la liste des suggestions, et son
 * libellé est alors recopié tel quel : « Aéroport Paris-Charles de Gaulle
 * (CDG) », « Gare du Nord ». Aucun de ces libellés ne contient de code
 * postal, donc `communeDepuisLibelle` n'en tire rien. La commune, elle, est
 * déclarée dans `lieux.ts` — c'est la seule chose à aller y chercher.
 */
export function communeDuLieuConnu(libelle: string | null | undefined): string | null {
  if (!libelle) return null
  const l = libelle.trim()
  if (!l) return null
  const lieu = LIEUX_CONNUS.find(x => x.label === l)
  return lieu?.commune?.trim() || null
}

/**
 * Le lieu tel qu'on l'enregistre. `codeZone` vient de `detectZone()` côté
 * appelant : ce module ne refait pas la détection, il n'en a pas le droit —
 * la détection de zone vit dans calcPrix.ts et nulle part ailleurs.
 *
 * Trois sources pour la commune, dans cet ordre, de la plus précise à la plus
 * pauvre. Le dernier repli — le code postal seul — ne donne pas un nom de
 * ville ; il n'existe que pour ne jamais rien perdre.
 */
export function lieuPourStatistique(
  libelle: string | null | undefined,
  codePostal: string | null | undefined,
  codeZone: string | null | undefined,
): string {
  const zone = (codeZone ?? '').trim().toUpperCase() || null
  let commune = communeDepuisLibelle(libelle)
  if (!commune) commune = communeDuLieuConnu(libelle)
  if (!commune) {
    const cp = (codePostal ?? '').trim()
    if (/^\d{5}$/.test(cp)) commune = cp
  }
  if (zone && commune) return `${zone}, ${commune}`
  if (zone) return `${zone}, ${LIEU_INCONNU}`
  if (commune) return commune
  return LIEU_INCONNU
}

/* ── Filet côté serveur ──────────────────────────────────────────────────
   Un client plus ancien, un script tiers ou une régression future peut encore
   poster une adresse complète. La route applique donc `generaliserLieu()`
   avant d'écrire : la fonction est idempotente, elle laisse intacte une
   valeur déjà généralisée et rabote les autres. */

/** Repères d'une adresse de voirie : si l'un apparaît, la valeur n'est pas
 *  généralisée et doit l'être. */
const MOTS_DE_VOIRIE = /\b(rue|avenue|av\.|boulevard|bd\.?|impasse|chemin|all[ée]e|place|quai|route|rte\.?|voie|sentier|square|cours|faubourg|passage|villa|cit[ée]|hameau|lieu[- ]dit|residence|résidence)\b/i

export function estDejaGeneralise(valeur: string): boolean {
  const v = valeur.trim()
  if (v === LIEU_INCONNU) return true
  if (MOTS_DE_VOIRIE.test(v)) return false
  /* Un numéro de voirie en tête (« 12 Rue… », « 4b avenue… ») */
  if (/^\d{1,4}\s*[a-z]?\s+\S/i.test(v) && !/^\d{5}\s/.test(v)) return false
  const bouts = v.split(',').map(s => s.trim()).filter(Boolean)
  if (bouts.length > 2) return false
  if (bouts.length === 2) {
    /* « CODE, NNNNN Commune », « CODE, NNNNN » ou « CODE, commune non précisée » */
    return /^[A-Z0-9]{1,6}$/.test(bouts[0])
      && (bouts[1] === LIEU_INCONNU || /^\d{5}(\s+\S|$)/.test(bouts[1]))
  }
  /* « NNNNN Commune » ou « NNNNN » seul */
  return /^\d{5}(\s+\S|$)/.test(bouts[0])
}

export function generaliserLieu(valeur: unknown): string {
  if (typeof valeur !== 'string') return LIEU_INCONNU
  const v = valeur.trim()
  if (!v) return LIEU_INCONNU
  if (estDejaGeneralise(v)) return v.slice(0, 80)
  const commune = communeDepuisLibelle(v)
  if (commune) return commune
  /* Un libellé de lieu connu posté brut par un onglet resté ouvert :
     « Aéroport Paris-Charles de Gaulle (CDG) » ne porte aucun code postal,
     mais sa commune est déclarée dans lieux.ts. */
  const connue = communeDuLieuConnu(v)
  if (connue) return connue.slice(0, 80)
  /* Dernier recours : un code postal, où qu'il se trouve dans la valeur. Il
     ne nomme pas la ville, mais il situe la demande — et il ne contient ni
     numéro, ni rue, ni rien d'identifiant. On ne jette une ligne que quand
     il n'y a vraiment rien à en tirer. */
  const cp = v.match(/\b(\d{5})\b/)
  if (cp) return cp[1]
  return LIEU_INCONNU
}
