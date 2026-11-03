/**
 * Les prix que le site DOIT afficher, calcules depuis la vraie base.
 *
 * Ecrit un fichier JSON que `essai-en-ligne.mjs` relit pour piloter le
 * navigateur. Deux etapes, parce que `puppeteer-core` ne se resout que depuis
 * c:/websitebuilding alors que `calcPrix.ts` vit ici.
 *
 * Aucune valeur n'est ecrite a la main : zones, grille, tarifs et parametres
 * sont lus en base, et les prix passent par `calcPrix.ts` — le meme code que
 * le site. Un trajet absent de la grille est signale plutot que devine.
 *
 *   npx tsx scripts/attendus-en-ligne.mts <fichier.json>
 */
import { readFileSync, writeFileSync } from 'fs'
import { join, resolve } from 'path'

for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createAdminClient } = await import('../src/lib/supabase/admin')
const { chargerTarification } = await import('../src/lib/tarification')
const { calculerPrix } = await import('../src/lib/calcPrix')
const { GAMME, vehiculesPour } = await import('../src/lib/gamme')

const sortie = resolve(process.argv[2] ?? 'attendus-en-ligne.json')

/* Un vendredi apres-midi : hors majoration de nuit comme de week-end, pour que
   l'ecart mesure ne vienne que du vehicule et de la liaison. */
const QUAND = '2026-11-20T14:00:00.000Z'
const DATE_SAISIE = '2026-11-20'
const HEURE_SAISIE = '14:00'

const sb = createAdminClient()
const { zones, grille, tarifs, params } = await chargerTarification(sb)

/* Les trajets eprouves : une adresse REELLE par zone de depart, telle qu'un
   client la taperait, et la zone correspondante pour retrouver le forfait. */
const TRAJETS = [
  { nom: 'Chantilly → CDG',  depart: '1 Avenue du Maréchal Joffre, 60500 Chantilly',   codeDep: 'CHA', arrivee: 'Aéroport Paris-Charles de Gaulle', codeArr: 'CDG' },
  { nom: 'Compiègne → CDG',  depart: "1 Place de l'Hôtel de Ville, 60200 Compiègne",   codeDep: 'COM', arrivee: 'Aéroport Paris-Charles de Gaulle', codeArr: 'CDG' },
  { nom: 'Creil → Orly',     depart: '1 Place François Mitterrand, 60100 Creil',        codeDep: 'CRL', arrivee: 'Aéroport Paris-Orly',             codeArr: 'ORY' },
  { nom: 'Senlis → CDG',     depart: '1 Place Henri IV, 60300 Senlis',                  codeDep: 'SEN', arrivee: 'Aéroport Paris-Charles de Gaulle', codeArr: 'CDG' },
]

const parCode = new Map(zones.map(z => [z.code, z]))
const cas: unknown[] = []
const manquants: string[] = []

for (const t of TRAJETS) {
  const zDep = parCode.get(t.codeDep)
  const zArr = parCode.get(t.codeArr)
  if (!zDep || !zArr) { manquants.push(`${t.nom} : zone ${!zDep ? t.codeDep : t.codeArr} absente`); continue }

  const prix: Record<string, number | null> = {}
  for (const v of GAMME) {
    const p = calculerPrix(zDep.id, zArr.id, v.cle, QUAND, grille, tarifs, zones, params)
    prix[v.cle] = p === null ? null : Math.round(p)
  }
  if (prix.berline === null) { manquants.push(`${t.nom} : aucun forfait dans la grille`); continue }

  cas.push({
    ...t, date: DATE_SAISIE, heure: HEURE_SAISIE, prix,
    /* Les vehicules proposes a 1, 5 et 8 passagers — c'est ce que le
       simulateur doit montrer, et rien d'autre. */
    proposes: {
      1: vehiculesPour(1).map(v => ({ cle: v.cle, nom: v.nom })),
      5: vehiculesPour(5).map(v => ({ cle: v.cle, nom: v.nom })),
      8: vehiculesPour(8).map(v => ({ cle: v.cle, nom: v.nom })),
    },
  })
}

const attendus = {
  genere: new Date().toISOString(),
  /* La regle du Grand Van, pour que le test la verifie au lieu de la supposer. */
  regleGrandVan: { surForfait: 20, surKm: 0.10 },
  libelles: GAMME.map(v => ({ cle: v.cle, nom: v.nom, surDevis: v.surDevis })),
  /* Orthographes qui ne doivent plus apparaitre nulle part sur le site.
     Le point final est indispensable : « Grand Van 8 pl » sans point est le
     PREFIXE de « Grand Van 8 places », le nom correct. Sans lui, le controle
     en ligne signalait six fautes imaginaires. */
  orthographesInterdites: ['Grand Van 8 pl.', 'Van 7 pl.'],
  /* Les coefficients, sous le NOM DE LEUR COLONNE : c'est ce nom que porte le
     champ de /admin/tarifs, et c'est par la qu'on le retrouve. */
  coefficients: {
    coef_berline_premium: Number(params?.coef_berline_premium),
    coef_van: Number(params?.coef_van),
  },
  cas, manquants,
}

writeFileSync(sortie, JSON.stringify(attendus, null, 2), 'utf8')
console.log(`\n${cas.length} trajet(s) attendus écrits dans ${sortie}`)
for (const c of cas as { nom: string; prix: Record<string, number | null> }[]) {
  console.log(`  ${c.nom.padEnd(20)} ` + GAMME.map(v => `${v.nom} ${c.prix[v.cle] ?? '—'} €`).join(' · '))
}
if (manquants.length) {
  console.log(`\n\x1b[33m${manquants.length} trajet(s) écarté(s) :\x1b[0m`)
  for (const m of manquants) console.log(`  · ${m}`)
}
console.log()
