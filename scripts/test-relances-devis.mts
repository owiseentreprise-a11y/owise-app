/**
 * test-relances-devis.mts — LES RELANCES ET LES ANNONCES AU CHAUFFEUR
 * VONT-ELLES AUX BONNES PERSONNES ?
 *
 * Défauts du 2026-11-19 (voir src/lib/relances-devis.ts et
 * src/lib/notifications-chauffeur.ts) :
 *   · une cliente relancée EN DOUBLE, et relancée alors qu'elle avait réservé ;
 *   · un chauffeur prévenu d'une « nouvelle course » qui avait eu lieu 2 semaines plus tôt.
 *
 * LECTURE SEULE : la base est lue pour rejouer le cas réel, rien n'est écrit,
 * aucun e-mail n'est envoyé.
 *
 *   npx tsx scripts/test-relances-devis.mts
 */
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { createClient } from '@supabase/supabase-js'
import { trierRelances, type Reservation } from '../src/lib/relances-devis'
import { courseAAnnoncerAuChauffeur } from '../src/lib/notifications-chauffeur'

let ok = 0, ko = 0
const V = '\x1b[32m', R = '\x1b[31m', B = '\x1b[1m', Z = '\x1b[0m'
const verifier = (c: boolean, m: string) => { if (c) { ok++; console.log(`${V}✓${Z} ${m}`) } else { ko++; console.log(`${R}✗ ${m}${Z}`) } }

console.log(`${B}Relances de devis — cas fabriqués${Z}`)
const d = (id: string, email: string | null, tel: string | null, created_at: string) => ({ id, email, tel, created_at })
{
  const t = trierRelances([d('a', 'Marie@x.fr', null, '2026-11-11T08:57:00+00:00'), d('b', 'marie@x.fr ', null, '2026-11-11T09:01:00+00:00')], [])
  verifier(t.aRelancer.length === 1 && t.aRelancer[0].id === 'b' && t.doublons.map(x => x.id).join() === 'a',
    'deux demandes de la même adresse → une seule relance, la plus récente')
}
{
  const t = trierRelances([d('a', 'p@x.fr', null, '2026-11-11T09:00:00+00:00')], [{ devis_id: 'a', email: null, created_at: '2026-11-13T14:00:00+00:00' }])
  verifier(t.aRelancer.length === 0 && t.dejaReservees.length === 1, 'demande convertie en course (lien devis_id) → plus de relance')
}
{
  const t = trierRelances([d('a', 'p@x.fr', null, '2026-11-11T09:00:00+00:00')], [{ devis_id: null, email: 'P@X.fr', created_at: '2026-11-13T14:00:00+00:00' }])
  verifier(t.dejaReservees.length === 1, 'réservation depuis, même e-mail (majuscules) → plus de relance')
}
{
  const t = trierRelances([d('a', 'p@x.fr', '06 12 34 56 78', '2026-11-11T09:00:00+00:00')], [{ devis_id: null, email: null, tel: '+33612345678', created_at: '2026-11-13T14:00:00+00:00' }])
  verifier(t.dejaReservees.length === 1, 'réservation depuis, même téléphone sous une autre écriture → plus de relance')
}
{
  const t = trierRelances([d('a', 'p@x.fr', null, '2026-11-11T09:00:00+00:00')], [{ devis_id: null, email: 'p@x.fr', created_at: '2026-11-01T09:00:00+00:00' }])
  verifier(t.aRelancer.length === 1, 'réservation ANTÉRIEURE à la demande → la nouvelle demande se relance normalement')
}
{
  const t = trierRelances([d('a', 'p@x.fr', null, '2026-11-11T09:00:00+00:00')], [{ devis_id: null, email: 'autre@x.fr', tel: null, created_at: '2026-11-13T09:00:00+00:00' }])
  verifier(t.aRelancer.length === 1, 'une autre personne a réservé → la demande se relance')
}
{
  const t = trierRelances([d('a', 'p@x.fr', null, '2026-11-11T09:00:00+00:00')], [{ devis_id: null, email: null, tel: null, created_at: '2026-11-13T09:00:00+00:00' }])
  verifier(t.aRelancer.length === 1, 'une réservation sans e-mail ni téléphone ne « reconnaît » personne')
}

console.log(`\n${B}Relances de devis — le cas réel du 18/11, rejoué depuis la base${Z}`)
{
  const env: Record<string, string> = {}
  for (const l of readFileSync(resolve('.env.local'), 'utf8').split('\n')) { const i = l.indexOf('='); if (i > 0) env[l.slice(0, i).trim()] = l.slice(i + 1).trim().replace(/^["'](.*)["']$/, '$1') }
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data: demandes } = await sb.from('devis').select('id, created_at, email, tel').ilike('email', 'ico%').order('created_at')
  const { data: courses } = await sb.from('courses').select('devis_id, created_at, passager_email, passager_tel').gte('created_at', '2026-11-11T00:00:00+00:00')
  const reservations: Reservation[] = (courses ?? []).map(c => ({ devis_id: c.devis_id, email: c.passager_email, tel: c.passager_tel, created_at: c.created_at }))
  verifier((demandes ?? []).length === 2, `les deux demandes de la cliente sont en base (${(demandes ?? []).length})`)
  const t = trierRelances(demandes ?? [], reservations)
  verifier(t.dejaReservees.length === 2 && t.aRelancer.length === 0,
    `ses deux demandes sont reconnues comme ayant abouti — aucune relance (${t.aRelancer.length} relance(s))`)
}

console.log(`\n${B}Annonce d'une course au chauffeur${Z}`)
const maintenant = new Date('2026-11-19T10:00:00+01:00')
verifier(!courseAAnnoncerAuChauffeur({ statut: 'en_attente', date_prevue: '2026-11-05T14:45:00+00:00' }, maintenant), 'course du 5/11 affectée le 19/11 → rien n’est annoncé')
verifier(!courseAAnnoncerAuChauffeur({ statut: 'terminee', date_prevue: '2026-11-30T10:00:00+00:00' }, maintenant), 'course terminée → rien n’est annoncé')
verifier(!courseAAnnoncerAuChauffeur({ statut: 'annulee', date_prevue: '2026-11-30T10:00:00+00:00' }, maintenant), 'course annulée → rien n’est annoncé')
verifier(courseAAnnoncerAuChauffeur({ statut: 'en_attente', date_prevue: '2026-11-20T06:00:00+00:00' }, maintenant), 'course de demain → annoncée')
verifier(courseAAnnoncerAuChauffeur({ statut: 'acceptee', date_prevue: '2026-11-19T08:30:00+00:00' }, maintenant), 'course partie il y a 30 min (dans la marge de 2 h) → annoncée')
verifier(!courseAAnnoncerAuChauffeur({ statut: 'en_attente', date_prevue: '2026-11-19T06:00:00+00:00' }, maintenant), 'course partie il y a 3 h → rien n’est annoncé')
verifier(courseAAnnoncerAuChauffeur({ statut: 'en_attente', date_prevue: '2026-11-19T10:30' }, maintenant), 'date-heure SANS fuseau lue comme une heure de Paris (10:30 > 10:00) → annoncée')

console.log(`\n${B}Les règles sont bien branchées${Z}`)
const lire = (f: string) => readFileSync(resolve(f), 'utf8')
verifier(/trierRelances\(/.test(lire('src/app/api/cron/relance-devis/route.ts')), 'la relance automatique passe par trierRelances()')
verifier(/if \(course && chauffeurEmail && courseAAnnoncerAuChauffeur\(course\)\)/.test(lire('src/app/admin/courses/[id]/actions.ts')), 'l’affectation d’un chauffeur passe par courseAAnnoncerAuChauffeur()')
verifier(/if \(chauffeur_id && !sous_traitant_id && !deja_effectuee\)/.test(lire('src/app/admin/courses/nouvelle/actions.ts')), 'la création d’une course déjà effectuée ne prévient pas le chauffeur')

console.log(`\n${ko ? R : V}${B}${ok} contrôle(s) réussi(s), ${ko} échec(s)${Z}`)
process.exit(ko ? 1 : 0)
