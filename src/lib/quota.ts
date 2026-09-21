/**
 * Garde-fou des routes qui appellent Google — et que Google facture.
 *
 * Trois adresses interrogent Google Maps : /api/geocode, /api/distance et
 * /api/places. Ce sont les seuls endroits où un visiteur, humain ou robot,
 * coûte de l'argent. Elles étaient protégées par un simple compteur par
 * visiteur, ce qui laissait deux trous :
 *
 *   - une attaque répartie sur mille adresses passait sans être ralentie,
 *     chaque adresse restant sous sa propre limite ;
 *   - aucun plafond sur la journée : un débit modéré mais continu pouvait
 *     tourner 24 heures sans jamais déclencher la limite par minute.
 *
 * On ajoute donc deux plafonds globaux, tous visiteurs confondus : un par
 * minute, un par jour. Les valeurs sont très au-dessus de l'usage réel
 * (environ 80 appels par jour, mesuré le 2026-09-21) et très en dessous de
 * ce qui produirait une facture notable.
 *
 * Limite assumée : les compteurs vivent dans la mémoire d'une instance. Avec
 * plusieurs instances, le total réel est un multiple de ces plafonds. C'est
 * un garde-fou de dépense, pas une barrière étanche — mais c'est strictement
 * mieux que l'absence de plafond. Un dépassement écrit une ligne `[QUOTA]`
 * dans les journaux, pour qu'un abus se voie au lieu de se découvrir sur la
 * facture.
 */

type Compteur = { nb: number; fin: number }

const parVisiteur = new Map<string, Compteur>()
const parMinute   = new Map<string, Compteur>()
const parJour     = new Map<string, Compteur>()

/** Plafonds par route. `visiteur` est par adresse IP, les autres sont globaux. */
export const PLAFONDS = {
  geocode:  { visiteur: 120, minute: 400, jour: 6000 },
  distance: { visiteur: 120, minute: 400, jour: 6000 },
  places:   { visiteur:  60, minute: 200, jour: 3000 },
} as const

export type RouteGoogle = keyof typeof PLAFONDS

function depasse(table: Map<string, Compteur>, cle: string, plafond: number, dureeSec: number): boolean {
  const maintenant = Math.floor(Date.now() / 1000)
  const c = table.get(cle)
  if (!c || c.fin <= maintenant) {
    table.set(cle, { nb: 1, fin: maintenant + dureeSec })
    return false
  }
  c.nb++
  return c.nb > plafond
}

/**
 * Faut-il refuser cette requête ? Renvoie la raison du refus, ou `null` si
 * elle peut passer.
 */
export function refuser(route: RouteGoogle, ip: string): 'visiteur' | 'minute' | 'jour' | null {
  const p = PLAFONDS[route]

  if (depasse(parVisiteur, `${route}:${ip}`, p.visiteur, 60)) return 'visiteur'
  if (depasse(parMinute,   route,           p.minute,   60)) {
    console.warn(`[QUOTA] ${route} : plafond par minute atteint (${p.minute}) — appels Google suspendus`)
    return 'minute'
  }
  if (depasse(parJour,     route,           p.jour,   86400)) {
    console.warn(`[QUOTA] ${route} : plafond journalier atteint (${p.jour}) — appels Google suspendus`)
    return 'jour'
  }
  return null
}

/** L'adresse du visiteur telle que la transmet le réseau de Vercel. */
export function adresseVisiteur(req: { headers: { get(n: string): string | null } }): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnue'
}
