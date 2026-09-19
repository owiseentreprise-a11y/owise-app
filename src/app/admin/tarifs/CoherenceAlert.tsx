// Server component — no directive needed

type Zone  = { id: string; code: string; nom: string; type: string }
type Grille = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }
type Tarif  = { vehicule: string; cdg_fixe: number; orly_fixe: number; beauvais_fixe: number }

const AIRPORT_COL: Record<string, keyof Tarif> = {
  CDG: 'cdg_fixe',
  ORY: 'orly_fixe',
  BVA: 'beauvais_fixe',
}

export default function CoherenceAlert({
  zones,
  grille,
  tarifs,
}: {
  zones: Zone[]
  grille: Grille[]
  tarifs: Tarif[]
}) {
  const berline = tarifs.find(t => t.vehicule === 'Berline')
  if (!berline) return null

  // Sans entrée de grille, le prix est calculé au kilomètre depuis le 2026-09-19 :
  // le forfait aéroport global a été retiré, il appliquait le même prix quelle que
  // soit la distance. On signale donc les paires qui n'ont pas de forfait, pour que
  // ce soit un choix et non un oubli.
  type Manquant = { zone: string; aeroport: string; tarifFixe: number }
  const manquants: Manquant[] = []

  const zonesActives = zones.filter(z => z.type !== 'aeroport' && z.type !== 'gare')

  for (const [code] of Object.entries(AIRPORT_COL)) {
    const airportZone = zones.find(z => z.code === code)
    if (!airportZone) continue

    for (const zone of zonesActives) {
      const hasGrille = grille.some(g =>
        (g.zone_depart_id === zone.id    && g.zone_arrivee_id === airportZone.id) ||
        (g.zone_depart_id === airportZone.id && g.zone_arrivee_id === zone.id)
      )
      if (!hasGrille) {
        const col = AIRPORT_COL[code]
        const fixe = Number(berline[col])
        manquants.push({ zone: zone.nom ?? zone.code, aeroport: code, tarifFixe: fixe })
      }
    }
  }

  if (manquants.length === 0) return null

  return (
    <div style={{
      background: 'rgba(77,142,212,.06)',
      border: '1px solid rgba(77,142,212,.25)',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>ℹ️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--blue)', marginBottom: 6 }}>
            Zones sans entrée de grille vers un aéroport
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12, lineHeight: 1.6 }}>
            Les trajets ci-dessous n&apos;ont pas d&apos;entrée dans la <strong style={{ color: 'var(--t1)' }}>grille tarifaire</strong>.
            Leur prix est donc <strong style={{ color: 'var(--t1)' }}>calculé au kilomètre</strong>, selon la distance réelle.
            Ajoutez une entrée dans la grille si vous voulez un forfait fixe pour ce trajet.
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                {['Zone', 'Aéroport', 'Prix appliqué'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '4px 12px 4px 0',
                    color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(77,142,212,.15)', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {manquants.map((m, i) => (
                <tr key={i}>
                  <td style={{ padding: '5px 12px 5px 0', color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {m.zone}
                  </td>
                  <td style={{ padding: '5px 12px 5px 0', color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {m.aeroport}
                  </td>
                  <td style={{ padding: '5px 0', color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    au kilomètre
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
