/**
 * Les pages anglaises disent-elles la vérité sur ce qu'Owise sait faire ?
 *
 *   npx tsx scripts/test-anglais-coherent.mts               → source + llms.txt
 *   npx tsx scripts/test-anglais-coherent.mts https://www.owise.fr   → + pages servies
 *
 * POURQUOI CE CONTRÔLE EXISTE
 *
 * Les deux pages anglaises ont été écrites AVANT que `/en/book` n'existe.
 * Elles disaient donc, honnêtement : « notre formulaire est en français,
 * écrivez-nous ». Depuis le 2026-11-06 c'est faux — et personne n'est revenu
 * le corriger, parce que rien ne le signalait.
 *
 * Deux choses étaient fausses en même temps, et la deuxième est la pire :
 *
 *   1. le bouton « Book now » menait à `/reserver`, le formulaire FRANÇAIS ;
 *   2. la phrase « The online booking form is currently in French » vivait
 *      dans la FICHE STRUCTURÉE (`FAQPage`) de la page — c'est-à-dire dans
 *      l'endroit exact qu'un assistant recopie. Le seul canal qui convertisse
 *      aujourd'hui annonçait donc à vos prospects anglophones qu'Owise ne
 *      sait pas prendre une réservation en ligne en anglais.
 *
 * CE CONTRÔLE REGARDE LA SOURCE, pas seulement le navigateur. La leçon du
 * 2026-11-06 : cinq textes français avaient survécu à deux passages au
 * navigateur, parce qu'ils vivaient dans des branches non déclenchées. Un
 * texte de FAQ et un libellé de bouton se lisent dans le fichier.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const RACINE = resolve(ICI, '..')
const BASE = process.argv.find(a => a.startsWith('http'))?.replace(/\/$/, '') ?? null
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0'
const V = '\x1b[32m', R = '\x1b[31m', J = '\x1b[33m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

let ok = 0
const soucis: string[] = []
const dire = (c: boolean, t: string, d = '') => {
  if (c) { ok++; console.log(`  ${V}✓${Z} ${t}`) }
  else { soucis.push(t); console.log(`  ${R}✗${Z} ${t}${d ? `\n      ${G}${d}${Z}` : ''}`) }
}

/* La route anglaise de la réservation se lit dans sa source unique, jamais
   recopiée ici : si elle change, ce contrôle suit. */
const langue = readFileSync(resolve(RACINE, 'src/lib/langue.ts'), 'utf8')
/* Pas de drapeau `s` : la cible TypeScript du projet est antérieure à
   es2018 et `tsc --noEmit` le refuse. `[^}]` suffit, il franchit déjà les
   sauts de ligne. */
const ROUTE_EN = langue.match(/JUMEAU_RESERVATION[^}]*?en:\s*'([^']+)'/)?.[1]

/* La phrase interdite, sous toutes les formes rencontrées. On vise la
   PRÉTENTION (« le formulaire est en français »), pas le mot « French » :
   « Version française → » est un lien légitime, et dire que la mise à
   disposition se devise par e-mail reste vrai. */
const PRETEND_FR_SEUL = /(booking )?form is (currently |now |)in French|in French for (now|the moment)|form(ulaire)? (is |est )?only in French|no English (booking|form)/i

console.log(`\n${B}LES PAGES ANGLAISES DISENT-ELLES LA VÉRITÉ ?${Z}`)
console.log(`${G}${BASE ? `source + llms.txt + pages servies par ${BASE}` : 'source + llms.txt — ajouter une URL pour éprouver les pages servies'}${Z}\n`)

// ── 0. La source unique est lisible ──────────────────────────────────────
console.log(`${B}0. la route anglaise${Z}`)
dire(ROUTE_EN === '/en/book', `JUMEAU_RESERVATION.en vaut « /en/book »`, `lu : ${ROUTE_EN ?? '(introuvable)'}`)

// ── 1. La SOURCE des pages anglaises ─────────────────────────────────────
console.log(`\n${B}1. la source des pages anglaises${Z}`)
const DOSSIER_EN = resolve(RACINE, 'src/app/en')
const pagesEn: string[] = []
const marcher = (d: string) => {
  for (const e of readdirSync(d)) {
    const p = join(d, e)
    if (statSync(p).isDirectory()) marcher(p)
    else if (e === 'page.tsx') pagesEn.push(p)
  }
}
marcher(DOSSIER_EN)
dire(pagesEn.length >= 3, `${pagesEn.length} pages anglaises trouvées`, pagesEn.join('\n      '))

for (const p of pagesEn) {
  const nom = p.replace(RACINE + '\\', '').replace(/\\/g, '/')
  const src = readFileSync(p, 'utf8')

  /* a) aucun lien de réservation vers le formulaire français. On ignore la
        page /en/book elle-même, dont le sélecteur de langue DOIT pointer
        vers /reserver — c'est son rôle. */
  const estLaPageDeReservation = p.includes(`en\\book`) || p.includes('en/book')
  if (!estLaPageDeReservation) {
    const versFr = [...src.matchAll(/href="\/reserver([^"]*)"/g)].map(m => m[0])
    dire(versFr.length === 0, `${nom} : aucun bouton ne renvoie au formulaire français`,
         versFr.length ? `${versFr.length} lien(s) : ${versFr.join(' · ')} — doivent viser ${ROUTE_EN}` : '')

    const versEn = src.includes(`href="${ROUTE_EN}`) || src.includes('JUMEAU_RESERVATION')
    dire(versEn, `${nom} : un lien mène bien vers ${ROUTE_EN}`)
  }

  /* b) aucune prétention que le formulaire n'existe qu'en français. */
  const lignes = src.split(/\r?\n/)
  const fautives = lignes
    .map((l, i) => ({ n: i + 1, l: l.trim() }))
    .filter(({ l }) => PRETEND_FR_SEUL.test(l))
  dire(fautives.length === 0, `${nom} : ne prétend plus que la réservation est française seulement`,
       fautives.map(({ n, l }) => `l.${n} : ${l.slice(0, 120)}`).join('\n      '))
}

// ── 2. llms.txt — le panneau que lisent les assistants ───────────────────
console.log(`\n${B}2. llms.txt désigne-t-il les pages anglaises ?${Z}`)
const llms = readFileSync(resolve(RACINE, 'public/llms.txt'), 'utf8')
/* Les pages anglaises publiées se lisent dans JUMEAUX_EN — la liste dont le
   sitemap dérive déjà. Pas une liste reconstituée de mémoire. */
const dest = readFileSync(resolve(RACINE, 'src/app/[destination]/page.tsx'), 'utf8')
const bloc = dest.match(/JUMEAUX_EN[^{]*\{([^}]*)\}/)?.[1] ?? ''
const URLS_EN = [...bloc.matchAll(/'(\/en\/[a-z0-9-]+)'/g)].map(m => m[1])
dire(URLS_EN.length >= 3, `${URLS_EN.length} pages anglaises déclarées dans JUMEAUX_EN`, URLS_EN.join(' · '))
for (const u of URLS_EN) {
  dire(llms.includes(u), `llms.txt cite ${u}`)
}
dire(/## .*English|English pages|In English/i.test(llms), 'llms.txt a une section anglaise repérable')
/* Un prix, écrit en anglais, trouvable sans ouvrir une page. */
dire(/fixed fare|Fixed fares|flat fare/i.test(llms), 'llms.txt écrit les prix en anglais ("fixed fare")')
dire(llms.includes('ANGLAIS-AUTO:DEBUT') && llms.includes('ANGLAIS-AUTO:FIN'),
     'le bloc anglais est généré (balises ANGLAIS-AUTO présentes), donc pas écrit à la main')

/* ── 2 bis. Les deux langues annoncent-elles LE MÊME prix ? ─────────────
   Les deux blocs sortent aujourd'hui du même appel à `prix()`, dans la même
   passe de `generer-llms-tarifs.mjs` : ils ne PEUVENT pas diverger. Ce
   contrôle existe pour le jour où quelqu'un corrigera « juste un chiffre »
   à la main dans un seul des deux. C'est exactement ainsi que trois
   `calculerPrix` et deux écritures de `formaterMontant` ont coexisté. */
console.log(`\n${B}2 bis. le même trajet, le même prix dans les deux langues${Z}`)
const blocFr = llms.match(/TARIFS-AUTO:DEBUT[\s\S]*?TARIFS-AUTO:FIN/)?.[0] ?? ''
const blocEnTxt = llms.match(/ANGLAIS-AUTO:DEBUT[\s\S]*?ANGLAIS-AUTO:FIN/)?.[0] ?? ''

const CODE_EN: Record<string, string> = { CDG: 'CDG', ORY: 'Orly', BVA: 'Beauvais-Tillé' }
const prixFr = new Map<string, number>()
for (const m of blocFr.matchAll(/^- ([A-Za-zÀ-ÿ' -]+?) → (CDG|Orly|Beauvais-Tillé|Paris|Bruxelles|Charleroi|Lille) : (\d+) €$/gm)) {
  prixFr.set(`${m[1].trim()}|${m[2]}`, Number(m[3]))
}
const prixEn = new Map<string, number>()
for (const m of blocEnTxt.matchAll(/^- ([A-Za-zÀ-ÿ' -]+?) to .*?\((CDG|ORY|BVA)\): €(\d+)$/gm)) {
  prixEn.set(`${m[1].trim()}|${CODE_EN[m[2]]}`, Number(m[3]))
}
dire(prixEn.size >= 15, `${prixEn.size} prix aéroport lus dans le bloc anglais`, [...prixEn.keys()].join(' · '))

const divergents: string[] = []
let compares = 0
for (const [cle, pEn] of prixEn) {
  const pFr = prixFr.get(cle)
  if (pFr === undefined) continue
  compares++
  if (pFr !== pEn) divergents.push(`${cle} : ${pFr} € en français, €${pEn} en anglais`)
}
dire(compares >= 15, `${compares} trajets comparables entre les deux blocs`,
     `seulement ${compares} — les libellés ne se recoupent plus, ce contrôle ne regarde plus rien`)
dire(divergents.length === 0, 'aucun prix ne diverge entre le français et l’anglais',
     divergents.join('\n      '))

/* ── 2 ter. Les promesses que ce fichier fait au nom d'Owise ────────────
   Décision du 2026-10-28 : aucun SMS. Le fichier annonçait pourtant une
   « confirmation immédiate par email et SMS » — une promesse publique que
   rien dans le code ne tient. */
console.log(`\n${B}2 ter. ce que llms.txt promet au nom d'Owise${Z}`)
/* Première écriture de ce contrôle : `/confirmation[^.]*SMS|SMS[^.]*confirmation/`.
   Elle signalait la phrase CORRECTE « aucun SMS n'est envoyé : l'e-mail est
   le canal de confirmation » — un contrôle qui crie au loup finit par être
   ignoré, ce qui est pire que pas de contrôle. La règle juste : toute
   mention de SMS dans ce fichier doit être une DÉNÉGATION. */
const DENIE_SMS = /aucun sms|pas de sms|no sms|sans sms/i
const lignesSms = llms.split(/\r?\n/).filter(l => /\bSMS\b/i.test(l))
const smsPromis = lignesSms.filter(l => !DENIE_SMS.test(l))
dire(smsPromis.length === 0,
     `llms.txt ne promet plus de confirmation par SMS (${lignesSms.length} mention(s), toutes des dénégations)`,
     smsPromis.map(l => l.trim().slice(0, 140)).join('\n      '))

/* Le détecteur sait-il encore échouer ? On lui repasse la phrase RÉELLE qui
   était publiée jusqu'au 2026-11-06. S'il la laisse passer, il ne protège
   plus rien, et ce contrôle doit le dire lui-même. */
const PHRASE_FAUTIVE_HISTORIQUE =
  '- La réservation se fait en ligne sur owise.fr/reserver, avec confirmation immédiate par email et SMS.'
dire(/\bSMS\b/i.test(PHRASE_FAUTIVE_HISTORIQUE) && !DENIE_SMS.test(PHRASE_FAUTIVE_HISTORIQUE),
     'le détecteur de SMS reconnaît toujours la phrase fautive d’origine',
     'il ne la voit plus — ce contrôle ne protège plus rien')
dire(llms.includes(ROUTE_EN ?? '/en/book'), `llms.txt dirige l'anglophone vers ${ROUTE_EN}`)

// ── 3. Les pages SERVIES ─────────────────────────────────────────────────
if (BASE) {
  console.log(`\n${B}3. ce qui est réellement servi par ${BASE}${Z}`)
  const lire = async (chemin: string) => {
    const r = await fetch(`${BASE}${chemin}`, { headers: { 'user-agent': UA } })
    return { statut: r.status, corps: r.ok ? await r.text() : '' }
  }

  const book = await lire(ROUTE_EN ?? '/en/book')
  dire(book.statut === 200, `${ROUTE_EN} répond 200`, `HTTP ${book.statut}`)

  for (const u of URLS_EN) {
    if (u === ROUTE_EN) continue
    const { statut, corps } = await lire(u)
    dire(statut === 200, `${u} répond 200`, `HTTP ${statut}`)
    if (statut !== 200) continue

    /* La fiche structurée EST ce qu'un assistant recopie : on la lit telle
       quelle, avec ses échappements JSON (\" dans le HTML). */
    const aplati = corps.replace(/\\"/g, '"')
    dire(!PRETEND_FR_SEUL.test(aplati), `${u} : plus aucune mention « le formulaire est en français »`,
         (aplati.match(PRETEND_FR_SEUL) ?? [''])[0])
    dire(aplati.includes(`href="${ROUTE_EN}"`) || aplati.includes(`"${BASE}${ROUTE_EN}"`),
         `${u} : un lien servi mène vers ${ROUTE_EN}`)
  }

  const servi = await lire('/llms.txt')
  dire(servi.statut === 200, '/llms.txt répond 200', `HTTP ${servi.statut}`)
  for (const u of URLS_EN) {
    dire(servi.corps.includes(u), `le llms.txt SERVI cite ${u}`)
  }
}

console.log('\n' + '─'.repeat(72))
if (soucis.length) {
  console.log(`${R}${B}${ok} au vert, ${soucis.length} échec(s) :${Z}`)
  for (const s of soucis) console.log(`  · ${s}`)
  process.exit(1)
}
console.log(`${V}${B}${ok} contrôles au vert${Z}\n`)
