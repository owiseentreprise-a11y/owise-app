import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

function monthLabel(year: number, month: number) {
  return new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
}

export default async function StatsPage() {
  const supabase = await createClient()

  const now = new Date()
  // 6 mois glissants (mois courant inclus)
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)

  const [coursesRes, chauffeursRes, clientsRes] = await Promise.all([
    supabase
      .from('courses')
      .select('statut, date_prevue, prix_final, prix_estime, chauffeur_id, client_id, chauffeurs(profiles(prenom, nom)), clients(type_compte, entreprise_nom, profiles(prenom, nom))')
      .gte('date_prevue', sixMonthsAgo.toISOString())
      .order('date_prevue', { ascending: true }),
    supabase
      .from('chauffeurs')
      .select('id, profiles(prenom, nom)')
      .order('created_at'),
    supabase
      .from('clients')
      .select('id, type_compte, entreprise_nom, profiles(prenom, nom)')
      .order('created_at'),
  ])

  const courses = coursesRes.data ?? []
  const terminées = courses.filter(c => c.statut === 'terminee')
  const annulées = courses.filter(c => c.statut === 'annulee')

  // ── Aggrégation par mois ──
  const months: { key: string; label: string; count: number; ca: number; annulees: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `${y}-${String(m).padStart(2, '0')}`
    const label = monthLabel(y, m)
    const monthCourses = terminées.filter(c => c.date_prevue.startsWith(key))
    const ca = monthCourses.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
    const ann = annulées.filter(c => c.date_prevue.startsWith(key)).length
    months.push({ key, label, count: monthCourses.length, ca, annulees: ann })
  }

  const maxCA = Math.max(...months.map(m => m.ca), 1)
  const maxCount = Math.max(...months.map(m => m.count), 1)

  // ── Top chauffeurs ──
  const chauffeurStats: Record<string, { nom: string; count: number; ca: number }> = {}
  for (const c of terminées) {
    if (!c.chauffeur_id) continue
    const ch = (c as any).chauffeurs
    const nom = ch?.profiles ? `${ch.profiles.prenom} ${ch.profiles.nom}` : 'Inconnu'
    if (!chauffeurStats[c.chauffeur_id]) chauffeurStats[c.chauffeur_id] = { nom, count: 0, ca: 0 }
    chauffeurStats[c.chauffeur_id].count++
    chauffeurStats[c.chauffeur_id].ca += c.prix_final ?? c.prix_estime ?? 0
  }
  const topChauffeurs = Object.values(chauffeurStats)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 6)

  // ── Top clients ──
  const clientStats: Record<string, { nom: string; count: number; ca: number }> = {}
  for (const c of terminées) {
    if (!c.client_id) continue
    const cl = (c as any).clients
    const nom = cl?.type_compte === 'entreprise'
      ? (cl.entreprise_nom ?? 'Entreprise')
      : cl?.profiles ? `${cl.profiles.prenom} ${cl.profiles.nom}` : 'Inconnu'
    if (!clientStats[c.client_id]) clientStats[c.client_id] = { nom, count: 0, ca: 0 }
    clientStats[c.client_id].count++
    clientStats[c.client_id].ca += c.prix_final ?? c.prix_estime ?? 0
  }
  const topClients = Object.values(clientStats)
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 6)

  // ── KPIs globaux ──
  const caTotal = terminées.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const caCurrentMonth = months[months.length - 1].ca
  const caPrevMonth = months[months.length - 2].ca
  const caEvo = caPrevMonth > 0 ? ((caCurrentMonth - caPrevMonth) / caPrevMonth * 100) : null

  const txCompletion = courses.length > 0
    ? Math.round(terminées.length / courses.filter(c => c.statut !== 'annulee' || true).length * 100)
    : 0

  const coursesThisMonth = months[months.length - 1].count
  const coursesPrevMonth = months[months.length - 2].count
  const countEvo = coursesPrevMonth > 0 ? ((coursesThisMonth - coursesPrevMonth) / coursesPrevMonth * 100) : null

  function evoLabel(evo: number | null) {
    if (evo === null) return null
    const sign = evo >= 0 ? '+' : ''
    return { text: `${sign}${evo.toFixed(0)}%`, pos: evo >= 0 }
  }

  const caEvoLabel = evoLabel(caEvo)
  const countEvoLabel = evoLabel(countEvo)

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Statistiques</div>
        <div style={{ marginLeft: 12, fontSize: 10, color: 'var(--t3)' }}>6 derniers mois</div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

        {/* ── KPIs ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
          {[
            {
              label: 'CA ce mois',
              value: `${caCurrentMonth.toFixed(0)} €`,
              evo: caEvoLabel,
              mono: true,
              gold: true,
            },
            {
              label: 'Courses ce mois',
              value: String(coursesThisMonth),
              evo: countEvoLabel,
              mono: true,
            },
            {
              label: 'CA 6 mois',
              value: `${caTotal.toFixed(0)} €`,
              mono: true,
              gold: true,
            },
            {
              label: 'Taux de complétion',
              value: `${Math.round(terminées.length / Math.max(courses.length, 1) * 100)} %`,
              mono: true,
              sub: `${terminées.length} / ${courses.length} courses`,
            },
          ].map((kpi, i) => (
            <div key={i} style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '18px 20px',
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>
                {kpi.label}
              </div>
              <div style={{
                fontFamily: kpi.mono ? 'var(--font-jetbrains), monospace' : undefined,
                fontSize: 26, fontWeight: 600,
                color: kpi.gold ? 'var(--gold)' : 'var(--t1)',
                letterSpacing: kpi.mono ? '-.02em' : undefined,
              }}>
                {kpi.value}
              </div>
              {kpi.evo && (
                <div style={{ fontSize: 10, color: kpi.evo.pos ? 'var(--grn)' : 'var(--red)', marginTop: 4 }}>
                  {kpi.evo.text} vs mois précédent
                </div>
              )}
              {kpi.sub && (
                <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
                  {kpi.sub}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* ── Graphiques ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Chiffre d'affaires */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, padding: '22px 24px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 20 }}>
              Chiffre d'affaires mensuel
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {months.map(m => {
                const h = maxCA > 0 ? Math.max((m.ca / maxCA) * 100, m.ca > 0 ? 4 : 0) : 0
                const isLast = m.key === months[months.length - 1].key
                return (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {m.ca > 0 ? `${Math.round(m.ca)}` : ''}
                    </div>
                    <div style={{ width: '100%', position: 'relative', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%',
                        height: `${h}%`,
                        minHeight: m.ca > 0 ? 4 : 0,
                        borderRadius: '4px 4px 2px 2px',
                        background: isLast
                          ? 'linear-gradient(180deg,var(--gold),rgba(201,168,76,.4))'
                          : 'linear-gradient(180deg,rgba(201,168,76,.35),rgba(201,168,76,.12))',
                        transition: 'height .3s',
                      }} />
                    </div>
                    <div style={{ fontSize: 9, color: isLast ? 'var(--gold)' : 'var(--t3)', textAlign: 'center' }}>
                      {m.label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Nombre de courses */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, padding: '22px 24px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 20 }}>
              Volume mensuel
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120 }}>
              {months.map(m => {
                const h = maxCount > 0 ? Math.max((m.count / maxCount) * 100, m.count > 0 ? 4 : 0) : 0
                const isLast = m.key === months[months.length - 1].key
                return (
                  <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 9, color: 'var(--t3)', fontFamily: 'var(--font-jetbrains), monospace' }}>
                      {m.count > 0 ? m.count : ''}
                    </div>
                    <div style={{ width: '100%', position: 'relative', flex: 1, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: '100%' }}>
                        <div style={{
                          flex: 1,
                          height: `${h}%`,
                          minHeight: m.count > 0 ? 4 : 0,
                          borderRadius: '3px 3px 2px 2px',
                          background: isLast
                            ? 'linear-gradient(180deg,var(--blu),rgba(74,142,208,.3))'
                            : 'linear-gradient(180deg,rgba(74,142,208,.45),rgba(74,142,208,.12))',
                        }} />
                        {m.annulees > 0 && (
                          <div style={{
                            flex: 1,
                            height: `${Math.max((m.annulees / maxCount) * 100, 4)}%`,
                            borderRadius: '3px 3px 2px 2px',
                            background: 'rgba(217,80,80,.35)',
                          }} />
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 9, color: isLast ? 'var(--blu)' : 'var(--t3)', textAlign: 'center' }}>
                      {m.label}
                    </div>
                  </div>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(74,142,208,.7)' }} />
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>Terminées</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(217,80,80,.5)' }} />
                <span style={{ fontSize: 9, color: 'var(--t3)' }}>Annulées</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Top chauffeurs + Top clients ── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

          {/* Top chauffeurs */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(201,168,76,.07)',
              fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--t2)', fontWeight: 500,
            }}>
              Top chauffeurs
            </div>
            {topChauffeurs.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Aucune donnée
              </div>
            ) : (
              <div>
                {topChauffeurs.map((ch, i) => {
                  const pct = topChauffeurs[0].ca > 0 ? (ch.ca / topChauffeurs[0].ca * 100) : 0
                  return (
                    <div key={i} style={{
                      padding: '12px 20px',
                      borderBottom: i < topChauffeurs.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            background: i === 0 ? 'linear-gradient(135deg,var(--gold),#8B6A1A)' : 'var(--elevated)',
                            border: i === 0 ? 'none' : '1px solid var(--t3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700,
                            color: i === 0 ? 'var(--base)' : 'var(--t3)',
                          }}>
                            {i + 1}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{ch.nom}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontFamily: 'var(--font-jetbrains), monospace',
                            fontSize: 13, fontWeight: 600, color: 'var(--gold)',
                          }}>
                            {ch.ca.toFixed(0)} €
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--t3)' }}>{ch.count} courses</div>
                        </div>
                      </div>
                      <div style={{ height: 3, background: 'var(--elevated)', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: i === 0 ? 'var(--gold)' : 'rgba(201,168,76,.35)',
                          borderRadius: 2, transition: 'width .4s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Top clients */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 14, overflow: 'hidden',
          }}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(201,168,76,.07)',
              fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--t2)', fontWeight: 500,
            }}>
              Top clients
            </div>
            {topClients.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', fontSize: 12, color: 'var(--t3)' }}>
                Aucune donnée
              </div>
            ) : (
              <div>
                {topClients.map((cl, i) => {
                  const pct = topClients[0].ca > 0 ? (cl.ca / topClients[0].ca * 100) : 0
                  return (
                    <div key={i} style={{
                      padding: '12px 20px',
                      borderBottom: i < topClients.length - 1 ? '1px solid rgba(201,168,76,.04)' : 'none',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                            background: i === 0 ? 'linear-gradient(135deg,var(--gold),#8B6A1A)' : 'var(--elevated)',
                            border: i === 0 ? 'none' : '1px solid var(--t3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 9, fontWeight: 700,
                            color: i === 0 ? 'var(--base)' : 'var(--t3)',
                          }}>
                            {i + 1}
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{cl.nom}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{
                            fontFamily: 'var(--font-jetbrains), monospace',
                            fontSize: 13, fontWeight: 600, color: 'var(--gold)',
                          }}>
                            {cl.ca.toFixed(0)} €
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--t3)' }}>{cl.count} courses</div>
                        </div>
                      </div>
                      <div style={{ height: 3, background: 'var(--elevated)', borderRadius: 2 }}>
                        <div style={{
                          height: '100%', width: `${pct}%`,
                          background: i === 0 ? 'var(--gold)' : 'rgba(201,168,76,.35)',
                          borderRadius: 2, transition: 'width .4s',
                        }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

      </div>
    </>
  )
}
