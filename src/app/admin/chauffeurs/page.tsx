import { createAdminClient } from '@/lib/supabase/admin'
import type { Chauffeur } from '@/lib/types'
import { TYPE_VEHICULE_LABEL } from '@/lib/types'

export const revalidate = 0

const statutBadge = (statut: string) => {
  const map: Record<string, { color: string; bg: string; label: string }> = {
    disponible:  { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', label: 'Disponible' },
    en_course:   { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', label: 'En course' },
    hors_ligne:  { color: 'var(--t3)',  bg: 'var(--elevated)',       label: 'Hors ligne' },
  }
  return map[statut] ?? map.hors_ligne
}

export default async function ChauffeursPage() {
  const supabase = createAdminClient()

  const { data: chauffeurs } = await supabase
    .from('chauffeurs')
    .select('*, profiles(*)')
    .order('created_at', { ascending: false })

  const list: Chauffeur[] = chauffeurs ?? []
  const disponibles = list.filter(c => c.statut === 'disponible').length
  const enCourse   = list.filter(c => c.statut === 'en_course').length

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)', 
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
          Chauffeurs{' '}
          <span style={{ color: 'var(--t2)', fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12 }}>
            ({list.length})
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
            <span style={{ color: 'var(--grn)' }}>● {disponibles} disponible{disponibles > 1 ? 's' : ''}</span>
            <span style={{ color: 'var(--blu)' }}>● {enCourse} en course</span>
          </div>
          <a href="/admin/chauffeurs/nouveau" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--gold)', color: 'var(--base)',
            padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            + Nouveau chauffeur
          </a>
        </div>
      </div>

      <div style={{ padding: '28px 32px' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 160px 180px 80px 80px 120px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>Chauffeur</div>
            <div>Véhicule</div>
            <div>Contrat / Immat.</div>
            <div style={{ textAlign: 'center' }}>Courses</div>
            <div style={{ textAlign: 'center' }}>Note</div>
            <div style={{ textAlign: 'right' }}>Statut</div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              Aucun chauffeur enregistré
            </div>
          ) : list.map(c => {
            const p = (c as any).profiles
            const prenom = p?.prenom ?? ''
            const nom = p?.nom ?? ''
            const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
            const s = statutBadge(c.statut)

            return (
              <div
                key={c.id}
                style={{
                  position: 'relative',
                  display: 'grid',
                  gridTemplateColumns: '1fr 160px 180px 80px 80px 120px',
                  padding: '13px 20px',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                  alignItems: 'center',
                }}
              >
                <a href={`/admin/chauffeurs/${c.id}`} aria-label="Voir le chauffeur" style={{ position: 'absolute', inset: 0, zIndex: 1 }} />
                {/* Identity */}
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))',
                    border: '1px solid rgba(201,168,76,.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-cormorant), serif',
                    fontSize: 14, fontWeight: 600, color: 'var(--gold)',
                  }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{prenom} {nom}</div>
                    <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{p?.telephone ?? '—'}</div>
                  </div>
                </div>

                {/* Véhicule */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ fontSize: 12, color: 'var(--t1)' }}>
                    {c.vehicule_marque ?? '—'} {c.vehicule_modele ?? ''}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>
                    {TYPE_VEHICULE_LABEL[c.type_vehicule]}
                  </div>
                </div>

                {/* Contrat + immat */}
                <div style={{ position: 'relative', zIndex: 2 }}>
                  <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'capitalize' }}>
                    {c.type_contrat === 'salarie' ? 'Salarié' : 'Sous-traitant'}
                  </div>
                  <div style={{
                    fontSize: 10, color: 'var(--t3)',
                    fontFamily: 'var(--font-jetbrains), monospace',
                    marginTop: 1, letterSpacing: '.06em',
                  }}>
                    {c.vehicule_immatriculation ?? '—'}
                  </div>
                </div>

                {/* Nb courses */}
                <div style={{
                  position: 'relative', zIndex: 2,
                  textAlign: 'center',
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 15, color: 'var(--t1)',
                }}>
                  {c.nb_courses}
                </div>

                {/* Note */}
                <div style={{
                  position: 'relative', zIndex: 2,
                  textAlign: 'center',
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 15,
                  color: c.note_moyenne >= 4.5 ? 'var(--grn)' : c.note_moyenne >= 4 ? 'var(--gold)' : 'var(--amb)',
                }}>
                  {c.note_moyenne?.toFixed(1) ?? '—'}
                </div>

                {/* Statut */}
                <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{
                    fontSize: 10, padding: '4px 10px',
                    borderRadius: 20, fontWeight: 500,
                    color: s.color, background: s.bg,
                    border: `1px solid ${s.color}30`,
                  }}>
                    {s.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
