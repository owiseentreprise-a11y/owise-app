/**
 * La gamme de véhicules — définie ici, et nulle part ailleurs.
 *
 * Pourquoi ce fichier existe
 * ──────────────────────────
 * Audit du 2026-11-03. La gamme était décrite à **cinq** endroits qui ne
 * disaient pas la même chose :
 *
 *   simulateur d'accueil   berline 1–3 · premium 4–4 · van 5–7 · grand van 8
 *   cartes flotte          berline 1–3 · premium 1–4 · van 5–7 · grand van 8
 *   page /reserver         berline 1–3 · premium 1–4 · van 1–7 · (pas de grand van)
 *   /admin/courses/nouvelle   berline · premium · « Van / Minibus »
 *   table `tarifs`         berline · premium · van 7        (pas de grand van)
 *
 * Conséquence mesurée sur le site en ligne, Compiègne → CDG : 5 passagers
 * coûtaient 196 €, et **8 passagers 120 €**. Le même 120 € sur Orly →
 * Beauvais, deux fois plus long. La cause : `tarifs` n'a pas de ligne
 * « Grand Van », la recherche échouait, le moteur de prix était saute, et le
 * code retombait sur une valeur écrite en dur (95 € + 25 € aéroport).
 *
 * Décisions de l'exploitant, 2026-11-03 :
 *
 *   1. Le Grand Van 8 places ne reçoit **aucun prix automatique**. Il est
 *      « sur devis » — ce que la carte flotte annonçait déjà pendant que le
 *      simulateur affichait 120 €. Le client remplit une demande.
 *   2. Le client **choisit son véhicule** parmi ceux qui acceptent son
 *      nombre de passagers, au lieu de se le voir imposer. La Premium
 *      n'apparaissait qu'à exactement 4 passagers : 8 estimations sur 149
 *      depuis septembre, alors que c'est la meilleure marge (+50 %).
 *
 * `scripts/test-gamme.mts` échoue si une surface diverge.
 */

/** La clé que connaissent `calcPrix.ts`, les formulaires et Stripe. */
export type CleVehicule = 'berline' | 'berline_premium' | 'van' | 'grand_van'

export type Vehicule = {
  cle: CleVehicule
  /** Le nom montré au client. */
  nom: string
  /** Le nom de la ligne correspondante dans la table `tarifs`, s'il y en a une. */
  nomTarif: string | null
  /**
   * La valeur que l'enum `public.type_vehicule` accepte en base.
   *
   * Elle differe de `cle` : l'application dit `van`, la base exige `van_7`.
   * Deux clients ont paye un van le 6 et le 7 octobre 2026 sans qu'aucune
   * course ne soit creee, parce que les deux vocabulaires ne correspondaient
   * pas. `vehicule.ts` fait la traduction, et la tient d'ici.
   */
  valeurBase: string
  capaciteMin: number
  capaciteMax: number
  /** Vrai quand aucun prix automatique n'est possible : il faut un devis. */
  surDevis: boolean
  argument: string
}

/**
 * L'ordre compte : c'est celui dans lequel le client voit les propositions,
 * du moins cher au plus cher.
 */
export const GAMME: Vehicule[] = [
  {
    cle: 'berline',
    nom: 'Berline',
    nomTarif: 'Berline',
    valeurBase: 'berline',
    capaciteMin: 1, capaciteMax: 3,
    surDevis: false,
    argument: 'Berline récente, intérieur soigné',
  },
  {
    cle: 'berline_premium',
    nom: 'Berline Premium',
    nomTarif: 'Berline Premium',
    valeurBase: 'berline_premium',
    capaciteMin: 1, capaciteMax: 4,
    surDevis: false,
    argument: 'Haut de gamme, eau offerte, chargeurs',
  },
  {
    cle: 'van',
    nom: 'Van 7 places',
    nomTarif: 'Van 7 places',
    valeurBase: 'van_7',
    capaciteMin: 5, capaciteMax: 7,
    surDevis: false,
    argument: 'Van récent, grand coffre, idéal aéroport',
  },
  {
    cle: 'grand_van',
    nom: 'Grand Van 8 places',
    /* Il n'a pas de ligne a lui dans `tarifs` : son prix DERIVE de celui du
       Van 7 places — + 20 EUR sur le forfait, + 0,10 EUR du kilometre
       (decision du 2026-11-03). On pointe donc la ligne du van, sans quoi la
       recherche de tarif echoue, le moteur de prix est saute en entier, et le
       code retombe sur une valeur en dur : c'est le 120 EUR forfaitaire,
       identique sur 52 km et sur 120 km, qu'on vient de corriger. */
    nomTarif: 'Van 7 places',
    valeurBase: 'grand_van_8',
    capaciteMin: 8, capaciteMax: 8,
    surDevis: true,
    argument: 'Séminaires et événements, selon disponibilité',
  },
]

/** Le plus grand nombre de passagers que le site sait traiter. */
export const PASSAGERS_MAX = Math.max(...GAMME.map(v => v.capaciteMax))

export function vehiculeParCle(cle: string): Vehicule | null {
  return GAMME.find(v => v.cle === cle) ?? null
}

/**
 * Les véhicules qui acceptent ce nombre de passagers, dans l'ordre d'affichage.
 *
 * Un voyageur seul en voit deux — Berline et Premium — et choisit. C'est le
 * point de la decision : le simulateur imposait la Berline, et la Premium
 * n'etait jamais proposee.
 */
export function vehiculesPour(passagers: number): Vehicule[] {
  return GAMME.filter(v => passagers >= v.capaciteMin && passagers <= v.capaciteMax)
}

/**
 * Le véhicule retenu par défaut : le premier compatible, donc le moins cher.
 *
 * Rend `null` au-dela de la gamme plutot que de retomber sur le dernier
 * vehicule — c'est ce repli silencieux qui faisait facturer 120 € un trajet
 * de 8 passagers quelle que soit sa longueur.
 */
export function vehiculeParDefaut(passagers: number): Vehicule | null {
  return vehiculesPour(passagers)[0] ?? null
}

/** Ce nombre de passagers exige-t-il un devis plutôt qu'un prix affiché ? */
export function exigeUnDevis(passagers: number): boolean {
  const possibles = vehiculesPour(passagers)
  return possibles.length > 0 && possibles.every(v => v.surDevis)
}

/** Le libellé de capacité montré au client : « 1 à 3 passagers ». */
export function capaciteTexte(v: Vehicule): string {
  return v.capaciteMin === v.capaciteMax
    ? `${v.capaciteMax} passagers`
    : `${v.capaciteMin} à ${v.capaciteMax} passagers`
}

/* ────────────────────────────────────────────────────────────────────────────
 * Les correspondances de noms, DERIVEES de la gamme ci-dessus.
 *
 * Elles etaient ecrites a la main dans trois autres fichiers — `calcPrix.ts`
 * (`VEHICULE_NOM`, `NOM_VERS_CLE`), `vehicule.ts` (`LIBELLES`) et
 * `VitrineBody.tsx` (`VEHICLES`) — et les quatre copies ne disaient pas la
 * meme chose. Le Grand Van s'appelait « Grand Van » ici et « Grand Van
 * 8 places » la : `NOM_VERS_CLE['Grand Van 8 places']` valait donc `undefined`
 * et le badge « des X EUR » du simulateur affichait le prix de la BERLINE a
 * 8 passagers (constate le 2026-11-03).
 *
 * Desormais on ne declare le nom qu'une fois, dans `GAMME`.
 * ──────────────────────────────────────────────────────────────────────────── */

/** `berline_premium` → « Berline Premium ». Le libelle montre au client. */
export const NOM_PAR_CLE: Record<string, string> =
  Object.fromEntries(GAMME.map(v => [v.cle, v.nom]))

/**
 * « Berline Premium » → `berline_premium`. L'inverse exact de `NOM_PAR_CLE`.
 *
 * Construite par retournement plutot qu'a la main : c'est la seule facon de
 * garantir qu'aucun libelle ne manque et qu'aucun ne pointe vers la mauvaise
 * cle.
 */
export const CLE_PAR_NOM: Record<string, string> =
  Object.fromEntries(GAMME.map(v => [v.nom, v.cle]))
/* Les orthographes historiques y sont ajoutees plus bas, apres la declaration
   d'ALIAS : une ligne de `devis` enregistree avant le 2026-11-03 porte
   « Grand Van », et doit rester reconnaissable. */

/** `grand_van` → `grand_van_8`, la valeur que l'enum de la base accepte. */
export const BASE_PAR_CLE: Record<string, string> =
  Object.fromEntries(GAMME.map(v => [v.cle, v.valeurBase]))

/** `grand_van_8` → « Grand Van 8 places ». Le libelle depuis la valeur en base. */
export const NOM_PAR_BASE: Record<string, string> =
  Object.fromEntries(GAMME.map(v => [v.valeurBase, v.nom]))

/**
 * Les orthographes historiques, telles qu'elles dorment encore en base.
 *
 * Deriver les libelles de `GAMME` change ce que le site ECRIT desormais ; les
 * lignes deja enregistrees gardent leur ancienne ecriture. La table `devis`
 * contient par exemple « Grand Van », jamais « Grand Van 8 places ». Toute
 * relecture d'un libelle doit donc accepter les deux.
 */
const ALIAS: Record<string, CleVehicule> = {
  'Van':              'van',
  'Van 7':            'van',
  'Van 7 pl.':        'van',
  'Van / Minibus':    'van',
  'Premium':          'berline_premium',
  'Grand Van':        'grand_van',
  'Grand Van 8 pl.':  'grand_van',
}

/**
 * Retrouve la cle d'un vehicule depuis n'importe quel libelle connu.
 *
 * Rend `null` sur un libelle inconnu — JAMAIS la berline. Le code qui
 * convertissait un devis en course ecrivait
 * `VH_MAP[devis.vehicle] ?? 'berline'` : un devis pour huit personnes devenait
 * une course en berline, sans un mot. Mieux vaut refuser la conversion que
 * d'envoyer la mauvaise voiture.
 */
export function cleDepuisLibelle(libelle: string | null | undefined): CleVehicule | null {
  const t = String(libelle ?? '').trim()
  if (!t) return null
  const exact = GAMME.find(v => v.nom === t)
  if (exact) return exact.cle
  if (ALIAS[t]) return ALIAS[t]
  /* Dernier recours : la cle elle-meme, ou la valeur de l'enum de la base. */
  const parCle = GAMME.find(v => v.cle === t || v.valeurBase === t)
  return parCle?.cle ?? null
}

/** Tous les libelles acceptes pour un vehicule — le courant d'abord. */
export function libellesConnus(cle: CleVehicule): string[] {
  const nom = GAMME.find(v => v.cle === cle)?.nom
  const alias = Object.entries(ALIAS).filter(([, c]) => c === cle).map(([a]) => a)
  return [nom, ...alias].filter((x): x is string => Boolean(x))
}

for (const [ancien, cle] of Object.entries(ALIAS)) {
  if (!(ancien in CLE_PAR_NOM)) CLE_PAR_NOM[ancien] = cle
}
