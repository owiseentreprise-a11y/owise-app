import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserEmail }  from '@/lib/supabase/admin'
import { STATUT_COURSE_LABEL, STATUT_COURSE_COLOR } from '@/lib/types'
import ClientEditActions, { DeleteClientButton } from './ClientEditActions'
import CollaborateursSection from './CollaborateursSection'
import GenererFactureButton from './GenererFactureButton'
import { togglePayerAbord } from './actions'

export const dynamic = 'force-dynamic'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = createAdminClient()

  const [clientRes, coursesRes, collabsRes, email] = await Promise.all([
    supabase
      .from('clients')
      .select('*, profiles(*)')
      .eq('id', id)
      .single(),
    supabase
      .from('courses')
      .select('id, statut, adresse_depart, adresse_arrivee, date_prevue, prix_final, prix_estime, chauffeur_id, chauffeurs(profiles(prenom, nom))')
      .eq('client_id', id)
      .order('date_prevue', { ascending: false })
      .limit(20),
    supabase
      .from('collaborateurs')
      .select('id, poste, nom, prenom, tel, email, adresse')
      .eq('client_id', id)
      .order('created_at', { ascending: true }),
    getUserEmail(id),
  ])

  if (clientRes.error || !clientRes.data) notFound()

  const client = clientRes.data as any
  const p = client.profiles  // peut être null dans le nouveau schéma
  const courses = coursesRes.data ?? []
  const collaborateurs = (collabsRes.data ?? []) as any[]
  const isEntreprise = client.type_compte === 'entreprise'
  // Colonnes directes sur clients (nouveau schéma) avec fallback profiles (ancien)
  const prenom = client.prenom || p?.prenom || ''
  const nom    = client.nom    || p?.nom    || ''
  const tel    = client.tel    || p?.telephone || ''
  const nomAffiche = isEntreprise
    ? (client.entreprise_nom ?? '—')
    : `${prenom} ${nom}`.trim() || '—'
  const initials = isEntreprise
    ? (client.entreprise_nom?.[0] ?? 'E').toUpperCase()
    : `${(prenom[0] ?? '')}${(nom[0] ?? '')}`.toUpperCase()

  const coursesTerminees = courses.filter(c => c.statut === 'terminee')
  const caTotal = coursesTerminees.reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)

  // Courses terminées sans facture (pour la facturation groupée)
  const [coursesRes2] = await Promise.all([
    supabase
      .from('courses')
      .select('id, prix_final, prix_estime')
      .eq('client_id', id)
      .eq('statut', 'terminee')
      .is('facture_id', null),
  ])
  const coursesNonFacturees = coursesRes2.data ?? []
  const montantNonFacture = coursesNonFacturees.reduce((s, c) => s + ((c as any).prix_final ?? (c as any).prix_estime ?? 0), 0)

  return (
    <>
      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gb)',
        boxShadow: '0 1px 3px rgba(0,0,0,.04)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/admin/clients" style={{
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 11, color: 'var(--t2)', textDecoration: 'none',
          }}>
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
            </svg>
            Clients
          </Link>
          <div style={{ width: 1, height: 14, background: 'var(--t3)' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: isEntreprise ? 6 : '50%',
              background: isEntreprise
                ? 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))'
                : 'var(--elevated)',
              border: isEntreprise ? '1px solid rgba(201,168,76,.2)' : '1px solid var(--t3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: isEntreprise ? 'var(--font-cormorant), serif' : undefined,
              fontSize: 12, fontWeight: 600,
              color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
            }}>{initials}</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{nomAffiche}</span>
          </div>
        </div>
        <span style={{
          fontSize: 9.5, padding: '4px 10px', borderRadius: 20, fontWeight: 500,
          color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
          background: isEntreprise ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
          border: `1px solid ${isEntreprise ? 'rgba(201,168,76,.2)' : 'var(--t3)'}`,
        }}>
          {isEntreprise ? 'Entreprise' : 'Particulier'}
        </span>
      </div>

      {/* Body */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 300px',
        gap: 20, padding: '24px 32px', alignItems: 'start',
      }}>

        {/* Colonne gauche */}
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
                width: 52, height: 52, borderRadius: isEntreprise ? 10 : '50%', flexShrink: 0,
                background: isEntreprise
                  ? 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))'
                  : 'var(--elevated)',
                border: isEntreprise ? '1px solid rgba(201,168,76,.2)' : '1px solid var(--t3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: isEntreprise ? 'var(--font-cormorant), serif' : undefined,
                fontSize: 20, fontWeight: 600,
                color: isEntreprise ? 'var(--gold)' : 'var(--t2)',
              }}>{initials}</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--t1)', fontFamily: 'var(--font-cormorant), serif' }}>
                  {nomAffiche}
                </div>
                {!isEntreprise && prenom && (
                  <div style={{ fontSize: 12, color: 'var(--t2)', marginTop: 2 }}>{prenom} {nom}</div>
                )}
                {tel && (
                  <a href={`tel:${tel}`} style={{
                    fontSize: 12, color: 'var(--gold)', textDecoration: 'none', display: 'block', marginTop: 4,
                  }}>{tel}</a>
                )}
              </div>
              {tel && (
                <a href={`tel:${tel}`} style={{
                  marginLeft: 'auto',
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
            </div>

            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16,
              marginTop: 20, paddingTop: 16, borderTop: '1px solid rgba(201,168,76,.07)',
            }}>
              {[
                { label: 'Courses', value: courses.length.toString(), mono: true },
                { label: 'Terminées', value: coursesTerminees.length.toString(), mono: true },
                { label: 'CA total', value: `${caTotal.toFixed(0)} €`, mono: true, color: 'var(--gold)' },
                { label: 'Client depuis', value: new Date(client.created_at).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }) },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 4 }}>
                    {item.label}
                  </div>
                  <div style={{
                    fontSize: 15, color: item.color ?? 'var(--t1)', fontWeight: 500,
                    fontFamily: item.mono ? 'var(--font-jetbrains), monospace' : undefined,
                  }}>
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Courses */}
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            <div style={{
              padding: '14px 20px', fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase',
              color: 'var(--t2)', fontWeight: 500, borderBottom: '1px solid rgba(201,168,76,.07)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span>Historique des courses</span>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)' }}>
                {courses.length} au total
              </span>
            </div>

            {courses.length === 0 ? (
              <div style={{ padding: '28px 20px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                Aucune course
              </div>
            ) : courses.map((course: any) => {
              const date = new Date(course.date_prevue)
              const prix = course.prix_final ?? course.prix_estime
              const chauffeur = course.chauffeurs
              const chauffeurNom = chauffeur?.profiles
                ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                : '—'
              return (
                <a key={course.id} href={`/admin/courses/${course.id}`} style={{
                  display: 'grid', gridTemplateColumns: '1fr 110px 100px 60px 60px',
                  padding: '11px 20px', borderBottom: '1px solid rgba(201,168,76,.04)',
                  alignItems: 'center', textDecoration: 'none',
                }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                      {course.adresse_depart.split(',')[0]}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--t3)' }}>{chauffeurNom}</div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)',
                  }}>
                    {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                    {' · '}{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{
                    textAlign: 'right', fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 12, color: 'var(--gold)',
                  }}>
                    {prix ? `${prix.toFixed(0)} €` : '—'}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{
                      fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 500,
                      color: STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR],
                      background: `${STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR]}18`,
                      border: `1px solid ${STATUT_COURSE_COLOR[course.statut as keyof typeof STATUT_COURSE_COLOR]}30`,
                    }}>
                      {STATUT_COURSE_LABEL[course.statut as keyof typeof STATUT_COURSE_LABEL]}
                    </span>
                  </div>
                </a>
              )
            })}
          </div>
        </div>

        {/* Colonne droite */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <ClientEditActions
            clientId={id}
            email={email ?? undefined}
            profile={{ nom, prenom, telephone: tel ?? '' }}
            compte={{
              type_compte: client.type_compte,
              entreprise_nom: client.entreprise_nom ?? '',
              adresse_facturation: client.adresse_facturation ?? '',
            }}
            tarif={{
              coef_tarifaire: client.coef_tarifaire ?? 1,
              paiement_differe: client.paiement_differe ?? false,
            }}
            facturationMode={(client.facturation_mode as 'mensuelle' | 'par_prestation') ?? 'mensuelle'}
          />

          {/* Toggle payer à bord — particuliers uniquement */}
          {!isEntreprise && (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 12 }}>
                Paiement
              </div>
              <form action={async () => {
                'use server'
                await togglePayerAbord(id, !client.payer_a_bord)
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked={client.payer_a_bord === true}
                    style={{ display: 'none' }} readOnly />
                  <button type="submit" style={{
                    width: 40, height: 22, borderRadius: 11, border: 'none', cursor: 'pointer',
                    background: client.payer_a_bord ? 'var(--gold)' : 'var(--t3)',
                    position: 'relative', transition: 'background .2s', flexShrink: 0,
                    padding: 0,
                  }}>
                    <span style={{
                      position: 'absolute', top: 3,
                      left: client.payer_a_bord ? 21 : 3,
                      width: 16, height: 16, borderRadius: '50%',
                      background: '#fff', transition: 'left .2s',
                      display: 'block',
                    }} />
                  </button>
                  <span style={{ fontSize: 13, color: 'var(--t1)' }}>
                    Autoriser paiement à bord (cash / chèque)
                  </span>
                </label>
                <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 8 }}>
                  {client.payer_a_bord
                    ? '✓ Ce client peut réserver sans payer en ligne.'
                    : 'Par défaut : paiement Stripe obligatoire à la réservation.'}
                </div>
              </form>
            </div>
          )}
          {isEntreprise && (
            <CollaborateursSection
              clientId={id}
              collaborateurs={collaborateurs}
            />
          )}

          <GenererFactureButton
            clientId={id}
            nbCoursesNonFacturees={coursesNonFacturees.length}
            montantNonFacture={montantNonFacture}
          />

          <DeleteClientButton clientId={id} nomAffiche={nomAffiche} />
        </div>
      </div>
    </>
  )
}
