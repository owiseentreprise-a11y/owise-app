/**
 * POST /api/contacts-clics — un clic vers le téléphone, le WhatsApp ou
 * l'e-mail d'Owise. Voir src/lib/contact-clic.ts.
 *
 * Route publique : rien de ce qu'elle reçoit n'est cru sur parole. Le type est
 * revérifié, le canal est recalculé ici depuis le référent (une seule écriture
 * de la règle, comme pour les estimations), l'appareil est lu dans l'en-tête
 * du navigateur, chaque texte est borné. L'adresse IP sert au seul plafond de
 * fréquence, en mémoire, et n'est jamais enregistrée.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { canalDepuisReferent } from '@/lib/origine-visite'
import { estUnRobot } from '@/lib/robot'
import { appareilDepuisUA, estPageInterne, type TypeContact } from '@/lib/contact-clic'
import { generaliserLieu } from '@/lib/estimation-anonyme'

const hits = new Map<string, { count: number; reset: number }>()
const LIMITE = 20, FENETRE = 60
function tropDeClics(ip: string): boolean {
  const now = Math.floor(Date.now() / 1000)
  const e = hits.get(ip)
  if (!e || e.reset <= now) { hits.set(ip, { count: 1, reset: now + FENETRE }); return false }
  return ++e.count > LIMITE
}

const TYPES: TypeContact[] = ['telephone', 'whatsapp', 'email']
const texte = (v: unknown, max: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim()
  return s ? s.slice(0, max) : null
}
const entier = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.round(v))) : null

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'inconnue'
  if (tropDeClics(ip)) return NextResponse.json({ error: 'rate_limited' }, { status: 429 })
  const ua = req.headers.get('user-agent')
  // Un robot ne réserve pas. On répond normalement, sans rien écrire.
  if (estUnRobot(ua)) return NextResponse.json({ ok: true, mesure: 'ignoree' }, { status: 202 })

  let b: Record<string, unknown>
  try {
    const j = await req.json()
    if (typeof j !== 'object' || j === null) throw new Error()
    b = j as Record<string, unknown>
  } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }) }

  const type = TYPES.find(t => t === b.type)
  const page = texte(b.page, 200)
  if (!type || !page) return NextResponse.json({ error: 'missing_fields' }, { status: 400 })
  if (estPageInterne(page)) return NextResponse.json({ ok: true, mesure: 'ignoree' }, { status: 202 })

  const parcours = Array.isArray(b.parcours) ? b.parcours.filter((x): x is string => typeof x === 'string').slice(-10).map(x => x.slice(0, 120)) : []

  /* Le dernier prix vu : lieux re-généralisés ici aussi (zone + commune,
     jamais la rue), au cas où un ancien onglet ou un script enverrait plus. */
  let estimation: Record<string, unknown> | null = null
  const e = b.derniere_estimation
  if (e && typeof e === 'object') {
    const x = e as Record<string, unknown>
    const dep = texte(x.depart, 200), arr = texte(x.arrivee, 200)
    if (dep && arr) estimation = {
      depart: generaliserLieu(dep), arrivee: generaliserLieu(arr),
      vehicule: texte(x.vehicule, 30), prix: entier(x.prix, 0, 100000), il_y_a_s: entier(x.il_y_a_s, 0, 86400 * 7),
    }
  }

  const referent = texte(b.referent, 300)
  const utmSource = texte(b.utm_source, 80)
  const sb = createAdminClient()
  const { error } = await sb.from('contacts_clics').insert({
    type,
    emplacement: texte(b.emplacement, 80),
    page,
    premiere_page: texte(b.premiere_page, 200),
    parcours,
    secondes_avant_clic: entier(b.secondes_avant_clic, 0, 86400 * 7),
    derniere_estimation: estimation,
    canal: canalDepuisReferent(referent, utmSource, texte(b.gclid, 120)),
    referent,
    utm_source: utmSource,
    utm_campaign: texte(b.utm_campaign, 120),
    appareil: appareilDepuisUA(ua),
    langue: texte(b.langue, 2),
    largeur_ecran: entier(b.largeur_ecran, 0, 10000),
  })
  if (error) {
    // Visible dans les journaux Vercel ; le visiteur, lui, n'est pas gêné.
    console.error('[contacts_clics] écriture refusée :', error.message)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
