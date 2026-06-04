import { createAdminClient } from '@/lib/supabase/admin'
import NouvelleFactureForm from './NouvelleFactureForm'

export const dynamic = 'force-dynamic'

export default async function NouvelleFacturePage() {
  const supabase = createAdminClient()

  const [clientsRes, coursesRes, parametresRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, type_compte, entreprise_nom, profiles(prenom, nom)')
      .order('entreprise_nom'),
    supabase
      .from('courses')
      .select('id, client_id, adresse_depart, adresse_arrivee, date_prevue, prix_final')
      .eq('statut', 'terminee')
      .is('facture_id', null)
      .not('prix_final', 'is', null)
      .order('date_prevue'),
    supabase.from('parametres').select('facture_taux_tva, facture_delai_paiement').eq('id', true).single(),
  ])

  const clients = clientsRes.data ?? []
  const courses = coursesRes.data ?? []
  const tauxTva = parametresRes.data?.facture_taux_tva ?? 20
  const delaiPaiement = parametresRes.data?.facture_delai_paiement ?? 30

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <a href="/admin/facturation" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
        }}>
          <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
          </svg>
          Facturation
        </a>
        <div style={{ width: 1, height: 16, background: 'var(--t3)' }} />
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Nouvelle facture</div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 800 }}>
        <NouvelleFactureForm
          clients={clients as any}
          courses={courses as any}
          tauxTva={Number(tauxTva)}
          delaiPaiement={Number(delaiPaiement)}
        />
      </div>
    </>
  )
}
