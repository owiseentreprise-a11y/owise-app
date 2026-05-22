import { createClient } from '@/lib/supabase/server'
import UpdateStatutButton from './UpdateStatutButton'

export const dynamic = 'force-dynamic'

const EN_COURS = ['acceptee', 'en_route', 'prise_en_charge']


export default async function CoursesPage({
  searchParams,
}: {
  searchParams: Promise<{ statut?: string; q?: string }>
}) {
  const sp = await searchParams
  const filterStatut = sp.statut ?? ''
  const filterQ = (sp.q ?? '').toLowerCase().trim()

  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select('*, clients(*, profiles(*)), chauffeurs(*, profiles(*)), collaborateurs(profiles(prenom, nom)), sous_traitants(id, nom)')
    .order('date_prevue', { ascending: false })
    .limit(500)

  const all = courses ?? []

  // Comptages pour les onglets
  const counts = {
    total:      all.length,
    en_attente: all.filter(c => c.statut === 'en_attente').length,
    en_cours:   all.filter(c => EN_COURS.includes(c.statut)).length,
    terminee:   all.filter(c => c.statut === 'terminee').length,
    annulee:    all.filter(c => c.statut === 'annulee').length,
  }

  // Filtrage par statut
  let list = all
  if (filterStatut === 'en_attente') list = all.filter(c => c.statut === 'en_attente')
  else if (filterStatut === 'en_cours') list = all.filter(c => EN_COURS.includes(c.statut))
  else if (filterStatut === 'terminee') list = all.filter(c => c.statut === 'terminee')
  else if (filterStatut === 'annulee') list = all.filter(c => c.statut === 'annulee')

  // Filtrage par recherche
  if (filterQ) {
    list = list.filter(c => {
      const client = (c as any).clients
      const collab = (c as any).collaborateurs
      const clientNom = client?.type_compte === 'entreprise'
        ? (client.entreprise_nom ?? '')
        : `${client?.profiles?.prenom ?? ''} ${client?.profiles?.nom ?? ''}`.trim()
      const collabNom = collab?.profiles
        ? `${collab.profiles.prenom} ${collab.profiles.nom}`
        : ''
      return (
        c.adresse_depart.toLowerCase().includes(filterQ) ||
        c.adresse_arrivee.toLowerCase().includes(filterQ) ||
        clientNom.toLowerCase().includes(filterQ) ||
        collabNom.toLowerCase().includes(filterQ)
      )
    })
  }

  const tabs = [
    { key: '',           label: 'Toutes',     count: counts.total },
    { key: 'en_attente', label: 'En attente', count: counts.en_attente },
    { key: 'en_cours',   label: 'En cours',   count: counts.en_cours },
    { key: 'terminee',   label: 'Terminées',  count: counts.terminee },
    { key: 'annulee',    label: 'Annulées',   count: counts.annulee },
  ]

  return (
    <>
      <style>{`
        .course-row:hover { background: rgba(201,168,76,.04); }
        .tab-link:hover { color: var(--t1) !important; }
        .search-input:focus { border-color: rgba(201,168,76,.4) !important; }
      `}</style>

      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(7,7,26,.92)', backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(201,168,76,.08)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Courses</div>
          <div style={{
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11, color: 'var(--t3)',
          }}>
            {list.length}{filterStatut || filterQ ? ` / ${counts.total}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <a href="/admin/courses/export" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--elevated)', color: 'var(--t2)',
            border: '1px solid var(--t3)',
            padding: '7px 14px', borderRadius: 8,
            fontSize: 11, fontWeight: 500, textDecoration: 'none',
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
            Export CSV
          </a>
          <a href="/admin/courses/nouvelle" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--gold)', color: 'var(--base)',
            padding: '8px 16px', borderRadius: 8,
            fontSize: 12, fontWeight: 600, textDecoration: 'none',
          }}>
            + Nouvelle course
          </a>
        </div>
      </div>

      {/* Barre de filtres */}
      <div style={{
        position: 'sticky', top: 60, zIndex: 40,
        background: 'rgba(7,7,26,.95)', backdropFilter: 'blur(8px)',
        borderBottom: '1px solid rgba(201,168,76,.06)',
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        height: 44,
      }}>
        {/* Onglets statut */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, height: '100%' }}>
          {tabs.map(tab => {
            const isActive = filterStatut === tab.key
            const href = tab.key
              ? `/admin/courses?statut=${tab.key}${filterQ ? `&q=${encodeURIComponent(filterQ)}` : ''}`
              : `/admin/courses${filterQ ? `?q=${encodeURIComponent(filterQ)}` : ''}`
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
                {tab.count > 0 && (
                  <span style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 9, color: isActive ? 'var(--gold)' : 'var(--t3)',
                  }}>
                    {tab.count}
                  </span>
                )}
              </a>
            )
          })}
        </div>

        {/* Recherche */}
        <form method="GET" action="/admin/courses" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {filterStatut && <input type="hidden" name="statut" value={filterStatut} />}
          <div style={{ position: 'relative' }}>
            <svg
              width="13" height="13" fill="none" viewBox="0 0 24 24"
              stroke="var(--t3)" strokeWidth={2}
              style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
            >
              <circle cx="11" cy="11" r="8"/><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35"/>
            </svg>
            <input
              name="q"
              className="search-input"
              defaultValue={filterQ}
              placeholder="Client, adresse…"
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
              href={filterStatut ? `/admin/courses?statut=${filterStatut}` : '/admin/courses'}
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
          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 140px 130px 160px 100px',
            padding: '10px 20px',
            fontSize: 9.5, letterSpacing: '.1em', textTransform: 'uppercase',
            color: 'var(--t3)', fontWeight: 500,
            borderBottom: '1px solid rgba(201,168,76,.07)',
          }}>
            <div>Trajet</div>
            <div>Client</div>
            <div>Chauffeur</div>
            <div>Date / Heure</div>
            <div>Statut</div>
            <div style={{ textAlign: 'right' }}>Prix</div>
          </div>

          {list.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--t3)', fontSize: 13 }}>
              {filterQ
                ? `Aucune course pour « ${filterQ} »`
                : 'Aucune course dans cette catégorie'}
            </div>
          ) : (
            list.map(course => {
              const client  = (course as any).clients
              const chauffeur = (course as any).chauffeurs
              const collab  = (course as any).collaborateurs

              const clientNom = client
                ? client.type_compte === 'entreprise'
                  ? (client.entreprise_nom ?? '—')
                  : `${client.profiles?.prenom ?? ''} ${client.profiles?.nom ?? ''}`.trim() || '—'
                : '—'
              const collabNom = collab?.profiles
                ? `${collab.profiles.prenom} ${collab.profiles.nom}`
                : null
              const chauffeurNom = chauffeur?.profiles
                ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                : null
              const date = new Date(course.date_prevue)

              return (
                <div
                  key={course.id}
                  className="course-row"
                  style={{
                    position: 'relative',
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr 140px 130px 160px 100px',
                    padding: '13px 20px',
                    borderBottom: '1px solid rgba(201,168,76,.04)',
                    alignItems: 'center',
                  }}
                >
                  <a
                    href={`/admin/courses/${course.id}`}
                    aria-label="Voir la course"
                    style={{ position: 'absolute', inset: 0, zIndex: 1 }}
                  />

                  {/* Trajet */}
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                      {course.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                  </div>

                  {/* Client */}
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    <div style={{ fontSize: 12, color: 'var(--t1)' }}>{clientNom}</div>
                    {collabNom && (
                      <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>↳ {collabNom}</div>
                    )}
                  </div>

                  {/* Chauffeur / Sous-traitant */}
                  <div style={{ position: 'relative', zIndex: 2 }}>
                    {chauffeurNom
                      ? <span style={{ fontSize: 12, color: 'var(--t2)' }}>{chauffeurNom}</span>
                      : (course as any).sous_traitants?.nom
                        ? <span style={{ fontSize: 11, color: 'var(--blu)', fontWeight: 500 }}>↗ {(course as any).sous_traitants.nom}</span>
                        : <span style={{ fontSize: 11, color: 'var(--amb)', fontWeight: 500 }}>Non assigné</span>
                    }
                  </div>

                  {/* Date */}
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 11, color: 'var(--t2)',
                    position: 'relative', zIndex: 2,
                  }}>
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    {' · '}
                    {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>

                  {/* Statut */}
                  <div style={{ position: 'relative', zIndex: 3 }}>
                    <UpdateStatutButton courseId={course.id} statut={course.statut} />
                  </div>

                  {/* Prix */}
                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 13, color: 'var(--gold)',
                    position: 'relative', zIndex: 2,
                  }}>
                    {course.prix_final ?? course.prix_estime
                      ? `${(course.prix_final ?? course.prix_estime)!.toFixed(0)} €`
                      : '—'}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
