import { NextResponse } from 'next/server'
import { createAdminClient, getUserEmail } from '@/lib/supabase/admin'
import { envoyerNouvelleFacture } from '@/lib/email'

// Appelé par Vercel Cron le 1er de chaque mois à 6h
// Génère une facture consolidée pour chaque client entreprise en mode "mensuelle"
export async function GET(req: Request) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://owise.fr'

  // Fenêtre : mois précédent complet
  const now = new Date()
  const debutMois = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const finMois   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999)
  const yyyymm    = `${debutMois.getFullYear()}${String(debutMois.getMonth() + 1).padStart(2, '0')}`

  // Courses terminées du mois précédent, sans facture, pour clients entreprise mensuelle
  const { data: courses } = await supabase
    .from('courses')
    .select('id, client_id, prix_final, adresse_depart, adresse_arrivee, date_prevue, clients(type_compte, entreprise_nom, nom, prenom, facturation_mode)')
    .eq('statut', 'terminee')
    .is('facture_id', null)
    .not('prix_final', 'is', null)
    .gte('date_fin', debutMois.toISOString())
    .lte('date_fin', finMois.toISOString())

  if (!courses || courses.length === 0) {
    return NextResponse.json({ message: 'Aucune course à facturer ce mois', facturesCreees: 0 })
  }

  // Grouper par client_id, filtrer entreprise mensuelle seulement
  const byClient = new Map<string, typeof courses>()
  for (const course of courses) {
    const client = (course as any).clients
    if (client?.type_compte !== 'entreprise') continue
    if ((client?.facturation_mode ?? 'mensuelle') !== 'mensuelle') continue
    if (!course.client_id) continue
    if (!byClient.has(course.client_id)) byClient.set(course.client_id, [])
    byClient.get(course.client_id)!.push(course)
  }

  let facturesCreees = 0

  // Récupérer le prochain numéro de séquence une seule fois
  const { count: existingCount } = await supabase
    .from('factures')
    .select('*', { count: 'exact', head: true })
    .like('numero', `OW-${yyyymm}-%`)

  let seq = (existingCount ?? 0) + 1

  await Promise.all(Array.from(byClient.entries()).map(async ([clientId, clientCourses]) => {
    const client = (clientCourses[0] as any).clients

    // Somme des courses
    const totalTtc = clientCourses.reduce((s, c) => s + Number(c.prix_final ?? 0), 0)
    if (totalTtc <= 0) return

    const montantTtc = Math.round(totalTtc * 100) / 100
    const montantHt  = Math.round((totalTtc / 1.2) * 100) / 100
    const tva        = Math.round((montantTtc - montantHt) * 100) / 100

    const numero = `OW-${yyyymm}-${String(seq++).padStart(4, '0')}`
    const dateEcheance = new Date(now)
    dateEcheance.setDate(dateEcheance.getDate() + 30)

    // Créer la facture
    const { data: facture } = await supabase.from('factures').insert({
      client_id:     clientId,
      numero,
      statut:        'en_attente',
      montant_ht:    montantHt,
      montant_ttc:   montantTtc,
      tva,
      date_emission: now.toISOString(),
      date_echeance: dateEcheance.toISOString(),
      mode_paiement: 'virement',
      notes:         `Facture mensuelle ${debutMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })} — ${clientCourses.length} course${clientCourses.length > 1 ? 's' : ''}`,
    }).select('id').single()

    if (!facture) return

    // Lier toutes les courses à cette facture
    await supabase.from('courses')
      .update({ facture_id: facture.id })
      .in('id', clientCourses.map(c => c.id))

    // Email client
    const clientEmail = await getUserEmail(clientId)
    const clientNom = client?.type_compte === 'entreprise'
      ? (client?.entreprise_nom ?? '')
      : `${client?.prenom ?? ''} ${client?.nom ?? ''}`.trim()

    if (clientEmail) {
      // On envoie la première course comme référence (ou le mois)
      await envoyerNouvelleFacture({
        clientEmail,
        clientNom,
        factureNumero: numero,
        montantHt,
        montantTtc,
        dateEcheance: dateEcheance.toISOString(),
        refCourse: `${clientCourses.length} courses — ${debutMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
        lienFacture: `${siteUrl}/espace-client/factures/${facture.id}`,
      })
    }

    facturesCreees++
  }))

  return NextResponse.json({
    periode: `${debutMois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
    coursesTraitees: courses.length,
    facturesCreees,
  })
}
