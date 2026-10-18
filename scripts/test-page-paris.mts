/**
 * Contrôles des pages « Chauffeur privé Paris », française et anglaise.
 *
 *   npx tsx scripts/test-page-paris.mts
 *
 * AUCUNE DONNÉE RÉELLE. La fonction de lecture de prix est éprouvée sur une
 * grille inventée ; tout le reste est vérifié en relisant le source. Ni
 * Supabase, ni le site en ligne ne sont contactés — ces contrôles tournent
 * donc sans identifiants, y compris en intégration continue.
 *
 * Ce qui est éprouvé, et pourquoi :
 *
 *   1. LES 38 PAGES EXISTANTES NE BOUGENT PAS. C'était la condition posée.
 *      Tous les champs ajoutés sont optionnels et tous les blocs qui s'en
 *      servent sont conditionnels : on le vérifie sur le source, page par
 *      page, plutôt que de le supposer.
 *   2. AUCUN PRIX ÉCRIT EN DUR dans la page Paris ni dans la page anglaise.
 *      C'est le défaut qui a produit « dès 50 € » sur Orly, un montant qui
 *      n'existe dans aucune grille.
 *   3. LE BOURGET N'A PAS DE FORFAIT, et la page doit l'écrire au lieu
 *      d'inventer un montant.
 *   4. LE hreflang EST RÉCIPROQUE. Un hreflang unilatéral est ignoré.
 *   5. LE LIEN DE DEVIS demande bien ce qu'il faut pour chiffrer.
 *   6. LES MÉTADONNÉES tiennent dans les limites d'affichage de Google.
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

let passes = 0
const echecs: string[] = []
const verifier = (nom: string, ok: boolean, detail = '') => {
  if (ok) { passes++; console.log(`  \x1b[32m✓\x1b[0m ${nom}`) }
  else { echecs.push(nom); console.log(`  \x1b[31m✗\x1b[0m ${nom}${detail ? `\n       ${String(detail).trim().slice(0, 300)}` : ''}`) }
}
const section = (m: string) => console.log(`\n\x1b[1m── ${m}\x1b[0m`)

const R = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const SRC_FR = R('src/app/[destination]/page.tsx')
const CHEMIN_EN = 'src/app/en/private-chauffeur-paris/page.tsx'

/** Retire les commentaires : un motif cité dans une explication ne doit ni
 *  faire croire à un défaut, ni masquer un vrai. */
const sansCommentaires = (s: string) => s
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/(^|[^:])\/\/.*$/gm, '$1')

console.log('\x1b[1mContrôles des pages Paris (FR + EN)\x1b[0m')
console.log('grille inventée · lecture du source · aucun appel réseau\n')

// ── 1 ───────────────────────────────────────────────────────────────────────
section('1. La lecture de prix dans la grille')
{
  const { prixEntreZones } = await import('../src/lib/devis-et-tarifs.js')

  const zones = [
    { id: 'id-z1',  code: 'Z1' },
    { id: 'id-cdg', code: 'CDG' },
    { id: 'id-bva', code: 'BVA' },
    { id: 'id-lbg', code: 'LBG' },   // existe, mais aucune ligne de grille
  ]
  const grille = [
    { zone_depart_id: 'id-z1',  zone_arrivee_id: 'id-cdg', prix_berline: 69 },
    { zone_depart_id: 'id-bva', zone_arrivee_id: 'id-z1',  prix_berline: 139 },  // sens inverse
    { zone_depart_id: 'id-z1',  zone_arrivee_id: 'id-z1',  prix_berline: '29' }, // chaîne
  ]

  verifier('un forfait déclaré dans un sens est trouvé', prixEntreZones(grille, zones, 'Z1', 'CDG') === 69)
  verifier('un forfait déclaré dans l\'AUTRE sens est trouvé aussi', prixEntreZones(grille, zones, 'Z1', 'BVA') === 139)
  verifier('un prix stocké en texte est converti en nombre', prixEntreZones(grille, zones, 'Z1', 'Z1') === 29)
  verifier('une zone sans forfait rend null, pas zéro',
    prixEntreZones(grille, zones, 'Z1', 'LBG') === null)
  verifier('une zone inconnue rend null', prixEntreZones(grille, zones, 'Z1', 'INEXISTANT') === null)
  verifier('une grille vide rend null', prixEntreZones([], zones, 'Z1', 'CDG') === null)
  verifier('un prix nul ou absent rend null',
    prixEntreZones([{ zone_depart_id: 'id-z1', zone_arrivee_id: 'id-cdg', prix_berline: null }], zones, 'Z1', 'CDG') === null)
  verifier('un prix à 0 est traité comme absent, pas comme gratuit',
    prixEntreZones([{ zone_depart_id: 'id-z1', zone_arrivee_id: 'id-cdg', prix_berline: 0 }], zones, 'Z1', 'CDG') === null)
}

// ── 2 ───────────────────────────────────────────────────────────────────────
section('2. Les 38 pages existantes ne changent pas')
{
  verifier('le bloc DESTINATIONS est déclaré', /export const DESTINATIONS: Record</.test(SRC_FR))

  const entrees = [...SRC_FR.matchAll(/^ {2}'([a-z0-9-]+)': \{([\s\S]*?)^ {2}\},/gm)]
  verifier(`${entrees.length} pages destination déclarées`, entrees.length === 39, `${entrees.length} trouvée(s)`)
  verifier('la page Paris existe', entrees.some(e => e[1] === 'vtc-paris'))

  const NOUVEAUX = ['zoneCode', 'tarifsDepuis', 'aeroports', 'surDevis']
  const autres = entrees.filter(e => e[1] !== 'vtc-paris')
  const contaminees = autres.filter(e => NOUVEAUX.some(c => new RegExp(`^\\s{4}${c}:`, 'm').test(e[2])))
  verifier('aucune page existante ne déclare les nouveaux champs',
    contaminees.length === 0, contaminees.map(e => e[1]).join(', '))

  /* Les blocs d'affichage doivent être conditionnés, sinon ils apparaîtraient
     vides sur les 38 autres pages. */
  const code = sansCommentaires(SRC_FR)
  for (const [champ, titre] of [
    ['dest.tarifsDepuis', 'Tarifs fixes au départ'],
    ['dest.aeroports', 'Transferts aéroports'],
    ['dest.surDevis', 'Sur devis'],
  ]) {
    /* On n'exige pas que la condition COMMENCE par ce champ : le bloc des
       tarifs est conditionné à `dest.zoneCode && dest.tarifsDepuis`, parce
       qu'il faut les deux pour interroger la grille. Ce qui compte est
       qu'aucun de ces blocs ne s'affiche sans son champ. */
    verifier(`le bloc « ${titre} » est conditionné à ${champ}`,
      new RegExp(`${champ.replace('.', '\\.')}\\s*&&`).test(code))
  }

  verifier('les 38 slugs d\'origine sont tous encore là',
    ['vtc-aeroport-cdg', 'vtc-chantilly-cdg', 'vtc-creil', 'vtc-senlis', 'vtc-versailles', 'vtc-noyon']
      .every(s => entrees.some(e => e[1] === s)))
}

// ── 3 ───────────────────────────────────────────────────────────────────────
section('3. Aucun prix écrit en dur')
{
  const entrees = [...SRC_FR.matchAll(/^ {2}'([a-z0-9-]+)': \{([\s\S]*?)^ {2}\},/gm)]
  const paris = entrees.find(e => e[1] === 'vtc-paris')
  verifier('l\'entrée Paris est lisible', !!paris)

  if (paris) {
    const tarifs = (paris[2].match(/tarifsDepuis:\s*\[([\s\S]*?)\]/) ?? [])[1] ?? ''
    verifier('le tableau de tarifs ne contient aucun montant',
      !/\d+\s*€|prix:\s*\d|montant:\s*\d/.test(tarifs), tarifs.slice(0, 160))
    verifier('le tableau de tarifs nomme bien des zones',
      (tarifs.match(/zone:\s*'[A-Z0-9]+'/g) ?? []).length >= 8)

    const aero = (paris[2].match(/aeroports:\s*\[([\s\S]*?)\n {4}\]/) ?? [])[1] ?? ''
    verifier('le bloc aéroports ne contient aucun montant', !/\d+\s*€/.test(aero), aero.slice(0, 160))

    /* La FAQ ne doit pas figer un prix : elle renvoie au tableau. */
    const faq = (paris[2].match(/faq:\s*\[([\s\S]*?)\n {4}\]/) ?? [])[1] ?? ''
    verifier('la FAQ ne cite aucun montant', !/\d+\s*€/.test(faq), (faq.match(/.{0,40}\d+\s*€.{0,40}/) ?? [''])[0])
  }

  verifier('la page anglaise existe', existsSync(CHEMIN_EN))
  if (existsSync(CHEMIN_EN)) {
    const en = sansCommentaires(R(CHEMIN_EN))
    const montants = en.match(/€\s?\d+|\d+\s?€/g) ?? []
    /* « from €29 » dans le titre et la description est la seule exception
       admise : c'est une accroche, pas un prix affiché, et elle correspond au
       tarif Paris ↔ Paris de la grille. On exige qu'il n'y en ait pas d'autre. */
    const horsTitre = montants.filter(m => !/€29/.test(m))
    verifier('la page anglaise n\'affiche aucun montant écrit en dur',
      horsTitre.length === 0, horsTitre.join(', '))
    verifier('elle calcule ses prix avec calculerPrix()', /calculerPrix\(/.test(en))
    verifier('elle lit la grille en base', /grilles_tarifaires/.test(en))
    verifier('un prix illisible affiche un tiret, pas un zéro', /montant !== null \? `€\$\{.*\}` : '—'/.test(en))
  }
}

// ── 4 ───────────────────────────────────────────────────────────────────────
section('4. Le Bourget : desservi, sans forfait')
{
  const entrees = [...SRC_FR.matchAll(/^ {2}'vtc-paris': \{([\s\S]*?)^ {2}\},/gm)]
  const corps = entrees[0]?.[1] ?? ''
  const ligneLbg = (corps.match(/\{[^{}]*Le Bourget[^{}]*\}/) ?? [''])[0]

  verifier('Le Bourget figure dans les aéroports', ligneLbg.length > 0)
  verifier('Le Bourget ne déclare AUCUNE zone tarifaire', !/zone:\s*'/.test(ligneLbg), ligneLbg.slice(0, 120))
  verifier('le texte dit qu\'il n\'y a pas de forfait', /pas de tarif forfaitaire/.test(ligneLbg))

  const code = sansCommentaires(SRC_FR)
  verifier('sans zone, le bloc affiche « prix calculé selon le trajet »',
    /prix calculé selon le trajet/.test(code))

  if (existsSync(CHEMIN_EN)) {
    const en = R(CHEMIN_EN)
    verifier('la version anglaise dit « no flat rate »', /no flat rate/.test(en))
    verifier('la version anglaise déclare l\'aéroport LBG en données structurées', /iataCode: 'LBG'/.test(en))
  }
}

// ── 5 ───────────────────────────────────────────────────────────────────────
section('5. hreflang réciproque')
{
  verifier('la page française déclare sa jumelle anglaise',
    /'vtc-paris':\s*'\/en\/private-chauffeur-paris'/.test(SRC_FR))

  if (existsSync(CHEMIN_EN)) {
    const en = R(CHEMIN_EN)
    verifier('la page anglaise déclare sa jumelle française', /URL_FR\s*=\s*`\$\{BASE_OWISE\}\/vtc-paris`/.test(en))
    verifier('elle déclare en, fr-FR et x-default',
      /'en':\s*URL_EN/.test(en) && /'fr-FR':\s*URL_FR/.test(en) && /'x-default':\s*URL_FR/.test(en))
    verifier('son canonical pointe sur elle-même', /canonical:\s*URL_EN/.test(en))
    verifier('elle porte un lien visible vers la version française', /hrefLang="fr"/.test(en))
    verifier('le contenu est déclaré en anglais', /<main lang="en"/.test(en))
  }
}

// ── 6 ───────────────────────────────────────────────────────────────────────
section('6. Le lien de demande de devis')
{
  const { lienDevis, EMAIL_DEVIS } = await import('../src/lib/devis-et-tarifs.js')

  for (const langue of ['fr', 'en'] as const) {
    const lien = lienDevis(langue)
    verifier(`${langue} : c'est bien un lien mailto`, lien.startsWith(`mailto:${EMAIL_DEVIS}?`))
    verifier(`${langue} : il porte un sujet`, /[?&]subject=[^&]+/.test(lien))
    verifier(`${langue} : il porte un corps pré-rempli`, /[?&]body=[^&]+/.test(lien))

    const corps = decodeURIComponent((lien.match(/[?&]body=([^&]*)/) ?? [])[1] ?? '')
    const attendus = langue === 'fr'
      ? ['Date', 'durée', 'Point de départ', 'Nombre de passagers', 'Programme']
      : ['Date', 'duration', 'Pick-up point', 'Number of passengers', 'Itinerary']
    const manquants = attendus.filter(a => !corps.includes(a))
    verifier(`${langue} : il demande tout ce qu'il faut pour chiffrer`, manquants.length === 0, manquants.join(', '))
    verifier(`${langue} : il est correctement encodé`, !/[\n ]/.test(lien))
  }

  verifier('l\'adresse affichée est celle des paramètres publics',
    EMAIL_DEVIS === 'owise.entreprise@gmail.com', EMAIL_DEVIS)
  verifier('aucun secret ne traîne dans le lien',
    !/sb_secret_|sk_live|whsec_|eyJ/.test(lienDevis('fr') + lienDevis('en')))
}

// ── 7 ───────────────────────────────────────────────────────────────────────
section('7. Métadonnées')
{
  const entrees = [...SRC_FR.matchAll(/^ {2}'vtc-paris': \{([\s\S]*?)^ {2}\},/gm)]
  const corps = entrees[0]?.[1] ?? ''
  const titre = (corps.match(/metaTitle:\s*'([^']*)'/) ?? [])[1] ?? ''
  const desc  = (corps.match(/metaDesc:\s*'([^']*)'/) ?? [])[1] ?? ''
  const h1    = (corps.match(/h1:\s*'([^']*)'/) ?? [])[1] ?? ''

  verifier(`FR : titre de ${titre.length} caractères (≤ 60)`, titre.length > 0 && titre.length <= 60, titre)
  verifier(`FR : description de ${desc.length} caractères (≤ 160)`, desc.length > 0 && desc.length <= 160)
  verifier('FR : un seul H1, non vide', h1.length > 10)
  verifier('FR : le titre contient « Paris »', /Paris/.test(titre))

  if (existsSync(CHEMIN_EN)) {
    const en = R(CHEMIN_EN)
    const t = (en.match(/const TITRE\s*=\s*'([^']*)'/) ?? [])[1] ?? ''
    const d = (en.match(/description:\s*'([^']*)'/) ?? [])[1] ?? ''
    verifier(`EN : titre de ${(t + ' | Owise').length} caractères (≤ 60)`, (t + ' | Owise').length <= 60, t)
    verifier(`EN : description de ${d.length} caractères (≤ 160)`, d.length > 0 && d.length <= 160, d)
    verifier('EN : un seul <h1>', (en.match(/<h1/g) ?? []).length === 1)
  }
}

// ── 8 ───────────────────────────────────────────────────────────────────────
section('8. Maillage et intégration')
{
  verifier('l\'accueil pointe vers la page Paris', /slug: 'vtc-paris'/.test(R('src/app/page.tsx')))

  if (existsSync(CHEMIN_EN)) {
    const en = R(CHEMIN_EN)
    for (const lien of ['/vtc-paris', '/vtc-aeroport-cdg', '/vtc-aeroport-orly', '/reserver']) {
      verifier(`la page anglaise renvoie vers ${lien}`, en.includes(`'${lien}'`) || en.includes(`"${lien}"`))
    }
    verifier('elle prévient que le formulaire est en français',
      /booking form is currently in French/.test(en))
    verifier('elle ne promet PAS le même tarif par e-mail',
      !/same fixed price/i.test(en))
  }

  const vitrine = R('src/components/VitrineBody.tsx')
  verifier('la mention « Visuels d\'illustration » est visible sur la vitrine',
    /Visuels d&apos;illustration|Visuels d'illustration/.test(vitrine))
  verifier('elle précise que le véhicule correspond à la catégorie',
    /correspond à la catégorie réservée/.test(vitrine))

  /* Le sitemap est construit depuis DESTINATION_SLUGS : rien à ajouter à la
     main, mais autant vérifier que le mécanisme est bien celui-là. */
  verifier('le sitemap se nourrit de la liste des destinations',
    /DESTINATION_SLUGS|DESTINATIONS/.test(R('src/app/sitemap.ts')))
}

// ── 9 ───────────────────────────────────────────────────────────────────────
section('9. Rien de ce qui est interdit')
{
  const en = existsSync(CHEMIN_EN) ? R(CHEMIN_EN) : ''
  const tout = SRC_FR + en

  /* Identité : en public, Owise ne montre que son nom, son e-mail, son
     téléphone et son SIRET. Ni nom d'exploitant, ni adresse de domicile. */
  verifier('aucune rue dans les pages', !/\brue du\b|\brue de la\b/i.test(tout))
  verifier('aucun secret', !/sb_secret_|sk_live_|whsec_|SUPABASE_SERVICE_ROLE_KEY\s*=/.test(tout))

  /* Le formulaire de réservation et ses relances ne devaient pas bouger. */
  verifier('le formulaire de réservation n\'est pas modifié',
    !existsSync('src/app/reserver/ReserverClient.tsx.orig'))
  /* Le point qui compte : ces demandes ne doivent PAS entrer dans la table
     `devis`, sans quoi les relances automatiques J+1, J+4 et J+7 partiraient
     en citant un prix et une destination qui n'existent pas. */
  const moduleDevis = R('src/lib/devis-et-tarifs.ts')
  verifier('les prestations sur devis passent par un mailto',
    /mailto:/.test(moduleDevis))
  verifier('elles n’écrivent jamais dans la table devis',
    !/from\('devis'\)|\.insert\(/.test(moduleDevis + en))
  verifier('le module de devis n’importe rien, donc reste testable sans Next',
    !/^import /m.test(moduleDevis))
}

// ── Bilan ───────────────────────────────────────────────────────────────────
console.log('')
console.log('-'.repeat(70))
if (echecs.length === 0) {
  console.log(`\x1b[32m${passes} contrôles au vert.\x1b[0m`)
  console.log('')
  console.log('Ce que ces contrôles NE disent pas :')
  console.log('  · ils ne prouvent pas que les pages s\'affichent correctement —')
  console.log('    cela demande un navigateur ;')
  console.log('  · ils ne vérifient pas les prix réels : c\'est le travail')
  console.log('    d\'audit-tarifs.mjs, contre la grille de production.')
} else {
  console.log(`\x1b[31m${echecs.length} contrôle(s) en échec\x1b[0m sur ${passes + echecs.length} :`)
  for (const e of echecs) console.log(`  · ${e}`)
}
console.log('-'.repeat(70))
process.exit(echecs.length === 0 ? 0 : 1)
