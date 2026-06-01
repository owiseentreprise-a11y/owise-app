import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; q?: string }>
}) {
  const sp = await searchParams
  const filterType = sp.type ?? ''
  const filterQ    = (sp.q ?? '').toLowerCase().trim()

  const supabase = await createClient()

  const { data: clients } = await supabase
    .from('clients')
    .select('*, profiles(*)')
    .order('created_at', { ascending: false })

  const all = clients ?? []

  const counts = {
    total:       all.length,
    entreprise:  all.filter(c => c.type_compte === 'entreprise').length,
    particulier: all.filter(c => c.type_compte === 'particulier').length,
  }

  let list = all
  if (filterType === 'entreprise') list = all.filter(c => c.type_compte === 'entreprise')
  else if (filterType === 'particulier') list = all.filter(c => c.type_compte === 'particulier')

  if (filterQ) {
    list = list.filter(c => {
      const p = (c as any).profiles
      const nom = c.type_compte === 'entreprise'
        ? (c.entreprise_nom ?? '')
        : `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim()
      return (
        nom.toLowerCase().includes(filterQ) ||
        (p?.telephone ?? '').toLowerCase().includes(filterQ) ||
        (c.adresse_facturation ?? '').toLowerCase().includes(filterQ)
      )
    })
  }

  const tabs = [
    { key: '',            label: 'Tous',         count: counts.total },
    { key: 'entreprise',  label: 'Entreprises',  count: counts.entreprise },
    { key: 'particulier', label: 'Particuliers', count: counts.particulier },
  ]

  return (
    <>
      <style>{`
        .client-row:hover { background: rgba(201,168,76,.04); }
        .tab-link:hover { color: var(--t1) !important; }
        .search-input:focus { border-color: rgba(201,168,76,.4) !important; }
      `}</style>

      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gb)',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--t1)' }}>Clients</div>
          <div style={{
            fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11,
            color: 'var(--t3)', background: 'var(--elevated)',
            border: '1px solid var(--gb)', borderRadius: 6, padding: '2px 7px',
          }}>
            {list.length}{filterType || filterQ ? ` / ${counts.total}` : ''}
          </div>
        </div>
        <a href="/admin/clients/nouveau" style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '7px 14px', borderRadius: 8,
          background: 'var(--gold)', color: '#0A0A0A',
          fontSize: 12, fontWeight: 600, textDecoration: 'none',
          boxShadow: '0 2px 8px rgba(201,168,76,.25)',
        }}>
          <svg width="11" height="11" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/>
          </svg>
          Nouveau client
        </a>
      </div>

      {/* Barre de filtres */}
      <div style={{
        position: 'sticky', top: 60, zIndex: 40,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gb)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 44,
      }}>
        {/* Onglets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
          {tabs.map(tab => {
            const isActive = filterType === tab.key
            const href = tab.key
              ? `/admin/clients?type=${tab.key}${filterQ ? `&q=${encodeURIComponent(filterQ)}` : ''}`
              : `/admin/clients${filterQ ? `?q=${encodeURIComponent(filterQ)}` : ''}`
            return (
              <a
                key={tab.key}
                href={href}
                className="tab-link"
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '0 12px', height: '100%',
                  fontSize: 11, fontWeight: isActive ? 600 : 400,
                  color: isActive ? 'var(--gold)' : 'var(--t2)',
                  textDecoration: 'none',
                  borderBottom: isActive ? '2px solid var(--gold)' : '2px solid transparent',
                  transition: 'color .15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
                <span style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 9, color: isActive ? 'var(--gold)' : 'var(--t3)',
                }}>
                  {tab.count}
                </span>
              </a>
            )
          })}
        </div>

        {/* Recherche */}
        <form method="GET" action="/admin/clients" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {filterType && <input type="hidden" name="type" value={filterType} />}
          <div style={{ position: 'relative' }}>
            <svg
              width="13" height="13" fill="none" viewBox="0 0 24 24"
              stroke="var(--t3)" strokeWidth={2}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              name="q"
              className="search-input"
              defaultValue={filterQ}
              placeholder="Nom, téléphone…"
              style={{
                padding: '6px 12px 6px 30px',
                background: 'var(--elevated)', border: '1px solid var(--t3)',
                borderRadius: 7, color: 'var(--t1)', fontSize: 11,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                outline: 'none', width: 180,
                transition: 'border-color .15s',
              }}
            />
          </div>
          {filterQ && (
            <a
              href={filterType ? `/admin/clients?type=${filterType}` : '/admin/clients'}
              style={{ fontSize: 10, color: 'var(--t2)', textDecoration: 'none' }}
            >
              ✕
            </a>
          )}
        </form>
      </div>

      {/* Tableau */}
      <div style={{ padding: '20px 32px' }}>
        <div style={{
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 14, overflow: 'hidden',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 120px 1fr 130px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>Client</div>
            <div>Type</div>
            <div>Adresse facturation</div>
            <div style={{ textAlign: 'right' }}>Membre depuis</div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              {filterQ ? `Aucun client pour « ${filterQ} »` : 'Aucun client enregistré'}
            </div>
          ) : list.map((client: any) => {
            const p = client.profiles
            const isEntreprise = client.type_compte === 'entreprise'
            const nomAffiche = isEntreprise
              ? (client.entreprise_nom ?? '—')
              : `${p?.prenom ?? ''} ${p?.nom ?? ''}`.trim() || '—'
            const initials = isEntreprise
              ? (client.entreprise_nom?.[0] ?? 'E').toUpperCase()
              : `${p?.prenom?.[0] ?? ''}${p?.nom?.[0] ?? ''}`.toUpperCase()

            return (
              <a
                key={client.id}
                href={`/admin/clients/${client.id}`}
                className="client-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 120px 1fr 130px',
                  padding: '13px 20px',
                  borderBottom: '1px solid rgba(201,168,76,.04)',
                  alignItems: 'center',
                  textDecoration: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: isEntreprise ? 6 : '50%', flexShrink: 0,
                    background: isEntreprise
                      ? 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))'
                      : 'var(--elevated)',
                    border: isEntreprise ? '1px solid rgba(201,168,76,.2)' : '1px solid var(--t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: isEntreprise ? 'var(--font-cormorant), serif' : 'var(--font-dm-sans), sans-serif',
                    fontSize: isEntreprise ? 13 : 11, fontWeight: 600,
                    color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
                  }}>{initials}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{nomAffiche}</div>
                    <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{p?.telephone ?? '—'}</div>
                  </div>
                </div>

                <div>
                  <span style={{
                    fontSize: 9.5, padding: '3px 9px', borderRadius: 20, fontWeight: 500,
                    color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
                    background: isEntreprise ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
                    border: `1px solid ${isEntreprise ? 'rgba(201,168,76,.2)' : 'var(--t3)'}`,
                  }}>
                    {isEntreprise ? 'Entreprise' : 'Particulier'}
                  </span>
                </div>

                <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                  {client.adresse_facturation ?? '—'}
                </div>

                <div style={{
                  textAlign: 'right',
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: 11, color: 'var(--t3)',
                }}>
                  {new Date(client.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </div>
              </a>
            )
          })}
        </div>
      </div>
    </>
  )
}
