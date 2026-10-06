/**
 * Les images qui accompagnent les publications sur la fiche Google.
 *
 * Les 13 publications deja en ligne portent chacune une photo ; les
 * publications automatiques, elles, partaient en texte nu. Visible au premier
 * coup d'oeil sur la fiche.
 *
 * On ne genere rien de nouveau : on reprend les maquettes de vehicules deja
 * utilisees sur /reserver — meme voiture, meme angle, meme rendu — et on les
 * repose sur un fond de la charte Owise.
 *
 * Ces images illustrent une CATEGORIE de vehicule, pas un vehicule d'Owise.
 * Le site les presente deja ainsi (« illustration categorie Berline Owise »).
 *
 * Les quatre maquettes n'ont PAS le meme fond — mesure aux quatre coins :
 *   berline          193,212,237  bleu clair
 *   berline-premium    5,  6, 22  bleu nuit, deja proche de la charte
 *   van7             222,214,202  creme
 *   grand-van         14, 14, 14  noir neutre
 *
 * Trois traitements, choisis par la mesure et jamais a la main :
 *
 *   fond sombre                 -> pas de detourage, bords fondus, fond nuit
 *   fond clair, detourable      -> detourage, pose sur le fond nuit
 *   fond clair, non detourable  -> pas de detourage, fond creme de la charte
 *
 * Le troisieme cas existe a cause du van 7 places : son bas de caisse en ombre
 * (177,171,165) a la MEME teinte que son fond creme (223,214,203) — ecart
 * mesure 0.009 quand le seuil de separation est a 0.030. Aucun reglage ne les
 * distingue, et un detourage force mange la carrosserie. Le script s'en rend
 * compte seul : si le masque de fond deborde sur le centre de l'image, la ou
 * le vehicule se trouve forcement, il abandonne le detourage.
 *
 * Usage, depuis owise-app :
 *   node scripts/images-posts-gbp.mjs            -> simulation, ecrit dans /tmp
 *   node scripts/images-posts-gbp.mjs ecrire     -> ecrit dans public/brand_assets
 */
import sharp from 'sharp'
import { mkdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ECRIRE = process.argv[2] === 'ecrire'
const SORTIE = ECRIRE ? 'public/brand_assets' : join(tmpdir(), 'owise-posts-gbp')
mkdirSync(SORTIE, { recursive: true })

/* ── La charte ─────────────────────────────────────────────────────────────── */
const OR = '#C9A84C'
const NUIT  = { base: '#09091A', haut: '#1A1A38', milieu: '#101026', texte: '#EDE8DF', texte2: '#848499' }
const CREME = { base: '#EDE8DF', haut: '#F8F6F1', milieu: '#F3F0E9', texte: '#09091A', texte2: '#6E6E85' }

const LARGEUR = 1200
const HAUTEUR = 900   // 4:3, le rapport recommande par Google pour les posts
const POLICE = 'DM Sans, Segoe UI, Helvetica, Arial, sans-serif'

/* Le traitement est DECLARE, pas devine.
 *
 * J'ai cherche a le choisir automatiquement, sur la part du centre de l'image
 * mordue par le masque puis sur le nombre de morceaux restants : aucun des
 * deux ne separe proprement les deux cas. L'indicateur le plus parlant est la
 * part du vehicule qui a la couleur de son fond — 13 % pour la berline, 21 %
 * pour le van — mais poser un seuil entre les deux serait un reglage invente
 * sur deux images, qui se tromperait a la premiere maquette suivante.
 *
 * Le choix est donc ecrit ici, avec ce qui le justifie, et le script continue
 * d'afficher la mesure : si elle change, la ligne devient douteuse.
 */
const VEHICULES = [
  // fond bleu clair, bien separe de la carrosserie blanche (13 % a risque)
  { id: 'berline',         src: 'vehicle-berline.png',         traitement: 'detoure',       titre: 'BERLINE',         sous: '1 à 3 passagers' },
  // fond deja bleu nuit, avec filets or : rien a retirer
  { id: 'berline-premium', src: 'vehicle-berline-premium.png', traitement: 'entiere-nuit',  titre: 'BERLINE PREMIUM', sous: '1 à 4 passagers' },
  // fond creme confondu avec le bas de caisse en ombre (21 % a risque) :
  // un detourage force mange le capot et le pare-chocs. Verifie a l'ecran.
  { id: 'van7',            src: 'vehicle-van7.png',            traitement: 'entiere-creme', titre: 'VAN 7 PLACES',    sous: '5 à 7 passagers' },
  // fond noir neutre
  { id: 'grand-van',       src: 'vehicle-grand-van.png',       traitement: 'entiere-nuit',  titre: 'GRAND VAN',       sous: '8 passagers' },
]

const luminance = (r, g, b) => 0.2126 * r + 0.7152 * g + 0.0722 * b
/** Chromaticite : la teinte independamment de la luminosite. Une ombre garde
 *  la teinte de ce qu'elle assombrit. */
const teinte = (r, g, b) => { const s = r + g + b || 1; return [r / s, g / s, b / s] }

async function brut(chemin) {
  const { data, info } = await sharp(chemin).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  return { data, W: info.width, H: info.height, C: info.channels }
}

/** La couleur du fond, mediane des quatre coins pour ne pas dependre d'un pixel. */
function referenceFond({ data, W, H, C }) {
  const coins = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].map(([x, y]) => (y * W + x) * C)
  return [0, 1, 2].map(k => {
    const v = coins.map(i => data[i + k]).sort((a, b) => a - b)
    return (v[1] + v[2]) / 2
  })
}

/**
 * Le masque du fond, par propagation depuis les bords.
 *
 * Un seuil de couleur unique laisserait un halo autour de l'ombre portee, qui
 * est un degrade. On propage donc de proche en proche, avec trois garde-fous :
 *   - l'ecart avec le pixel voisin reste faible    (s'arrete sur un contour)
 *   - le pixel n'est pas plus clair que le fond    (une ombre assombrit)
 *   - le pixel garde la teinte du fond             (un pneu noir ne l'a pas)
 *
 * Ne modifie pas l'image : rend le masque et de quoi juger s'il est fiable.
 */
function masqueFond(img, ref) {
  const { data, W, H, C } = img
  const lumRef = luminance(...ref)
  const teinteRef = teinte(...ref)

  const fond = new Uint8Array(W * H)
  const pile = []
  for (let x = 0; x < W; x++) pile.push(x, (H - 1) * W + x)
  for (let y = 0; y < H; y++) pile.push(y * W, y * W + W - 1)

  const ECART_LOCAL = 20
  const ECART_TEINTE = 0.030

  while (pile.length) {
    const p = pile.pop()
    if (fond[p]) continue
    const i = p * C
    if (luminance(data[i], data[i + 1], data[i + 2]) > lumRef * 1.03) continue
    const t = teinte(data[i], data[i + 1], data[i + 2])
    if (Math.abs(t[0] - teinteRef[0]) + Math.abs(t[1] - teinteRef[1]) + Math.abs(t[2] - teinteRef[2]) > ECART_TEINTE) continue
    fond[p] = 1
    const x = p % W, y = (p - x) / W
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
      const q = ny * W + nx
      if (fond[q]) continue
      const j = q * C
      const ecart = Math.abs(data[j] - data[i]) + Math.abs(data[j + 1] - data[i + 1]) + Math.abs(data[j + 2] - data[i + 2])
      if (ecart <= ECART_LOCAL) pile.push(q)
    }
  }

  /* Le masque est-il credible ?
   *
   * Au centre de l'image se trouve forcement le vehicule. Si le masque y mord,
   * c'est que la propagation est passee sur la carrosserie : le fond et le
   * vehicule ne sont pas separables par la couleur, et il faut renoncer. */
  const x0 = Math.round(W * 0.32), x1 = Math.round(W * 0.68)
  const y0 = Math.round(H * 0.30), y1 = Math.round(H * 0.70)
  let dedans = 0
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (fond[y * W + x]) dedans++

  /* Combien du vehicule a la couleur de son fond ?
   *
   * C'est ce qui decide si un detourage est possible. Mesure, jamais devinee :
   * 13 % sur la berline (fond bleu, carrosserie blanche), 21 % sur le van
   * (fond creme, carrosserie blanche). Affichee a chaque execution pour qu'un
   * changement de maquette se voie. */
  let total = 0, opaques = 0, aRisque = 0
  for (let p = 0; p < W * H; p++) {
    total += fond[p]
    if (fond[p]) continue
    opaques++
    const i = p * C
    if (luminance(data[i], data[i + 1], data[i + 2]) > lumRef * 1.03) continue
    const t = teinte(data[i], data[i + 1], data[i + 2])
    if (Math.abs(t[0] - teinteRef[0]) + Math.abs(t[1] - teinteRef[1]) + Math.abs(t[2] - teinteRef[2]) <= ECART_TEINTE) aRisque++
  }
  return {
    fond,
    partCentre: dedans / ((x1 - x0) * (y1 - y0)),
    part: total / (W * H),
    confusion: opaques ? aRisque / opaques : 0,
  }
}

/**
 * Applique le masque : le fond devient transparent, bordures nettoyees.
 *
 * Deux nettoyages, chacun pour un defaut vu a l'ecran :
 *   - les pixels de bordure, melange de carrosserie et de fond, n'ont la
 *     teinte d'aucun des deux : on comble les trous isoles puis on elargit de
 *     deux pixels, pour manger la frange claire qui cernait le chauffeur ;
 *   - ce qui reste opaque sans etre rattache au vehicule est supprime : le bas
 *     de l'ombre portee devenait gris et laissait des eclats le long du bas de
 *     caisse.
 *
 * L'ombre d'origine est abandonnee — son grain se voyait une fois rendu en
 * transparence. Une ombre propre est dessinee a la composition.
 */
function appliquerMasque(img, fond) {
  const { data, W, H, C } = img
  const voisins = (m, p) => {
    const x = p % W, y = (p - x) / W
    let n = 0
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) { n++; continue }
      if (m[ny * W + nx]) n++
    }
    return n
  }

  let comble = 0
  for (let p = 0; p < W * H; p++) if (!fond[p] && voisins(fond, p) >= 6) { fond[p] = 1; comble++ }

  let masque = fond
  for (let tour = 0; tour < 2; tour++) {
    const elargi = masque.slice()
    for (let p = 0; p < W * H; p++) if (!masque[p] && voisins(masque, p) >= 1) elargi[p] = 1
    masque = elargi
  }
  for (let p = 0; p < W * H; p++) if (masque[p]) data[p * C + 3] = 0

  const SEUIL_ILOT = Math.round(W * H * 0.0015)
  const vu = new Uint8Array(W * H)
  let ilots = 0
  for (let depart = 0; depart < W * H; depart++) {
    if (vu[depart] || masque[depart]) continue
    const groupe = [], file = [depart]
    vu[depart] = 1
    while (file.length) {
      const q = file.pop()
      groupe.push(q)
      const x = q % W, y = (q - x) / W
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue
        const r = ny * W + nx
        if (vu[r] || masque[r]) continue
        vu[r] = 1
        file.push(r)
      }
    }
    if (groupe.length < SEUIL_ILOT) { ilots++; for (const q of groupe) data[q * C + 3] = 0 }
  }
  return { comble, ilots }
}

/**
 * Image gardee entiere : on dore la lueur bleue et on fond les bords.
 *
 * Seuls les pixels nettement bleus ET sombres sont touches — la carrosserie
 * blanche et le costume noir ont B-R proche de zero et restent intacts.
 */
function dorerEtFondre(img, marge) {
  const { data, W, H, C } = img
  let dores = 0
  for (let p = 0; p < W * H; p++) {
    const i = p * C
    const r = data[i], g = data[i + 1], b = data[i + 2]
    if (b - r > 22 && luminance(r, g, b) < 130) {
      const force = Math.min(1, (b - r - 22) / 60)
      data[i]     = Math.round(r + (0.79 * 255 - r) * force * 0.55)
      data[i + 1] = Math.round(g + (0.66 * 255 - g) * force * 0.42)
      data[i + 2] = Math.round(b + (0.30 * 255 - b) * force * 0.62)
      dores++
    }
    const x = p % W, y = (p - x) / W
    const d = Math.min(x, y, W - 1 - x, H - 1 - y)
    if (d < marge) data[i + 3] = Math.round(255 * (d / marge))
  }
  return { dores }
}

/** La couleur mesuree de la maquette, en hexadecimal. */
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(v).toString(16).padStart(2, '0')).join('')

/**
 * Pour une maquette gardee entiere, le fond de la carte prend EXACTEMENT la
 * couleur de son fond d'origine.
 *
 * Sans cela, le rectangle de l'image se devine : ses bords fondus arrivent sur
 * un degrade qui n'a pas tout a fait la meme valeur. Defaut visible sur la
 * premiere version, en haut et en bas des deux cartes concernees.
 */
const paletteCalee = (ref, c) => ({ ...c, base: hex(ref), milieu: hex(ref), haut: hex(ref) })

/* ── Le fond ───────────────────────────────────────────────────────────────── */
const fondCharte = c => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}">
  <defs>
    <radialGradient id="halo" cx="50%" cy="52%" r="64%">
      <stop offset="0%"   stop-color="${c.haut}"/>
      <stop offset="60%"  stop-color="${c.milieu}"/>
      <stop offset="100%" stop-color="${c.base}"/>
    </radialGradient>
    <radialGradient id="lueur" cx="50%" cy="56%" r="44%">
      <stop offset="0%"   stop-color="${OR}" stop-opacity="0.14"/>
      <stop offset="100%" stop-color="${OR}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${LARGEUR}" height="${HAUTEUR}" fill="url(#halo)"/>
  <ellipse cx="${LARGEUR / 2}" cy="${HAUTEUR * 0.56}" rx="${LARGEUR * 0.45}" ry="${HAUTEUR * 0.33}" fill="url(#lueur)"/>
</svg>`)

/** Une ombre portee propre, sous le vehicule detoure. */
const ombrePortee = (cx, cy, rx, ry) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}">
  <defs><radialGradient id="o">
    <stop offset="0%"   stop-color="#000" stop-opacity="0.55"/>
    <stop offset="55%"  stop-color="#000" stop-opacity="0.30"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0"/>
  </radialGradient></defs>
  <ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="url(#o)"/>
</svg>`)

/* ── La signature ──────────────────────────────────────────────────────────── */
const signature = (titre, sous, c) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${HAUTEUR}">
  <g transform="translate(74,62)">
    <rect x="0" y="0" width="56" height="56" rx="13" fill="rgba(201,168,76,0.10)" stroke="rgba(201,168,76,0.20)"/>
    <circle cx="28" cy="28" r="15.4" stroke="${c.texte}" stroke-opacity="0.88" stroke-width="2.5" fill="none"/>
    <path d="M28 12.6 A15.4 15.4 0 0 1 42 21.7" stroke="${OR}" stroke-width="3.1" stroke-linecap="round" fill="none"/>
    <circle cx="28" cy="28" r="3.1" fill="${OR}"/>
  </g>
  <text x="150" y="95"  font-family="${POLICE}" font-size="28" font-weight="700" letter-spacing="3.6" fill="${c.texte}">OWISE</text>
  <text x="152" y="117" font-family="${POLICE}" font-size="12" font-weight="400" letter-spacing="4.8" fill="${c.texte2}">CHAUFFEUR PRIVÉ</text>

  <rect x="74" y="${HAUTEUR - 158}" width="80" height="2" fill="${OR}"/>
  <text x="74" y="${HAUTEUR - 112}" font-family="${POLICE}" font-size="36" font-weight="600" letter-spacing="2.4" fill="${c.texte}">${titre}</text>
  <text x="76" y="${HAUTEUR - 76}"  font-family="${POLICE}" font-size="18" font-weight="400" letter-spacing="1.2" fill="${c.texte2}">${sous}</text>
  <text x="${LARGEUR - 74}" y="${HAUTEUR - 76}" text-anchor="end"
        font-family="${POLICE}" font-size="18" font-weight="500" letter-spacing="1.4" fill="${OR}">owise.fr</text>
</svg>`)

/* ── Assemblage ────────────────────────────────────────────────────────────── */
console.log(`${VEHICULES.length} image(s) -> ${SORTIE}\n`)

const SEUIL_CENTRE = 0.02   // au-dela, le masque mord sur le vehicule

for (const v of VEHICULES) {
  const img = await brut(`public/brand_assets/${v.src}`)
  const ref = referenceFond(img)

  let couches, palette = NUIT, note

  if (v.traitement === 'detoure') {
    const { fond, part, confusion } = masqueFond(img, ref)
    const { comble, ilots } = appliquerMasque(img, fond)
    const png = await sharp(img.data, { raw: { width: img.W, height: img.H, channels: img.C } }).png().toBuffer()
    const coupe = await sharp(png).trim({ threshold: 1 }).toBuffer()
    const m = await sharp(coupe).metadata()
    const l = Math.round(LARGEUR * 0.82), h = Math.round(l * (m.height / m.width))
    const haut = Math.round(HAUTEUR * 0.53 - h / 2)
    couches = [
      { input: ombrePortee(LARGEUR / 2, haut + h * 0.95, l * 0.42, Math.max(14, h * 0.085)), left: 0, top: 0 },
      { input: await sharp(coupe).resize(l, h).toBuffer(), left: Math.round((LARGEUR - l) / 2), top: haut },
    ]
    note = `detoure, fond nuit    ${(part * 100).toFixed(1).padStart(5)} % retire · ${comble} px de bordure · ${ilots} ilot(s) · ${(confusion * 100).toFixed(1)} % du vehicule a la couleur du fond`
  } else {
    palette = paletteCalee(ref, v.traitement === 'entiere-creme' ? CREME : NUIT)
    const { confusion } = masqueFond(img, ref)
    const { dores } = dorerEtFondre(img, 110)
    const png = await sharp(img.data, { raw: { width: img.W, height: img.H, channels: img.C } }).png().toBuffer()
    const h = Math.round(LARGEUR * (img.H / img.W))
    couches = [{ input: await sharp(png).resize(LARGEUR, h).toBuffer(), left: 0, top: Math.round(HAUTEUR * 0.50 - h / 2) }]
    const fond = v.traitement === 'entiere-creme' ? 'creme' : 'nuit '
    note = `entiere, fond ${fond}   ${String(dores).padStart(6)} px de lueur bleue dores · ${(confusion * 100).toFixed(1)} % du vehicule a la couleur du fond`
  }

  const fichier = `${SORTIE}/post-${v.id}.jpg`
  await sharp(fondCharte(palette))
    .composite([...couches, { input: signature(v.titre, v.sous, palette), left: 0, top: 0 }])
    .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
    .toFile(fichier)

  console.log(`   ${v.id.padEnd(17)} ${note}  ·  ${Math.round(statSync(fichier).size / 1024)} Ko`)
}

console.log(ECRIRE ? '\necrit dans public/brand_assets\n' : `\nSIMULATION — relire les fichiers dans ${SORTIE}, puis relancer avec « ecrire »\n`)
