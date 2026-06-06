import { createAdminClient } from '@/lib/supabase/admin'
import StatsClient from './StatsClient'

export const dynamic = 'force-dynamic'

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

// Détection géographique d'une adresse
function detectGeo(adresse: string): string {
  const a = adresse.toLowerCase()
  if (/charles de gaulle|roissy|\bcdg\b/.test(a)) return 'CDG'
  if (/\borly\b/.test(a))                          return 'Orly'
  if (/beauvais/.test(a))                           return 'Beauvais'
  if (/\bparis\b|75\d{3}/.test(a))                 return 'Paris'
  if (/\b60\d{3}\b/.test(a))                       return 'Oise'
  if (/gare/.test(a))                               return 'Gare'
  return 'Autre'
}

export default async function StatsPage() {
  const supabase = createAdminClient()
  const now = new Date()

  const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [coursesRes, chauffeursRes, clientsRes, newClientsRes] = await Promise.all([
    supabase
      .from('courses')
      .select('statut, date_prevue, prix_final, prix_estime, type_vehicule, chauffeur_id, client_id, adresse_depart, adresse_arrivee, chauffeurs(profiles(prenom, nom)), clients(type_compte, entreprise_nom, profiles(prenom, nom))')
      .gte('date_prevue', twelveMonthsAgo.toISOString())
      .order('date_prevue', { ascending: true }),
    supabase
      .from('chauffeurs')
      .select('id, note_moyenne, profiles(prenom, nom)')
      .order('created_at'),
    supabase
      .from('clients')
      .select('id, type_compte, entreprise_nom, created_at, profiles(prenom, nom)')
      .order('created_at'),
    supabase
      .from('clients')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', currentMonthStart.toISOString()),
  ])

  const courses   = coursesRes.data ?? []
  const terminées = courses.filter(c => c.statut === 'terminee')
  const annulées  = courses.filter(c => c.statut === 'annulee')

  // ── Agrégation 12 mois ──
  const months12 = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1)
    const y = d.getFullYear(); const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const mTerm = terminées.filter(c => c.date_prevue.startsWith(key))
    const mAnn  = annulées.filter(c => c.date_prevue.startsWith(key))
    const ca    = mTerm.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
    return {
      key, label: monthLabel(y, m),
      count: mTerm.length, ca,
      annulees: mAnn.length,
      panierMoyen: mTerm.length > 0 ? ca / mTerm.length : 0,
    }
  })

  // ── Top chauffeurs ──
  const chStats: Record<string, { nom: string; count: number; ca: number }> = {}
  for (const c of terminées) {
    if (!c.chauffeur_id) continue
    const ch = (c as any).chauffeurs
    const nom = ch?.profiles ? `${ch.profiles.prenom} ${ch.profiles.nom}` : 'Inconnu'
    if (!chStats[c.chauffeur_id]) chStats[c.chauffeur_id] = { nom, count: 0, ca: 0 }
    chStats[c.chauffeur_id].count++
    chStats[c.chauffeur_id].ca += c.prix_final ?? c.prix_estime ?? 0
  }
  const topChauffeurs = Object.values(chStats).sort((a, b) => b.ca - a.ca).slice(0, 6)

  // ── Top clients ──
  const clStats: Record<string, { nom: string; count: number; ca: number }> = {}
  for (const c of terminées) {
    if (!c.client_id) continue
    const cl = (c as any).clients
    const nom = cl?.type_compte === 'entreprise'
      ? (cl.entreprise_nom ?? 'Entreprise')
      : cl?.profiles ? `${cl.profiles.prenom} ${cl.profiles.nom}` : 'Inconnu'
    if (!clStats[c.client_id]) clStats[c.client_id] = { nom, count: 0, ca: 0 }
    clStats[c.client_id].count++
    clStats[c.client_id].ca += c.prix_final ?? c.prix_estime ?? 0
  }
  const topClients = Object.values(clStats).sort((a, b) => b.ca - a.ca).slice(0, 6)

  // ── Répartition véhicule ──
  const vehiculeLabels: Record<string, string> = {
    berline: 'Berline', berline_premium: 'Berline Premium',
    van: 'Van 7 pl.', van_7: 'Van 7 pl.', grand_van_8: 'Grand Van',
  }
  const vStats: Record<string, { count: number; ca: number }> = {}
  for (const c of terminées) {
    const k = (c as any).type_vehicule ?? 'berline'
    if (!vStats[k]) vStats[k] = { count: 0, ca: 0 }
    vStats[k].count++
    vStats[k].ca += c.prix_final ?? c.prix_estime ?? 0
  }
  const vehiculeList = Object.entries(vStats)
    .map(([k, v]) => ({ label: vehiculeLabels[k] ?? k, ...v }))
    .sort((a, b) => b.count - a.count)

  // ── Répartition géographique ──
  const geoStats: Record<string, { count: number; ca: number }> = {}
  for (const c of terminées) {
    const geo = detectGeo((c as any).adresse_arrivee ?? '') !== 'Autre'
      ? detectGeo((c as any).adresse_arrivee ?? '')
      : detectGeo((c as any).adresse_depart ?? '')
    if (!geoStats[geo]) geoStats[geo] = { count: 0, ca: 0 }
    geoStats[geo].count++
    geoStats[geo].ca += c.prix_final ?? c.prix_estime ?? 0
  }
  const GEO_ORDER = ['CDG', 'Orly', 'Paris', 'Oise', 'Gare', 'Beauvais', 'Autre']
  const geoData = GEO_ORDER
    .filter(k => geoStats[k]?.count > 0)
    .map(k => ({ label: k, ...geoStats[k] }))

  // ── Heures de pointe ──
  const heuresCtr: Record<number, number> = {}
  for (const c of terminées) {
    const h = new Date(c.date_prevue).getHours()
    heuresCtr[h] = (heuresCtr[h] ?? 0) + 1
  }
  const heuresData = Object.entries(heuresCtr).map(([h, count]) => ({ heure: Number(h), count }))

  // ── Notes ──
  const chauffeursAvecNote = (chauffeursRes.data ?? []).filter(c => c.note_moyenne && c.note_moyenne > 0)
  const noteGlobale = chauffeursAvecNote.length > 0
    ? chauffeursAvecNote.reduce((s, c) => s + Number(c.note_moyenne), 0) / chauffeursAvecNote.length
    : null

  // ── CA entreprise vs particulier (12m) ──
  const caEntreprise12 = terminées
    .filter(c => (c as any).clients?.type_compte === 'entreprise')
    .reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const caParticulier12 = terminées
    .filter(c => (c as any).clients?.type_compte !== 'entreprise')
    .reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)

  return (
    <>
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Statistiques</div>
        <div style={{ fontSize: 10, color: 'var(--t3)' }}>
          {terminées.length} courses terminées · {courses.length} total (12 mois)
        </div>
      </div>

      <StatsClient
        months12={months12}
        topChauffeurs={topChauffeurs}
        topClients={topClients}
        vehiculeList={vehiculeList}
        geoData={geoData}
        heuresData={heuresData}
        noteGlobale={noteGlobale}
        nbChauffeursNotes={chauffeursAvecNote.length}
        nbClientsTotal={(clientsRes.data ?? []).length}
        nouveauxClientsActuel={newClientsRes.count ?? 0}
        caEntreprise12={caEntreprise12}
        caParticulier12={caParticulier12}
      />
    </>
  )
}
