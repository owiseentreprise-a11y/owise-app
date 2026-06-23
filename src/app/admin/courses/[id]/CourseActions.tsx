'use client'

import { useState, useTransition, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignerChauffeur, changerStatut, setPrixFinal, modifierNotes, assignerSousTraitant, supprimerCourse, modifierCourseDetails, rembourserCourseAction } from './actions'
import { STATUT_COURSE_LABEL, TYPE_VEHICULE_LABEL, type StatutCourse, type TypeVehicule } from '@/lib/types'

const STATUT_TRANSITIONS: Record<StatutCourse, StatutCourse[]> = {
  en_attente:      ['acceptee', 'annulee'],
  acceptee:        ['en_route', 'en_attente', 'annulee'],
  en_route:        ['prise_en_charge', 'annulee'],
  prise_en_charge: ['terminee', 'annulee'],
  terminee:        [],
  annulee:         [],
}

const STATUT_STYLE: Record<StatutCourse, { color: string; bg: string; border: string }> = {
  en_attente:      { color: 'var(--amb)', bg: 'rgba(232,160,48,.12)', border: 'rgba(232,160,48,.25)' },
  acceptee:        { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', border: 'rgba(74,142,208,.25)' },
  en_route:        { color: 'var(--blu)', bg: 'rgba(74,142,208,.12)', border: 'rgba(74,142,208,.25)' },
  prise_en_charge: { color: 'var(--grn)', bg: 'rgba(60,196,124,.12)', border: 'rgba(60,196,124,.25)' },
  terminee:        { color: 'var(--t2)',  bg: 'var(--elevated)',     border: 'var(--t3)' },
  annulee:         { color: 'var(--red)', bg: 'rgba(217,80,80,.12)', border: 'rgba(217,80,80,.25)' },
}

const STATUT_ORDER: StatutCourse[] = ['en_attente', 'acceptee', 'en_route', 'prise_en_charge', 'terminee']

export default function CourseActions({
  course,
  chauffeurs,
  sousTraitants,
}: {
  course: {
    id: string
    statut: StatutCourse
    chauffeur_id: string | null
    prix_estime: number | null
    prix_final: number | null
    notes: string | null
    type_vehicule: TypeVehicule
    nb_passagers: number
    date_prevue: string
    date_debut: string | null
    date_fin: string | null
    created_at: string
    adresse_depart: string
    adresse_arrivee: string
    client: { nom: string; prenom: string; telephone: string | null; entreprise: string | null } | null
    chauffeur: { nom: string; prenom: string; telephone: string | null; vehicule: string } | null
    prix_sous_traitant: number | null
    sous_traitant_nom: string | null
    sous_traitant_id: string | null
    mode_paiement: string | null
    paiement_statut: string | null
    stripe_payment_intent_id: string | null
  }
  chauffeurs: Array<{ id: string; nom: string; prenom: string; vehicule: string; statut: string; sous_traitant_id: string | null; sous_traitant_nom: string | null }>
  sousTraitants: Array<{ id: string; nom: string }>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [selectedChauffeur, setSelectedChauffeur] = useState(course.chauffeur_id ?? '')
  const [selectedST, setSelectedST] = useState(course.sous_traitant_id ?? '')
  const [prixSTInput, setPrixSTInput] = useState(course.prix_sous_traitant?.toString() ?? '')
  // ST verrouillé = auto-provient du chauffeur sélectionné (ne pas permettre override manuel)
  const [stLockedFromChauffeur, setStLockedFromChauffeur] = useState<{ id: string; nom: string } | null>(() => {
    if (!course.chauffeur_id) return null
    const c = chauffeurs.find(ch => ch.id === course.chauffeur_id)
    return c?.sous_traitant_id ? { id: c.sous_traitant_id, nom: c.sous_traitant_nom ?? '' } : null
  })

  // Quand on change de chauffeur → auto-lier son ST
  useEffect(() => {
    const c = chauffeurs.find(ch => ch.id === selectedChauffeur)
    if (c?.sous_traitant_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedST(c.sous_traitant_id)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStLockedFromChauffeur({ id: c.sous_traitant_id, nom: c.sous_traitant_nom ?? '' })
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStLockedFromChauffeur(null)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (selectedChauffeur) setSelectedST('')
    }
  }, [selectedChauffeur])
  const [prixInput, setPrixInput] = useState(course.prix_final?.toString() ?? course.prix_estime?.toString() ?? '')
  const [notesInput, setNotesInput] = useState(course.notes ?? '')
  const [notesSaved, setNotesSaved] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [refundOpen, setRefundOpen] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [refundDone, setRefundDone] = useState<number | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editDate, setEditDate] = useState(course.date_prevue.slice(0, 16))
  const [editVehicule, setEditVehicule] = useState(course.type_vehicule as string)
  const [editPassagers, setEditPassagers] = useState(String(course.nb_passagers))
  const [editDepart, setEditDepart] = useState(course.adresse_depart)
  const [editArrivee, setEditArrivee] = useState(course.adresse_arrivee)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaved, setEditSaved] = useState(false)

  const s = STATUT_STYLE[course.statut]
  const transitions = STATUT_TRANSITIONS[course.statut]
  const isTerminal = transitions.length === 0

  function run(fn: () => Promise<void>) {
    startTransition(async () => {
      await fn()
      router.refresh()
    })
  }

  const NEXT_LABEL: Partial<Record<StatutCourse, string>> = {
    acceptee:        'Marquer acceptée',
    en_route:        'Chauffeur en route',
    prise_en_charge: 'Client à bord',
    terminee:        'Terminer la course',
    en_attente:      'Remettre en attente',
    annulee:         'Annuler la course',
  }

  // Bouton principal = premier statut dans les transitions (hors annulée)
  const mainNext = transitions.find(t => t !== 'annulee') ?? null
  const canCancel = transitions.includes('annulee')
  const canReset = transitions.includes('en_attente') && course.statut !== 'en_attente'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* === STATUT === */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 14 }}>
          Statut de la course
        </div>

        {/* Timeline */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 18, gap: 0 }}>
          {STATUT_ORDER.map((s_step, i) => {
            const idx = STATUT_ORDER.indexOf(course.statut)
            const done = course.statut === 'annulee' ? false : i < idx
            const active = course.statut === 'annulee' ? false : i === idx
            return (
              <div key={s_step} style={{ display: 'flex', alignItems: 'center', flex: i < 4 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: done ? 'var(--grn)' : active ? STATUT_STYLE[s_step].color : 'var(--elevated)',
                    border: `2px solid ${done ? 'var(--grn)' : active ? STATUT_STYLE[s_step].color : 'var(--t3)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 700, color: done || active ? 'var(--base)' : 'var(--t3)',
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <div style={{ fontSize: 8, color: done || active ? 'var(--t1)' : 'var(--t3)', textAlign: 'center', letterSpacing: '.02em' }}>
                    {['Attente', 'Acceptée', 'En route', 'À bord', 'Terminée'][i]}
                  </div>
                </div>
                {i < 4 && (
                  <div style={{
                    flex: 1, height: 2, margin: '0 4px', marginBottom: 16,
                    background: done ? 'var(--grn)' : 'var(--elevated)',
                  }} />
                )}
              </div>
            )
          })}
        </div>

        {course.statut === 'annulee' && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.2)',
            color: 'var(--red)', fontSize: 12, fontWeight: 500,
            marginBottom: 14,
          }}>
            Course annulée
          </div>
        )}

        {/* Bouton avancement principal */}
        {mainNext && (
          <button
            onClick={() => run(() => changerStatut(course.id, mainNext, course.chauffeur_id))}
            disabled={pending}
            style={{
              width: '100%', padding: '12px',
              borderRadius: 8, border: 'none',
              background: STATUT_STYLE[mainNext].color,
              color: 'var(--base)',
              fontSize: 12, fontWeight: 600, cursor: pending ? 'wait' : 'pointer',
              opacity: pending ? .6 : 1,
              fontFamily: 'var(--font-dm-sans), sans-serif',
              marginBottom: canCancel || canReset ? 8 : 0,
            }}
          >
            {NEXT_LABEL[mainNext] ?? `→ ${STATUT_COURSE_LABEL[mainNext]}`}
          </button>
        )}

        {/* Remettre en attente */}
        {canReset && course.statut === 'acceptee' && (
          <button
            onClick={() => run(() => changerStatut(course.id, 'en_attente', course.chauffeur_id))}
            disabled={pending}
            style={{
              width: '100%', padding: '9px', borderRadius: 8, marginBottom: 8,
              background: 'var(--elevated)', border: '1px solid var(--t3)',
              color: 'var(--t2)', fontSize: 11, cursor: pending ? 'wait' : 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Remettre en attente
          </button>
        )}

        {/* Annuler */}
        {canCancel && (
          <button
            onClick={() => {
              if (!confirm('Annuler cette course ? Cette action est définitive.')) return
              run(() => changerStatut(course.id, 'annulee', course.chauffeur_id))
            }}
            disabled={pending}
            style={{
              width: '100%', padding: '9px', borderRadius: 8,
              background: 'rgba(217,80,80,.08)', border: '1px solid rgba(217,80,80,.2)',
              color: 'var(--red)', fontSize: 11, cursor: pending ? 'wait' : 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Annuler la course
          </button>
        )}
      </div>

      {/* === CHAUFFEUR === */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 12 }}>
          {course.chauffeur ? 'Chauffeur assigné' : 'Assigner un chauffeur'}
        </div>

        {course.chauffeur && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 8,
            background: 'var(--elevated)', marginBottom: 10,
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,rgba(201,168,76,.2),rgba(201,168,76,.06))',
              border: '1px solid rgba(201,168,76,.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-cormorant), serif',
              fontSize: 14, color: 'var(--gold)',
            }}>
              {course.chauffeur.prenom[0]}{course.chauffeur.nom[0]}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>
                {course.chauffeur.prenom} {course.chauffeur.nom}
              </div>
              <div style={{ fontSize: 10, color: 'var(--t2)' }}>{course.chauffeur.vehicule}</div>
              {course.chauffeur.telephone && (
                <a href={`tel:${course.chauffeur.telephone}`} style={{
                  fontSize: 10, color: 'var(--gold)', textDecoration: 'none',
                }}>
                  {course.chauffeur.telephone}
                </a>
              )}
            </div>
          </div>
        )}

        {!isTerminal && (
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              value={selectedChauffeur}
              onChange={e => setSelectedChauffeur(e.target.value)}
              style={{
                flex: 1, minWidth: 0, padding: '9px 12px',
                background: 'var(--elevated)', border: '1px solid var(--t3)',
                borderRadius: 8, color: selectedChauffeur ? 'var(--t1)' : 'var(--t3)',
                fontSize: 12, outline: 'none',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              <option value="">— Non assigné —</option>
              {chauffeurs.map(c => (
                <option key={c.id} value={c.id}>
                  {c.prenom} {c.nom} — {c.vehicule}
                  {c.sous_traitant_nom ? ` · ${c.sous_traitant_nom}` : ' · Owise'}
                  {c.statut === 'disponible' ? ' ✓' : c.statut === 'en_course' ? ' (en course)' : ' (hors ligne)'}
                </option>
              ))}
            </select>
            <button
              onClick={() => run(() => assignerChauffeur(course.id, selectedChauffeur || null))}
              disabled={pending || selectedChauffeur === (course.chauffeur_id ?? '')}
              style={{
                padding: '9px 14px', borderRadius: 8,
                background: 'var(--gold)', border: 'none',
                color: 'var(--base)', fontSize: 12, fontWeight: 600,
                cursor: pending ? 'wait' : 'pointer',
                opacity: (pending || selectedChauffeur === (course.chauffeur_id ?? '')) ? .4 : 1,
                fontFamily: 'var(--font-dm-sans), sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              {course.chauffeur ? 'Réassigner' : 'Assigner'}
            </button>
          </div>
        )}
      </div>

      {/* === SOUS-TRAITANT === */}
      {!isTerminal && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 12 }}>
            Sous-traitant
          </div>

          {/* Chauffeur Owise direct (salarié, pas de ST) — section verrouillée */}
          {selectedChauffeur && !stLockedFromChauffeur ? (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8,
              background: 'var(--elevated)', border: '1px solid var(--t3)',
              opacity: 0.7,
            }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                background: 'var(--floating)', border: '1px solid var(--t3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, color: 'var(--t3)',
              }}>
                O
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--t2)' }}>Chauffeur Owise direct</div>
                <div style={{ fontSize: 9, color: 'var(--t3)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 1 }}>
                  Pas de sous-traitant
                </div>
              </div>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--t3)" strokeWidth={2.5}>
                <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
              </svg>
            </div>
          ) : stLockedFromChauffeur ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: 'rgba(201,168,76,.15)', border: '1px solid rgba(201,168,76,.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, color: 'var(--gold)',
                }}>
                  {stLockedFromChauffeur.nom.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{stLockedFromChauffeur.nom}</div>
                  <div style={{ fontSize: 9, color: 'var(--gold)', letterSpacing: '.08em', textTransform: 'uppercase', marginTop: 1 }}>
                    Lié au chauffeur assigné
                  </div>
                </div>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth={2.5}>
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
                </svg>
              </div>
              {/* Prix ST */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type="number" min={0} step={0.5}
                    value={prixSTInput}
                    onChange={e => setPrixSTInput(e.target.value)}
                    placeholder="Prix ST (€)"
                    style={{
                      width: '100%', padding: '9px 30px 9px 12px',
                      background: 'var(--elevated)', border: '1px solid var(--t3)',
                      borderRadius: 8, color: 'var(--t1)', fontSize: 13,
                      fontFamily: 'var(--font-jetbrains), monospace',
                      outline: 'none', boxSizing: 'border-box',
                    }}
                  />
                  <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--t3)' }}>€</span>
                </div>
                <button
                  onClick={() => run(() => assignerSousTraitant(course.id, stLockedFromChauffeur.id, prixSTInput ? parseFloat(prixSTInput) : null))}
                  disabled={pending}
                  style={{
                    padding: '9px 14px', borderRadius: 8, background: 'var(--gold)', border: 'none',
                    color: 'var(--base)', fontSize: 12, fontWeight: 600,
                    cursor: pending ? 'wait' : 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', whiteSpace: 'nowrap',
                  }}
                >
                  Sauver
                </button>
              </div>
            </div>
          ) : (
            /* ST manuel — aucun chauffeur ST assigné */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sousTraitants.length > 0 ? (
                <>
                  <select
                    value={selectedST}
                    onChange={e => setSelectedST(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', minWidth: 0,
                      background: 'var(--elevated)', border: '1px solid var(--t3)',
                      borderRadius: 8, color: selectedST ? 'var(--t1)' : 'var(--t3)',
                      fontSize: 12, outline: 'none', fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}
                  >
                    <option value="">— Aucun sous-traitant —</option>
                    {sousTraitants.map(st => (
                      <option key={st.id} value={st.id}>{st.nom}</option>
                    ))}
                  </select>
                  {selectedST && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{ position: 'relative', flex: 1 }}>
                        <input
                          type="number" min={0} step={0.5}
                          value={prixSTInput}
                          onChange={e => setPrixSTInput(e.target.value)}
                          placeholder="Prix ST (€)"
                          style={{
                            width: '100%', padding: '9px 30px 9px 12px',
                            background: 'var(--elevated)', border: '1px solid var(--t3)',
                            borderRadius: 8, color: 'var(--t1)', fontSize: 13,
                            fontFamily: 'var(--font-jetbrains), monospace',
                            outline: 'none', boxSizing: 'border-box',
                          }}
                        />
                        <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: 'var(--t3)' }}>€</span>
                      </div>
                      <button
                        onClick={() => run(() => assignerSousTraitant(course.id, selectedST || null, prixSTInput ? parseFloat(prixSTInput) : null))}
                        disabled={pending}
                        style={{
                          padding: '9px 14px', borderRadius: 8, background: 'var(--gold)', border: 'none',
                          color: 'var(--base)', fontSize: 12, fontWeight: 600,
                          cursor: pending ? 'wait' : 'pointer', fontFamily: 'var(--font-dm-sans), sans-serif', whiteSpace: 'nowrap',
                        }}
                      >
                        Assigner
                      </button>
                    </div>
                  )}
                  {!selectedST && course.sous_traitant_nom && (
                    <button
                      onClick={() => run(() => assignerSousTraitant(course.id, null, null))}
                      disabled={pending}
                      style={{
                        padding: '7px', borderRadius: 8, width: '100%',
                        background: 'transparent', border: '1px solid rgba(217,80,80,.25)',
                        color: 'var(--red)', fontSize: 11, cursor: 'pointer',
                        fontFamily: 'var(--font-dm-sans), sans-serif',
                      }}
                    >
                      Retirer {course.sous_traitant_nom}
                    </button>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: 'var(--t3)', fontStyle: 'italic' }}>Aucun sous-traitant actif</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* === TARIFICATION === */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 12 }}>
          Tarification
        </div>

        {course.prix_estime !== null && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 3 }}>Prix estimé</div>
            <div style={{
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 20, color: 'var(--t2)',
            }}>
              {course.prix_estime.toFixed(2)} €
            </div>
          </div>
        )}

        <div>
          <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 6 }}>Prix final</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="number"
                min={0}
                step={0.5}
                value={prixInput}
                onChange={e => setPrixInput(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%', padding: '9px 30px 9px 12px',
                  background: 'var(--elevated)', border: '1px solid var(--t3)',
                  borderRadius: 8, color: 'var(--t1)', fontSize: 14,
                  fontFamily: 'var(--font-jetbrains), monospace',
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                fontSize: 12, color: 'var(--t3)',
              }}>€</span>
            </div>
            <button
              onClick={() => run(() => setPrixFinal(course.id, prixInput ? parseFloat(prixInput) : null))}
              disabled={pending}
              style={{
                padding: '9px 14px', borderRadius: 8,
                background: 'var(--elevated)', border: '1px solid var(--t3)',
                color: 'var(--t2)', fontSize: 12, cursor: pending ? 'wait' : 'pointer',
                fontFamily: 'var(--font-dm-sans), sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Sauver
            </button>
          </div>
          {course.prix_final !== null && (
            <div style={{
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 22, color: 'var(--gold)', marginTop: 8, fontWeight: 500,
            }}>
              {course.prix_final.toFixed(2)} €
            </div>
          )}
        </div>

        {/* Bloc sous-traitant : coût + marge */}
        {course.sous_traitant_nom && (
          <div style={{
            marginTop: 16, paddingTop: 14,
            borderTop: '1px solid rgba(201,168,76,.08)',
          }}>
            <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 10, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Sous-traitant · {course.sous_traitant_nom}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4 }}>Coût ST</div>
                <div style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 16, fontWeight: 600, color: 'var(--red)' }}>
                  {course.prix_sous_traitant != null ? `${course.prix_sous_traitant.toFixed(2)} €` : '—'}
                </div>
              </div>
              <div style={{ background: 'var(--elevated)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4 }}>Marge Owise</div>
                {(() => {
                  const prixClient = course.prix_final ?? course.prix_estime
                  const marge = prixClient != null && course.prix_sous_traitant != null
                    ? prixClient - course.prix_sous_traitant : null
                  return (
                    <div style={{
                      fontFamily: 'var(--font-jetbrains), monospace', fontSize: 16, fontWeight: 600,
                      color: marge == null ? 'var(--t3)' : marge >= 0 ? 'var(--grn)' : 'var(--red)',
                    }}>
                      {marge != null ? `${marge.toFixed(2)} €` : '—'}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* === MODIFIER LA COURSE === */}
      {!isTerminal && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 12, padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: editOpen ? 14 : 0 }}>
            <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)' }}>
              Modifier la course
            </div>
            <button
              onClick={() => { setEditOpen(!editOpen); setEditError(null); setEditSaved(false) }}
              style={{
                fontSize: 11, padding: '5px 12px', borderRadius: 6, cursor: 'pointer',
                background: editOpen ? 'var(--elevated)' : 'rgba(201,168,76,.1)',
                border: `1px solid ${editOpen ? 'var(--t3)' : 'rgba(201,168,76,.25)'}`,
                color: editOpen ? 'var(--t2)' : 'var(--gold)',
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              {editOpen ? 'Fermer' : 'Modifier'}
            </button>
          </div>

          {editOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Date & heure */}
              <div>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.1em', textTransform: 'uppercase' }}>Date & heure</div>
                <input
                  type="datetime-local"
                  value={editDate}
                  onChange={e => setEditDate(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                    background: 'var(--elevated)', border: '1px solid var(--t3)',
                    borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                    colorScheme: 'dark',
                  }}
                />
              </div>

              {/* Véhicule + Passagers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.1em', textTransform: 'uppercase' }}>Véhicule</div>
                  <select
                    value={editVehicule}
                    onChange={e => setEditVehicule(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px',
                      background: 'var(--elevated)', border: '1px solid var(--t3)',
                      borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}
                  >
                    <option value="berline">Berline</option>
                    <option value="berline_premium">Berline Premium</option>
                    <option value="van">Van 7 places</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.1em', textTransform: 'uppercase' }}>Passagers</div>
                  <input
                    type="number" min={1} max={7}
                    value={editPassagers}
                    onChange={e => setEditPassagers(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                      background: 'var(--elevated)', border: '1px solid var(--t3)',
                      borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}
                  />
                </div>
              </div>

              {/* Départ */}
              <div>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.1em', textTransform: 'uppercase' }}>Adresse de départ</div>
                <input
                  type="text"
                  value={editDepart}
                  onChange={e => setEditDepart(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                    background: 'var(--elevated)', border: '1px solid var(--t3)',
                    borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}
                />
              </div>

              {/* Arrivée */}
              <div>
                <div style={{ fontSize: 9, color: 'var(--t3)', marginBottom: 4, letterSpacing: '.1em', textTransform: 'uppercase' }}>Adresse d&apos;arrivée</div>
                <input
                  type="text"
                  value={editArrivee}
                  onChange={e => setEditArrivee(e.target.value)}
                  style={{
                    width: '100%', padding: '9px 12px', boxSizing: 'border-box',
                    background: 'var(--elevated)', border: '1px solid var(--t3)',
                    borderRadius: 8, color: 'var(--t1)', fontSize: 12, outline: 'none',
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}
                />
              </div>

              {editError && (
                <div style={{ fontSize: 11, color: 'var(--red)', padding: '6px 10px', borderRadius: 6, background: 'rgba(217,84,84,.1)' }}>
                  {editError}
                </div>
              )}

              <button
                onClick={() => {
                  setEditError(null); setEditSaved(false)
                  startTransition(async () => {
                    const res = await modifierCourseDetails(course.id, {
                      date_prevue:    editDate,
                      type_vehicule:  editVehicule,
                      nb_passagers:   parseInt(editPassagers) || 1,
                      adresse_depart: editDepart,
                      adresse_arrivee: editArrivee,
                    })
                    if (res?.error) { setEditError(res.error); return }
                    setEditSaved(true)
                    setEditOpen(false)
                    router.refresh()
                  })
                }}
                disabled={pending}
                style={{
                  width: '100%', padding: '10px', borderRadius: 8, border: 'none', cursor: pending ? 'wait' : 'pointer',
                  background: editSaved ? 'rgba(61,184,122,.15)' : 'var(--gold)',
                  color: editSaved ? 'var(--grn)' : 'var(--base)',
                  fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                  opacity: pending ? .6 : 1,
                }}
              >
                {pending ? 'Sauvegarde…' : 'Sauvegarder les modifications'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* === NOTES === */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--gb)',
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', marginBottom: 10 }}>
          Notes internes
        </div>
        <textarea
          value={notesInput}
          onChange={e => { setNotesInput(e.target.value); setNotesSaved(false) }}
          rows={4}
          placeholder="Instructions, références, consignes chauffeur..."
          style={{
            width: '100%', padding: '10px 12px',
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            borderRadius: 8, color: 'var(--t1)', fontSize: 12,
            resize: 'vertical', outline: 'none',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => run(async () => {
            await modifierNotes(course.id, notesInput)
            setNotesSaved(true)
          })}
          disabled={pending}
          style={{
            marginTop: 8, padding: '8px 16px', borderRadius: 7,
            background: notesSaved ? 'rgba(60,196,124,.15)' : 'var(--elevated)',
            border: `1px solid ${notesSaved ? 'rgba(60,196,124,.3)' : 'var(--t3)'}`,
            color: notesSaved ? 'var(--grn)' : 'var(--t2)',
            fontSize: 11, cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
          }}
        >
          {notesSaved ? '✓ Sauvegardé' : 'Sauvegarder les notes'}
        </button>
      </div>

      {course.mode_paiement === 'stripe' && course.stripe_payment_intent_id && (
        <div style={{
          background: 'var(--surface)', border: '1px solid rgba(232,160,48,.2)',
          borderRadius: 12, padding: '18px 20px',
        }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--amb)', marginBottom: 12, opacity: .7 }}>
            Paiement Stripe
          </div>
          {course.paiement_statut === 'remboursee' || refundDone !== null ? (
            <div style={{ fontSize: 12, color: 'var(--t2)' }}>
              ✓ Remboursé{refundDone !== null ? ` (${refundDone.toFixed(2)} €)` : ''}
            </div>
          ) : !refundOpen ? (
            <button
              onClick={() => setRefundOpen(true)}
              style={{
                width: '100%', padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
                background: 'rgba(232,160,48,.06)', border: '1px solid rgba(232,160,48,.25)',
                color: 'var(--amb)', fontSize: 12, fontWeight: 500,
                fontFamily: 'var(--font-dm-sans), sans-serif',
              }}
            >
              Rembourser ce client
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.5 }}>
                Ceci déclenche un <strong style={{ color: 'var(--amb)' }}>vrai remboursement Stripe</strong>, irréversible.
              </div>
              {refundError && (
                <div style={{ fontSize: 11, color: 'var(--red)', padding: '6px 10px', borderRadius: 6, background: 'rgba(217,84,84,.1)' }}>
                  {refundError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => {
                    startTransition(async () => {
                      const res = await rembourserCourseAction(course.id)
                      if (res?.error) { setRefundError(res.error); return }
                      setRefundDone(res.montant ?? 0)
                      setRefundOpen(false)
                    })
                  }}
                  disabled={pending}
                  style={{
                    flex: 1, padding: '9px', borderRadius: 7, cursor: pending ? 'wait' : 'pointer',
                    background: 'var(--amb)', border: 'none',
                    color: '#fff', fontSize: 12, fontWeight: 600,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}
                >
                  {pending ? 'Remboursement…' : 'Confirmer le remboursement'}
                </button>
                <button
                  onClick={() => { setRefundOpen(false); setRefundError(null) }}
                  style={{
                    padding: '9px 14px', borderRadius: 7, cursor: 'pointer',
                    background: 'var(--elevated)', border: '1px solid var(--t3)',
                    color: 'var(--t2)', fontSize: 12,
                    fontFamily: 'var(--font-dm-sans), sans-serif',
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === ZONE DANGEREUSE === */}
      <div style={{
        background: 'var(--surface)', border: '1px solid rgba(217,84,84,.2)',
        borderRadius: 12, padding: '18px 20px',
      }}>
        <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--red)', marginBottom: 12, opacity: .7 }}>
          Zone dangereuse
        </div>
        {!deleteOpen ? (
          <button
            onClick={() => setDeleteOpen(true)}
            style={{
              width: '100%', padding: '9px 16px', borderRadius: 8, cursor: 'pointer',
              background: 'rgba(217,84,84,.06)', border: '1px solid rgba(217,84,84,.2)',
              color: 'var(--red)', fontSize: 12, fontWeight: 500,
              fontFamily: 'var(--font-dm-sans), sans-serif',
            }}
          >
            Supprimer cette course
          </button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 12, color: 'var(--t1)', lineHeight: 1.5 }}>
              Cette action est <strong style={{ color: 'var(--red)' }}>irréversible</strong>. La course sera définitivement supprimée de la base de données.
            </div>
            {deleteError && (
              <div style={{ fontSize: 11, color: 'var(--red)', padding: '6px 10px', borderRadius: 6, background: 'rgba(217,84,84,.1)' }}>
                {deleteError}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  startTransition(async () => {
                    const res = await supprimerCourse(course.id)
                    if (res?.error) { setDeleteError(res.error); return }
                    router.push('/admin/courses')
                  })
                }}
                disabled={pending}
                style={{
                  flex: 1, padding: '9px', borderRadius: 7, cursor: pending ? 'wait' : 'pointer',
                  background: 'var(--red)', border: 'none',
                  color: '#fff', fontSize: 12, fontWeight: 600,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >
                {pending ? 'Suppression…' : 'Confirmer la suppression'}
              </button>
              <button
                onClick={() => { setDeleteOpen(false); setDeleteError(null) }}
                style={{
                  padding: '9px 14px', borderRadius: 7, cursor: 'pointer',
                  background: 'var(--elevated)', border: '1px solid var(--t3)',
                  color: 'var(--t2)', fontSize: 12,
                  fontFamily: 'var(--font-dm-sans), sans-serif',
                }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
