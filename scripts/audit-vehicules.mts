/**
 * Audit de la gamme de véhicules : capacités, tarifs, cohérence des surfaces.
 *
 * Écrit le 2026-11-03 à la demande de l'exploitant, qui observait que « le van
 * 8 places est parfois moins cher que celui de 7 places ». Ce script mesure au
 * lieu de supposer : il calcule les quatre prix sur TOUTES les liaisons de la
 * grille et liste les incohérences.
 *
 *   npx tsx scripts/audit-vehicules.mts
 */
import { readFileSync } from 'fs'
import { join } from 'path'

for (const l of readFileSync(join(process.cwd(), '.env.local'), 'utf8').split('\n')) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const { createAdminClient } = await import('../src/lib/supabase/admin')
const { calculerPrix, calculerPrixKm, VEHICULE_NOM, NOM_VERS_CLE } = await import('../src/lib/calcPrix')
const { vehiculeParCle } = await import('../src/lib/gamme')
/* Le nom de la LIGNE DE TARIF, qui n'est pas toujours le nom du vehicule : le
   grand van derive de la ligne du van 7 places. Sans cette distinction,
   l'audit annoncait « aucune ligne dans tarifs » et « repli code en dur »
   pour un vehicule qui est en realite correctement chiffre. */
const ligneTarif = (cle: string) => vehiculeParCle(cle)?.nomTarif ?? VEHICULE_NOM[cle]
const { formaterMontant } = await import('../src/lib/montant')
const { VEHICULES_BASE } = await import('../src/lib/vehicule')

const sb = createAdminClient()
const [{ data: zones }, { data: grille }, { data: tarifs }, { data: params }] = await Promise.all([
  sb.from('zones').select('id, nom, code, type, prefixes_postaux').eq('actif', true),
  sb.from('grilles_tarifaires').select('zone_depart_id, zone_arrivee_id, prix_berline'),
  sb.from('tarifs').select('*'),
  sb.from('parametres').select('*').eq('id', true).single(),
])

const nomZone = new Map((zones ?? []).map(z => [z.id, z.nom]))
const QUAND = '2026-11-20T14:00:00.000Z'   // un vendredi apres-midi, hors majorations

/* Les quatre categories telles que le CLIENT les voit. */
const GAMME = [
  { cle: 'berline',         libelle: 'Berline' },
  { cle: 'berline_premium', libelle: 'Berline Premium' },
  { cle: 'van',             libelle: 'Van 7 places' },
  { cle: 'grand_van',       libelle: 'Grand Van 8 places' },
]

console.log('\n\x1b[1mAUDIT DE LA GAMME DE VÉHICULES\x1b[0m')
console.log(`${(zones ?? []).length} zones · ${(grille ?? []).length} liaisons · ${(tarifs ?? []).length} lignes de tarif\n`)

// ── 1. La table des tarifs couvre-t-elle la gamme ? ────────────────────────
console.log('\x1b[1m1. Couverture de la table « tarifs »\x1b[0m')
for (const v of GAMME) {
  const nom = ligneTarif(v.cle)
  const ligne = (tarifs ?? []).find(t => t.vehicule === nom)
  const derive = nom !== VEHICULE_NOM[v.cle] ? `  (dérivé de « ${nom} »)` : ''
  const etat = !nom ? '\x1b[31mabsent de la gamme\x1b[0m'
             : !ligne ? '\x1b[31maucune ligne dans « tarifs »\x1b[0m'
             : `prise en charge ${formaterMontant(Number(ligne.prise_en_charge))} · ${formaterMontant(Number(ligne.prix_km))}/km${derive}`
  console.log(`   ${v.libelle.padEnd(20)} ${etat}`)
}

// ── 2. L'enum de la base ───────────────────────────────────────────────────
console.log('\n\x1b[1m2. Valeurs acceptées par la base\x1b[0m')
console.log('   ' + VEHICULES_BASE.join(' · '))
console.log('   NOM_VERS_CLE : ' + Object.entries(NOM_VERS_CLE).map(([a, b]) => `${a}→${b}`).join(' · '))

// ── 3. Le prix de chaque véhicule sur chaque liaison ───────────────────────
console.log('\n\x1b[1m3. Prix par liaison — anomalies\x1b[0m')

type Anomalie = { liaison: string; detail: string }
const moinsCherQueVan: Anomalie[] = []
const egalBerline: Anomalie[] = []
let liaisons = 0

for (const g of grille ?? []) {
  const dep = nomZone.get(g.zone_depart_id) ?? '?'
  const arr = nomZone.get(g.zone_arrivee_id) ?? '?'
  const liaison = `${dep} → ${arr}`
  liaisons++

  const prix: Record<string, number | null> = {}
  for (const v of GAMME) {
    prix[v.cle] = calculerPrix(
      g.zone_depart_id, g.zone_arrivee_id, v.cle, QUAND,
      grille as never, tarifs as never, zones as never, params as never)
  }

  const b = prix.berline, van = prix.van, gv = prix.grand_van
  if (b != null && gv != null && gv === b) {
    egalBerline.push({ liaison, detail: `${formaterMontant(gv)} — identique à la berline` })
  }
  if (van != null && gv != null && gv < van) {
    moinsCherQueVan.push({
      liaison,
      detail: `Grand Van ${formaterMontant(gv)} < Van 7 ${formaterMontant(van)} — écart ${formaterMontant(van - gv)}`,
    })
  }
}

console.log(`   Grand Van au MÊME prix que la berline : \x1b[31m${egalBerline.length}\x1b[0m liaison(s) sur ${liaisons}`)
console.log(`   Grand Van MOINS CHER que le Van 7     : \x1b[31m${moinsCherQueVan.length}\x1b[0m liaison(s) sur ${liaisons}`)
for (const a of moinsCherQueVan.slice(0, 8)) console.log(`     · ${a.liaison.padEnd(46)} ${a.detail}`)
if (moinsCherQueVan.length > 8) console.log(`     … et ${moinsCherQueVan.length - 8} autres`)

// ── 4. Le prix au kilomètre, hors grille ───────────────────────────────────
console.log('\n\x1b[1m4. Prix au kilomètre (hors grille) — 50 km\x1b[0m')
for (const v of GAMME) {
  const p = calculerPrixKm(50, v.cle, QUAND, tarifs as never, params as never)
  const ligne = (tarifs ?? []).find(t => t.vehicule === ligneTarif(v.cle))
  const note = ligne ? '' : '  \x1b[31m← repli codé en dur : 15 € + 2 €/km\x1b[0m'
  console.log(`   ${v.libelle.padEnd(20)} ${p == null ? '—' : formaterMontant(p).padStart(10)}${note}`)
}

// ── 5. Exemple parlant : une liaison réelle ────────────────────────────────
const exemple = (grille ?? []).find(g =>
  (nomZone.get(g.zone_depart_id) ?? '').toLowerCase().includes('compi')
  && (nomZone.get(g.zone_arrivee_id) ?? '').toLowerCase().includes('cdg'))
if (exemple) {
  console.log(`\n\x1b[1m5. Exemple — ${nomZone.get(exemple.zone_depart_id)} → ${nomZone.get(exemple.zone_arrivee_id)}\x1b[0m`)
  for (const v of GAMME) {
    const p = calculerPrix(exemple.zone_depart_id, exemple.zone_arrivee_id, v.cle, QUAND,
                           grille as never, tarifs as never, zones as never, params as never)
    console.log(`   ${v.libelle.padEnd(20)} ${p == null ? '—' : formaterMontant(p).padStart(10)}`)
  }
}

console.log()
