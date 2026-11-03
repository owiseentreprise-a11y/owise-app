/**
 * Une modification de tarif est-elle effective PARTOUT ?
 *
 * Demande de l'exploitant, 2026-11-03 : « quand on modifie le prix, le
 * kilometre, le forfait ou la zone, il faut que ce soit effectif partout.
 * Sinon on s'y retrouve plus. »
 *
 * Quatre facons de rater ca, toutes rencontrees dans ce projet :
 *
 *   1. un reglage affiche dans /admin/tarifs que PERSONNE ne lit — le champ
 *      existe, l'ecriture en base reussit, et rien ne change ;
 *   2. une page qui cite ses colonnes une par une : celle qu'elle oublie
 *      arrive `undefined` et le moteur retombe sur sa valeur de repli, en
 *      silence ;
 *   3. une valeur de repli du code qui a cesse de correspondre a la base ;
 *   4. un prix ecrit en dur dans une page, donc un second moteur de prix.
 *
 *   npx tsx scripts/audit-sources-tarifs.mts
 *
 * Ce contrôle sait echouer : remettre `coef_berline` hors de `calcPrix.ts`,
 * ou rendre a `DEFAULT_COEF_VAN` sa valeur de 1.5, et il passe au rouge.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')

const SRC = resolve('src')
function fichiers(d: string): string[] {
  const out: string[] = []
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) out.push(...fichiers(p))
    else if (/\.(ts|tsx)$/.test(n)) out.push(p)
  }
  return out
}
const court = (f: string) => relative('.', f).replace(/\\/g, '/')
const tous = fichiers(SRC)
const lire = (f: string) => readFileSync(f, 'utf8')

let soucis = 0
let verts = 0
const ko = (t: string) => { soucis++; console.log(`     \x1b[31m✗\x1b[0m ${t}`) }
const ok = (t: string) => { verts++; console.log(`     \x1b[32m✓\x1b[0m ${t}`) }

const sb = createAdminClient()
const [{ data: params }, { data: tarifs }] = await Promise.all([
  sb.from('parametres').select('*').eq('id', true).single(),
  sb.from('tarifs').select('*'),
])

/** Une lecture exacte : `coef_berline` ne doit pas matcher `coef_berline_premium`. */
function estLue(colonne: string, texte: string): boolean {
  return new RegExp(`\\b${colonne}(?![A-Za-z0-9_])`).test(texte)
}

const FORMULAIRE = 'src/app/admin/tarifs'
const horsFormulaire = tous.filter(f => !court(f).startsWith(FORMULAIRE))

console.log('\n\x1b[1mUNE MODIFICATION DE TARIF EST-ELLE EFFECTIVE PARTOUT ?\x1b[0m\n')

// ── 1. Un reglage affiche, mais lu par personne ────────────────────────────
console.log('\x1b[1m1. Réglages d\'/admin/tarifs qui ont réellement un effet\x1b[0m')
const actionsTarifs = lire(resolve('src/app/admin/tarifs/actions.ts'))
/* Les colonnes que le formulaire ECRIT : « nom_colonne: » suivi d'une lecture
   de formData. C'est la liste des promesses faites a l'exploitant. */
const ecrites = [...actionsTarifs.matchAll(/^\s{4}([a-z_]+):\s+(?:Number\(|formData)/gm)].map(m => m[1])
if (ecrites.length === 0) ko('aucune colonne détectée dans updateParams — le motif de lecture a changé')
for (const c of ecrites) {
  const lecteurs = horsFormulaire.filter(f => estLue(c, lire(f)))
  if (lecteurs.length === 0) {
    ko(`\x1b[1m${c}\x1b[0m = ${params?.[c]} — champ affiché dans /admin/tarifs, \x1b[1mlu par aucune page\x1b[0m`)
  }
}
if (soucis === 0) ok(`les ${ecrites.length} réglages du formulaire sont tous lus quelque part`)

// ── 2. Les pages qui citent leurs colonnes a la main ───────────────────────
console.log('\n\x1b[1m2. Lectures TARIFAIRES de « parametres » : par le chargeur unique ?\x1b[0m')
/* On ne juge que les lectures qui servent a calculer un prix. Les factures et
   l'identite de la societe lisent la meme table pour d'autres colonnes
   (`facture_*`, `societe_*`, `paiement_*`) : ce n'est pas le sujet de ce
   controle, et les melanger le rendrait illisible, donc inutile. */
const estColonneTarifaire = (c: string) => /^(coef_|tarif_|supplement_)/.test(c.trim())
let aLaMain = 0
let parLeChargeur = 0
for (const f of tous) {
  const texte = lire(f)
  if (/chargerParametres|chargerTarification/.test(texte)) parLeChargeur++
  for (const m of texte.matchAll(/from\(\s*['"]parametres['"]\s*\)\s*\.\s*select\(\s*([`'"])([^`'"]*)\1/g)) {
    const liste = m[2].trim()
    if (liste === '*') continue
    const tarifaires = liste.split(',').filter(estColonneTarifaire)
    if (tarifaires.length === 0) continue
    aLaMain++
    ko(`${court(f)} cite ${tarifaires.length} colonne(s) tarifaire(s) à la main`
       + ` — passer par chargerParametres()\n         ${liste.slice(0, 110)}…`)
  }
}
if (aLaMain === 0) {
  ok(`aucune page ne cite ses colonnes tarifaires — ${parLeChargeur} fichier(s) passent par src/lib/tarification.ts`)
}

// ── 3. Les replis du code correspondent-ils encore a la base ? ─────────────
console.log('\n\x1b[1m3. Valeurs de repli du code, face à la base\x1b[0m')
const calcPrix = lire(resolve('src/lib/calcPrix.ts'))
const REPLIS: { motif: RegExp; quoi: string; colonne: string | null }[] = [
  /* Pas de « coefficient Berline » ici : il n'en existe pas, et c'est voulu.
     `prix_berline` de la grille EST le prix de la berline. Voir la note dans
     calcPrix.ts — la colonne `coef_berline` vaut 1,5 en base sans que
     personne l'ait decide, et la lire augmenterait tous les prix de 50 %. */
  { motif: /DEFAULT_COEF_PREMIUM\s*=\s*([\d.]+)/, quoi: 'coefficient Berline Premium', colonne: 'coef_berline_premium' },
  { motif: /DEFAULT_COEF_VAN\s*=\s*([\d.]+)/,     quoi: 'coefficient Van',             colonne: 'coef_van' },
  { motif: /SUPPLEMENT_ETAPE_DEFAUT\s*=\s*([\d.]+)/, quoi: 'supplément par étape',     colonne: 'supplement_etape' },
  { motif: /SUPPLEMENT_GRAND_VAN\s*=\s*([\d.]+)/, quoi: 'supplément Grand Van',        colonne: 'supplement_grand_van' },
  { motif: /SURCOUT_KM_GRAND_VAN\s*=\s*([\d.]+)/, quoi: 'surcoût au km Grand Van',     colonne: 'surcout_km_grand_van' },
]
for (const { motif, quoi, colonne } of REPLIS) {
  const m = calcPrix.match(motif)
  if (!m) { ko(`${quoi} : constante de repli introuvable dans calcPrix.ts`); continue }
  const enDur = Number(m[1])
  const enBase = colonne && params && colonne in params ? params[colonne] : undefined
  if (enBase === undefined) {
    /* Pas de colonne : le code est alors la SEULE source, donc rien ne peut
       diverger. C'est reglable depuis /admin/tarifs une fois la colonne
       creee — un confort, pas un defaut de synchronisation. */
    console.log(`     ~ ${quoi} : ${enDur} dans le code, seule source (pas de colonne « ${colonne} »)`)
  } else if (Number(enBase) !== enDur) {
    ko(`${quoi} : \x1b[1m${enDur}\x1b[0m dans le code, \x1b[1m${enBase}\x1b[0m en base — ils ont divergé`)
  } else {
    ok(`${quoi} : ${enDur} de part et d'autre`)
  }
}

// ── 4. Un prix ecrit en dur dans une page ──────────────────────────────────
console.log('\n\x1b[1m4. Prix de course écrits en dur\x1b[0m')
/* On ne regarde que les fichiers qui chiffrent un trajet, c'est-a-dire ceux
   qui importent `calcPrix`. C'est la, et nulle part ailleurs, qu'un second
   moteur de prix peut naitre. Un montant en dur ailleurs — le credit de
   parrainage de 10 EUR, par exemple — n'est pas un prix de course et n'a rien
   a faire dans ce controle. */
const surfacesDePrix = horsFormulaire.filter(f => /from '@\/lib\/calcPrix'|from '\.\/calcPrix'/.test(lire(f)))
let enDurTrouves = 0
for (const f of surfacesDePrix) {
  /* Sans ancre de debut de ligne : le defaut d'origine etait `base:65` au
     milieu d'une ligne (`{ min:1,max:3, name:'Berline', base:65 }`), et la
     version ancree de ce controle ne l'aurait jamais vu. */
  for (const m of lire(f).matchAll(/\b(?:base|prix|tarif|montant)\s*:\s*(\d{2,4})\b/g)) {
    enDurTrouves++
    ko(`${court(f)} — prix de course en dur : ${m[1]} €`)
  }
}
if (enDurTrouves === 0) ok(`aucun prix en dur dans les ${surfacesDePrix.length} surfaces qui calculent un prix`)

// ── 5. Une seule declaration de la gamme ───────────────────────────────────
console.log('\n\x1b[1m5. Le vocabulaire des véhicules n\'est déclaré qu\'une fois\x1b[0m')
const { GAMME } = await import('../src/lib/gamme')
for (const v of GAMME) {
  const ligne = (tarifs ?? []).find(t => t.vehicule === v.nomTarif)
  if (!ligne) ko(`${v.nom} — aucune ligne dans « tarifs » (nomTarif = ${v.nomTarif ?? 'null'})`)
}
/* Une mention isolee d'un libelle (une option de liste deroulante, un
   intitule de statistique) n'est pas un defaut. Ce qui divergeait, ce sont les
   TABLES DE CORRESPONDANCE : quatre objets qui associaient chacun les cles de
   vehicules a des noms, et ne disaient pas la meme chose. Un fichier qui
   declare un tel objet est une deuxieme source. */
const sansCommentairesSimple = (t: string) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
const CLES = GAMME.map(v => v.cle)
let tables = 0
for (const f of tous) {
  if (court(f) === 'src/lib/gamme.ts') continue
  const texte = lire(f)
  /* Un objet litteral qui porte au moins trois cles de la gamme comme
     proprietes, chacune suivie d'une chaine : c'est une table de noms. */
  /* `\\b` et non `\b` : dans un gabarit JavaScript, `\b` est le caractere
     « retour arriere », pas une limite de mot. Ecrit ainsi, ce controle est
     reste aveugle a sa premiere redaction — il ne cherchait rien. */
  /* La valeur doit RESSEMBLER a un nom de vehicule : « Berline », « Van »,
     « Premium », ou un nombre de places. Sans cette condition, le controle
     signalait aussi une table d'emojis (`berline: '🚘'`) — qui ne decide du
     nom de rien, et dont la presence est legitime. Ce qu'on traque, c'est une
     SECONDE source du NOM. */
  const VALEUR_NOM = "[^'\"`]*(?:Berline|Van|Premium|\\\\d\\\\s*places?)[^'\"`]*"
  const portees = CLES.filter(c => new RegExp(`\\b${c}:\\s*['"\`]${VALEUR_NOM}['"\`]`).test(texte))
  if (portees.length >= 3) {
    tables++
    ko(`${court(f)} déclare sa propre table de noms (${portees.join(', ')}) — la dériver de gamme.ts`)
  }
}
if (tables === 0) ok('une seule table de correspondance clé → nom, dans gamme.ts')

/* 5 bis. Les orthographes ABANDONNEES, ecrites comme chaines.
 *
 * Le controle ci-dessus cherche une table `cle: 'Nom'`. Il est passe a cote
 * d'une SEPTIEME declaration de la gamme : une simple liste de libelles dans
 * le tableau de tarifs public de l'accueil
 * (`[{ label:'Van 7 pl.' }, ...]`), ecrite deux fois dans le meme bloc JSX.
 * Elle a survecu au premier nettoyage parce qu'on ne cherchait que « 8 pl. »,
 * et elle etait EN LIGNE : « Van 7 pl. » apparaissait quatre fois sur la page
 * d'accueil de owise.fr.
 *
 * On cherche donc les orthographes abandonnees elles-memes. Seules celles qui
 * ne peuvent designer qu'un vehicule sont retenues — « Van » ou « Premium »
 * seuls se rencontrent legitimement ailleurs. */
const ORTHOGRAPHES_ABANDONNEES = ['Van 7 pl.', 'Grand Van 8 pl.', 'Van 7 pl', 'Grand Van 8 pl']
let abandonnees = 0
for (const f of tous) {
  if (court(f) === 'src/lib/gamme.ts') continue
  const texte = sansCommentairesSimple(lire(f))
  for (const o of ORTHOGRAPHES_ABANDONNEES) {
    /* On exige les guillemets FERMANTS, sans quoi « Grand Van 8 pl » ferait
       mouche sur « Grand Van 8 places », dont il est le prefixe. C'est le
       piege qui a fait echouer 6 controles de mon essai en ligne a tort. */
    const cite = [`'${o}'`, `"${o}"`, '`' + o + '`'].some(v => texte.includes(v))
    if (cite) { abandonnees++; ko(`${court(f)} écrit l'orthographe abandonnée « ${o} » — la prendre dans gamme.ts`) }
  }
}
if (abandonnees === 0) ok(`aucune des ${ORTHOGRAPHES_ABANDONNEES.length} orthographes abandonnées n'est réécrite`)
ok(`${GAMME.length} véhicules déclarés, chacun rattaché à une ligne de « tarifs »`)

// ── 6. Les libelles DEJA EN BASE sont-ils tous reconnus ? ─────────────────
console.log('\n\x1b[1m6. Les libellés déjà enregistrés en base sont-ils reconnus ?\x1b[0m')
/* Deriver les libelles de `gamme.ts` change ce que le site ECRIT ; les lignes
   deja enregistrees gardent leur ancienne orthographe. Ce controle lit les
   valeurs REELLES, jamais une liste reconstituee de memoire.
   Defaut trouve le 2026-11-03 : `convertirEnCourse` resolvait le vehicule
   avec `VH_MAP[...] ?? 'berline'`. Un devis « Grand Van 8 places » n'etait pas
   dans la table — il se serait converti en course BERLINE pour 8 personnes. */
const { cleDepuisLibelle } = await import('../src/lib/gamme')
const [{ data: devis }, { data: courses }, { data: estims }] = await Promise.all([
  sb.from('devis').select('vehicle'),
  sb.from('courses').select('type_vehicule'),
  sb.from('estimations').select('vehicule'),
])
const libellesEnBase = new Map<string, string>()
for (const d of devis ?? [])   if (d.vehicle)       libellesEnBase.set(String(d.vehicle), 'devis.vehicle')
for (const c of courses ?? []) if (c.type_vehicule) libellesEnBase.set(String(c.type_vehicule), 'courses.type_vehicule')
for (const e of estims ?? [])  if (e.vehicule)      libellesEnBase.set(String(e.vehicule), 'estimations.vehicule')
if (libellesEnBase.size === 0) ko('aucun libellé lu en base — le contrôle ne vérifie rien')
for (const [libelle, source] of libellesEnBase) {
  const cle = cleDepuisLibelle(libelle)
  if (cle) ok(`« ${libelle} » → ${cle}   (${source})`)
  else ko(`\x1b[1m« ${libelle} »\x1b[0m de ${source} n'est reconnu par aucun véhicule de la gamme`)
}
/* Et aucun repli silencieux sur la berline au moment de resoudre un libelle. */
/* Les commentaires sont retires avant de chercher : ce fichier-ci et deux
   autres CITENT le defaut d'origine (`VH_MAP[...] ?? 'berline'`) pour
   l'expliquer. Un controle qui signale sa propre documentation se fait
   ignorer. */
const sansCommentaires = (t: string) => t
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')
/* Les routes de /api/test sont ecartees : `body.type_vehicule ?? 'berline'`
   y est la valeur par defaut d'un PARAMETRE d'entree, pas le resultat d'une
   resolution de libelle qui aurait echoue. */
const repliSilencieux = tous
  .filter(f => !court(f).startsWith('src/app/api/test/'))
  .filter(f => /\?\?\s*'berline'/.test(sansCommentaires(lire(f))))
for (const f of repliSilencieux) {
  ko(`${court(f)} retombe sur « berline » quand un libellé n'est pas reconnu — refuser plutôt`)
}
if (repliSilencieux.length === 0) ok("aucun repli silencieux sur « berline » à la résolution d'un libellé")

console.log()
console.log(soucis
  ? `\x1b[31m${soucis} endroit(s) où une modification ne serait pas effective partout\x1b[0m  (${verts} contrôle(s) au vert)\n`
  : `\x1b[32m${verts} contrôle(s) au vert — tout réglage est effectif partout\x1b[0m\n`)
process.exit(soucis ? 1 : 0)
