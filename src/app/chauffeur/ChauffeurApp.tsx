'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { STATUT_COURSE_LABEL, type StatutCourse, type StatutChauffeur } from '@/lib/types'

const ETAPES: { statut: StatutCourse; label: string; action: string; color: string }[] = [
  { statut: 'acceptee',        label: 'Course acceptée',    action: 'Départ vers le client', color: 'var(--blu)' },
  { statut: 'en_route',        label: 'En route',           action: 'Client pris en charge', color: 'var(--amb)' },
  { statut: 'prise_en_charge', label: 'Client à bord',      action: 'Terminer la course',    color: 'var(--grn)' },
  { statut: 'terminee',        label: 'Course terminée',    action: '',                       color: 'var(--t2)' },
]

const PROGRESSION: Partial<Record<StatutCourse, StatutCourse>> = {
  acceptee:        'en_route',
  en_route:        'prise_en_charge',
  prise_en_charge: 'terminee',
}

export default function ChauffeurApp({
  userId,
  profile,
  courses,
}: {
  userId: string
  profile: any
  courses: any[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [dispo, setDispo] = useState<StatutChauffeur>(
    profile?.chauffeurs?.statut ?? 'hors_ligne'
  )

  const activeCourse = courses[0] ?? null
  const prenom = profile?.prenom ?? 'Chauffeur'
  const nom = profile?.nom ?? ''
  const initials = `${prenom[0] ?? ''}${nom[0] ?? ''}`.toUpperCase()

  async function toggleDispo() {
    const next: StatutChauffeur = dispo === 'disponible' ? 'hors_ligne' : 'disponible'
    setDispo(next)
    const supabase = createClient()
    await supabase.from('chauffeurs').update({ statut: next }).eq('id', userId)
  }

  async function nextStatut() {
    if (!activeCourse) return
    const next = PROGRESSION[activeCourse.statut as StatutCourse]
    if (!next) return
    startTransition(async () => {
      const supabase = createClient()
      const updates: Record<string, any> = { statut: next }
      if (next === 'en_route') updates.date_debut = new Date().toISOString()
      if (next === 'terminee') updates.date_fin = new Date().toISOString()
      await supabase.from('courses').update(updates).eq('id', activeCourse.id)
      if (next === 'terminee') {
        await supabase.from('chauffeurs').update({ statut: 'disponible' }).eq('id', userId)
        setDispo('disponible')
      }
      router.refresh()
    })
  }

  const etapeIndex = ETAPES.findIndex(e => e.statut === activeCourse?.statut)
  const etape = ETAPES[etapeIndex]
  const client = activeCourse?.clients
  const clientNom = client?.profiles
    ? `${client.profiles.prenom} ${client.profiles.nom}`
    : '—'

  return (
    <div style={{
      minHeight: '100vh', background: 'var(--base)',
      fontFamily: 'var(--font-dm-sans), sans-serif',
      paddingBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        background: 'var(--surface)',
        borderBottom: '1px solid var(--gb)',
        padding: '20px 20px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'linear-gradient(135deg,rgba(201,168,76,.25),rgba(201,168,76,.08))',
              border: '1.5px solid rgba(201,168,76,.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 17, fontWeight: 600, color: 'var(--gold)',
            }}>{initials}</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
                {prenom} {nom}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>
                {profile?.chauffeurs?.vehicule_marque} {profile?.chauffeurs?.vehicule_modele}
              </div>
            </div>
          </div>
          {/* Toggle dispo */}
          <button
            onClick={toggleDispo}
            style={{
              padding: '8px 16px', borderRadius: 100,
              background: dispo === 'disponible' ? 'var(--grn)' : 'var(--elevated)',
              border: dispo === 'disponible' ? 'none' : '1px solid var(--t3)',
              color: dispo === 'disponible' ? 'var(--base)' : 'var(--t2)',
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              boxShadow: dispo === 'disponible' ? '0 4px 12px rgba(60,196,124,.3)' : 'none',
            }}
          >
            {dispo === 'disponible' ? '● Disponible' : '○ Hors ligne'}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {/* Course active */}
        {activeCourse ? (
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--gb)',
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 20,
            boxShadow: '0 8px 32px rgba(0,0,0,.3)',
          }}>
            {/* Barre de progression */}
            <div style={{
              display: 'flex',
              borderBottom: '1px solid rgba(201,168,76,.08)',
            }}>
              {ETAPES.slice(0, 3).map((e, i) => (
                <div
                  key={e.statut}
                  style={{
                    flex: 1, padding: '10px 6px', textAlign: 'center',
                    background: i <= etapeIndex ? 'rgba(201,168,76,.06)' : 'transparent',
                    borderRight: i < 2 ? '1px solid rgba(201,168,76,.08)' : 'none',
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    margin: '0 auto 4px',
                    background: i < etapeIndex ? 'var(--grn)'
                      : i === etapeIndex ? 'var(--gold)' : 'var(--t3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 600,
                    color: i <= etapeIndex ? 'var(--base)' : 'var(--t2)',
                  }}>
                    {i < etapeIndex ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 8.5, color: i <= etapeIndex ? 'var(--t1)' : 'var(--t3)', letterSpacing: '.04em' }}>
                    {['Accepté', 'En route', 'À bord'][i]}
                  </div>
                </div>
              ))}
            </div>

            {/* Infos course */}
            <div style={{ padding: '16px' }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 4 }}>
                  Trajet #{activeCourse.id.slice(-6).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{activeCourse.adresse_depart}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 2, border: '2px solid var(--red)', marginTop: 4, flexShrink: 0 }} />
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{activeCourse.adresse_arrivee}</div>
                  </div>
                </div>
              </div>

              {/* Client */}
              <div style={{
                background: 'var(--elevated)', borderRadius: 10, padding: '10px 12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 14,
              }}>
                <div>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>Client</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{clientNom}</div>
                  {client?.profiles?.telephone && (
                    <div style={{ fontSize: 11, color: 'var(--t2)' }}>{client.profiles.telephone}</div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 2 }}>Tarif</div>
                  <div style={{
                    fontFamily: 'var(--font-jetbrains), monospace',
                    fontSize: 20, fontWeight: 500, color: 'var(--gold)',
                  }}>
                    {activeCourse.prix_estime ? `${activeCourse.prix_estime} €` : '—'}
                  </div>
                </div>
              </div>

              {/* Bouton action principale */}
              {etape && etape.action && (
                <button
                  onClick={nextStatut}
                  disabled={pending}
                  style={{
                    width: '100%', padding: '16px',
                    borderRadius: 14,
                    background: etape.color === 'var(--grn)'
                      ? 'linear-gradient(135deg,var(--grn),#2a9e62)'
                      : etape.color === 'var(--amb)'
                      ? 'var(--amb)'
                      : 'var(--blu)',
                    border: 'none',
                    color: 'var(--base)',
                    fontSize: 15, fontWeight: 600,
                    cursor: pending ? 'wait' : 'pointer',
                    opacity: pending ? .7 : 1,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    boxShadow: '0 8px 24px rgba(0,0,0,.2)',
                  }}
                >
                  {pending ? '...' : etape.action}
                </button>
              )}
              {activeCourse.statut === 'terminee' && (
                <div style={{
                  textAlign: 'center', padding: '12px',
                  color: 'var(--grn)', fontSize: 14, fontWeight: 500,
                }}>
                  ✓ Course terminée
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Pas de course active */
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--gb)',
            borderRadius: 16, padding: '40px 24px',
            textAlign: 'center', marginBottom: 20,
          }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>🚗</div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--t1)', marginBottom: 6 }}>
              Aucune course assignée
            </div>
            <div style={{ fontSize: 13, color: 'var(--t2)' }}>
              {dispo === 'disponible'
                ? 'Vous êtes disponible. En attente d\'une nouvelle course.'
                : 'Passez en mode disponible pour recevoir des courses.'}
            </div>
          </div>
        )}

        {/* Stats du jour */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>
              Courses en attente
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 24, color: 'var(--t1)' }}>
              {courses.length}
            </div>
          </div>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--gb)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 6 }}>
              Note chauffeur
            </div>
            <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 24, color: 'var(--gold)' }}>
              {profile?.chauffeurs?.note_moyenne?.toFixed(2) ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
