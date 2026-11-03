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
 * Les parametres tarifaires, en entier.
 *
 * Ne jamais remplacer `'*'` par une liste de colonnes : c'est precisement la
 * faute que ce fichier existe pour empecher.
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
