import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminClient } from '@/lib/supabase/server'
import TarifsMatrix from './TarifsMatrix'
import TarifsVehicules from './TarifsVehicules'
import ZonesSection from './ZonesSection'
import GlobalParamsForm from './GlobalParamsForm'

export const dynamic = 'force-dynamic'

export default async function TarifsPage() {
  await requireAdminClient()
  const supabase = createAdminClient()

  const [zonesRes, grilleRes, paramsRes, tarifsRes] = await Promise.all([
    supabase.from('zones').select('*').order('ordre'),
    supabase.from('grilles_tarifaires').select('*'),
    supabase.from('parametres').select('*').eq('id', true).single(),
    supabase.from('tarifs').select('*'),
  ])

  const zones  = zonesRes.data ?? []
  const grille = grilleRes.data ?? []
  const p      = paramsRes.data as any
  const tarifs = tarifsRes.data ?? []

  return (
    <>
      <style>{`
        .tarif-section { background: var(--surface); border: 1px solid var(--gb); border-radius: 14px; padding: 28px; }
        .save-btn:hover { background: var(--gold-bright) !important; }
        .zone-row:hover { background: rgba(201,168,76,.03); }
      `}</style>

      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,.95)', 
        borderBottom: '1px solid rgba(0,0,0,.07)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center',
        boxShadow: '0 1px 0 rgba(0,0,0,.06)',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Tarification</div>
      </div>

      <div style={{ padding: '28px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Tarifs de base par véhicule */}
        <div className="tarif-section">
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 6 }}>
            Tarifs de base par véhicule
          </div>
          <div style={{ fontSize: 11, color: 'var(--t3)', marginBottom: 20 }}>
            Prix fixe garanti · Tarif fixe = Prise en charge + Distance × Prix/km · Forfaits aéroport indépendants
          </div>
          <TarifsVehicules tarifs={tarifs} />
        </div>

        {/* Matrice des prix */}
        <div className="tarif-section">
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 20 }}>
            Matrice tarifaire — prix berline de base
          </div>
          <TarifsMatrix
            zones={zones}
            grille={grille}
            coefPremium={p?.coef_berline_premium ?? 1.25}
            coefVan={p?.coef_van ?? 1.5}
          />
        </div>

        {/* Paramètres globaux */}
        <div className="tarif-section">
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 20 }}>
            Paramètres globaux
          </div>
          <GlobalParamsForm p={p} />
        </div>

        {/* Zones */}
        <div className="tarif-section">
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 16 }}>
            Zones définies
          </div>
          <ZonesSection zones={zones} />
        </div>
      </div>
    </>
  )
}
