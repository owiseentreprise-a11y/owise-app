import { createClient } from '@/lib/supabase/server'
import ParametresForm from './ParametresForm'

export const dynamic = 'force-dynamic'

export default async function ParametresPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from('parametres')
    .select('*')
    .eq('id', true)
    .single()

  const parametres = data ?? {
    societe_nom: null, societe_siret: null, societe_tva_numero: null, societe_naf: null,
    societe_adresse: null, societe_code_postal: null, societe_ville: null,
    societe_telephone: null, societe_email: null,
    facture_prefixe: 'OW-', facture_taux_tva: 20, facture_delai_paiement: 30, facture_mentions: null,
    banque_iban: null, banque_bic: null, banque_nom: null,
  }

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Paramètres</div>
        <div style={{ fontSize: 11, color: 'var(--t3)' }}>
          Informations société · Facturation · Banque
        </div>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: 820 }}>
        <ParametresForm data={parametres} />
      </div>
    </>
  )
}
