import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { STATUT_COURSE_LABEL, TYPE_VEHICULE_LABEL, type StatutCourse } from '@/lib/types'
import CourseActions from './CourseActions'

export const dynamic = 'force-dynamic'

const STATUT_STYLE: Record<StatutCourse, { color: string; bg: string; border: string }> = {
  en_attente:      { color: 'var(--amb)', bg: 'rgba(232,160,48,.12)', border: 'rgba(232,160,48,.25)' },
  acceptee:        { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', border: 'rgba(74,142,208,.25)' },
  en_route:        { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', border: 'rgba(74,142,208,.25)' },
  prise_en_charge: { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', border: 'rgba(60,196,124,.25)' },
  terminee:        { color: 'var(--t2)',  bg: 'var(--elevated)',      border: 'var(--t3)' },
  annulee:         { color: 'var(--red)', bg: 'rgba(217,80,80,.12)',  border: 'rgba(217,80,80,.25)' },
}

function fmt(iso: string | null, opts: Intl.DateTimeFormatOptions) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-FR', opts)
}

function duree(debut: string | null, fin: string | null) {
  if (!debut || !fin) return null
  const mins = Math.round((new Date(fin).getTime() - new Date(debut).getTime()) / 60000)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h${m.toString().padStart(2, '0')}` : `${m} min`
}

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [courseRes, chauffeursRes] = await Promise.all([
    supabase
      .from('courses')
      .select('*, clients(*, profiles(*)), chauffeurs(*, profiles(*)), collaborateurs(poste, profiles(prenom, nom, telephone)), sous_traitants(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('chauffeurs')
      .select('id, statut, vehicule_marque, vehicule_modele, profiles(prenom, nom, telephone)')
      .order('statut'),
  ])

  if (courseRes.error || !courseRes.data) notFound()

  const course = courseRes.data
  const chauffeurs = chauffeursRes.data ?? []
  const statut = course.statut as StatutCourse
  const s = STATUT_STYLE[statut]

  const clientData = (course as any).clients
  const chauffeurData = (course as any).chauffeurs
  const collabData = (course as any).collaborateurs
  const sousTraitantData = (course as any).sous_traitants

  const clientNom = clientData?.type_compte === 'entreprise'
    ? (clientData.entreprise_nom ?? null)
    : clientData?.profiles
      ? `${clientData.profiles.prenom} ${clientData.profiles.nom}`.trim()
      : null
  const clientTel: string | null = clientData?.profiles?.telephone ?? null
  const clientType: string = clientData?.type_compte ?? 'particulier'

  const collabNom = collabData?.profiles
    ? `${collabData.profiles.prenom} ${collabData.profiles.nom}`.trim()
    : null
  const collabPoste: string | null = collabData?.poste ?? null
  const collabTel: string | null = collabData?.profiles?.telephone ?? null

  const chauffeurNom = chauffeurData?.profiles
    ? `${chauffeurData.profiles.prenom} ${chauffeurData.profiles.nom}`.trim()
    : null
  const chauffeurTel: string | null = chauffeurData?.profiles?.telephone ?? null
  const chauffeurVehicule = [chauffeurData?.vehicule_marque, chauffeurData?.vehicule_modele]
    .filter(Boolean).join(' ') || '—'

  // Données normalisées pour le composant client
  const courseForActions = {
    id: course.id,
    statut,
    chauffeur_id: course.chauffeur_id,
    prix_estime: course.prix_estime,
    prix_final: course.prix_final,
    notes: course.notes,
    type_vehicule: course.type_vehicule,
    nb_passagers: course.nb_passagers,
    date_prevue: course.date_prevue,
    date_debut: course.date_debut,
    date_fin: course.date_fin,
    created_at: course.created_at,
    adresse_depart: course.adresse_depart,
    adresse_arrivee: course.adresse_arrivee,
    client: clientNom ? { nom: '', prenom: clientNom, telephone: clientTel, entreprise: clientData?.entreprise_nom } : null,
    chauffeur: chauffeurNom ? { nom: '', prenom: chauffeurNom, telephone: chauffeurTel, vehicule: chauffeurVehicule } : null,
  }

  const chauffeursForActions = chauffeurs.map((c: any) => ({
    id: c.id,
    nom: c.profiles?.nom ?? '',
    prenom: c.profiles?.prenom ?? '',
    vehicule: [c.vehicule_marque, c.vehicule_modele].filter(Boolean).join(' ') || '—',
    statut: c.statut,
  }))

  const courseRef = course.id.slice(-8).toUpperCase()
  const dureeReelle = duree(course.date_debut, course.date_fin)

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <a href="/admin/courses" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Courses
          </a>
          <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
          <div style={{
            fontSize: 11, color: 'var(--t2)',
            fontFamily: 'var(--font-jetbrains), monospace',
          }}>
            #{courseRef}
          </div>
        </div>
        <span style={{
          fontSize: 10, padding: '4px 10px', borderRadius: 20, fontWeight: 600,
          color: s.color, background: s.bg,
          border: `1px solid ${s.border}`,
        }}>
          {STATUT_COURSE_LABEL[statut]}
        </span>
      </div>

      {/* Body */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 320px',
        gap: 20, padding: '24px 32px',
        alignItems: 'start',
      }}>

        {/* ── Colonne gauche ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Trajet */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '20px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
              Trajet
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: 'var(--grn)', marginTop: 4, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 2 }}>Départ</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{course.adresse_depart}</div>
                </div>
              </div>
              <div style={{ marginLeft: 5, width: 1.5, height: 20, background: 'var(--t3)' }} />
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{
                  width: 10, height: 10, borderRadius: 2,
                  border: '2px solid var(--red)', marginTop: 4, flexShrink: 0,
                }} />
                <div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 2 }}>Arrivée</div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{course.adresse_arrivee}</div>
                </div>
              </div>
            </div>

            {/* Méta trajet */}
            <div style={{
              display: 'flex', gap: 24, marginTop: 18,
              paddingTop: 16, borderTop: '1px solid rgba(201,168,76,.07)',
            }}>
              {[
                { label: 'Date prévue', value: fmt(course.date_prevue, { day: '2-digit', month: 'short', year: 'numeric' }) },
                { label: 'Heure', value: fmt(course.date_prevue, { hour: '2-digit', minute: '2-digit' }), mono: true },
                { label: 'Véhicule', value: TYPE_VEHICULE_LABEL[course.type_vehicule as keyof typeof TYPE_VEHICULE_LABEL] },
                { label: 'Passagers', value: `${course.nb_passagers}`, mono: true },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 13, color: 'var(--t1)',
                    fontFamily: item.mono ? 'var(--font-jetbrains), monospace' : undefined,
                  }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Client */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '20px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14 }}>
              Client
            </div>
            {clientNom ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Entité de facturation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%',
                      background: 'var(--elevated)', border: '1px solid var(--t3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-cormorant), serif',
                      fontSize: 16, color: 'var(--t1)',
                    }}>
                      {clientNom.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                        {clientNom}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                        {clientType === 'entreprise' ? 'Compte entreprise' : 'Client particulier'}
                      </div>
                      {clientTel && (
                        <a href={`tel:${clientTel}`} style={{
                          fontSize: 11, color: 'var(--gold)', textDecoration: 'none', display: 'block', marginTop: 2,
                        }}>
                          {clientTel}
                        </a>
                      )}
                    </div>
                  </div>
                  {clientTel && (
                    <a href={`tel:${clientTel}`} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 8,
                      background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)',
                      color: 'var(--gold)', fontSize: 12, fontWeight: 500,
                      textDecoration: 'none',
                    }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                      </svg>
                      Appeler
                    </a>
                  )}
                </div>

                {/* Collaborateur voyageur */}
                {collabNom && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--elevated)', border: '1px solid var(--t3)',
                  }}>
                    <div>
                      <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 3 }}>Voyageur</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{collabNom}</div>
                      {collabPoste && (
                        <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{collabPoste}</div>
                      )}
                      {collabTel && (
                        <a href={`tel:${collabTel}`} style={{
                          fontSize: 11, color: 'var(--gold)', textDecoration: 'none', display: 'block', marginTop: 2,
                        }}>
                          {collabTel}
                        </a>
                      )}
                    </div>
                    {collabTel && (
                      <a href={`tel:${collabTel}`} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8,
                        background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)',
                        color: 'var(--gold)', fontSize: 12, fontWeight: 500,
                        textDecoration: 'none',
                      }}>
                        <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                        </svg>
                        Appeler
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: 'var(--t3)' }}>Aucun client assigné</div>
            )}
          </div>

          {/* Sous-traitant */}
          {sousTraitantData && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '20px',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14 }}>
                Sous-traitant
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 16, color: 'var(--gold)',
                    fontFamily: 'var(--font-cormorant), serif',
                  }}>
                    {sousTraitantData.nom.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                      {sousTraitantData.nom}
                    </div>
                    {sousTraitantData.contact_nom && (
                      <div style={{ fontSize: 11, color: 'var(--t2)' }}>{sousTraitantData.contact_nom}</div>
                    )}
                    {sousTraitantData.telephone && (
                      <a href={`tel:${sousTraitantData.telephone}`} style={{ fontSize: 11, color: 'var(--gold)', textDecoration: 'none', display: 'block', marginTop: 2 }}>
                        {sousTraitantData.telephone}
                      </a>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {sousTraitantData.telephone && (
                    <a href={`tel:${sousTraitantData.telephone}`} style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '8px 14px', borderRadius: 8,
                      background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)',
                      color: 'var(--gold)', fontSize: 12, fontWeight: 500, textDecoration: 'none',
                    }}>
                      <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/>
                      </svg>
                      Appeler
                    </a>
                  )}
                  <a href={`/admin/sous-traitants/${sousTraitantData.id}`} style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 14px', borderRadius: 8,
                    background: 'var(--elevated)', border: '1px solid var(--t3)',
                    color: 'var(--t2)', fontSize: 12, textDecoration: 'none',
                  }}>
                    Fiche →
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Timing */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '20px',
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14 }}>
              Chronologie
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
              {[
                { label: 'Créée le', value: fmt(course.created_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Prévue', value: fmt(course.date_prevue, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) },
                { label: 'Début réel', value: fmt(course.date_debut, { hour: '2-digit', minute: '2-digit' }) },
                { label: 'Fin / Durée', value: course.date_fin ? `${fmt(course.date_fin, { hour: '2-digit', minute: '2-digit' })}${dureeReelle ? ` · ${dureeReelle}` : ''}` : '—' },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 5 }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 12, color: 'var(--t1)',
                    fontFamily: 'var(--font-jetbrains), monospace',
                  }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Colonne droite (actions) ── */}
        <CourseActions
          course={courseForActions}
          chauffeurs={chauffeursForActions}
        />
      </div>
    </>
  )
}
