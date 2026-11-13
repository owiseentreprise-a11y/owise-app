/**
 * Ce qu'on MONTRE d'un véhicule : son illustration, sa vignette de fond,
 * ses arguments. Une seule écriture, pour toutes les pages qui l'affichent.
 *
 * POURQUOI CE FICHIER EXISTE
 *
 * Ces données vivaient dans `VitrineBody.tsx`, un composant client de
 * 2 900 lignes. La page `/mise-a-disposition` avait besoin des mêmes
 * illustrations ; les y recopier aurait fait vivre deux listes d'images
 * côte à côte, et la première photo remplacée aurait laissé l'autre page
 * sur l'ancienne. Même raison que `gamme.ts` pour les noms, `calcPrix.ts`
 * pour les prix, `conditions.ts` pour les conditions.
 *
 * CE FICHIER EST PUR : aucun import, aucune dépendance React. Il se lit
 * depuis le serveur comme depuis le navigateur.
 *
 * LES CLÉS SONT CELLES DE `GAMME` (`gamme.ts`). Une clé absente ici n'est
 * pas une erreur de compilation — `presentationVehicule()` rend `null`, et
 * l'appelant affiche la carte sans illustration plutôt que de casser.
 */

export type PresentationVehicule = {
  /** Trois arguments courts, affichés sous le nom sur l'accueil. */
  feats: string[]
  /** Fond de la vignette : un jeton de `vitrine.css`, jamais une couleur en dur. */
  bg: string
  /** Pastille en coin, ou `null`. */
  badge: string | null
  /** La vignette est-elle sombre ? Décide de l'encre posée dessus. */
  dark: boolean
  /** L'illustration servie sur le site. Optimisée par `next/image`. */
  img: string
  /** Texte alternatif : il DÉCRIT l'illustration, il ne vend pas. */
  alt: string
}

export const PRESENTATION_VEHICULES: Record<string, PresentationVehicule> = {
  berline: {
    feats: ['Berline récente, intérieur soigné', 'Climatisation bi-zone', 'WiFi embarqué'],
    bg: 'var(--vignette-ciel)', badge: null, dark: false,
    img: '/brand_assets/vehicle-berline.png',
    alt: 'Illustration de la catégorie Berline Owise : berline blanche et chauffeur en costume',
  },
  berline_premium: {
    feats: ['Berline haut de gamme', 'Eau minérale offerte', 'Chargeurs universels, WiFi'],
    bg: 'var(--vignette-nuit)', badge: '4 passagers', dark: true,
    img: '/brand_assets/vehicle-berline-premium.png',
    alt: 'Illustration de la catégorie Berline Premium Owise : berline blanche aux finitions dorées, chauffeur ouvrant la portière arrière',
  },
  van: {
    feats: ['Van récent, 7 places assises', 'Grand coffre, idéal aéroport', 'Transferts groupes & familles'],
    bg: 'var(--vignette-sable)', badge: null, dark: false,
    img: '/brand_assets/vehicle-van7.png',
    alt: 'Illustration de la catégorie Van 7 places Owise : van blanc et une famille de quatre personnes',
  },
  grand_van: {
    feats: ['Grand van, 8 places assises', "Séminaires, événements d'entreprise", 'Selon la disponibilité de nos partenaires'],
    bg: 'var(--vignette-charbon)', badge: null, dark: true,
    img: '/brand_assets/vehicle-grand-van.png',
    alt: 'Illustration de la catégorie Grand Van 8 places Owise : grand van blanc, porte latérale ouverte, chauffeur en costume',
  },
}

/** La présentation d'un véhicule, ou `null` si la clé est inconnue. */
export function presentationVehicule(cle: string): PresentationVehicule | null {
  return PRESENTATION_VEHICULES[cle] ?? null
}

/**
 * CE QUI DOIT ÊTRE DIT PARTOUT OÙ CES IMAGES SONT MONTRÉES.
 *
 * Owise ne possède pas de photographies de son parc : ces quatre fichiers
 * sont des illustrations. Les textes alternatifs le disent déjà
 * (« Illustration de la catégorie… »), mais un texte alternatif ne se lit
 * pas à l'écran. L'accueil portait donc cette phrase sous sa flotte.
 *
 * Elle vit ici depuis le 2026-11-13, parce que `/mise-a-disposition` s'est
 * mise à montrer les MÊMES images : une phrase d'honnêteté recopiée est
 * une phrase qu'on oublie sur la deuxième page.
 */
export const MENTION_ILLUSTRATION =
  'Visuels d’illustration. Le véhicule mis à disposition correspond à la catégorie réservée.'

export const MENTION_ILLUSTRATION_EN =
  'Illustrative images. The vehicle provided matches the category booked.'
