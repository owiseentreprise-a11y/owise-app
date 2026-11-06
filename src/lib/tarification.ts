/**
 * La seule porte par laquelle on lit les tarifs.
 *
 * Pourquoi ce fichier existe
 * ──────────────────────────
 * Demande de l'exploitant, 2026-11-03 : « quand on modifie le prix, le
 * kilometre, le forfait ou la zone, il faut que ce soit effectif partout.
 * Sinon on s'y retrouve plus. »
 *
 * Avant ce fichier, neuf pages lisaient la table `parametres` en citant leurs
 * colonnes une par une, et les neuf listes etaient differentes :
 *
 *   accueil                        15 colonnes
 *   /reserver (page)                7 colonnes
 *   /reserver (3 actions)       7, 3 et 6 colonnes
 *   pages villes                   15 colonnes
 *   deux pages anglaises           15 colonnes
 *   /admin/courses/nouvelle         7 colonnes
 *   /admin/courses/[id]             3 colonnes
 *
 * Une colonne absente de la liste n'arrive pas `null` : elle arrive
 * `undefined`, et le moteur de prix retombe sur sa valeur de repli **sans rien
 * dire**. C'est ainsi que `supplement_etape` a valu 20 EUR en base pendant des
 * mois tandis que le site facturait 10 EUR, et que le champ d'/admin/tarifs
 * n'avait aucun effet.
 *
 * La regle tient en une ligne : **on prend toute la ligne**. `select('*')` sur
 * une table d'une seule ligne et d'une quarantaine de colonnes ne coute rien,
 * et aucun reglage ajoute plus tard ne pourra etre oublie ici.
 *
 * `scripts/audit-sources-tarifs.mts` echoue si une page recommence a citer ses
 * colonnes a la main.
 */
import type { ZoneCalc, GrilleCalc, TarifCalc, ParamsCalc } from './calcPrix'

/** Tout ce dont le moteur de prix a besoin pour chiffrer un trajet. */
export type Tarification = {
  zones: ZoneCalc[]
  grille: GrilleCalc[]
  tarifs: TarifCalc[]
  params: ParamsCalc | null
}

/**
 * Le client Supabase, vu d'ici : seul `from(...).select(...)` nous interesse.
 *
 * Volontairement structurel plutot qu'importe de `@supabase/supabase-js` : ce
 * module est appele depuis des pages serveur comme depuis des actions, avec le
 * client admin ou le client de session, et n'a pas a connaitre la difference.
 */
type ClientLecture = {
  from: (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    select: (colonnes: string) => any
  }
}

/**
 * Les cles de `ParamsCalc`, A L'EXECUTION.
 *
 * Un type TypeScript n'existe pas a l'execution : `ParamsCalc` decrit bien
 * les seules colonnes tarifaires, mais `select('*')` rend la LIGNE ENTIERE,
 * et rien n'empechait cette ligne de traverser jusqu'au navigateur.
 *
 * Cette liste doit rester en phase avec `ParamsCalc`. Le controle
 * `scripts/test-parametres-prives.mts` echoue si une colonne tarifaire de la
 * base manque ici, ET si une colonne privee s'y glisse.
 */
export const CLES_PARAMS_CALC = [
  'coef_berline_premium', 'coef_van',
  'supplement_grand_van', 'surcout_km_grand_van',
  'supplement_nuit', 'supplement_weekend', 'supplement_etape',
  'tarif_pec_actif', 'tarif_frais_pec',
  'supplement_bagages_actif', 'supplement_bagages_prix',
  'supplement_panneau_actif', 'supplement_panneau_prix',
  'supplement_animaux_actif', 'supplement_animaux_prix',
  'supplement_siege_enfant_actif', 'supplement_siege_enfant_prix',
] as const

/**
 * Ce qu'on accepte d'envoyer AU NAVIGATEUR : les tarifs, et rien d'autre.
 *
 * POURQUOI CETTE FONCTION EXISTE — incident du 2026-11-03, trouve le
 * 2026-11-06.
 *
 * La table `parametres` ne contient pas que des tarifs : elle porte aussi
 * l'identite de l'entreprise et ses coordonnees bancaires. Le 3 novembre,
 * `chargerParametres` est passee d'une liste de sept colonnes nommees a
 * `select('*')` — pour la bonne raison qu'une colonne oubliee faisait
 * silencieusement retomber un prix sur sa valeur de repli.
 *
 * Mais ces parametres sont passes en `props` a des composants CLIENT
 * (`ReserverClient`, `VitrineBody`). Or tout prop d'un composant client est
 * serialise dans le HTML pour l'hydratation. Resultat, publie sur 41 pages
 * pendant trois jours : l'adresse du domicile de l'exploitant, son IBAN, son
 * BIC et le nom de sa banque.
 *
 * Les deux proprietes sont donc separees :
 *   · le SERVEUR lit tout (`chargerParametres`), et aucun tarif ne manque ;
 *   · le NAVIGATEUR ne recoit que `CLES_PARAMS_CALC`.
 *
 * Toute page qui passe des parametres a un composant client passe par ici.
 */
export function paramsPourNavigateur(params: ParamsCalc | null): ParamsCalc | null {
  if (!params) return null
  const sortie: Record<string, unknown> = {}
  for (const cle of CLES_PARAMS_CALC) {
    if (cle in (params as Record<string, unknown>)) {
      sortie[cle] = (params as Record<string, unknown>)[cle]
    }
  }
  return sortie as ParamsCalc
}

/**
 * Les parametres tarifaires, en entier — POUR LE SERVEUR.
 *
 * Ne jamais remplacer `'*'` par une liste de colonnes : c'est precisement la
 * faute que ce fichier existe pour empecher.
 *
 * En revanche, ne JAMAIS passer ce resultat tel quel a un composant client :
 * il porte l'identite de l'entreprise et son IBAN. Utiliser
 * `paramsPourNavigateur()`.
 */
export async function chargerParametres(client: ClientLecture): Promise<ParamsCalc | null> {
  const { data } = await client.from('parametres').select('*').eq('id', true).single()
  return (data as ParamsCalc | null) ?? null
}

/**
 * Les zones desservies, telles que `detectZone` les attend.
 *
 * `active = true` est le drapeau qu'ecrit le bouton d'/admin/tarifs — la
 * colonne `actif`, qui existe aussi dans la table, n'est ecrite ni lue par
 * personne (verifie le 2026-11-03). Filtrer sur la mauvaise des deux ferait
 * reapparaitre une zone desactivee.
 *
 * `code <> 'HORS'` : cette zone-ci n'est pas un forfait mais le fourre-tout du
 * hors-secteur, qui se facture au kilometre.
 */
export async function chargerZones(client: ClientLecture): Promise<ZoneCalc[]> {
  const { data } = await client.from('zones').select('*')
    .neq('code', 'HORS').eq('active', true).order('ordre')
  return (data as ZoneCalc[] | null) ?? []
}

/** La grille des forfaits zone a zone. */
export async function chargerGrille(client: ClientLecture): Promise<GrilleCalc[]> {
  const { data } = await client.from('grilles_tarifaires').select('*')
  return (data as GrilleCalc[] | null) ?? []
}

/** Une ligne par vehicule facturable : prise en charge, prix du km, forfaits aeroport. */
export async function chargerTarifs(client: ClientLecture): Promise<TarifCalc[]> {
  const { data } = await client.from('tarifs').select('*')
  return (data as TarifCalc[] | null) ?? []
}

/**
 * Les quatre sources en un seul aller-retour.
 *
 * C'est la fonction qu'appelle toute page ou action qui affiche ou enregistre
 * un prix. Les quatre lectures partent ensemble : le cout est celui de la plus
 * lente, pas la somme.
 */
export async function chargerTarification(client: ClientLecture): Promise<Tarification> {
  const [zones, grille, tarifs, params] = await Promise.all([
    chargerZones(client),
    chargerGrille(client),
    chargerTarifs(client),
    chargerParametres(client),
  ])
  return { zones, grille, tarifs, params }
}
