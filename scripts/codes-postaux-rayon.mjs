/**
 * Récupère tous les codes postaux dans un rayon donné.
 * Utilise geo.api.gouv.fr (gratuit, sans clé).
 *
 * Usage :
 *   node scripts/codes-postaux-rayon.mjs <lat> <lng> <rayon_km> [departements]
 *
 * Exemples :
 *   node scripts/codes-postaux-rayon.mjs 49.2575 2.4686 15 60,95,02,80
 *   node scripts/codes-postaux-rayon.mjs 48.8566 2.3522 30 75,77,78,91,92,93,94,95
 *   node scripts/codes-postaux-rayon.mjs 49.4431 2.0773 20 60,80
 *
 * Si départements non précisés → déduit automatiquement depuis lat/lng
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const [,, latArg, lngArg, rayonArg, depsArg] = process.argv

if (!latArg || !lngArg || !rayonArg) {
  console.error('Usage: node scripts/codes-postaux-rayon.mjs <lat> <lng> <rayon_km> [depts]')
  console.error('Ex:    node scripts/codes-postaux-rayon.mjs 49.2575 2.4686 15 60,95,02,80')
  process.exit(1)
}

const lat   = parseFloat(latArg)
const lng   = parseFloat(lngArg)
const rayon = parseFloat(rayonArg)

// Haversine distance en km
function dist(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2)**2
    + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

// Déduire les départements à explorer depuis le centre + rayon
// ~1° lat ≈ 111km, ~1° lon ≈ 80km à la latitude de Paris
function depsAutour(lat, lng, rayonKm) {
  const dLat = rayonKm / 111
  const dLon = rayonKm / (111 * Math.cos(lat * Math.PI / 180))
  const found = []
  // Grille des centres de département (approximatif)
  const DEPS_FR = {
    '01':[46.02,5.22],'02':[49.54,3.36],'03':[46.34,3.42],'04':[44.10,6.23],
    '05':[44.66,6.22],'06':[43.93,7.12],'07':[44.80,4.49],'08':[49.77,4.72],
    '09':[42.93,1.55],'10':[48.27,4.08],'11':[43.21,2.36],'12':[44.35,2.57],
    '13':[43.53,5.44],'14':[49.09,-0.36],'15':[45.03,2.55],'16':[45.67,0.16],
    '17':[45.74,-0.63],'18':[47.08,2.40],'19':[45.27,1.88],'21':[47.32,4.83],
    '22':[48.46,-2.76],'23':[46.12,2.00],'24':[45.15,0.72],'25':[47.24,6.02],
    '26':[44.73,5.05],'27':[49.10,1.14],'28':[48.45,1.49],'29':[48.26,-3.83],
    '2A':[41.86,9.01],'2B':[42.37,9.18],'30':[43.88,4.36],'31':[43.60,1.44],
    '32':[43.64,0.59],'33':[44.84,-0.58],'34':[43.61,3.88],'35':[48.11,-1.68],
    '36':[46.81,1.69],'37':[47.39,0.69],'38':[45.18,5.72],'39':[46.67,5.55],
    '40':[44.00,-0.60],'41':[47.59,1.33],'42':[45.75,4.12],'43':[45.04,3.88],
    '44':[47.27,-1.55],'45':[47.90,2.17],'46':[44.62,1.77],'47':[44.35,0.46],
    '48':[44.52,3.50],'49':[47.47,-0.55],'50':[49.11,-1.31],'51':[49.04,4.03],
    '52':[48.11,5.14],'53':[48.07,-0.77],'54':[48.69,6.18],'55':[49.16,5.37],
    '56':[47.84,-2.78],'57':[49.03,6.60],'58':[47.06,3.67],'59':[50.41,3.08],
    '60':[49.41,2.43],'61':[48.43,0.09],'62':[50.51,2.19],'63':[45.77,3.08],
    '64':[43.29,-0.37],'65':[43.11,0.16],'66':[42.70,2.56],'67':[48.57,7.75],
    '68':[47.94,7.34],'69':[45.76,4.83],'70':[47.62,6.15],'71':[46.79,4.55],
    '72':[47.99,0.19],'73':[45.57,6.44],'74':[45.90,6.12],'75':[48.86,2.35],
    '76':[49.64,1.10],'77':[48.63,2.98],'78':[48.80,1.86],'79':[46.65,-0.36],
    '80':[49.90,2.30],'81':[43.85,2.15],'82':[44.02,1.35],'83':[43.46,6.23],
    '84':[43.98,5.05],'85':[46.67,-1.43],'86':[46.58,0.34],'87':[45.84,1.26],
    '88':[48.18,6.45],'89':[47.80,3.57],'90':[47.63,6.85],'91':[48.63,2.44],
    '92':[48.83,2.28],'93':[48.91,2.48],'94':[48.78,2.46],'95':[49.05,2.11],
  }
  for (const [code, [dLat2, dLon2]] of Object.entries(DEPS_FR)) {
    if (dist(lat, lng, dLat2, dLon2) <= rayonKm + 50) found.push(code)
  }
  return found
}

const depsToSearch = depsArg
  ? depsArg.split(',').map(d => d.trim())
  : depsAutour(lat, lng, rayon)

console.log(`\n📍 Centre : ${lat}, ${lng} — Rayon : ${rayon} km`)
console.log(`📂 Départements explorés : ${depsToSearch.join(', ')}\n`)

// Récupérer toutes les communes des départements concernés
const allCommunes = []
for (const dep of depsToSearch) {
  process.stdout.write(`  Département ${dep}... `)
  try {
    const r = await fetch(
      `https://geo.api.gouv.fr/communes?codeDepartement=${dep}&fields=nom,codesPostaux,centre&limit=2000`
    )
    const data = await r.json()
    if (Array.isArray(data)) {
      allCommunes.push(...data)
      console.log(`${data.length} communes`)
    }
  } catch (e) {
    console.log(`erreur: ${e.message}`)
  }
}

console.log(`\n  Total chargé : ${allCommunes.length} communes\n`)

// Filtrer par distance réelle
const communes = allCommunes
  .map(c => {
    const [cLng, cLat] = c.centre?.coordinates ?? [lng, lat]
    return { ...c, km: dist(lat, lng, cLat, cLng) }
  })
  .filter(c => c.km <= rayon)
  .sort((a, b) => a.km - b.km)

// Codes postaux uniques triés
const cps = [...new Set(communes.flatMap(c => c.codesPostaux ?? []))].sort()

// Affichage
console.log(`✅ ${communes.length} communes dans le rayon — ${cps.length} codes postaux\n`)

console.log('━━━ Communes ━━━')
for (const c of communes) {
  const cp = (c.codesPostaux ?? []).join(', ')
  console.log(`  ${String(c.km.toFixed(1)).padStart(5)} km  ${c.nom.padEnd(32)} ${cp}`)
}

console.log('\n━━━ Codes postaux (copier dans Préfixes de la zone) ━━━')
console.log(cps.join(', '))

console.log('\n━━━ Format PostgreSQL array ━━━')
console.log('{' + cps.join(',') + '}')
