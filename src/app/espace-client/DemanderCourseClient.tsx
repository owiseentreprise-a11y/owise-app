'use client'

import { useState, useTransition, useRef } from 'react'
import { demanderCourse } from './actions'
import AddressInput from '@/components/AddressInput'

const VEHICULES = [
  { value: 'berline',         label: 'Berline',         places: '1–4' },
  { value: 'berline_premium', label: 'Berline Premium', places: '1–4' },
  { value: 'van',             label: 'Van',             places: '1–7' },
]

type ModesActifs = {
  stripe:   boolean
  cash:     boolean
  cheque:   boolean
  virement: boolean
}

type Collab = {
  id: string
  nom: string | null
  prenom: string | null
  tel: string | null
  adresse: string | null
  poste: string | null
}

const MODE_META: Record<string, { icon: string; label: string; desc: string }> = {
  stripe:   { icon: '💳', label: 'Carte bancaire', desc: 'Paiement en ligne sécurisé — vous serez redirigé vers notre interface de paiement.' },
  cash:     { icon: '💵', label: 'Espèces',         desc: 'Le chauffeur encaissera le montant au moment de la course.' },
  cheque:   { icon: '📝', label: 'Chèque',          desc: "Chèque à l'ordre de OWISE SAS remis au chauffeur le jour de la course." },
  virement: { icon: '🏦', label: 'Virement',        desc: 'Virement bancaire à effectuer avant la course. Coordonnées transmises par email.' },
}

export default function DemanderCourseClient({
  success, error, isEntreprise = false, peutPayerAbord: _peutPayerAbord = false, modesActifs, collaborateurs = [],
}: {
  success?: boolean
  error?: boolean
  isEntreprise?: boolean
  peutPayerAbord?: boolean
  modesActifs?: ModesActifs
  collaborateurs?: Collab[]
}) {
  const [step, setStep]             = useState<1 | 2>(1)
  const [selectedCollab, setCollab] = useState<Collab | null>(null)
  const [depart,   setDepart]   = useState('')
  const [arrivee,  setArrivee]  = useState('')
  const [etapes,   setEtapes]   = useState<string[]>([])
  const [vehicule, setVehicule] = useState('berline')
  const [passagers, setPass]    = useState(1)
  const [date, setDate]         = useState('')
  const [note, setNote]         = useState('')
  const [allerRetour, setAllerRetour] = useState(false)
  const [dateRetour, setDateRetour]   = useState('')
  const [payMode, setPayMode]   = useState<string | null>(null)
  const [stepErr, setStepErr]   = useState('')
  const [pending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Modes disponibles (Stripe toujours si actif + modes alternatifs)
  const modes = Object.entries(modesActifs ?? { stripe: true, cash: false, cheque: false, virement: false })
    .filter(([, on]) => on)
    .map(([k]) => k)

  // Entreprise → pas d'étape paiement, soumission directe
  const showPayStep = !isEntreprise

  function goToStep2() {
    if (!depart.trim())  { setStepErr('Adresse de départ requise.'); return }
    if (!arrivee.trim()) { setStepErr("Adresse d'arrivée requise."); return }
    if (!date)           { setStepErr('Date et heure requises.'); return }
    setStepErr('')
    const first = modes[0] ?? 'stripe'
    setPayMode(first)
    setStep(2)
  }

  function submitDirect(mode: string) {
    if (!formRef.current) return
    const data = new FormData(formRef.current)
    data.set('depart', depart)
    data.set('arrivee', arrivee)
    data.set('etapes', JSON.stringify(etapes.filter(e => e.trim())))
    data.set('mode_paiement', mode)
    data.set('aller_retour', allerRetour ? 'true' : 'false')
    data.set('date_retour', dateRetour)
    startTransition(() => demanderCourse(data))
  }

  function handleConfirm() {
    if (!payMode) return
    if (payMode === 'stripe') {
      const params = new URLSearchParams()
      if (depart)  params.set('depart', depart)
      if (arrivee) params.set('arrivee', arrivee)
      if (date) {
        const d = new Date(date)
        params.set('date', d.toISOString().split('T')[0])
        params.set('time', d.toTimeString().slice(0, 5))
      }
      params.set('pax', String(passagers))
      params.set('vehicule', vehicule)
      window.location.href = `/reserver?${params.toString()}`
      return
    }
    submitDirect(payMode)
  }

  // Entreprise : soumet directement sans étape paiement
  function handleFormSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    if (isEntreprise) {
      const data = new FormData(formRef.current!)
      data.set('depart', depart)
      data.set('arrivee', arrivee)
      data.set('etapes', JSON.stringify(etapes.filter(e => e.trim())))
      data.set('mode_paiement', 'entreprise')
      data.set('aller_retour', allerRetour ? 'true' : 'false')
      data.set('date_retour', dateRetour)
      startTransition(() => demanderCourse(data))
    } else {
      goToStep2()
    }
  }

  const inputStyle: React.CSSProperties = {
    background: 'var(--elevated)', border: '1px solid var(--gb)',
    borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--t1)',
    width: '100%', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit',
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
    color: 'var(--t3)', display: 'block', marginBottom: 6,
  }

  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--gb)', borderRadius: 16, overflow: 'hidden' }}>

      {/* Barre de progression */}
      {showPayStep && (
        <div style={{ height: 2, background: 'var(--elevated)' }}>
          <div style={{
            height: '100%',
            background: 'linear-gradient(90deg, var(--gold), var(--gold2, #DDB95A))',
            width: step === 1 ? '50%' : '100%',
            transition: 'width .35s ease',
          }} />
        </div>
      )}

      <div style={{ padding: 28 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 4 }}>
          {showPayStep ? (step === 1 ? 'Étape 1 / 2 — ' : 'Étape 2 / 2 — ') : ''}Réserver un transfert
        </div>

        {/* ── Messages globaux ── */}
        {success && (
          <div style={{ marginBottom: 16, marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(61,184,122,.1)', border: '1px solid rgba(61,184,122,.2)', fontSize: 12, color: '#2E9E5E' }}>
            ✓ Demande envoyée — notre équipe vous contactera pour confirmer.
          </div>
        )}
        {error && (
          <div style={{ marginBottom: 16, marginTop: 12, padding: '10px 14px', borderRadius: 8, background: 'rgba(217,84,84,.1)', border: '1px solid rgba(217,84,84,.2)', fontSize: 12, color: '#C03030' }}>
            Veuillez renseigner le départ, l'arrivée et la date.
          </div>
        )}

        {/* ══════════ ÉTAPE 1 : Formulaire ══════════ */}
        {step === 1 && (
          <form ref={formRef} onSubmit={handleFormSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 18 }}>

            {/* Sélecteur collaborateur — entreprise uniquement */}
            {isEntreprise && collaborateurs.length > 0 && (
              <div>
                <label style={labelStyle}>Pour qui ?</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Option "Moi-même" */}
                  <button type="button" onClick={() => setCollab(null)} style={{
                    display: 'flex', alignItems: 'center', gap: 7,
                    padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1px solid ${!selectedCollab ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                    background: !selectedCollab ? 'rgba(201,168,76,.08)' : 'var(--elevated)',
                    color: !selectedCollab ? '#C9A84C' : 'var(--t2)',
                    fontSize: 11, fontWeight: !selectedCollab ? 600 : 400, fontFamily: 'inherit',
                  }}>
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%',
                      background: !selectedCollab ? 'rgba(201,168,76,.2)' : 'var(--gb)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 9, fontWeight: 700, color: !selectedCollab ? '#C9A84C' : 'var(--t3)',
                    }}>M</div>
                    Moi-même
                  </button>

                  {collaborateurs.map(c => {
                    const nom = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || '—'
                    const ini = `${c.prenom?.[0] ?? ''}${c.nom?.[0] ?? ''}`.toUpperCase()
                    const active = selectedCollab?.id === c.id
                    return (
                      <button key={c.id} type="button" onClick={() => setCollab(c)} style={{
                        display: 'flex', alignItems: 'center', gap: 7,
                        padding: '7px 12px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${active ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                        background: active ? 'rgba(201,168,76,.08)' : 'var(--elevated)',
                        color: active ? '#C9A84C' : 'var(--t2)',
                        fontSize: 11, fontWeight: active ? 600 : 400, fontFamily: 'inherit',
                      }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: active ? 'rgba(201,168,76,.2)' : 'var(--gb)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 9, fontWeight: 700, fontFamily: 'var(--font-cormorant), serif',
                          color: active ? '#C9A84C' : 'var(--t3)',
                        }}>{ini}</div>
                        {nom}
                        {c.poste && <span style={{ opacity: .6, fontSize: 10 }}>· {c.poste}</span>}
                      </button>
                    )
                  })}
                </div>

                {/* Adresses de l'équipe — tous les collabs, sélectionné en or */}
                {collaborateurs.length > 0 && (
                  <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {collaborateurs.map(c => {
                      const sel = selectedCollab?.id === c.id
                      const nom = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || '—'

                      if (!c.adresse) {
                        return (
                          <div key={c.id} style={{
                            padding: '8px 12px', borderRadius: 8,
                            background: sel ? 'rgba(201,168,76,.04)' : 'var(--elevated)',
                            border: `1px solid ${sel ? 'rgba(201,168,76,.14)' : 'var(--gb)'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                          }}>
                            <div style={{ fontSize: 11, color: 'var(--t3)' }}>
                              <span style={{ color: sel ? 'rgba(201,168,76,.6)' : 'var(--t3)', fontWeight: 500 }}>
                                📍 {nom} :
                              </span>{' '}
                              <em style={{ fontStyle: 'normal' }}>Aucune adresse enregistrée</em>
                            </div>
                            <a href="#mon-equipe" style={{ fontSize: 9, color: 'var(--t3)', textDecoration: 'underline', flexShrink: 0 }}>
                              Ajouter ↓
                            </a>
                          </div>
                        )
                      }

                      const bStyle: React.CSSProperties = {
                        padding: '3px 9px', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
                        fontSize: 10, fontWeight: 600,
                        border: sel ? '1px solid rgba(201,168,76,.35)' : '1px solid var(--gb)',
                        background: sel ? 'rgba(201,168,76,.1)' : 'var(--floating)',
                        color: sel ? '#C9A84C' : 'var(--t2)',
                      }
                      return (
                        <div key={c.id} style={{
                          padding: '8px 12px', borderRadius: 8,
                          background: sel ? 'rgba(201,168,76,.06)' : 'var(--elevated)',
                          border: `1px solid ${sel ? 'rgba(201,168,76,.22)' : 'var(--gb)'}`,
                        }}>
                          <div style={{ fontSize: 11, color: 'var(--t2)' }}>
                            <span style={{ color: sel ? '#C9A84C' : 'var(--t1)', fontWeight: sel ? 600 : 500 }}>
                              📍 {nom} :
                            </span>{' '}
                            {c.adresse}
                          </div>
                          <div style={{ display: 'flex', gap: 5, marginTop: 5 }}>
                            <button type="button" onClick={() => setDepart(c.adresse!)} style={bStyle}>→ Départ</button>
                            {etapes.length < 2 && (
                              <button type="button" onClick={() => {
                                const idx = etapes.findIndex(e => !e.trim())
                                if (idx >= 0) setEtapes(p => p.map((e, i) => i === idx ? c.adresse! : e))
                                else setEtapes(p => [...p, c.adresse!])
                              }} style={bStyle}>+ Étape</button>
                            )}
                            <button type="button" onClick={() => setArrivee(c.adresse!)} style={bStyle}>→ Arrivée</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <input type="hidden" name="collaborateur_id" value={selectedCollab?.id ?? ''} />
              </div>
            )}

            {/* Adresses */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {/* Départ */}
              <div>
                <label style={labelStyle}>Adresse de départ</label>
                <AddressInput name="depart" placeholder="15 rue de la Paix, Paris" value={depart} onChange={setDepart} theme="light" />
              </div>

              {/* Étapes intermédiaires (max 2) */}
              {etapes.map((etape, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>
                      Étape {i + 1}
                      <span style={{ color: '#aaa', fontWeight: 400, marginLeft: 4 }}>(optionnelle)</span>
                    </label>
                    <AddressInput
                      name={`etape_${i}`}
                      placeholder={`Adresse intermédiaire ${i + 1}`}
                      value={etape}
                      onChange={v => setEtapes(prev => prev.map((e, j) => j === i ? v : e))}
                      theme="light"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setEtapes(prev => prev.filter((_, j) => j !== i))}
                    style={{
                      width: 34, height: 38, borderRadius: 8, flexShrink: 0,
                      background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)',
                      color: '#D95454', cursor: 'pointer', fontSize: 16, marginBottom: 1,
                    }}
                    title="Supprimer cette étape"
                  >×</button>
                </div>
              ))}

              {/* Bouton ajouter étape */}
              {etapes.length < 2 && (
                <button
                  type="button"
                  onClick={() => setEtapes(prev => [...prev, ''])}
                  style={{
                    alignSelf: 'flex-start', padding: '6px 14px', borderRadius: 8,
                    background: 'transparent', border: '1px dashed rgba(201,168,76,.4)',
                    color: '#C9A84C', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 14 }}>+</span> Ajouter une étape
                </button>
              )}

              {/* Arrivée */}
              <div>
                <label style={labelStyle}>Adresse d'arrivée</label>
                <AddressInput name="arrivee" placeholder="CDG, Gare de Lyon, adresse..." value={arrivee} onChange={setArrivee} theme="light" />
              </div>
            </div>

            {/* Date + note */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={labelStyle}>Date et heure</label>
                <input name="date" type="datetime-local" required value={date} onChange={e => setDate(e.target.value)}
                  style={{ ...inputStyle, colorScheme: 'light' }} />
              </div>
              <div>
                <label style={labelStyle}>Commentaire (optionnel)</label>
                <input name="note" placeholder="Vol AF123, bagages..." value={note} onChange={e => setNote(e.target.value)} style={inputStyle} />
              </div>
            </div>

            {/* Aller-Retour */}
            <div>
              <button
                type="button"
                onClick={() => { setAllerRetour(a => !a); if (allerRetour) setDateRetour('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 14px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1px solid ${allerRetour ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                  background: allerRetour ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
                  color: allerRetour ? '#C9A84C' : 'var(--t2)',
                  fontSize: 12, fontWeight: allerRetour ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 15 }}>↩</span>
                Aller-Retour
                <span style={{
                  marginLeft: 4, fontSize: 9, padding: '2px 6px', borderRadius: 4,
                  background: allerRetour ? 'rgba(201,168,76,.2)' : 'var(--floating)',
                  color: allerRetour ? '#C9A84C' : 'var(--t3)', fontWeight: 700, letterSpacing: '.05em',
                }}>
                  {allerRetour ? 'ON' : 'OFF'}
                </span>
              </button>

              {allerRetour && (
                <div style={{
                  marginTop: 10, padding: '12px 14px', borderRadius: 10,
                  background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.2)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div>
                    <label style={labelStyle}>Date et heure du retour</label>
                    <input
                      type="datetime-local" value={dateRetour} required={allerRetour}
                      onChange={e => setDateRetour(e.target.value)}
                      style={{ ...inputStyle, colorScheme: 'light' }}
                    />
                  </div>
                  {(depart || arrivee) && (
                    <div style={{
                      fontSize: 11, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 10px', borderRadius: 7,
                      background: 'var(--elevated)', border: '1px solid var(--gb)',
                    }}>
                      <span style={{ color: '#D95454', fontSize: 9 }}>●</span>
                      <span style={{ color: 'var(--t3)' }}>{arrivee || '…'}</span>
                      <span style={{ color: 'var(--t3)', fontSize: 10 }}>→</span>
                      <span style={{ color: '#3DB87A', fontSize: 9 }}>●</span>
                      <span style={{ color: 'var(--t3)' }}>{depart || '…'}</span>
                      <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--t3)' }}>(adresses inversées)</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Véhicule + passagers */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'end' }}>
              <div>
                <label style={labelStyle}>Véhicule</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {VEHICULES.map(v => (
                    <button key={v.value} type="button" onClick={() => setVehicule(v.value)}
                      style={{
                        flex: 1, padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${vehicule === v.value ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                        background: vehicule === v.value ? 'rgba(201,168,76,.08)' : 'var(--elevated)',
                        fontSize: 11, fontWeight: vehicule === v.value ? 600 : 400,
                        color: vehicule === v.value ? '#C9A84C' : 'var(--t2)',
                        fontFamily: 'inherit', textAlign: 'center', lineHeight: 1.3,
                      }}>
                      <div>{v.label}</div>
                      <div style={{ fontSize: 9, opacity: .7 }}>{v.places} pass.</div>
                    </button>
                  ))}
                </div>
                <input type="hidden" name="vehicule" value={vehicule} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={labelStyle}>Passagers</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button type="button" onClick={() => setPass(p => Math.max(1, p - 1))}
                    style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--elevated)', border: '1px solid var(--gb)', color: '#C9A84C', fontSize: 18, cursor: 'pointer' }}>−</button>
                  <span style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: 600, color: 'var(--t1)', minWidth: 20, textAlign: 'center' }}>{passagers}</span>
                  <button type="button" onClick={() => setPass(p => Math.min(vehicule === 'van' ? 7 : 4, p + 1))}
                    style={{ width: 32, height: 32, borderRadius: 7, background: 'var(--elevated)', border: '1px solid var(--gb)', color: '#C9A84C', fontSize: 18, cursor: 'pointer' }}>+</button>
                  <input type="hidden" name="passagers" value={passagers} />
                </div>
              </div>
            </div>

            {/* Erreur step 1 */}
            {stepErr && (
              <div style={{ fontSize: 11, color: 'var(--red)', background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)', borderRadius: 8, padding: '8px 12px' }}>
                {stepErr}
              </div>
            )}

            {/* Info entreprise */}
            {isEntreprise && (
              <div style={{ fontSize: 11, color: 'var(--t2)', background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.14)', borderRadius: 8, padding: '8px 12px' }}>
                🏢 Facturation entreprise — aucun paiement immédiat requis.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button type="submit" disabled={pending}
                style={{
                  background: pending ? 'rgba(201,168,76,.5)' : '#C9A84C',
                  color: '#0A0A0A', border: 'none', borderRadius: 8,
                  padding: '11px 22px', fontSize: 13, fontWeight: 600,
                  cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>
                {pending ? 'Envoi…' : isEntreprise ? '+ Demander' : 'Continuer →'}
              </button>
            </div>
          </form>
        )}

        {/* ══════════ ÉTAPE 2 : Paiement ══════════ */}
        {step === 2 && (
          <div style={{ marginTop: 18 }}>

            {/* Récap course */}
            <div style={{ background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.14)', borderRadius: 10, padding: '13px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 8 }}>Récapitulatif</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, fontSize: 12, color: 'var(--t2)', fontFamily: 'inherit' }}>
                <div><span style={{ color: 'var(--green)', fontSize: 8 }}>●</span>{' '}{depart}</div>
                <div><span style={{ color: 'var(--red)', fontSize: 8 }}>●</span>{' '}{arrivee}</div>
                <div style={{ marginTop: 5, color: 'var(--t3)', fontSize: 11 }}>
                  {new Date(date + (date.includes('T') ? '' : 'T00:00')).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}
                  {VEHICULES.find(v => v.value === vehicule)?.label}
                  {' · '}{passagers} passager{passagers > 1 ? 's' : ''}
                </div>
              </div>
            </div>

            {/* Sélection du mode */}
            <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--t3)', marginBottom: 10 }}>Mode de paiement</div>

            {modes.length > 1 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                {modes.map(m => {
                  const meta = MODE_META[m]
                  const active = payMode === m
                  return (
                    <button key={m} type="button" onClick={() => setPayMode(m)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                        border: `1px solid ${active ? 'rgba(201,168,76,.5)' : 'var(--gb)'}`,
                        background: active ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
                        color: active ? '#C9A84C' : 'var(--t2)',
                        fontSize: 12, fontFamily: 'inherit', fontWeight: active ? 600 : 400,
                        transition: 'all .15s',
                      }}>
                      <span>{meta.icon}</span> {meta.label}
                    </button>
                  )
                })}
              </div>
            )}

            {/* Panneau du mode sélectionné */}
            {payMode && (() => {
              const meta = MODE_META[payMode]
              return (
                <div style={{ background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 10, padding: '14px 16px', marginBottom: 20, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 20, flexShrink: 0 }}>{meta.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{meta.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.6 }}>{meta.desc}</div>
                    {payMode === 'virement' && (
                      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {[['Bénéficiaire', 'OWISE SAS'], ['IBAN', 'FR76 3000 4000 0100 0000 0000 000'], ['BIC', 'BNPAFRPPXXX']].map(([k, v]) => (
                          <div key={k} style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                            <span style={{ color: 'var(--t3)', minWidth: 80 }}>{k}</span>
                            <span style={{ color: 'var(--t1)', fontFamily: 'var(--font-jetbrains, monospace)' }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Sécurité Stripe */}
            {payMode === 'stripe' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 16 }}>
                <svg width="11" height="13" viewBox="0 0 11 13" fill="none"><rect x=".5" y="5" width="10" height="7.5" rx="1.5" stroke="var(--t3)"/><path d="M2.5 5V3.5a3 3 0 1 1 6 0V5" stroke="var(--t3)" strokeLinecap="round"/></svg>
                <span style={{ fontSize: 11, color: 'var(--t3)' }}>Paiement sécurisé · Powered by <span style={{ color: '#635BFF', fontWeight: 600 }}>Stripe</span></span>
              </div>
            )}

            {/* Boutons */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => { setStep(1); setStepErr('') }}
                style={{ background: 'var(--elevated)', color: 'var(--t2)', border: '1px solid var(--gb)', padding: '11px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s' }}>
                ← Modifier
              </button>
              <button type="button" onClick={handleConfirm} disabled={pending || !payMode}
                style={{
                  flex: 1,
                  background: pending || !payMode ? 'rgba(201,168,76,.4)' : '#C9A84C',
                  color: '#0A0A0A', border: 'none', borderRadius: 8,
                  padding: '11px 20px', fontSize: 13, fontWeight: 600,
                  cursor: pending || !payMode ? 'wait' : 'pointer', fontFamily: 'inherit',
                }}>
                {pending ? 'Traitement…'
                  : payMode === 'stripe' ? 'Payer en ligne →'
                  : 'Confirmer la réservation →'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
