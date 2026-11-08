import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generaliserLieu } from '@/lib/estimation-anonyme'
import { canalDepuisReferent } from '@/lib/origine-visite'

const hits = new Map<string, { count: number; reset: number }>()
const LIMIT  = 10
const WINDOW = 60

function isRateLimited(ip: string): boolean {
  const now = Math.floor(Date.now() / 1000)
  const entry = hits.get(ip)
  if (!entry || entry.reset <= now) {
    hits.set(ip, { count: 1, reset: now + WINDOW })
    return false
  }
  entry.count++
  return entry.count > LIMIT
}

const VEHICULES_VALIDES = ['berline', 'berline_premium', 'van', 'grand_van']

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  }

  const {
    adresse_depart, adresse_arrivee, vehicule, prix, source,
    adresse_depart_saisie, adresse_arrivee_saisie,
    page, referent, utm_source, utm_campaign, gclid,
  } = body as Record<string, unknown>

  if (typeof adresse_depart !== 'string' || typeof adresse_arrivee !== 'string') {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  }

  const dep = adresse_depart.trim().slice(0, 500)
  const arr = adresse_arrivee.trim().slice(0, 500)

  if (dep.length < 3 || arr.length < 3) {
    return NextResponse.json({ error: 'too_short' }, { status: 400 })
  }

  const prixNum = typeof prix === 'number' && isFinite(prix) && prix >= 0 ? Math.round(prix) : null
  const vehiculeVal = typeof vehicule === 'string' && VEHICULES_VALIDES.includes(vehicule) ? vehicule : null
  const sourceVal = source === 'reservation' ? 'reservation' : 'vitrine'

  /* Filet. Les deux appelants généralisent déjà le lieu avant l'envoi
     (zone tarifaire + commune, jamais le numéro ni la rue), mais cette route
     est publique : un ancien onglet resté ouvert, un script tiers ou une
     régression future peuvent encore poster une adresse complète. On ne fait
     donc pas confiance à l'entrée. `generaliserLieu` est idempotente : elle
     laisse intacte une valeur déjà généralisée. */
  const depPropre = generaliserLieu(dep)
  const arrPropre = generaliserLieu(arr)

  /* ── Le détail du visiteur ────────────────────────────────────────────
     Décision de l'exploitant du 2026-11-09, prise après que la contrepartie
     lui a été exposée : il a besoin de l'adresse exacte pour auditer ses prix
     et comprendre la demande.

     Ce détail vit dans des colonnes SÉPARÉES. `adresse_depart` et
     `adresse_arrivee` restent généralisées et restent la source des agrégats :
     rien de ce qui existait ne change de sens, et un retour en arrière se
     limite à vider ces colonnes-ci.

     Le canal est recalculé ICI à partir du référent, jamais repris du
     navigateur : une seule écriture de la règle, et une valeur fabriquée par
     un script tiers ne peut pas fausser les comptages. */
  const texte = (v: unknown, max: number): string | null => {
    if (typeof v !== 'string') return null
    const s = v.trim()
    return s ? s.slice(0, max) : null
  }

  const referentVal = texte(referent, 300)
  const utmSourceVal = texte(utm_source, 80)
  const canalVal = canalDepuisReferent(referentVal, utmSourceVal, texte(gclid, 120))

  const supabase = createAdminClient()
  const { error } = await supabase.from('estimations').insert({
    adresse_depart:  depPropre,
    adresse_arrivee: arrPropre,
    vehicule:        vehiculeVal,
    prix:            prixNum,
    source:          sourceVal,
    adresse_depart_saisie:  texte(adresse_depart_saisie, 300),
    adresse_arrivee_saisie: texte(adresse_arrivee_saisie, 300),
    page:         texte(page, 200),
    canal:        canalVal,
    referent:     referentVal,
    utm_source:   utmSourceVal,
    utm_campaign: texte(utm_campaign, 120),
  })

  /* L'écriture n'était pas vérifiée. Une colonne manquante, une contrainte,
     une panne : la route répondait 201 et la ligne n'existait pas. On l'a déjà
     payé ailleurs — une contrainte CHECK avait cassé les réservations du Grand
     Van sans que rien ne le dise. On ne change pas la réponse faite au
     visiteur (une estimation ratée ne doit pas gêner son parcours), mais
     l'échec laisse désormais une trace lisible dans les journaux Vercel. */
  if (error) {
    console.error('[estimations] écriture refusée :', error.message)
    return NextResponse.json({ ok: false, erreur: 'non_enregistree' }, { status: 202 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
