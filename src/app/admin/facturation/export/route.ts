import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()

  const { data: factures } = await supabase
    .from('factures')
    .select('*, clients(type_compte, entreprise_nom, profiles(prenom, nom))')
    .order('date_emission', { ascending: false })

  if (!factures) return NextResponse.json({ error: 'Erreur' }, { status: 500 })

  const fmt = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('fr-FR') : ''

  const escape = (v: string | number | null | undefined) => {
    const s = String(v ?? '')
    return s.includes(';') || s.includes('"') || s.includes('\n')
      ? `"${s.replace(/"/g, '""')}"`
      : s
  }

  const header = ['Numéro', 'Client', 'Type', 'Date émission', 'Date échéance', 'Montant HT', 'Montant TTC', 'Statut']
  const rows = factures.map(f => {
    const client = (f as any).clients
    const clientNom = client?.type_compte === 'entreprise'
      ? (client.entreprise_nom ?? '')
      : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : ''
    const type = client?.type_compte === 'entreprise' ? 'Entreprise' : 'Particulier'
    const statut = { en_attente: 'En attente', payee: 'Payée', retard: 'En retard' }[f.statut as string] ?? f.statut
    return [
      escape(f.numero),
      escape(clientNom),
      escape(type),
      escape(fmt(f.date_emission)),
      escape(fmt(f.date_echeance)),
      escape(f.montant_ht?.toFixed(2)),
      escape(f.montant_ttc?.toFixed(2)),
      escape(statut),
    ].join(';')
  })

  const csv = [header.join(';'), ...rows].join('\n')
  const date = new Date().toISOString().split('T')[0]

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="owise-factures-${date}.csv"`,
    },
  })
}
