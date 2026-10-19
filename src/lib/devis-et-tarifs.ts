/**
 * Deux outils des pages commerciales : lire un prix dans la grille, et
 * fabriquer un lien de demande de devis.
 *
 * ── Pourquoi un module à part ────────────────────────────────────────────
 *
 * Ces fonctions vivaient d'abord dans `[destination]/page.tsx`. Ce fichier
 * importe une feuille de style, donc aucun contrôle automatique ne pouvait
 * l'importer : les tests tombaient sur « Unexpected token '.' » en lisant du
 * CSS. Une logique qu'on ne peut pas éprouver finit par dériver.
 *
 * Ce module n'importe RIEN. Il se charge depuis le serveur, depuis un test,
 * depuis n'importe où.
 */

/* ── Lire un prix, ou admettre qu'il n'y en a pas ───────────────────────── */

export type LigneGrille = {
  zone_depart_id: string
  zone_arrivee_id: string
  prix_berline: number | string | null
}
export type ZoneMinimale = { id: string; code: string }

/**
 * Le prix berline d'une liaison, tel qu'il est en base.
 *
 * Rend `null` quand aucun forfait n'existe — et c'est un cas normal, pas une
 * panne : Le Bourget n'en a aucun. L'appelant doit alors écrire « prix
 * calculé selon le trajet », jamais inventer un montant.
 *
 * C'est précisément ce qui manquait aux 35 pages qui portent un « dès X € »
 * écrit à la main : trois d'entre elles annoncent un montant qui ne
 * correspond à aucune ligne de la grille, dont une **sous** le forfait le
 * plus bas.
 *
 * La grille stocke une seule ligne par paire, dans un sens arbitraire : on
 * cherche donc dans les deux.
 */
export function prixEntreZones(
  grille: LigneGrille[],
  zones: ZoneMinimale[],
  codeA: string,
  codeB: string,
): number | null {
  const a = zones.find(z => z.code === codeA)
  const b = zones.find(z => z.code === codeB)
  if (!a || !b) return null

  const cellule = grille.find(g =>
    (g.zone_depart_id === a.id && g.zone_arrivee_id === b.id) ||
    (g.zone_depart_id === b.id && g.zone_arrivee_id === a.id)
  )
  if (cellule?.prix_berline == null) return null

  const n = Number(cellule.prix_berline)
  /* Un 0 est traité comme une absence : aucune course n'est gratuite, et
     afficher « 0 € » serait pire que n'afficher aucun prix. */
  return Number.isFinite(n) && n > 0 ? n : null
}

/* ── Afficher un numéro de téléphone ────────────────────────────────────── */

/**
 * « +33619106356 » → « +33 6 19 10 63 56 ».
 *
 * Le numéro lisible est aujourd'hui recopié à la main dans cinq fichiers.
 * Plutôt que d'en ajouter un sixième, on le dérive de `IDENTITE_OWISE`, qui
 * est la source unique. Les cinq copies existantes restent à unifier — ce
 * n'est pas le chantier du jour, mais c'est noté.
 *
 * Un numéro non reconnu est rendu tel quel : mieux vaut un affichage brut
 * qu'un numéro découpé de travers.
 */
export function telephoneLisible(brut: string): string {
  const m = /^\+33(\d)(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(brut.replace(/\s/g, ''))
  return m ? `+33 ${m[1]} ${m[2]} ${m[3]} ${m[4]} ${m[5]}` : brut
}

/* ── Le canal des prestations sans tarif public ─────────────────────────── */

/**
 * L'adresse de contact publique d'Owise, telle qu'elle est enregistrée dans
 * les paramètres et déjà affichée sur le site.
 */
export const EMAIL_DEVIS = 'owise.entreprise@gmail.com'

/**
 * Le lien de demande de devis, et le message qu'il pré-remplit.
 *
 * ── Pourquoi un e-mail plutôt que le formulaire ──────────────────────────
 *
 * Mise à disposition, circuits et déplacements professionnels ne peuvent pas
 * passer par le formulaire de devis, et ce n'est pas une question de confort.
 * Ce formulaire exige un départ ET une arrivée, calcule un prix, puis
 * déclenche trois relances automatiques à J+1, J+4 et J+7 — qui citent ce
 * prix et cette destination. Une demande de mise à disposition qui y
 * passerait recevrait donc trois rappels d'un trajet jamais demandé, à un
 * tarif sans rapport, sans que personne s'en aperçoive.
 *
 * Le corps pré-rempli demande d'emblée ce qu'il faut pour chiffrer : sans
 * lui, la demande arrive en « bonjour, c'est combien ? » et coûte trois
 * allers-retours.
 */
export function lienDevis(langue: 'fr' | 'en'): string {
  const sujet = langue === 'fr'
    ? 'Demande de devis — mise à disposition / circuit'
    : 'Quote request — hourly hire / private tour'

  const corps = langue === 'fr'
    ? [
        'Bonjour,', '',
        'Prestation souhaitée : (mise à disposition / circuit / déplacement professionnel)',
        'Date :',
        'Heure de début et durée approximative :',
        'Point de départ :',
        'Nombre de passagers :',
        'Programme ou étapes souhaitées :', '',
        'Merci,',
      ].join('\n')
    : [
        'Hello,', '',
        'Service required: (hourly hire / private tour / business travel)',
        'Date:',
        'Start time and approximate duration:',
        'Pick-up point:',
        'Number of passengers:',
        'Itinerary or stops:', '',
        'Thank you,',
      ].join('\n')

  return `mailto:${EMAIL_DEVIS}?subject=${encodeURIComponent(sujet)}&body=${encodeURIComponent(corps)}`
}
