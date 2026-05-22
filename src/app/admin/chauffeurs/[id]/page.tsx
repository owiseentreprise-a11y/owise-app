import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import {
  TYPE_VEHICULE_LABEL,
  STATUT_COURSE_LABEL,
  STATUT_COURSE_COLOR,
  type StatutChauffeur,
  type TypeContrat,
  type TypeVehicule,
  type TypeDocument,
} from '@/lib/types'
import ChauffeurEditActions from './ChauffeurEditActions'

export const dynamic = 'force-dynamic'

const STATUT_BADGE: Record<StatutChauffeur, { color: string; bg: string; label: string }> = {
  disponible: { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', label: 'Disponible' },
  en_course:  { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', label: 'En course' },
  hors_ligne: { color: 'var(--t3)',  bg: 'var(--elevated)',      label: 'Hors ligne' },
}

export default async function ChauffeurDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const [chauffeurRes, docsRes, coursesRes] = await Promise.all([
    supabase
      .from('chauffeurs')
      .select('*, profiles(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('documents_chauffeur')
      .select('*')
      .eq('chauffeur_id', id)
      .order('type'),
    supabase
      .from('courses')
      .select('id, statut, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime')
      .eq('chauffeur_id', id)
      .order('date_prevue', { ascending: false })
      .limit(8),
  ])

  if (chauffeurRes.error || !chauffeurRes.data) notFound()

  const c = chauffeurRes.data
  const p = (c as any).profiles
  const docs = docsRes.data ?? []
  const courses = coursesRes.data ?? []

  const prenom = p?.prenom ?? ''
  const nom    = p?.nom ?? ''
  const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
  const s = STATUT_BADGE[c.statut as StatutChauffeur]

  const docsForActions = docs.map((d: any) => ({
    id: d.id,
    type: d.type as TypeDocument,
    date_expiration: d.date_expiration,
    statut: d.statut,
  }))

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
          <a href="/admin/chauffeurs" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Chauffeurs
          </a>
          <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))',
              border: '1px solid rgba(201,168,76,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 12, fontWeight: 600, color: 'var(--gold)',
            }}>{initials}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{prenom} {nom}</span>
          </div>
        </div>
        <span style={{
          fontSize: 10, padding: '4px 10px', borderRadius: 20, fontWeight: 600,
          color: s.color, background: s.bg, border: `1px solid ${s.color}30`,
        }}>{s.label}</span>
      </div>

      {/* Body */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 320px',
        gap: 20, padding: '24px 32px', alignItems: 'start',
      }}>

        {/* ── Colonne gauche ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Carte identité */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: 20,
          }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 16 }}>
              Identité
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))',
                border: '1px solid rgba(201,168,76,.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--font-cormorant), serif',
                fontSize: 22, fontWeight: 600, color: 'var(--gold)',
              }}>{initials}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--t1)', fontFamily: 'var(--font-cormorant), serif' }}>
                  {prenom} {nom}
                </div>
                {p?.telephone && (
                  <a href={`tel:${p.telephone}`} style={{
                    fontSize: 12, color: 'var(--gold)', textDecoration: 'none',
                    display: 'block', marginTop: 4,
                  }}>{p.telephone}</a>
                )}
              </div>
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
              marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(201,168,76,.07)',
            }}>
              {[
                { label: 'Véhicule', value: [c.vehicule_marque, c.vehicule_modele].filter(Boolean).join(' ') || '—' },
                { label: 'Type', value: TYPE_VEHICULE_LABEL[c.type_vehicule as TypeVehicule] ?? '—' },
                { label: 'Contrat', value: c.type_contrat === 'salarie' ? 'Salarié' : 'Sous-traitant' },
                { label: 'Inscrit le', value: new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t1)' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
          }}>
            {[
              { label: 'Courses effectuées', value: c.nb_courses.toString(), color: 'var(--t1)', mono: true },
              {
                label: 'Note moyenne',
                value: c.note_moyenne > 0 ? c.note_moyenne.toFixed(1) : '—',
                color: c.note_moyenne >= 4.5 ? 'var(--grn)' : c.note_moyenne >= 4 ? 'var(--gold)' : 'var(--amb)',
                mono: true,
              },
              {
                label: 'Immatriculation',
                value: c.vehicule_immatriculation ?? '—',
                color: 'var(--t2)', mono: true,
              },
            ].map(item => (
              <div key={item.label} style={{
                background: 'var(--surface)', border: '1px solid var(--gb)',
                borderRadius: 12, padding: 16,
              }}>
                <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>
                  {item.label}
                </div>
                <div style={{
                  fontSize: 22, color: item.color, fontWeight: 500,
                  fontFamily: item.mono ? 'var(--font-jetbrains), monospace' : undefined,
                }}>
                  {item.value}
                </div>
              </div>
            ))}
          </div>

          {/* Courses récentes */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px',
              fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--t2)', fontWeight: 500,
              borderBottom: '1px solid rgba(201,168,76,.07)',
            }}>Courses récentes</div>

            {courses.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                Aucune course
              </div>
            ) : courses.map((course: any) => {
              const date = new Date(course.date_prevue)
              const prix = course.prix_final ?? course.prix_estime
              const statutColor = STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR] ?? 'var(--t2)'
              return (
                <a
                  key={course.id}
                  href={`/admin/courses/${course.id}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 110px 80px 70px',
                    padding: '12px 20px',
                    borderBottom: '1px solid rgba(201,168,76,.04)',
                    alignItems: 'center',
                    textDecoration: 'none',
                  }}
                >
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 2 }}>
                      {course.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 10, color: 'var(--t2)',
                  }}>
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} · {date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ fontSize: 10, color: statutColor }}>
                    {STATUT_COURSE_LABEL[course.statut as keyof typeof STATUT_COURSE_LABEL]}
                  </div>
                  <div style={{
                    textAlign: 'right',
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 12, color: 'var(--gold)',
                  }}>
                    {prix ? `${prix.toFixed(0)} €` : '—'}
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* ── Colonne droite (édition) ── */}
        <ChauffeurEditActions
          chauffeurId={id}
          statut={c.statut as StatutChauffeur}
          profile={{ nom: nom, prenom: prenom, telephone: p?.telephone ?? '' }}
          vehicule={{
            marque: c.vehicule_marque ?? '',
            modele: c.vehicule_modele ?? '',
            immatriculation: c.vehicule_immatriculation ?? '',
            type: c.type_vehicule as TypeVehicule,
          }}
          typeContrat={c.type_contrat as TypeContrat}
          documents={docsForActions}
        />
      </div>
    </>
  )
}
