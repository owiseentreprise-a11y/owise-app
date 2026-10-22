/**
 * sentry-confidentialite.ts — ce que Sentry a le droit d'emporter.
 *
 * Constat mesuré à l'étape 91, sur six passages avec une erreur provoquée
 * sur `/reserver?depart=12 rue de Paris, 60500 Chantilly&arrivee=…` :
 * l'adresse du client partait vers Sentry à QUATRE endroits.
 *
 *   request.url        « …/reserver?depart=12%20rue%20de%20Paris%2C%2060500%20Chantilly… »
 *   fil d'Ariane nav.  { from: "/reserver?depart=12%20rue%20de%20Paris…" }
 *   fil d'Ariane fetch { method: "POST", url: "/reserver?depart=12%20rue…" }
 *   fil d'Ariane fetch { method: "GET",  url: "/api/geocode?q=12%20rue%20de%20Paris…" }
 *
 * Rien de tout cela n'est nécessaire pour diagnostiquer une panne : savoir
 * que l'erreur s'est produite sur `/reserver` suffit. On coupe donc la
 * partie interrogative des adresses — c'est elle, et elle seule, qui porte
 * l'adresse du client, sa destination, son code de parrainage ou son
 * identifiant de clic publicitaire.
 *
 * ── Aucun import ─────────────────────────────────────────────────────────
 * Ce module est appelé depuis la configuration navigateur, la configuration
 * serveur et la configuration edge. Il reste pur pour être chargeable par
 * les trois. Les types sont volontairement structurels et minimaux, pour
 * accepter les formes de Sentry sans en dépendre.
 */

/** Garde le chemin, jette la requête et le fragment. */
export function nettoyerUrl(url: unknown): string | unknown {
  if (typeof url !== 'string' || !url) return url
  const coupe = url.search(/[?#]/)
  if (coupe === -1) return url
  /* On signale la coupe plutôt que de la masquer : en lisant un rapport, on
     doit voir qu'il y avait des paramètres et qu'ils ont été retirés. */
  return `${url.slice(0, coupe)}?[retiré]`
}

type FilDAriane = {
  category?: string
  message?: string
  data?: { [k: string]: unknown }
}

/**
 * Les trois champs par lesquels une adresse passait dans un fil d'Ariane.
 * Rend `null` pour un fil d'Ariane de console : une trace d'erreur se lit
 * dans l'exception, pas dans les `console.log` du client, qui peuvent
 * contenir n'importe quoi.
 */
export function nettoyerFilDAriane<T extends FilDAriane>(f: T): T | null {
  if (!f || typeof f !== 'object') return f
  if (f.category === 'console') return null
  if (f.data && typeof f.data === 'object') {
    const d = f.data as { [k: string]: unknown }
    for (const cle of ['url', 'from', 'to']) {
      if (cle in d) d[cle] = nettoyerUrl(d[cle])
    }
  }
  return f
}

type Requete = {
  url?: string
  query_string?: unknown
  data?: unknown
  cookies?: unknown
}

type Evenement = {
  request?: Requete
  breadcrumbs?: FilDAriane[]
}

/**
 * Dernier filtre avant l'envoi d'un événement d'erreur. On conserve ce qui
 * sert au diagnostic — le type d'erreur, la pile, la page, le navigateur —
 * et on retire ce qui décrit le client.
 */
export function nettoyerEvenement<T extends Evenement>(e: T): T {
  if (!e || typeof e !== 'object') return e
  if (e.request && typeof e.request === 'object') {
    const r = e.request
    if (typeof r.url === 'string') r.url = nettoyerUrl(r.url) as string
    /* Jamais : la chaîne de requête, le corps d'une requête (il contient
       les champs du formulaire de réservation) et les cookies. */
    delete r.query_string
    delete r.data
    delete r.cookies
  }
  if (Array.isArray(e.breadcrumbs)) {
    e.breadcrumbs = e.breadcrumbs
      .map(f => nettoyerFilDAriane(f))
      .filter((f): f is FilDAriane => f !== null) as T['breadcrumbs']
  }
  return e
}
