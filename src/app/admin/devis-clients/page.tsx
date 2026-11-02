import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { formaterMontant } from '@/lib/montant'
import { STATUTS, dateCourte, type DevisClient } from '@/lib/devis-client'
import NouveauBouton from './NouveauBouton'

export const dynamic = 'force-dynamic'

/* Chaque statut porte sa couleur : sur une liste, l'état se lit avant le
   texte. Les teintes viennent de la charte, pas d'une palette inventée. */
const TEINTE: Record<string, { fond: string; trait: string; encre: string }> = {
  brouillon: { fond: 'rgba(0,0,0,.04)',         trait: 'rgba(0,0,0,.10)',        encre: '#6B6B6B' },
  envoye:    { fond: 'rgba(201,168,76,.12)',    trait: 'rgba(201,168,76,.30)',   encre: '#9A7E2E' },
  accepte:   { fond: 'rgba(61,184,122,.12)',    trait: 'rgba(61,184,122,.32)',   encre: '#2E8A58' },
  refuse:    { fond: 'rgba(217,84,84,.10)',     trait: 'rgba(217,84,84,.28)',    encre: '#B14343' },
  expire:    { fond: 'rgba(0,0,0,.04)',         trait: 'rgba(0,0,0,.10)',        encre: '#999999' },
}

export default async function DevisClientsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('devis_clients')
    .select('*')
    .order('created_at', { ascending: false })

  const devis = (data ?? []) as DevisClient[]
  const enCours = devis.filter(d => d.statut === 'brouillon' || d.statut === 'envoye').length

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1300 }}>

      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 26, fontWeight: 500, color: '#0A0A0A', margin: 0 }}>
            Devis clients
          </h1>
          <p style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
            Les devis que vous adressez — plusieurs trajets, un seul document
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(201,168,76,.12), rgba(201,168,76,.06))',
            border: '1px solid rgba(201,168,76,.25)',
            borderRadius: 10, padding: '10px 20px', textAlign: 'center',
          }}>
            <div style={{ fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#C9A84C' }}>{enCours}</div>
            <div style={{ fontSize: 10, color: '#999', letterSpacing: '.08em', textTransform: 'uppercase' }}>En cours</div>
          </div>
          <NouveauBouton />
        </div>
      </div>

      {devis.length === 0 ? (
        <div style={{ background: '#FAFAF8', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, padding: '60px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: '#999', marginBottom: 6 }}>Aucun devis pour le moment.</div>
          <div style={{ fontSize: 12.5, color: '#BBB' }}>
            « Nouveau devis » crée un brouillon que vous remplissez ligne par ligne.
          </div>
        </div>
      ) : (
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,.07)', borderRadius: 12, overflow: 'hidden' }}>
          {devis.map((d, i) => {
            const t = TEINTE[d.statut] ?? TEINTE.brouillon
            return (
              <Link
                key={d.id}
                href={`/admin/devis-clients/${d.id}`}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(130px,auto) minmax(0,1fr) auto auto auto',
                  gap: 16, alignItems: 'center', padding: '15px 20px',
                  borderTop: i === 0 ? 'none' : '1px solid rgba(0,0,0,.06)',
                  textDecoration: 'none', color: 'inherit',
                }}
              >
                <span style={{ fontFamily: 'monospace', fontSize: 12.5, color: '#C9A84C', letterSpacing: '.03em' }}>
                  {d.numero}
                </span>

                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#0A0A0A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {d.client_nom || <em style={{ color: '#BBB', fontWeight: 400 }}>Sans nom</em>}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#999', marginTop: 2 }}>
                    {d.client_societe ? d.client_societe + ' · ' : ''}
                    {d.lignes.length} prestation{d.lignes.length > 1 ? 's' : ''}
                    {d.date_prestation ? ' · ' + dateCourte(d.date_prestation) : ''}
                  </span>
                </span>

                <span style={{
                  fontSize: 10.5, letterSpacing: '.08em', textTransform: 'uppercase', fontWeight: 600,
                  background: t.fond, border: `1px solid ${t.trait}`, color: t.encre,
                  borderRadius: 20, padding: '3px 11px', whiteSpace: 'nowrap',
                }}>
                  {STATUTS[d.statut] ?? d.statut}
                </span>

                <span style={{ fontFamily: 'monospace', fontSize: 14, fontWeight: 500, color: '#0A0A0A', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {formaterMontant(Number(d.total_ht))}
                </span>

                <span style={{ fontSize: 12, color: '#C9A84C', whiteSpace: 'nowrap' }}>Ouvrir →</span>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
