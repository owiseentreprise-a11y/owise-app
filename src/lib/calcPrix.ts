import { heureMuraleParis } from './heure'
import { NOM_PAR_CLE, CLE_PAR_NOM, vehiculeParCle } from './gamme'
export type ZoneCalc   = { id: string; code: string; type: string; prefixes_postaux: string[] }
export type GrilleCalc = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }

/**
 * Les colonnes de `grilles_tarifaires` que toute page doit lire.
 *
 * Pourquoi une liste, et pourquoi ici. Mesuré le 2026-11-07 : neuf endroits
 * lisent cette table, et CINQ d'entre eux nommaient trois colonnes à la main
 * — dont la page d'accueil, les 38 pages villes, les deux pages anglaises et
 * `reserver/actions.ts`. Les quatre autres lisent `*`.
 *
 * Tant que la table n'a qu'une colonne de prix, les deux formes donnent le
 * même résultat et la divergence est invisible. Le jour où une colonne de
 * prix s'ajoute, les cinq `select` nommés ne la voient pas : /reserver
 * afficherait le prix fixé et l'accueil le prix calculé, pour le même
 * trajet, sans qu'aucune erreur ne se produise nulle part.
 *
 * C'est exactement le défaut que `supplement_etape` a laissé courir des mois
 * — « une colonne oubliée fait silencieusement retomber le code sur sa
 * valeur de repli ». On ne le reproduit pas : une seule liste, et le
 * contrôle `scripts/test-colonnes-grille.mts` refuse tout `select` qui ne
 * l'emploie pas.
 */
export const COLONNES_GRILLE = 'zone_depart_id,zone_arrivee_id,prix_berline'
export type TarifCalc  = {
  vehicule: string
  prise_en_charge: number
  prix_km: number
  cdg_fixe: number
  orly_fixe: number
  beauvais_fixe: number
}
export type ParamsCalc = {
  /* Pas de `coef_berline` ici, et c'est voulu. Voir la note sous les replis. */
  coef_berline_premium?: number | null
  coef_van?: number | null
  /** Colonne optionnelle ; a defaut, SUPPLEMENT_GRAND_VAN. */
  supplement_grand_van?: number | null
  /** Colonne optionnelle ; a defaut, SURCOUT_KM_GRAND_VAN. */
  surcout_km_grand_van?: number | null
  supplement_nuit?: number | null
  supplement_weekend?: number | null
  supplement_etape?: number | null
  tarif_pec_actif?: boolean | null
  tarif_frais_pec?: number | null
  // Options du formulaire de devis (bagages/panneau/animaux/siège enfant) —
  // non utilisées par les fonctions de calcul de ce fichier, juste
  // transportées jusqu'à VitrineBody pour piloter l'affichage des cases à cocher.
  supplement_bagages_actif?: boolean | null
  supplement_bagages_prix?: number | null
  supplement_panneau_actif?: boolean | null
  supplement_panneau_prix?: number | null
  supplement_animaux_actif?: boolean | null
  supplement_animaux_prix?: number | null
  supplement_siege_enfant_actif?: boolean | null
  supplement_siege_enfant_prix?: number | null
}

/**
 * Valeurs de repli, si la lecture de `parametres` echoue entierement.
 *
 * Elles doivent rester EGALES aux valeurs reellement en base. Elles valaient
 * 1,25 et 1,5 face a 1,5 et 1,7 en base : une page qui n'aurait pas charge ses
 * parametres aurait facture une Premium 17 % trop bas sans que rien ne le
 * signale. `scripts/audit-sources-tarifs.mts` echoue si elles divergent a
 * nouveau.
 */
export const DEFAULT_COEF_PREMIUM = 1.5
export const DEFAULT_COEF_VAN     = 1.7

/**
 * Pourquoi la berline n'a PAS de coefficient — et pourquoi il ne faut pas en
 * ajouter un.
 *
 * La colonne de la grille s'appelle `prix_berline` : le montant qui y est
 * saisi EST le prix de la berline. Le multiplier par un coefficient serait le
 * compter deux fois. Les coefficients Premium et Van existent precisement
 * parce que ces deux vehicules n'ont pas de colonne a eux.
 *
 * La table `parametres` porte pourtant une colonne `coef_berline`, et
 * /admin/tarifs en affichait le champ. Personne ne la lisait. Le 2026-11-03,
 * en branchant les reglages oublies, elle a failli le devenir : elle vaut
 * 1.5 en production — quelqu'un l'a saisie un jour sans effet. La lire aurait
 * augmente de 50 % le prix de TOUTES les berlines (Chantilly -> CDG :
 * 59 EUR devenus 88,50 EUR), sans qu'aucune decision ne soit prise.
 *
 * Le champ a donc ete retire d'/admin/tarifs plutot que branche. Un reglage
 * sans effet est un defaut ; le corriger en le rendant actif sur une valeur
 * que personne n'a choisie en serait un pire.
 */

/**
 * Le Grand Van 8 places : le prix du Van 7 places, plus un supplement fixe.
 *
 * Decision de l'exploitant, 2026-11-03 : « le 8 places est plus cher que le
 * 7 places ; au moins 20 EUR de plus sur le forfait, au moins 10 centimes de
 * plus du kilometre ».
 *
 * Pourquoi un supplement et pas un coefficient : le moteur ne sait faire que
 * des multiplications, et « +20 EUR » ne s'exprime pas ainsi. Il faudrait
 * 2,039 sur Chantilly -> CDG et 1,874 sur Compiegne -> CDG.
 *
 * Pourquoi en dur ici : ces deux valeurs devraient vivre dans `parametres`,
 * reglables depuis /admin/tarifs comme les coefficients. La colonne reste a
 * creer — le code lit deja `params.supplement_grand_van` s'il la trouve.
 */
const SUPPLEMENT_GRAND_VAN   = 20
const SURCOUT_KM_GRAND_VAN   = 0.10

export const AIRPORT_COL: Record<string, keyof TarifCalc> = {
  CDG: 'cdg_fixe',
  ORY: 'orly_fixe',
  BVA: 'beauvais_fixe',
}

/**
 * `berline_premium` → « Berline Premium ». Vient de `gamme.ts`, qui est la
 * seule declaration de la gamme.
 */
export const VEHICULE_NOM: Record<string, string> = NOM_PAR_CLE

/**
 * « Berline Premium » → `berline_premium`. L'inverse exact de `VEHICULE_NOM`.
 *
 * Elle etait ecrite a la main et incomplete : elle connaissait « Grand Van »
 * quand le reste du projet disait « Grand Van 8 places ». Le badge
 * « des X EUR » du simulateur cherchait donc une cle introuvable et retombait
 * sur la berline — a 8 passagers, le client lisait un prix de berline.
 */
export const NOM_VERS_CLE: Record<string, string> = CLE_PAR_NOM

/**
 * Le nom de la ligne de `tarifs` qui chiffre ce vehicule.
 *
 * Le grand van n'a pas de ligne a lui : il derive de celle du van 7 places.
 * C'est `gamme.ts` qui le dit, et plus une condition eparpillee dans ce
 * fichier.
 */
function nomTarifPour(vehiculeKey: string): string {
  return vehiculeParCle(vehiculeKey)?.nomTarif ?? VEHICULE_NOM[vehiculeKey] ?? vehiculeKey
}

/**
 * Vocabulaire des destinations belges desservies.
 *
 * Sert à deux choses qui doivent rester d'accord : la détection de zone
 * ci-dessous, et le géocodage (`/api/geocode`), qui doit chercher en Belgique
 * plutôt qu'en France pour ces adresses. La France compte des homonymes —
 * « Bruxelles » est un hameau de Dammarie-sur-Loing (45230), « Tournai » une
 * commune de l'Orne, « Mouscron » un lieu-dit de Willems — et Google renvoyait
 * ces lieux-là, à 400-500 km de la vraie destination (constaté le 2026-09-19).
 */
export const TERMES_CHARLEROI = ['charleroi', 'gosselies'] as const
export const TERMES_BELGIQUE  = [
  'belgique', 'belgium', 'bruxelles', 'brussels', 'zaventem',
  'mouscron', 'kortrijk', 'courtrai', 'tournai',
] as const

/** Vrai si le libellé désigne une destination belge desservie. */
export function estAdresseBelge(label: string): boolean {
  const l = (label ?? '').toLowerCase()
  return TERMES_CHARLEROI.some(t => l.includes(t)) || TERMES_BELGIQUE.some(t => l.includes(t))
}

/**
 * Détecte la zone tarifaire d'une adresse.
 * Libellé en priorité (aéroports, gares, Paris), code postal en fallback
 * (préfixe le plus long gagne — ex: "60550" > "60").
 */
export function detectZone<T extends ZoneCalc>(codePostal: string, zones: T[], addressLabel?: string): T | null {
  if (addressLabel) {
    // Les traits d'union sont neutralisés avant toute comparaison : Google
    // réécrit les libellés qu'on lui envoie, et « Aéroport Paris-Charles de
    // Gaulle (CDG) » revient en « Aéroport Charles-de-Gaulle, Rue du Luxembourg,
    // 93290 Tremblay-en-France ». Le mot « CDG » a disparu, « Charles de Gaulle »
    // a pris des traits d'union, et 93290 n'appartient à aucune zone : le
    // forfait aéroport ne s'appliquait plus sur les liens pré-remplis.
    const lower = addressLabel.toLowerCase().replace(/[-‐‑–—]/g, ' ')
    const marqueurAeroport = /a[ée]roport|terminal/.test(lower)

    // « Charles de Gaulle » est l'un des noms de rue les plus répandus de
    // France : sans marqueur d'aéroport, une adresse de Creil ou de Neuilly
    // était facturée comme un transfert CDG. « Roissy en Brie » (77) est une
    // commune de Seine-et-Marne, à 40 km de l'aéroport.
    const estRoissyAeroport = lower.includes('roissy') && !lower.includes('roissy en brie')
    if (/\bcdg\b/.test(lower)
        || estRoissyAeroport
        || (lower.includes('charles de gaulle') && marqueurAeroport)) {
      const z = zones.find(z => z.code === 'CDG'); if (z) return z
    }
    if (lower.includes('orly')) {
      const z = zones.find(z => z.code === 'ORY'); if (z) return z
    }
    // Aéroport de Beauvais-Tillé : on exige « Tillé » comme mot entier, ou
    // « Beauvais » accompagné d'un marqueur d'aéroport — sinon une adresse dans
    // la ville de Beauvais (zone BEA) est absorbée par la zone aéroport.
    // Le mot entier est indispensable : « bastille » contient « tille », si bien
    // que « Place de la Bastille, 75011 Paris » était facturée comme un départ
    // de l'aéroport de Beauvais.
    // À noter : la ville et l'aéroport partagent le code postal 60000 (l'aéroport
    // est sur la commune de Tillé). Seul le libellé peut donc les distinguer —
    // la zone BVA n'a d'ailleurs aucun préfixe postal en base.
    if (/\btill[ée]\b/.test(lower)
        || (lower.includes('beauvais') && marqueurAeroport)) {
      const z = zones.find(z => z.code === 'BVA'); if (z) return z
    }
    // Charleroi : aéroport belge distinct de Bruxelles, sensiblement plus proche
    // de l'Oise (~45 km de moins) — mérite son propre tarif, pas celui de "BEL".
    if (TERMES_CHARLEROI.some(t => lower.includes(t))) {
      const z = zones.find(z => z.code === 'CHR'); if (z) return z
    }
    // Belgique (reste) : pas de code postal français exploitable, donc détection
    // uniquement par libellé (nom de pays ou grandes villes du trajet longue distance).
    if (TERMES_BELGIQUE.some(t => lower.includes(t))) {
      const z = zones.find(z => z.code === 'BEL'); if (z) return z
    }
    // "gare" dans l'adresse → zone gare uniquement si Paris intramuros (CP 75xxx)
    if ((lower.includes('gare ') || lower.startsWith('gare') || lower.includes(' gare')) && /^75/.test(codePostal)) {
      const z = zones.find(z => z.type === 'gare'); if (z) return z
    }
    // "paris" dans le libellé → Z1 uniquement si le code postal connu confirme
    // Paris intramuros (75xxx) — évite de faire matcher "Disneyland Paris"
    // (77700) ou "Aéroport Paris-Le Bourget" (93350) sur la zone Paris.
    if (/\bparis\b/.test(lower) && (!codePostal || /^75/.test(codePostal))) {
      const z = zones.find(z => z.code === 'Z1'); if (z) return z
    }
  }
  if (!codePostal) return null
  const sorted = [...zones].sort((a, b) => {
    const maxA = Math.max(0, ...(a.prefixes_postaux as string[]).map(p => p.trim().length))
    const maxB = Math.max(0, ...(b.prefixes_postaux as string[]).map(p => p.trim().length))
    return maxB - maxA
  })
  return sorted.find(z =>
    (z.prefixes_postaux as string[]).some(p => p.trim() && codePostal.startsWith(p.trim()))
  ) ?? null
}

/** Forfait si l'une des zones est un aéroport, une gare, ou Paris intramuros (Z1) */
export function isForfaitZone(zone: ZoneCalc): boolean {
  return zone.type === 'aeroport' || zone.type === 'gare' || zone.code === 'Z1'
}

/**
 * Majorations nuit (22h-6h) et weekend, appliquées multiplicativement sur le prix de base.
 *
 * L'heure et le jour se lisent **à Paris**, jamais sur l'horloge de la machine.
 * `new Date(x).getHours()` donnait deux résultats : juste quand `x` était la
 * saisie brute d'un formulaire (les deux erreurs s'annulent), faux quand `x`
 * venait de la base — sur le serveur Vercel, en temps universel, une course du
 * mardi 23:30 perdait sa majoration de nuit, une course de 07:30 en gagnait une
 * qu'elle ne devait pas, et un lundi 00:30 était facturé comme un dimanche.
 * `heureMuraleParis` rend les deux formes correctes sur toutes les machines.
 * (Mesuré le 2026-09-27, en remontant l'écart d'heure de la course #F9557D.)
 */
export function appliquerSupplements(prix: number, dateHeure: string, params?: ParamsCalc | null): number {
  if (!dateHeure) return prix
  const d = heureMuraleParis(dateHeure)
  if (isNaN(d.getTime())) return prix
  const h = d.getHours()
  const j = d.getDay()
  let p = prix
  if (h >= 22 || h < 6)   p *= 1 + (params?.supplement_nuit    ?? 0) / 100
  if (j === 0 || j === 6) p *= 1 + (params?.supplement_weekend ?? 0) / 100
  return p
}

/**
 * Calcule le prix forfait pour un trajet entre deux zones.
 * Priorité 1 : matrice zone-à-zone (grilles_tarifaires) — la plus spécifique.
 * Priorité 2 : tarif fixe aéroport (tarifs.cdg_fixe/orly_fixe/beauvais_fixe),
 * utilisé seulement si aucune entrée de grille n'existe pour cette paire.
 */
export function calculerPrix(
  zoneDepId: string,
  zoneArrId: string,
  vehiculeKey: string,
  dateHeure: string,
  grille: GrilleCalc[],
  tarifs: TarifCalc[],
  zones: ZoneCalc[],
  params?: ParamsCalc | null,
): number | null {
  // Priorité 1 : matrice zone-à-zone (dans les deux sens)
  const cell = grille.find(g =>
    (g.zone_depart_id === zoneDepId  && g.zone_arrivee_id === zoneArrId) ||
    (g.zone_depart_id === zoneArrId  && g.zone_arrivee_id === zoneDepId)
  )
  if (cell?.prix_berline) {
    /* 1 pour la berline, par definition : `prix_berline` est deja son prix.
       Voir la note sur `coef_berline` en tete de fichier. */
    let coef = 1
    let supplement = 0
    if (vehiculeKey === 'berline_premium') coef = params?.coef_berline_premium ?? DEFAULT_COEF_PREMIUM
    if (vehiculeKey === 'van')             coef = params?.coef_van ?? DEFAULT_COEF_VAN
    /* Le grand van partait sans coefficient : il retombait a 1, donc au prix
       d'une berline — 101 liaisons sur 127 ou il coutait moins cher que le
       van 7 places. Mesure du 2026-11-03. */
    if (vehiculeKey === 'grand_van') {
      coef = params?.coef_van ?? DEFAULT_COEF_VAN
      supplement = Number(params?.supplement_grand_van ?? SUPPLEMENT_GRAND_VAN)
    }
    let prix = Number(cell.prix_berline) * coef + supplement
    if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
    return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
  }

  // Plus de forfait aéroport « global » en repli : un prix unique appliqué dès
  // qu'une zone aéroport était impliquée, quelle que soit la distance. Il
  // facturait Orly → Charleroi 59 € pour 300 km, et CDG → Charleroi 69 € pour
  // 262 km. Sans ligne de grille, on passe désormais au kilomètre, ce que les
  // trois points d'entrée savent faire.
  return null
}

/**
 * Base sur laquelle un « dès … € » est annoncé au public.
 *
 * Deux réponses légitimes, et ce n'est pas une question technique :
 *
 *   `minimum-technique`      le forfait le moins cher de toute la grille.
 *                            Exact au sens littéral de « dès », mais c'est
 *                            Paris intramuros → Paris intramuros, atypique
 *                            pour une entreprise basée à Saint-Maximin.
 *   `aeroport-le-moins-cher` le forfait aéroport le moins cher. C'est le
 *                            cœur de métier, et ce montant est DÉJÀ publié
 *                            ailleurs sur le site (tableau des forfaits de
 *                            /reserver, pages villes).
 *
 * Le choix appartient à l'exploitant. Voir `audit-owise/13-CONTRE-AUDIT-PRIORITES.md`.
 */
export type BaseAffichage = 'minimum-technique' | 'aeroport-le-moins-cher'

/**
 * Base retenue pour les cartes véhicules de la vitrine.
 *
 * **Décision commerciale en attente de validation.** `aeroport-le-moins-cher`
 * est posé par défaut pour une raison précise : ce montant (59 € en berline)
 * est DÉJÀ publié ailleurs sur le site — tableau « Nos forfaits les plus
 * demandés » de /reserver, pages villes, llms.txt. Le retenir n'introduit donc
 * aucun tarif nouveau ; il aligne la page d'accueil sur le reste.
 *
 * L'autre option, `minimum-technique`, afficherait 29 € : exact, mais c'est un
 * trajet Paris → Paris, et un visiteur de Chantilly y lirait une promesse que
 * son trajet ne tiendra pas.
 *
 * Changer cette seule ligne change les quatre cartes.
 */
export const BASE_AFFICHAGE_VITRINE: BaseAffichage = 'aeroport-le-moins-cher'

/**
 * Le prix d'appel d'un véhicule, dérivé de la grille réelle.
 *
 * Ne définit aucune règle de calcul : il appelle `calculerPrix()` sur les
 * paires éligibles et garde la plus basse. Un prix affiché ne peut donc pas
 * diverger de celui que le client paiera, puisqu'ils sortent de la même
 * fonction.
 *
 * La date-heure passée est vide volontairement : `appliquerSupplements` rend
 * alors le prix inchangé. C'est bien un tarif de base qu'on annonce, pas
 * celui d'un créneau de nuit ou de week-end.
 *
 * Rend `null` plutôt qu'un montant de repli si aucune paire n'est éligible :
 * mieux vaut une carte sans prix qu'une carte avec un prix faux.
 */
export function prixAPartirDe(
  vehiculeKey: string,
  base: BaseAffichage,
  grille: GrilleCalc[],
  tarifs: TarifCalc[],
  zones: ZoneCalc[],
  params?: ParamsCalc | null,
): number | null {
  const estAeroport = (id: string) => zones.find(z => z.id === id)?.type === 'aeroport'

  let min: number | null = null
  for (const ligne of grille) {
    if (base === 'aeroport-le-moins-cher'
      && !estAeroport(ligne.zone_depart_id) && !estAeroport(ligne.zone_arrivee_id)) continue

    const prix = calculerPrix(ligne.zone_depart_id, ligne.zone_arrivee_id, vehiculeKey, '', grille, tarifs, zones, params)
    if (prix === null || prix <= 0) continue
    if (min === null || prix < min) min = prix
  }
  /* Arrondi à l'euro, convention d'affichage de tout le site. */
  return min === null ? null : Math.round(min)
}

/**
 * Le prix à AFFICHER pour une liaison entre deux zones, pour un véhicule.
 *
 * Ne définit aucune règle de calcul : comme `prixAPartirDe` juste au-dessus,
 * elle appelle `calculerPrix()`. C'est tout son objet — l'affichage et la
 * facturation sortent de la même fonction, donc ils ne peuvent plus diverger.
 *
 * Deux conventions, reprises telles quelles de `prixAPartirDe` :
 *
 *   — **date-heure vide** : `appliquerSupplements` rend alors le prix inchangé.
 *     C'est un tarif de base qu'on annonce, pas celui d'un créneau de nuit ou
 *     de week-end.
 *   — **arrondi à l'euro par `Math.round`**, qui est exactement l'arrondi du
 *     paiement : `reserver/actions.ts` fait `Math.round(prixServeur)` avant de
 *     remplir `unit_amount` pour Stripe. Le montant affiché est donc au centime
 *     celui qui sera débité — par exemple 103,50 € de forfait premium s'affiche
 *     et se facture 104 €.
 *
 * Rend `null` quand la paire n'a aucun forfait. L'appelant doit alors écrire
 * « prix calculé selon le trajet », jamais inventer un montant.
 *
 * ── Pourquoi cette fonction existe ─────────────────────────────────────────
 *
 * Le tableau comparatif et les cartes aéroport de la vitrine lisaient
 * `tarifs.cdg_fixe / orly_fixe / beauvais_fixe`. Ces trois colonnes étaient
 * l'ancien repli du moteur, retiré le 2026-09-19 parce qu'il facturait
 * Orly → Charleroi 59 € pour 300 km. Plus rien ne les mettait à jour, et
 * **sept des neuf cellules affichaient MOINS que le prix facturé** — jusqu'à
 * 42 € d'écart sur un van Paris → Beauvais-Tillé, sous un titre « Prix fixe
 * garanti, zéro surprise à l'arrivée ».
 *
 * Les six valeurs premium et van valaient le forfait berline multiplié par les
 * ANCIENS coefficients (1,25 et 1,5) au lieu de ceux réglés en base. Changer un
 * coefficient dans /admin/tarifs élargissait donc l'écart sans aucune alerte,
 * puisque ces colonnes n'y sont même pas modifiables.
 */
export function prixAffiche(
  codeDepart: string,
  codeArrivee: string,
  vehiculeKey: string,
  grille: GrilleCalc[],
  tarifs: TarifCalc[],
  zones: ZoneCalc[],
  params?: ParamsCalc | null,
): number | null {
  const depart  = zones.find(z => z.code === codeDepart)
  const arrivee = zones.find(z => z.code === codeArrivee)
  if (!depart || !arrivee) return null

  const prix = calculerPrix(depart.id, arrivee.id, vehiculeKey, '', grille, tarifs, zones, params)
  if (prix === null || prix <= 0) return null
  return Math.round(prix)
}

/**
 * Frais par étape appliqués si /admin/tarifs n'a jamais été configuré, ou si
 * la page qui calcule le prix a oublié de charger `supplement_etape`.
 * Valeur de repli volontairement égale au tarif en vigueur : une page mal
 * câblée facture le bon prix au lieu d'offrir l'étape au client.
 */
export const SUPPLEMENT_ETAPE_DEFAUT = 15

/**
 * Prix d'une course qui comporte une ou plusieurs étapes intermédiaires.
 *
 * Règle unique, la même pour tous les clients et tous les parcours :
 *
 *     prix du trajet direct
 *   + kilomètres réellement ajoutés par le détour
 *   + frais fixes, une fois par étape
 *
 * Le détour est ce que les étapes rallongent vraiment le trajet : la somme
 * des tronçons parcourus moins le trajet direct, arrondie au kilomètre
 * supérieur. Une étape qui se trouve déjà sur la route ne rallonge rien et
 * ne coûte donc que les frais fixes ; un détour ne réduit jamais le prix.
 *
 * `prixDirect` est le prix normal de A→B, qu'il vienne d'un forfait de zone
 * ou du calcul au kilomètre : la règle s'applique identiquement aux deux.
 * Les majorations nuit/weekend portent sur les kilomètres du détour, qui
 * sont du transport, mais pas sur les frais fixes.
 */
export function calculerPrixEtapes(
  prixDirect: number,
  distanceDirecteKm: number,
  distancesTronconsKm: number[],
  vehiculeKey: string,
  dateHeure: string,
  tarifs: TarifCalc[],
  params?: ParamsCalc | null,
): number {
  const nbEtapes = Math.max(0, distancesTronconsKm.length - 1)
  if (nbEtapes === 0) return Math.round(prixDirect * 100) / 100

  /* `nomTarifPour` et non `VEHICULE_NOM` : le grand van n'a pas de ligne dans
     `tarifs`, la recherche echouait, et le detour d'un grand van etait chiffre
     a 2 EUR/km — une valeur inventee, inferieure a celle du van 7 places
     (constate le 2026-11-03). */
  const tarif  = tarifs.find(t => t.vehicule === nomTarifPour(vehiculeKey))
  const prixKm = tarif
    ? Number(tarif.prix_km) + (vehiculeKey === 'grand_van'
        ? Number(params?.surcout_km_grand_van ?? SURCOUT_KM_GRAND_VAN) : 0)
    : 2
  const frais  = params?.supplement_etape ?? SUPPLEMENT_ETAPE_DEFAUT

  const totalTroncons = distancesTronconsKm.reduce((t, d) => t + d, 0)
  const detourKm = Math.ceil(Math.max(0, totalTroncons - distanceDirecteKm))

  const prixDetour = appliquerSupplements(detourKm * prixKm, dateHeure, params)
  return Math.round((prixDirect + prixDetour + nbEtapes * frais) * 100) / 100
}

/** Calcule le prix au kilomètre — utilisé quand aucun forfait n'est disponible */
export function calculerPrixKm(
  distanceKm: number,
  vehiculeKey: string,
  dateHeure: string,
  tarifs: TarifCalc[],
  params?: ParamsCalc | null,
): number | null {
  /* Le grand van n'a pas de ligne dans `tarifs`. Sans ce traitement, la
     recherche echouait et le calcul retombait sur 15 EUR + 2 EUR/km, deux
     valeurs inventees — moins cher que le van 7 places sur 50 km. */
  const estGrandVan = vehiculeKey === 'grand_van'
  const tarif = tarifs.find(t => t.vehicule === nomTarifPour(vehiculeKey))
  const base  = tarif ? Number(tarif.prise_en_charge) : 15
  const surcout = estGrandVan
    ? Number(params?.surcout_km_grand_van ?? SURCOUT_KM_GRAND_VAN)
    : 0
  const km    = (tarif ? Number(tarif.prix_km) : 2) + surcout
  // Arrondir la distance à l'entier le plus proche pour absorber les
  // écarts de géocodage entre sources (BAN, LIEUX_CONNUS, Google Maps)
  const dist  = Math.round(distanceKm)
  let prix = base + dist * km
  if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
  return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
}

/* ────────────────────────────────────────────────────────────────────────────
 * Le partage d'un aller-retour entre ses deux trajets.
 *
 * Un aller-retour est encaisse en UNE fois par Stripe. Les deux courses
 * enregistrees doivent donc se partager ce montant exactement : ni plus, ni
 * moins. C'est l'invariant que ces deux fonctions garantissent —
 *
 *     partAller(total) + partRetour(total) === Math.round(total)
 *
 * — et qui n'etait garanti par personne avant le 2026-11-04. Le formulaire
 * donnait la moitie au retour, le webhook Stripe donnait le TOTAL a l'aller,
 * et les deux ne se parlaient pas.
 *
 * Constate sur la course de M. Soter Ranguin, reservee le 2026-11-02 — le
 * premier aller-retour jamais paye en ligne : 283 EUR encaisses par Stripe,
 * 283 EUR sur l'aller et 142 EUR sur le retour, soit 425 EUR enregistres.
 * 142 EUR de chiffre d'affaires qui n'ont jamais ete encaisses. Les six autres
 * allers-retours du projet, tous saisis a la main, etaient justes : le defaut
 * ne touchait que la reservation en ligne, et il a suffi du premier client.
 *
 * Le partage est volontairement asymetrique d'un euro quand le total est
 * impair — 283 donne 141 et 142 — parce que la somme prime sur la symetrie :
 * mieux vaut deux montants dont l'un differe d'un euro qu'un total faux.
 *
 * `surcoutEtapes` est retire avant le partage : un arret demande sur l'aller
 * ne se facture pas a moitie sur le retour.
 * ──────────────────────────────────────────────────────────────────────────── */

/** La part du retour dans un aller-retour encaisse en une fois. */
export function partRetour(total: number, surcoutEtapes = 0): number {
  return Math.round((total - surcoutEtapes) / 2)
}

/** La part de l'aller : le reste, pour que la somme tombe juste. */
export function partAller(total: number, surcoutEtapes = 0): number {
  return Math.round(total) - partRetour(total, surcoutEtapes)
}
