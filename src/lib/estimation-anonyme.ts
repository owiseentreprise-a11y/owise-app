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
 *   « CDG, 93290 Tremblay-en-France »
 *   « 75116 Paris »                 commune seule, aucune zone reconnue
 *   « Z1, commune non précisée »    zone reconnue, commune introuvable
 *   « commune non précisée »        rien d'exploitable
 *
 * La virgule n'est pas décorative : /admin/estimations découpe sur la virgule
 * et cherche « NNNNN Commune » dans les morceaux. Cette forme s'y lit donc
 * sans modifier l'écran, et les anciennes lignes continuent de s'y lire aussi.
 *
 * ── Aucun import ─────────────────────────────────────────────────────────
 * Ce module est volontairement pur : il est appelé depuis le navigateur
 * (vitrine et /reserver) ET depuis la route serveur, qui s'en sert de filet.
 * Lui donner une dépendance le rendrait inappelable depuis l'un des deux.
 */

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
 * Le lieu tel qu'on l'enregistre. `codeZone` vient de `detectZone()` côté
 * appelant : ce module ne refait pas la détection, il n'en a pas le droit —
 * la détection de zone vit dans calcPrix.ts et nulle part ailleurs.
 */
export function lieuPourStatistique(
  libelle: string | null | undefined,
  codePostal: string | null | undefined,
  codeZone: string | null | undefined,
): string {
  const zone = (codeZone ?? '').trim().toUpperCase() || null
  let commune = communeDepuisLibelle(libelle)
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
    /* « CODE, NNNNN Commune » ou « CODE, commune non précisée » */
    return /^[A-Z0-9]{1,6}$/.test(bouts[0])
      && (bouts[1] === LIEU_INCONNU || /^\d{5}\s+\S/.test(bouts[1]))
  }
  /* « NNNNN Commune » seul */
  return /^\d{5}\s+\S/.test(bouts[0])
}

export function generaliserLieu(valeur: unknown): string {
  if (typeof valeur !== 'string') return LIEU_INCONNU
  const v = valeur.trim()
  if (!v) return LIEU_INCONNU
  if (estDejaGeneralise(v)) return v.slice(0, 80)
  const commune = communeDepuisLibelle(v)
  if (commune) return commune
  /* Aucune commune repérable et une forme suspecte : on n'invente rien et on
     ne garde rien. Perdre une ligne de statistique coûte moins cher que de
     conserver une adresse dont on n'a pas besoin. */
  return LIEU_INCONNU
}
