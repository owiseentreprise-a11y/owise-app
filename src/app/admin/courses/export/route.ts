import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.app_metadata?.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }
  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to   = searchParams.get('to')

  let query = supabase
    .from('courses')
    .select('*, clients(type_compte, entreprise_nom, profiles(prenom, nom)), chauffeurs(profiles(prenom, nom)), collaborateurs(prenom, nom), sous_traitants(nom)')
    .order('date_prevue', { ascending: false })

  if (from) query = query.gte('date_prevue', from)
  if (to)   query = query.lte('date_prevue', to + 'T23:59:59')

  const { data: courses } = await query

  if (!courses) return NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR') : ''
  const fmtTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''

  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(';') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const STATUT: Record<string, string> = {
    en_attente: 'En attente', acceptee: 'Acceptée',
    en_route: 'En route', prise_en_charge: 'Client à bord',
    terminee: 'Terminée', annulee: 'Annulée',
  }

  const header = ['Date', 'Heure', 'Départ', 'Arrivée', 'Client', 'Voyageur', 'Chauffeur / Sous-traitant', 'Véhicule', 'Passagers', 'Prix estimé', 'Prix final', 'Statut']
  const rows = courses.map(c => {
    const client = (c as any).clients
    const chauffeur = (c as any).chauffeurs
    const collab = (c as any).collaborateurs
    const st = (c as any).sous_traitants

    const clientNom = client?.type_compte === 'entreprise'
      ? (client.entreprise_nom ?? '')
      : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : ''
    const collabNom = collab ? `${collab.prenom ?? ''} ${collab.nom ?? ''}`.trim() : ''
    const assigneNom = chauffeur?.profiles
      ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
      : st?.nom ? `[ST] ${st.nom}` : ''

    return [
      escape(fmt(c.date_prevue)),
      escape(fmtTime(c.date_prevue)),
      escape(c.adresse_depart),
      escape(c.adresse_arrivee),
      escape(clientNom),
      escape(collabNom),
      escape(assigneNom),
      escape(c.type_vehicule),
      escape(c.nb_passagers),
      escape(c.prix_estime?.toFixed(2)),
      escape(c.prix_final?.toFixed(2)),
      escape(STATUT[c.statut] ?? c.statut),
    ].join(';')
  })

  const csv = [header.join(';'), ...rows].join('\n')
  const date = new Date().toISOString().split('T')[0]

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="owise-courses-${date}.csv"`,
    },
  })
}
