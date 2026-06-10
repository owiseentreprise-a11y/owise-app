import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import { STATUT_COURSE_LABEL, STATUT_COURSE_COLOR } from '@/lib/types'
import type { Course } from '@/lib/types'
import AdminRealtime from './AdminRealtime'
import PanierCourses from './PanierCourses'

export const dynamic = 'force-dynamic'

const STATUT_CHAUFFEUR_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  disponible: { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', label: 'Disponible' },
  en_course:  { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', label: 'En course' },
  hors_ligne: { color: 'var(--t3)',  bg: 'var(--elevated)',      label: 'Hors ligne' },
}

export default async function AdminDashboard() {
  const supabase = createAdminClient()

  const now    = new Date()
  const today  = now.toISOString().split('T')[0]
  const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [coursesRes, chauffeursRes, weekRes, monthRes, facturesRetardRes, docsAlertRes] = await Promise.all([
    supabase
      .from('courses')
      .select('*, clients(*, profiles(*)), chauffeurs(*, profiles(*)), collaborateurs(prenom, nom)')
      .order('date_prevue', { ascending: false })
      .limit(60),
    supabase
      .from('chauffeurs')
      .select('id, statut, vehicule_marque, vehicule_modele, type_vehicule, profiles(prenom, nom)')
      .order('statut'),
    supabase
      .from('courses')
      .select('prix_final, prix_estime, statut')
      .gte('date_prevue', weekStart.toISOString()),
    supabase
      .from('courses')
      .select('prix_final, prix_estime, statut')
      .gte('date_prevue', monthStart.toISOString()),
    supabase
      .from('factures')
      .select('id, numero, montant_ttc, date_echeance, clients(entreprise_nom, type_compte, profiles(prenom, nom))')
      .in('statut', ['en_attente', 'retard'])
      .lt('date_echeance', now.toISOString())
      .order('date_echeance'),
    // Documents chauffeurs expirés ou expirant dans 30 jours
    supabase
      .from('documents_chauffeur')
      .select('id, type, date_expiration, statut, chauffeur_id, chauffeurs(profiles(prenom, nom))')
      .in('statut', ['expire', 'bientot_expire'])
      .order('date_expiration', { ascending: true }),
  ])

  const courses: Course[] = coursesRes.data ?? []
  const docsAlert = (docsAlertRes.data ?? []) as any[]
  const chauffeurs        = chauffeursRes.data ?? []
  const weekCourses  = weekRes.data ?? []
  const monthCourses = monthRes.data ?? []
  const facturesRetard = facturesRetardRes.data ?? []

  // KPIs jour
  const coursesAujourdHui    = courses.filter(c => c.date_prevue.startsWith(today))
  const coursesActives       = courses.filter(c => ['en_route', 'prise_en_charge', 'acceptee'].includes(c.statut))
  const coursesEnAttente     = courses.filter(c => c.statut === 'en_attente')
  const demandesCollaborateur = coursesEnAttente.filter(c => !!(c as any).collaborateur_id && !c.chauffeur_id)
  const nonAssignees         = coursesEnAttente.filter(c => !c.chauffeur_id)

  // CA jour : terminée (prix_final) + en attente (prix_estime)
  const caJourTerminee = coursesAujourdHui
    .filter(c => c.statut === 'terminee')
    .reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const caJourEstime = coursesAujourdHui
    .filter(c => c.statut !== 'terminee' && c.statut !== 'annulee')
    .reduce((s, c) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const caJour = caJourTerminee + caJourEstime

  // KPIs semaine — toutes statuts hors annulée
  const coursesSemaine = weekCourses.filter((c: any) => c.statut !== 'annulee').length
  const caSemaine = weekCourses
    .filter((c: any) => c.statut !== 'annulee')
    .reduce((s: number, c: any) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const caRéelSemaine = weekCourses
    .filter((c: any) => c.statut === 'terminee')
    .reduce((s: number, c: any) => s + (c.prix_final ?? 0), 0)

  // KPIs mois — toutes statuts hors annulée
  const coursesMois = monthCourses.filter((c: any) => c.statut !== 'annulee').length
  const caMois = monthCourses
    .filter((c: any) => c.statut !== 'annulee')
    .reduce((s: number, c: any) => s + (c.prix_final ?? c.prix_estime ?? 0), 0)
  const caRéelMois = monthCourses
    .filter((c: any) => c.statut === 'terminee')
    .reduce((s: number, c: any) => s + (c.prix_final ?? 0), 0)

  const chauffeursDisponibles = chauffeurs.filter(c => c.statut === 'disponible')
  const dateLabel = now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  // Format chauffeurs for DispatchRapideButton (profiles may be array or object)
  const chauffeursForDispatch = chauffeurs.map((c: any) => ({
    id: c.id,
    statut: c.statut,
    profiles: Array.isArray(c.profiles) ? (c.profiles[0] ?? null) : (c.profiles ?? null),
  }))

  return (
    <>
      <AdminRealtime intervalMs={30000} />

      {/* Topbar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'rgba(255,255,255,.95)', 
        borderBottom: '1px solid rgba(0,0,0,.07)',
        padding: '0 32px', height: 60,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        boxShadow: '0 1px 0 rgba(0,0,0,.06)',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>Dashboard</div>
          <div style={{ fontSize: 11, color: 'var(--t2)', textTransform: 'capitalize' }}>{dateLabel}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {nonAssignees.length > 0 && (
            <Link href="/admin/courses" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '5px 12px', borderRadius: 20,
              background: 'rgba(232,160,48,.12)', border: '1px solid rgba(232,160,48,.3)',
              color: 'var(--amb)', fontSize: 11, fontWeight: 500, textDecoration: 'none',
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amb)', display: 'inline-block' }} />
              {nonAssignees.length} sans chauffeur
            </Link>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--grn)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
            {chauffeursDisponibles.length} disponible{chauffeursDisponibles.length > 1 ? 's' : ''}
          </div>
        </div>
      </div>

      <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>

          {/* Aujourd'hui */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}>Aujourd&apos;hui</div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 26, fontWeight: 500, color: 'var(--t1)', lineHeight: 1 }}>
              {coursesAujourdHui.length}
              <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400, marginLeft: 5 }}>courses</span>
            </div>
            {coursesEnAttente.length > 0 && coursesAujourdHui.length === 0 && (
              <div style={{ fontSize: 10, color: 'var(--amb)', marginTop: 5 }}>
                {coursesEnAttente.length} en attente au total
              </div>
            )}
          </div>

          {/* En cours */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}>En cours</div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 26, fontWeight: 500, color: 'var(--blu)', lineHeight: 1 }}>
              {coursesActives.length}
              <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400, marginLeft: 5 }}>actives</span>
            </div>
          </div>

          {/* Sans chauffeur */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}>Sans chauffeur</div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 26, fontWeight: 500, color: nonAssignees.length > 0 ? 'var(--amb)' : 'var(--t3)', lineHeight: 1 }}>
              {nonAssignees.length}
              <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400, marginLeft: 5 }}>en attente</span>
            </div>
          </div>

          {/* CA du jour */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}>
              {caJourTerminee > 0 ? 'CA du jour' : 'CA estimé / jour'}
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 26, fontWeight: 500, color: 'var(--gold)', lineHeight: 1 }}>
              {caJour.toFixed(0)}
              <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400, marginLeft: 5 }}>€</span>
            </div>
            {caJourTerminee < caJour && caJour > 0 && (
              <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 5 }}>
                {caJourTerminee.toFixed(0)} € encaissé
              </div>
            )}
          </div>

          {/* Chauffeurs disponibles */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '16px 18px' }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 8 }}>Disponibles</div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 26, fontWeight: 500, color: 'var(--grn)', lineHeight: 1 }}>
              {chauffeursDisponibles.length}/{chauffeurs.length}
              <span style={{ fontSize: 11, color: 'var(--t2)', fontWeight: 400, marginLeft: 5 }}>chauffeurs</span>
            </div>
          </div>

        </div>

        {/* Panier courses sans chauffeur */}
        <PanierCourses courses={nonAssignees} chauffeurs={chauffeursForDispatch} />

        {/* Demandes collaborateur */}
        {demandesCollaborateur.length > 0 && (
          <div style={{
            background: 'rgba(77,142,212,.06)', border: '1px solid rgba(77,142,212,.2)',
            borderRadius: 12, padding: '14px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blu)', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--blu)' }}>
                  {demandesCollaborateur.length} demande{demandesCollaborateur.length > 1 ? 's' : ''} collaborateur à dispatcher
                </span>
              </div>
              <Link href="/admin/courses" style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'rgba(77,142,212,.15)', border: '1px solid rgba(77,142,212,.3)',
                color: 'var(--blu)', textDecoration: 'none',
              }}>
                Voir tout →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {demandesCollaborateur.slice(0, 4).map((c: any) => {
                const collab = c.collaborateurs
                const client = c.clients
                const collabNom = collab?.profiles ? `${collab.profiles.prenom} ${collab.profiles.nom}` : '—'
                const entreprise = client?.entreprise_nom ?? '—'
                const date = new Date(c.date_prevue)
                return (
                  <a key={c.id} href={`/admin/courses/${c.id}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr 160px 120px',
                    background: 'var(--elevated)', borderRadius: 8, padding: '10px 14px',
                    textDecoration: 'none', alignItems: 'center', gap: 12,
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>
                        {c.adresse_depart.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>
                        → {c.adresse_arrivee.split(',')[0]}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--t1)' }}>{collabNom}</div>
                      <div style={{ fontSize: 10, color: 'var(--gold)' }}>{entreprise}</div>
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 10, color: 'var(--t3)', textAlign: 'right',
                    }}>
                      {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' })}
                      {' · '}{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}


        {/* Factures en retard */}
        {facturesRetard.length > 0 && (
          <div style={{
            background: 'rgba(217,80,80,.06)', border: '1px solid rgba(217,80,80,.2)',
            borderRadius: 12, padding: '14px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--red)' }}>
                  {facturesRetard.length} facture{facturesRetard.length > 1 ? 's' : ''} en retard de paiement
                </span>
              </div>
              <Link href="/admin/facturation" style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'rgba(217,80,80,.12)', border: '1px solid rgba(217,80,80,.3)',
                color: 'var(--red)', textDecoration: 'none',
              }}>
                Voir tout →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {facturesRetard.slice(0, 3).map((f: any) => {
                const client = f.clients
                const clientNom = client?.type_compte === 'entreprise'
                  ? (client.entreprise_nom ?? '—')
                  : client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : '—'
                const echeance = new Date(f.date_echeance)
                const joursRetard = Math.floor((now.getTime() - echeance.getTime()) / 86400000)
                return (
                  <a key={f.id} href={`/admin/facturation/${f.id}`} style={{
                    display: 'grid', gridTemplateColumns: '120px 1fr 100px 80px',
                    background: 'var(--elevated)', borderRadius: 8, padding: '10px 14px',
                    textDecoration: 'none', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 11, fontWeight: 600, color: 'var(--gold)',
                    }}>
                      {f.numero}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--t1)' }}>{clientNom}</div>
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace',
                      fontSize: 13, color: 'var(--t1)', textAlign: 'right',
                    }}>
                      {f.montant_ttc.toFixed(0)} €
                    </div>
                    <div style={{
                      fontSize: 10, color: 'var(--red)', textAlign: 'right', fontWeight: 500,
                    }}>
                      +{joursRetard}j
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* Documents chauffeurs en alerte */}
        {docsAlert.length > 0 && (
          <div style={{
            background: 'rgba(232,160,48,.05)', border: '1px solid rgba(232,160,48,.18)',
            borderRadius: 12, padding: '14px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--amb)', display: 'inline-block' }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--amb)' }}>
                  {docsAlert.length} document{docsAlert.length > 1 ? 's' : ''} expiré{docsAlert.length > 1 ? 's' : ''} ou bientôt
                </span>
              </div>
              <Link href="/admin/chauffeurs" style={{
                padding: '6px 14px', borderRadius: 7, fontSize: 11, fontWeight: 600,
                background: 'rgba(232,160,48,.12)', border: '1px solid rgba(232,160,48,.25)',
                color: 'var(--amb)', textDecoration: 'none',
              }}>
                Chauffeurs →
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {docsAlert.slice(0, 5).map((d: any) => {
                const chauffeur = d.chauffeurs
                const nom = chauffeur?.profiles
                  ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                  : '—'
                const isExpire = d.statut === 'expire'
                const expDate = new Date(d.date_expiration)
                const DOC_LABELS: Record<string, string> = {
                  carte_vtc: 'Carte VTC', assurance_rc: 'Assurance RC',
                  visite_medicale: 'Visite médicale', permis: 'Permis',
                }
                return (
                  <a key={d.id} href={`/admin/chauffeurs/${d.chauffeur_id}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr 140px 100px',
                    background: 'var(--elevated)', borderRadius: 8, padding: '9px 14px',
                    textDecoration: 'none', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 600,
                        color: isExpire ? 'var(--red)' : 'var(--amb)',
                        background: isExpire ? 'rgba(217,80,80,.12)' : 'rgba(232,160,48,.12)',
                        border: `1px solid ${isExpire ? 'rgba(217,80,80,.25)' : 'rgba(232,160,48,.25)'}`,
                      }}>
                        {isExpire ? 'Expiré' : 'Bientôt'}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>{nom}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                      {DOC_LABELS[d.type] ?? d.type}
                    </div>
                    <div style={{
                      fontSize: 11, color: isExpire ? 'var(--red)' : 'var(--amb)',
                      fontFamily: 'var(--font-jetbrains), monospace', textAlign: 'right',
                    }}>
                      {expDate.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                    </div>
                  </a>
                )
              })}
            </div>
          </div>
        )}

        {/* 2 colonnes */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 20, alignItems: 'start' }}>

          {/* Colonne principale */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Courses actives */}
            {coursesActives.length > 0 && (
              <div style={{
                background: 'var(--surface)', border: '1px solid rgba(74,142,208,.2)',
                borderRadius: 12, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '13px 20px', fontSize: 11, fontWeight: 500, color: 'var(--blu)',
                  borderBottom: '1px solid rgba(74,142,208,.1)',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blu)', display: 'inline-block' }} />
                  Courses en cours ({coursesActives.length})
                </div>
                {coursesActives.map(course => {
                  const chauffeur = (course as any).chauffeurs
                  const client = (course as any).clients
                  const chauffeurNom = chauffeur?.profiles ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}` : '—'
                  const clientNom = client?.profiles ? `${client.profiles.prenom} ${client.profiles.nom}` : client?.entreprise_nom ?? '—'
                  return (
                    <a key={course.id} href={`/admin/courses/${course.id}`} style={{
                      display: 'grid', gridTemplateColumns: '1fr 120px 90px 70px',
                      padding: '11px 20px', alignItems: 'center',
                      borderBottom: '1px solid rgba(201,168,76,.04)',
                      textDecoration: 'none',
                    }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                          {course.adresse_depart.split(',')[0]}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--t2)' }}>{chauffeurNom}</div>
                      <div style={{ fontSize: 11, color: 'var(--t3)' }}>{clientNom}</div>
                      <div style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                          color: STATUT_COURSE_COLOR[course.statut], background: `${STATUT_COURSE_COLOR[course.statut]}18`,
                          border: `1px solid ${STATUT_COURSE_COLOR[course.statut]}30`,
                        }}>
                          {STATUT_COURSE_LABEL[course.statut]}
                        </span>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            {/* Courses récentes */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 20px', borderBottom: '1px solid rgba(201,168,76,.07)',
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)' }}>Courses récentes</div>
                <Link href="/admin/courses" style={{ fontSize: 11, color: 'var(--t2)', textDecoration: 'none' }}>
                  Voir tout →
                </Link>
              </div>

              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 70px',
                padding: '8px 20px', fontSize: 9.5, letterSpacing: '.1em',
                textTransform: 'uppercase', color: 'var(--t3)', fontWeight: 500,
                borderBottom: '1px solid rgba(201,168,76,.05)',
              }}>
                <div>Trajet</div><div>Client</div><div>Chauffeur</div><div>Date</div><div style={{ textAlign: 'right' }}>Statut</div>
              </div>

              {courses.length === 0 ? (
                <div style={{ padding: '36px', textAlign: 'center', color: 'var(--t3)', fontSize: 12 }}>
                  Aucune course
                </div>
              ) : courses.slice(0, 12).map(course => {
                const client   = (course as any).clients
                const chauffeur = (course as any).chauffeurs
                const clientNom = client?.profiles
                  ? `${client.profiles.prenom} ${client.profiles.nom}`
                  : client?.entreprise_nom ?? '—'
                const chauffeurNom = chauffeur?.profiles
                  ? `${chauffeur.profiles.prenom} ${chauffeur.profiles.nom}`
                  : '—'
                const date = new Date(course.date_prevue)
                return (
                  <a key={course.id} href={`/admin/courses/${course.id}`} style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 70px',
                    padding: '11px 20px', borderBottom: '1px solid rgba(201,168,76,.04)',
                    textDecoration: 'none', alignItems: 'center',
                  }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t1)', marginBottom: 1 }}>
                        {course.adresse_depart.split(',')[0]}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--t2)' }}>→ {course.adresse_arrivee.split(',')[0]}</div>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{clientNom}</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{chauffeurNom}</div>
                    <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--t3)' }}>
                      {isNaN(date.getTime()) ? '—' : (
                        <>
                          {date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Paris' })}
                          {' · '}{date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}
                        </>
                      )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{
                        fontSize: 9, padding: '2px 7px', borderRadius: 4, fontWeight: 500,
                        color: STATUT_COURSE_COLOR[course.statut],
                        background: `${STATUT_COURSE_COLOR[course.statut]}18`,
                        border: `1px solid ${STATUT_COURSE_COLOR[course.statut]}30`,
                      }}>
                        {STATUT_COURSE_LABEL[course.statut]}
                      </span>
                    </div>
                  </a>
                )
              })}
            </div>
          </div>

          {/* Colonne droite */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Stats semaine / mois */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, padding: '16px 18px',
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14, fontWeight: 500 }}>
                Périodes
              </div>
              {[
                { label: 'Cette semaine', courses: coursesSemaine, ca: caSemaine, caReel: caRéelSemaine },
                { label: 'Ce mois',       courses: coursesMois,    ca: caMois,    caReel: caRéelMois   },
              ].map(p => (
                <div key={p.label} style={{
                  paddingBottom: 12, marginBottom: 12,
                  borderBottom: '1px solid rgba(201,168,76,.07)',
                }}>
                  <div style={{ fontSize: 10, color: 'var(--t3)', marginBottom: 6 }}>{p.label}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                    <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 18, color: 'var(--t1)' }}>
                      {p.courses}
                      <span style={{ fontSize: 10, color: 'var(--t3)', marginLeft: 4 }}>courses</span>
                    </span>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 16, color: 'var(--gold)' }}>
                        {p.ca.toFixed(0)} €
                      </div>
                      {p.caReel < p.ca && p.caReel > 0 && (
                        <div style={{ fontSize: 9, color: 'var(--t3)' }}>{p.caReel.toFixed(0)} € encaissé</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div style={{ fontSize: 9, color: 'var(--t3)', marginTop: -4 }}>Pipeline (estimé · hors annulées)</div>
            </div>

            {/* Chauffeurs */}
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--gb)',
              borderRadius: 12, overflow: 'hidden',
            }}>
              <div style={{
                padding: '13px 16px', fontSize: 11, fontWeight: 500, color: 'var(--t1)',
                borderBottom: '1px solid rgba(201,168,76,.07)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span>Chauffeurs</span>
                <Link href="/admin/chauffeurs" style={{ fontSize: 10, color: 'var(--t2)', textDecoration: 'none' }}>
                  Gérer →
                </Link>
              </div>

              {chauffeurs.length === 0 ? (
                <div style={{ padding: '20px 16px', fontSize: 11, color: 'var(--t3)', textAlign: 'center' }}>
                  Aucun chauffeur
                </div>
              ) : chauffeurs.map((c: any) => {
                const p = c.profiles
                const prenom = p?.prenom ?? ''
                const nom    = p?.nom ?? ''
                const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()
                const s = STATUT_CHAUFFEUR_STYLE[c.statut] ?? STATUT_CHAUFFEUR_STYLE.hors_ligne
                return (
                  <a key={c.id} href={`/admin/chauffeurs/${c.id}`} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 16px', borderBottom: '1px solid rgba(201,168,76,.04)',
                    textDecoration: 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                        background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: 'var(--font-cormorant), serif',
                        fontSize: 11, fontWeight: 600, color: 'var(--gold)',
                      }}>{initials}</div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--t1)' }}>
                          {prenom} {nom}
                        </div>
                        <div style={{ fontSize: 9.5, color: 'var(--t3)', marginTop: 1 }}>
                          {[c.vehicule_marque, c.vehicule_modele].filter(Boolean).join(' ') || '—'}
                        </div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 12, fontWeight: 500,
                      color: s.color, background: s.bg,
                    }}>{s.label}</span>
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
