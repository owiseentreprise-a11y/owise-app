/**
 * test-consentement-ads.mts — étape 90.
 *
 * Une conversion publicitaire part-elle encore sans accord explicite ?
 *
 * ── Aucune donnée ne sort ────────────────────────────────────────────────
 * `globalThis.fetch` est remplacé par un enregistreur avant le chargement du
 * module : toute tentative de sortie est notée et rendue inerte. Aucun appel
 * n'atteint Google, aucun compte réel n'est touché.
 *
 * ── Un piège évité ───────────────────────────────────────────────────────
 * Le module abandonne tout de suite si les variables GOOGLE_ADS_* manquent.
 * Sans les renseigner, les quatre cas passeraient au vert pour la mauvaise
 * raison — le garde-fou ne serait même pas atteint. On pose donc des valeurs
 * factices AVANT l'import, et le cas « accepted » sert de témoin : il doit
 * aller jusqu'à la demande de jeton.
 *
 * Lancer depuis owise-app :  npx tsx scripts/test-consentement-ads.mts
 */

process.env.GOOGLE_ADS_CLIENT_ID            = 'factice-client-id'
process.env.GOOGLE_ADS_CLIENT_SECRET        = 'factice-secret'
process.env.GOOGLE_ADS_REFRESH_TOKEN        = 'factice-refresh'
process.env.GOOGLE_ADS_CUSTOMER_ID          = '0000000000'
process.env.GOOGLE_ADS_CONVERSION_ACTION_ID = '0000000000'

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ko = 0, n = 0

/* ── L'enregistreur ─────────────────────────────────────────────────────── */
let sorties: string[] = []
globalThis.fetch = (async (entree: unknown) => {
  const url = typeof entree === 'string' ? entree : String((entree as { url?: string })?.url ?? entree)
  sorties.push(url)
  /* Réponse inerte : le module s'arrêtera de lui-même. */
  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } })
}) as typeof fetch

const { uploadGoogleAdsConversion } = await import('../src/lib/googleAdsConversion')

function verifier(titre: string, cond: boolean, detail = '') {
  n++
  if (!cond) ko++
  console.log(`  ${cond ? V + '✓' : R + '✗'} ${titre}${Z}${detail ? `  ${G}${detail}${Z}` : ''}`)
}

async function essai(consent: 'accepted' | 'refused' | 'unknown' | undefined) {
  sorties = []
  await uploadGoogleAdsConversion({
    gclid: 'FACTICE_gclid_de_test',
    value: 59,
    currency: 'EUR',
    conversionDateTime: new Date('2026-10-22T10:00:00Z'),
    orderId: 'test-90',
    consent,
  })
  return sorties
}

console.log(`\n${B}Conversion Google Ads et consentement${Z}\n`)

const refus = await essai('refused')
verifier('refus explicite : aucune sortie réseau', refus.length === 0, refus.join(' | ') || 'aucune')

const inconnu = await essai('unknown')
verifier('consentement inconnu : aucune sortie réseau', inconnu.length === 0, inconnu.join(' | ') || 'aucune')

const absent = await essai(undefined)
verifier('consentement absent : aucune sortie réseau', absent.length === 0, absent.join(' | ') || 'aucune')

const accepte = await essai('accepted')
verifier('acceptation : la remontée reprend son cours',
  accepte.some(u => u.includes('oauth2.googleapis.com')),
  accepte.join(' | ') || 'aucune')

/* Témoin : sans ce contrôle, un garde-fou trop large passerait inaperçu. */
verifier('le témoin prouve que le garde-fou est bien la cause des trois refus',
  accepte.length > 0 && refus.length === 0,
  `accepté ${accepte.length} sortie(s) · refusé ${refus.length}`)

console.log(`\n${'─'.repeat(58)}`)
console.log(ko ? `${R}${B}${ko} échec(s) sur ${n}.${Z}\n` : `${V}${B}${n} contrôles au vert.${Z}\n`)
process.exit(ko ? 1 : 0)
