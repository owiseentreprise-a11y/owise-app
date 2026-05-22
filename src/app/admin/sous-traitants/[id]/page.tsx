import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { modifierSousTraitantAction } from '../actions'
import { STATUT_COURSE_LABEL, STATUT_COURSE_COLOR } from '@/lib/types'

export const dynamic = 'force-dynamic'

export default async function SousTraitantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; success?: string }>
}) {
  const { id } = await params
  const sp = await searchParams
  const supabase = await createClient()

  const [stRes, coursesRes] = await Promise.all([
    supabase.from('sous_traitants').select('*').eq('id', id).single(),
    supabase.from('courses')
      .select('id, statut, adresse_depart, adresse_arrivee, date_prevue, prix_final, clients(type_compte, entreprise_nom, profiles(prenom, nom))')
      .eq('sous_traitant_id', id)
      .order('date_prevue', { ascending: false })
      .limit(50),
  ])

  if (!stRes.data) notFound()
  const st = stRes.data
  const courses = coursesRes.data ?? []

  const inputStyle = {
    background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.18)',
    borderRadius: 9, padding: '11px 14px',
    color: 'var(--t1)', fontFamily: 'var(--font-dm-sans), sans-serif',
    fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' as const,
  }
  const labelStyle = {
    fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase' as const,
    color: 'var(--t2)', fontWeight: 500, display: 'block', marginBottom: 6,
  }

  const totalCA = courses
    .filter(c => c.statut === 'terminee' && c.prix_final)
    .reduce((s, c) => s + (c.prix_final ?? 0), 0)
  const nbTerminees = courses.filter(c => c.statut === 'terminee').length

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <a href="/admin/sous-traitants" style={{ color: 'var(--t3)', textDecoration: 'none', fontSize: 13 }}>
            ← Sous-traitants
          </a>
          <span style={{ color: 'var(--t3)' }}>/</span>
          <span style={{ fontSize: 13, color: 'var(--t1)' }}>{st.nom}</span>
        </div>
        <span style={{
          fontSize: 9, padding: '3px 10px', borderRadius: 4, fontWeight: 500,
          color:      st.actif ? 'var(--grn)' : 'var(--t3)',
          background: st.actif ? 'rgba(61,184,122,.1)' : 'var(--elevated)',
          border:     st.actif ? '1px solid rgba(61,184,122,.2)' : '1px solid var(--t3)',
        }}>
          {st.actif ? 'Actif' : 'Inactif'}
        </span>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* Banners */}
        {sp.success === '1' && (
          <div style={{
            background: 'rgba(60,196,124,.1)', border: '1px solid rgba(60,196,124,.25)',
            borderRadius: 9, padding: '11px 14px', fontSize: 13, color: 'var(--grn)',
          }}>
            ✓ Modifications enregistrées.
          </div>
        )}
        {sp.error && (
          <div style={{
            background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.25)',
            borderRadius: 9, padding: '11px 14px', fontSize: 13, color: '#e88080',
          }}>
            Erreur lors de la mise à jour.
          </div>
        )}

        {/* KPIs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {[
            { label: 'Courses totales', value: courses.length, mono: true },
            { label: 'Courses terminées', value: nbTerminees, mono: true },
            { label: 'CA généré', value: totalCA > 0 ? `${totalCA.toFixed(2)} €` : '—', mono: true, gold: totalCA > 0 },
          ].map(k => (
            <div key={k.label} style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 6 }}>
                {k.label}
              </div>
              <div style={{
                fontFamily: 'var(--font-jetbrains), monospace',
                fontSize: 22, fontWeight: 600,
                color: k.gold ? 'var(--gold)' : 'var(--t1)',
              }}>
                {k.value}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

          {/* Formulaire édition */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, padding: '24px' }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 18 }}>Informations</div>
            <form action={modifierSousTraitantAction} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input type="hidden" name="id" value={st.id} />

              <div>
                <label style={labelStyle}>Société *</label>
                <input name="nom" type="text" required defaultValue={st.nom} style={inputStyle} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Contact</label>
                  <input name="contact_nom" type="text" defaultValue={st.contact_nom ?? ''} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Téléphone</label>
                  <input name="telephone" type="tel" defaultValue={st.telephone ?? ''} style={inputStyle} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={labelStyle}>Email</label>
                  <input name="email" type="email" defaultValue={st.email ?? ''} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>SIRET</label>
                  <input name="siret" type="text" defaultValue={st.siret ?? ''} style={inputStyle} />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Adresse</label>
                <input name="adresse" type="text" defaultValue={st.adresse ?? ''} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Notes internes</label>
                <textarea name="notes" rows={3} defaultValue={st.notes ?? ''} style={{ ...inputStyle, resize: 'vertical' as const }} />
              </div>

              <div>
                <label style={labelStyle}>Statut</label>
                <select name="actif" defaultValue={st.actif ? 'true' : 'false'} style={inputStyle}>
                  <option value="true">Actif</option>
                  <option value="false">Inactif</option>
                </select>
              </div>

              <button type="submit" style={{
                background: 'var(--gold)', color: 'var(--base)', border: 'none',
                borderRadius: 9, padding: '11px',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                marginTop: 4,
              }}>
                Enregistrer
              </button>
            </form>
          </div>

          {/* Courses associées */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Courses sous-traitées</span>
              <span style={{ fontSize: 11, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                {courses.length}
              </span>
            </div>

            {courses.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Aucune course assignée
              </div>
            ) : courses.map((c, i) => {
              const client = (c as any).clients
              const clientNom = client?.type_compte === 'entreprise'
                ? (client.entreprise_nom ?? '—')
                : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : '—'
              const color = STATUT_COURSE_COLOR[c.statut as keyof typeof STATUT_COURSE_COLOR]
              const label = STATUT_COURSE_LABEL[c.statut as keyof typeof STATUT_COURSE_LABEL]
              return (
                <a
                  key={c.id}
                  href={`/admin/courses/${c.id}`}
                  style={{
                    display: 'block', padding: '12px 20px', textDecoration: 'none',
                    borderBottom: i < courses.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                        {c.adresse_depart.split(',')[0]}
                        <span style={{ color: 'var(--t3)', margin: '0 6px' }}>→</span>
                        {c.adresse_arrivee.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                        {new Date(c.date_prevue).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        {' · '}{clientNom}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                      {c.prix_final && (
                        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--gold)' }}>
                          {c.prix_final} €
                        </span>
                      )}
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                        color, background: `${color}18`, border: `1px solid ${color}30`,
                      }}>
                        {label}
                      </span>
                    </div>
                  </div>
                </a>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
