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
  const berline  = tarifs.find(t => t.vehicule === 'Berline')
  if (!berline) return null

  type Ecart = { route: string; fixe: number; grille: number; aeroport: string }
  const ecarts: Ecart[] = []

  for (const [code, col] of Object.entries(AIRPORT_COL)) {
    const airportZone = zones.find(z => z.code === code)
    if (!airportZone) continue
    const fixe = Number(berline[col])

    for (const cell of grille) {
      const isAirport =
        cell.zone_depart_id === airportZone.id ||
        cell.zone_arrivee_id === airportZone.id

      if (!isAirport) continue

      const prix = Number(cell.prix_berline)
      if (prix === fixe) continue

      const other = zones.find(z =>
        z.id === (cell.zone_depart_id === airportZone.id ? cell.zone_arrivee_id : cell.zone_depart_id)
      )
      ecarts.push({
        aeroport: code,
        route: `${other?.nom ?? other?.code ?? '?'} ↔ ${code}`,
        fixe,
        grille: prix,
      })
    }
  }

  if (ecarts.length === 0) return null

  return (
    <div style={{
      background: 'rgba(232,160,48,.08)',
      border: '1px solid rgba(232,160,48,.3)',
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 4,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 6 }}>
            Incohérence tarifaire détectée
          </div>
          <div style={{ fontSize: 12, color: 'var(--t2)', marginBottom: 12, lineHeight: 1.6 }}>
            Le <strong style={{ color: 'var(--t1)' }}>tarif fixe aéroport</strong> (colonne de secours) et les{' '}
            <strong style={{ color: 'var(--t1)' }}>entrées de la grille</strong> sont différents pour les trajets suivants.
            L&apos;estimation rapide du widget utilise le tarif fixe, le formulaire de réservation utilise la grille.
            Résultat : le client peut voir deux prix différents pour le même trajet.
          </div>

          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 11 }}>
            <thead>
              <tr>
                {['Trajet', 'Tarif fixe (widget)', 'Grille (formulaire)', 'Écart'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '4px 12px 4px 0',
                    color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase',
                    borderBottom: '1px solid rgba(201,168,76,.1)', fontWeight: 500,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ecarts.map((e, i) => (
                <tr key={i}>
                  <td style={{ padding: '5px 12px 5px 0', color: 'var(--t1)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {e.route}
                  </td>
                  <td style={{ padding: '5px 12px 5px 0', color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {e.fixe} €
                  </td>
                  <td style={{ padding: '5px 12px 5px 0', color: 'var(--gold)', fontFamily: 'var(--font-jetbrains), monospace', fontWeight: 600 }}>
                    {e.grille} €
                  </td>
                  <td style={{ padding: '5px 0', color: e.grille > e.fixe ? 'var(--green)' : 'var(--red)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                    {e.grille > e.fixe ? '+' : ''}{e.grille - e.fixe} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 12, fontSize: 11, color: 'var(--t3)', lineHeight: 1.6 }}>
            <strong style={{ color: 'var(--t2)' }}>Comment corriger :</strong> mettez à jour les tarifs fixes aéroport
            (section ci-dessous) pour qu&apos;ils correspondent au prix le plus courant dans la grille —
            ou ignorez si les écarts sont intentionnels (tarifs zone-à-zone personnalisés).
          </div>
        </div>
      </div>
    </div>
  )
}
