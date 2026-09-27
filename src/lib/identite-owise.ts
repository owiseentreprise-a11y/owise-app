/**
 * L'identité d'Owise telle qu'elle est déclarée aux moteurs et aux IA.
 *
 * Une seule définition, importée par toutes les pages. Ces systèmes ne
 * reconnaissent une entreprise comme une entité unique que si le nom,
 * l'adresse et le téléphone concordent partout : une valeur recopiée à la main
 * finit par diverger, et l'entreprise devient deux entités dont aucune ne fait
 * autorité.
 *
 * Défaut réel, 2026-09-27 : les 38 pages villes déclaraient une fiche
 * d'entreprise **sans image et sans adresse**, alors que l'accueil les portait
 * toutes les deux. Une fiche sans image ni lieu est lue comme du texte, pas
 * comme un établissement — c'est ce qui manquait pour apparaître autrement
 * qu'en texte brut dans les réponses des assistants.
 */

export const BASE_OWISE = 'https://www.owise.fr'

/** Le socle commun à toute fiche `LocalBusiness` / `TaxiService` du site. */
export const IDENTITE_OWISE = {
  name: 'Owise — Chauffeur Privé VTC',
  logo: `${BASE_OWISE}/brand_assets/logo.svg`,
  image: `${BASE_OWISE}/brand_assets/hero-paris-night.webp`,
  telephone: '+33619106356',
  email: 'owise.entreprise@gmail.com',
  priceRange: '€€',
  currenciesAccepted: 'EUR',
  paymentAccepted: 'Cash, Credit Card, Stripe',
  // Adresse de l'entreprise, confirmee par l'exploitant le 2026-09-27 : c'est
  // Saint-Maximin, comme au registre (SIRET 47753413500041), pas Creil, que le
  // site declarait jusqu'ici. Bing Places et Foursquare comparent ce que le
  // site declare a ce qui est declare chez eux : deux communes differentes et
  // l'entreprise ne se recoupe plus.
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'Saint-Maximin',
    addressRegion: 'Oise',
    postalCode: '60740',
    addressCountry: 'FR',
  },
  // Geocodees, jamais devinees : Google renvoie ces valeurs pour
  // « Saint-Maximin, 60740, France ».
  geo: {
    '@type': 'GeoCoordinates',
    latitude: 49.223063,
    longitude: 2.441352,
  },
  sameAs: [
    'https://owise.fr',
    'https://www.owise.fr',
    'https://facebook.com/Owise.vtc',
    'https://www.tiktok.com/@owise857',
  ],
} as const

/**
 * Nom de commune exploitable, tiré d'un titre de page.
 *
 * Les titres portent des suffixes commerciaux — « VTC Chantilly — Aéroport &
 * Paris ». Déclarés tels quels dans `areaServed`, ils annoncent une ville qui
 * n'existe pas. On ne garde que ce qui précède le premier séparateur.
 *
 * Défaut réel : `/vtc-chantilly` déclarait la ville « Chantilly — Aéroport »,
 * `/vtc-beauvais` la ville « Beauvais — Chauffeur Privé ».
 */
export function communeDepuisTitre(titre: string): string {
  return titre
    .replace(/^VTC\s+/i, '')
    .split(/\s+[—–-]\s+|\s*&\s*|,/)[0]
    .trim()
}

/* ────────────────────────────── Les avis ─────────────────────────────────── */

/**
 * Valeurs de repli, relevées sur l'API Google Business le 2026-09-27.
 *
 * Elles ne servent que tant que la migration `20260927000000_avis_google.sql`
 * n'est pas appliquée. La source de vérité est la table `parametres` — un
 * chiffre écrit dans le code se périme sans que personne ne le voie : le site
 * a annoncé « 5 avis » pendant des mois alors que la fiche en portait 7.
 */
export const AVIS_PAR_DEFAUT = { nombre: 7, note: 5 } as const

/**
 * Le balisage `aggregateRating`, construit à partir du compteur réel.
 *
 * Renvoie `undefined` s'il n'y a aucun avis : déclarer une note sans avis est
 * une donnée fausse, et Google la sanctionne.
 */
export function ficheAvis(nombre?: number | null, note?: number | null) {
  const n = nombre ?? AVIS_PAR_DEFAUT.nombre
  const v = note ?? AVIS_PAR_DEFAUT.note
  if (!n || n < 1) return undefined
  return {
    '@type': 'AggregateRating',
    ratingValue: String(v),
    reviewCount: String(n),
    bestRating: '5',
    worstRating: '1',
  }
}

/**
 * Lit le compteur d'avis sans jamais faire échouer la page.
 *
 * Requête séparée et volontairement tolérante : tant que la migration n'est pas
 * appliquée, la colonne n'existe pas et PostgREST renvoie une erreur. Ajouter
 * ces colonnes au `select` qui charge les tarifs ferait échouer **toute** la
 * requête, et la page perdrait ses prix.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lireAvis(admin: { from: (t: string) => any }): Promise<{ nombre: number; note: number }> {
  try {
    const { data } = await admin.from('parametres').select('avis_nombre,avis_note').single()
    const d = data as { avis_nombre?: number | null; avis_note?: number | null } | null
    return {
      nombre: d?.avis_nombre ?? AVIS_PAR_DEFAUT.nombre,
      note: d?.avis_note ?? AVIS_PAR_DEFAUT.note,
    }
  } catch {
    return { ...AVIS_PAR_DEFAUT }
  }
}
