/**
 * Une seule politique d'annulation, une seule règle d'attente.
 *
 * Le 2026-11-03, un inventaire a trouvé TROIS politiques d'annulation
 * vivantes en même temps — le cahier des charges, les CGV publiées, et une
 * quatrième ajoutée sur les devis la veille — plus deux tarifs d'attente
 * (0,50 €/min au cahier des charges, 70 €/h inventé dans le code).
 *
 * Personne ne s'en était aperçu parce que rien ne les comparait. Ce contrôle
 * compare.
 *
 *   npx tsx scripts/test-conditions.mts [url]
 *
 * Sans argument : il lit le code. Avec une URL, il lit en plus les pages
 * réellement servies — c'est là que se voit une divergence déployée.
 */
import { readFileSync, readdirSync, statSync } from 'fs'
import { join, relative, resolve } from 'path'

const SRC = resolve('src')
const SOURCE = 'src/lib/conditions.ts'
const BASE = process.argv[2] ?? null

const { ANNULATION_COURTE, ANNULATION_MENTION, ANNULATION_PHRASE, ATTENTE_MENTION,
        PALIERS_ANNULATION, coutAnnulation, coutAttente } =
  await import('../src/lib/conditions')

let ok = 0
const echecs: string[] = []
const dire = (intitule: string, condition: boolean, detail = '') => {
  if (condition) { ok++; return }
  echecs.push(`${intitule}${detail ? `\n       ${detail}` : ''}`)
}

function fichiers(dossier: string): string[] {
  const out: string[] = []
  for (const nom of readdirSync(dossier)) {
    const p = join(dossier, nom)
    if (statSync(p).isDirectory()) out.push(...fichiers(p))
    else if (/\.(ts|tsx)$/.test(nom)) out.push(p)
  }
  return out
}

console.log('\nUne seule politique d\'annulation, une seule règle d\'attente\n')

// ── 1. Les formulations abandonnées ne doivent plus figurer nulle part ──────

/* Les traces de l'ancienne politique « VTC a la demande ». Elles sont
   tolerees dans les COMMENTAIRES, qui racontent justement pourquoi on en
   est sorti — on ne regarde donc que le code. */
const ABANDONNE: { motif: RegExp; quoi: string }[] = [
  /* Le motif exigeait une espace apres « tant qu » ; le texte enchaine sur
     une apostrophe (« tant qu'aucun ») et passait au travers. Mesure du
     2026-11-03 : en remettant la phrase d'origine, le controle restait vert. */
  { motif: /gratuite?[^.]{0,12}(tant qu|avant)[^.]{0,30}attribu/i, quoi: '« gratuite avant attribution »' },
  { motif: /3\s*€\s*de\s*3\s*à\s*10/i,                        quoi: 'le palier « 3 € de 3 à 10 minutes »' },
  { motif: /frais d.annulation de [38]\s*€/i,                 quoi: 'les frais de 3 € ou 8 €' },
  { motif: /attente_tarif_heure\s*:\s*\d/,                    quoi: 'un tarif d\'attente horaire en dur' },
  { motif: /70[,.]00?\s*€\s*par heure/i,                      quoi: 'le tarif inventé de 70 €/h' },
]

function sansCommentaires(texte: string): string {
  return texte
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')
}

const tous = fichiers(SRC)
for (const { motif, quoi } of ABANDONNE) {
  const coupables = tous
    .filter(f => relative('.', f).replace(/\\/g, '/') !== SOURCE)
    .filter(f => motif.test(sansCommentaires(readFileSync(f, 'utf8'))))
    .map(f => relative('.', f).replace(/\\/g, '/'))
  dire(`aucune trace de ${quoi}`, coupables.length === 0, coupables.join(', '))
}

// ── 2. Chaque surface doit lire la source ───────────────────────────────────

const SURFACES: { fichier: string; quoi: string }[] = [
  { fichier: 'src/app/mentions-legales/MentionsLegalesClient.tsx', quoi: 'les CGV' },
  { fichier: 'src/components/VitrineBody.tsx',                     quoi: 'la page d\'accueil' },
  { fichier: 'src/app/reserver/ParcoursEtQuestions.tsx',           quoi: 'la FAQ de /reserver' },
  { fichier: 'src/app/reserver/ReserverClient.tsx',                quoi: 'le formulaire de réservation' },
  { fichier: 'src/lib/blogGenerator.ts',                           quoi: 'les articles de blog' },
  { fichier: 'src/lib/gbpTemplates.ts',                            quoi: 'la fiche Google' },
  { fichier: 'src/lib/devis-client.ts',                            quoi: 'le devis' },
]
for (const { fichier, quoi } of SURFACES) {
  let texte = ''
  try { texte = readFileSync(resolve(fichier), 'utf8') } catch { /* absent */ }
  dire(`${quoi} lit conditions.ts`, /from '@\/lib\/conditions'/.test(texte), fichier)
}

// ── 3. Le calcul doit suivre ce qui est annoncé ─────────────────────────────

dire('annulation 48 h avant : rien',        coutAnnulation(115, 48) === 0)
dire('annulation 24 h pile : rien',         coutAnnulation(115, 24) === 0)
dire('annulation 12 h avant : la moitié',   coutAnnulation(115, 12) === 57.5,
     `obtenu ${coutAnnulation(115, 12)}`)
dire('annulation 4 h pile : la moitié',     coutAnnulation(115, 4) === 57.5)
dire('annulation 2 h avant : la totalité',  coutAnnulation(115, 2) === 115)
dire('attente de 10 min : offerte',         coutAttente(10) === 0)
dire('attente de 15 min : offerte',         coutAttente(15) === 0)
dire('attente de 30 min : 7,50 €',          coutAttente(30) === 7.5, `obtenu ${coutAttente(30)}`)
dire('attente de 90 min : 37,50 €',         coutAttente(90) === 37.5, `obtenu ${coutAttente(90)}`)

// ── 4. Les textes annoncent bien les mêmes seuils ───────────────────────────

for (const [nom, texte] of [['la phrase', ANNULATION_PHRASE], ['la mention', ANNULATION_MENTION],
                            ['le libellé court', ANNULATION_COURTE]] as [string, string][]) {
  dire(`${nom} d'annulation parle de 24 h`, /24\s*h/i.test(texte), texte.slice(0, 70))
}
dire('la phrase et la mention parlent de 4 h',
     /4\s*h/i.test(ANNULATION_PHRASE) && /4\s*h/i.test(ANNULATION_MENTION))
dire('la mention d\'attente annonce 0,50 €', /0,50\s*€/.test(ATTENTE_MENTION), ATTENTE_MENTION.slice(0, 60))
dire('les paliers couvrent gratuit / 50 % / 100 %',
     PALIERS_ANNULATION.some(p => /gratuit/i.test(p.penalite))
     && PALIERS_ANNULATION.some(p => /50\s*%/.test(p.penalite))
     && PALIERS_ANNULATION.some(p => /100\s*%/.test(p.penalite)))

// ── 5. Les pages réellement servies ─────────────────────────────────────────

if (BASE) {
  const PAGES = ['/mentions-legales', '/reserver', '/faq', '/']
  for (const chemin of PAGES) {
    let html = ''
    try {
      const r = await fetch(BASE + chemin, { headers: { 'User-Agent': 'Mozilla/5.0 (contrôle Owise)' } })
      html = await r.text()
    } catch (e) {
      dire(`${chemin} répond`, false, String(e).slice(0, 80)); continue
    }
    const texte = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ')
    dire(`${chemin} n'annonce plus l'ancienne règle`,
         !/gratuite?\s+(tant qu|avant)[^.]{0,25}attribu/i.test(texte),
         'la page servie parle encore d\'attribution du chauffeur')
  }
}

console.log()
if (echecs.length) {
  console.log(`${ok} contrôle(s) réussi(s), ${echecs.length} échec(s) :\n`)
  for (const e of echecs) console.log(`  ✗ ${e}`)
  console.log()
  process.exit(1)
}
console.log(`${ok} contrôle(s) réussi(s), 0 échec(s)\n`)
