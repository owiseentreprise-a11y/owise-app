'use client'

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react'
import { creerCourseAction } from './actions'
import { searchLieux } from '@/lib/lieux'
import { searchAddresses, fetchPlaceDetails, getSuggestionIcon } from '@/lib/addressSearch'

// ── Types ─────────────────────────────────────────────────────────────────────

type Zone   = { id: string; nom: string; code: string; type: string; prefixes_postaux: string[] }
type Grille = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }
type AdresseVal = { label: string; codePostal: string; lat?: number; lng?: number }

type ClientOption = {
  id: string; type_compte: string; entreprise_nom: string | null
  profiles: { prenom: string; nom: string } | null
}
type CollabOption = { id: string; client_id: string; poste: string | null; profiles: { prenom: string; nom: string } | null }
type ChauffeurOption = { id: string; statut: string; vehicule_marque: string | null; vehicule_modele: string | null; profiles: { prenom: string; nom: string } | null }
type SousTraitantOption = { id: string; nom: string }

// ── Styles ────────────────────────────────────────────────────────────────────

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 14px',
  background: 'var(--elevated)', border: '1px solid var(--t3)',
  borderRadius: 8, color: 'var(--t1)', fontSize: 13, outline: 'none',
  fontFamily: 'var(--font-dm-sans), sans-serif', boxSizing: 'border-box',
}
const sel: React.CSSProperties = {
  ...inp, appearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='none' viewBox='0 0 24 24' stroke='%23848499' stroke-width='2'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 14px center', paddingRight: 36,
}
const lbl: React.CSSProperties = {
  display: 'block', fontSize: 10, letterSpacing: '.14em',
  textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 7,
}

// ── Tarif helpers (miroir de ReserverClient) ──────────────────────────────────

function detectZone(codePostal: string, zones: Zone[], addressLabel?: string): Zone | null {
  if (addressLabel) {
    const lower = addressLabel.toLowerCase()
    if (lower.includes('gare ') || lower.startsWith('gare') || lower.includes(' gare')) {
      const z = zones.find(z => z.type === 'gare')
      if (z) return z
    }
    if (/\bparis\b/.test(lower)) {
      const z = zones.find(z => z.code === 'Z1')
      if (z) return z
    }
  }
  if (!codePostal) return null
  const sorted = [...zones].sort((a, b) => {
    const maxA = Math.max(0, ...(a.prefixes_postaux as string[]).map(p => p.trim().length))
    const maxB = Math.max(0, ...(b.prefixes_postaux as string[]).map(p => p.trim().length))
    return maxB - maxA
  })
  return sorted.find(z =>
    (z.prefixes_postaux as string[]).some(p => p.trim() && codePostal.startsWith(p.trim()))
  ) ?? null
}

function isForfaitZone(z: Zone) {
  return z.type === 'aeroport' || z.type === 'gare' || z.code === 'Z1'
}

function appliquerSupplements(prix: number, dateHeure: string, params: any): number {
  if (!dateHeure) return prix
  const d = new Date(dateHeure), h = d.getHours(), j = d.getDay()
  if (h >= 20 || h < 6)   prix *= 1 + (params?.supplement_nuit    ?? 0) / 100
  if (j === 0 || j === 6)  prix *= 1 + (params?.supplement_weekend ?? 0) / 100
  return prix
}

function calculerPrixForfait(depId: string, arrId: string, vehicule: string, dateHeure: string, grille: Grille[], params: any): number | null {
  const cell = grille.find(g => g.zone_depart_id === depId && g.zone_arrivee_id === arrId)
  if (!cell || !cell.prix_berline) return null
  let coef = 1
  if (vehicule === 'berline_premium') coef = params?.coef_berline_premium ?? 1.25
  if (vehicule === 'van')             coef = params?.coef_van ?? 1.5
  let prix = cell.prix_berline * coef
  if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
  return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
}

function calculerPrixKm(km: number, vehicule: string, dateHeure: string, params: any): number | null {
  const base = params?.tarif_base_particulier ?? 15
  const tarif = params?.tarif_km_particulier ?? 2
  let coef = 1
  if (vehicule === 'berline_premium') coef = params?.coef_berline_premium ?? 1.25
  if (vehicule === 'van')             coef = params?.coef_van ?? 1.5
  let prix = (base + km * tarif) * coef
  if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
  return Math.round(appliquerSupplements(prix, dateHeure, params) * 100) / 100
}

async function fetchDistanceKm(dep: AdresseVal, arr: AdresseVal): Promise<number | null> {
  if (!dep.lng || !dep.lat || !arr.lng || !arr.lat) return null
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${dep.lng},${dep.lat};${arr.lng},${arr.lat}?overview=false`
    const res = await fetch(url)
    const json = await res.json()
    const m = json?.routes?.[0]?.distance
    return m ? Math.round(m / 100) / 10 : null
  } catch { return null }
}

// ── AddressInput ──────────────────────────────────────────────────────────────

function AddressInput({
  name, placeholder, dotColor, dotShape, value, onChange,
}: {
  name: string; placeholder: string; dotColor: string; dotShape: 'circle' | 'square'
  value: AdresseVal; onChange: (v: AdresseVal) => void
}) {
  const [query, setQuery]     = useState(value.label)
  const [suggestions, setSug] = useState<any[]>([])
  const [open, setOpen]       = useState(false)
  const [idx, setIdx]         = useState(-1)
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef          = useRef<HTMLDivElement>(null)

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSug([]); setOpen(false); return }
    const results = await searchAddresses(q)
    setSug(results)
    setOpen(results.length > 0)
    setIdx(-1)
  }, [])

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setQuery(v)
    onChange({ label: v, codePostal: '' })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(v), 280)
  }

  async function pick(s: any) {
    setQuery(s.label)
    setSug([]); setOpen(false); setIdx(-1)
    if (s.isGoogle && s.placeId) {
      onChange({ label: s.label, codePostal: '' })
      const details = await fetchPlaceDetails(s.placeId)
      if (details) onChange({ label: details.label || s.label, codePostal: details.codePostal, lat: details.lat, lng: details.lng })
    } else {
      onChange({ label: s.label, codePostal: '' })
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && idx >= 0) { e.preventDefault(); pick(suggestions[idx]) }
    if (e.key === 'Escape') { setOpen(false); setIdx(-1) }
  }

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        name={name} value={query} onChange={handleInput} onKeyDown={handleKey}
        placeholder={placeholder} required autoComplete="off"
        style={{ ...inp, paddingLeft: 34 }}
      />
      <div style={{
        position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
        width: 8, height: 8,
        borderRadius: dotShape === 'circle' ? '50%' : 2,
        background: dotShape === 'circle' ? dotColor : 'transparent',
        border: dotShape === 'square' ? `2px solid ${dotColor}` : undefined,
      }} />
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
          background: 'var(--floating)', border: '1px solid var(--t3)',
          borderRadius: 8, marginTop: 4, overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,.4)',
        }}>
          {suggestions.map((s, i) => (
            <div key={i} onMouseDown={() => pick(s)} style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              padding: '9px 14px', fontSize: 12, color: 'var(--t1)', cursor: 'pointer',
              background: i === idx ? 'rgba(201,168,76,.12)' : 'transparent',
              borderBottom: i < suggestions.length - 1 ? '1px solid rgba(201,168,76,.06)' : undefined,
            }}>
              <span style={{ marginRight: 8, fontSize: 13 }}>{getSuggestionIcon(s)}</span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span>{s.label}</span>
                {s.sublabel && (
                  <span style={{ display: 'block', fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{s.sublabel}</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────────────────────

export default function NouvelleCourseForm({
  clients, collabs, chauffeurs, sousTraitants,
  zones, grille, params,
  defaultDatetime,
}: {
  clients: ClientOption[]; collabs: CollabOption[]
  chauffeurs: ChauffeurOption[]; sousTraitants: SousTraitantOption[]
  zones: Zone[]; grille: Grille[]; params: any
  defaultDatetime: string
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)

  const [depart,  setDepart]  = useState<AdresseVal>({ label: '', codePostal: '' })
  const [arrivee, setArrivee] = useState<AdresseVal>({ label: '', codePostal: '' })
  const [etapes,  setEtapes]  = useState<string[]>([])
  const [dateHeure, setDateHeure] = useState(defaultDatetime)
  const [vehicule, setVehicule]   = useState('berline')
  const [prixManuel, setPrixManuel] = useState<string>('')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [clientId, setClientId]     = useState('')
  const [allerRetour, setAllerRetour] = useState(false)
  const [dateRetour, setDateRetour]   = useState('')
  const [numVolTrain, setNumVolTrain] = useState('')
  const [terminal, setTerminal]       = useState('')
  const [heureArrivee, setHeureArrivee] = useState('')

  const activeZones = useMemo(() => zones.filter(z => z.code !== 'HORS'), [zones])
  const zoneDepart  = useMemo(() => detectZone(depart.codePostal,  activeZones, depart.label),  [depart,  activeZones])
  const zoneArrivee = useMemo(() => detectZone(arrivee.codePostal, activeZones, arrivee.label), [arrivee, activeZones])

  const useForfait = !!(zoneDepart && zoneArrivee && (isForfaitZone(zoneDepart) || isForfaitZone(zoneArrivee)))

  const prixAuto = useMemo(() => {
    if (!zoneDepart || !zoneArrivee) return null
    if (useForfait) return calculerPrixForfait(zoneDepart.id, zoneArrivee.id, vehicule, dateHeure, grille, params)
    if (distanceKm) return calculerPrixKm(distanceKm, vehicule, dateHeure, params)
    return null
  }, [zoneDepart, zoneArrivee, useForfait, vehicule, dateHeure, distanceKm, grille, params])

  // Fetch OSRM distance when in km mode
  useEffect(() => {
    if (useForfait || !depart.lat || !arrivee.lat) { setDistanceKm(null); return }
    let alive = true
    fetchDistanceKm(depart, arrivee).then(d => { if (alive) setDistanceKm(d) })
    return () => { alive = false }
  }, [useForfait, depart.lat, depart.lng, arrivee.lat, arrivee.lng])

  const prixFinal = prixManuel !== '' ? parseFloat(prixManuel) : prixAuto

  const selectedClient = clients.find(c => c.id === clientId)
  const isEntreprise   = selectedClient?.type_compte === 'entreprise'
  const filteredCollabs = collabs.filter(c => c.client_id === clientId)

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    fd.set('adresse_depart', depart.label || (fd.get('adresse_depart') as string))
    fd.set('adresse_arrivee', arrivee.label || (fd.get('adresse_arrivee') as string))
    fd.set('etapes', JSON.stringify(etapes.filter(e => e.trim())))
    if (prixFinal !== null) fd.set('prix_estime', String(prixFinal))
    fd.set('aller_retour', allerRetour ? 'true' : 'false')
    fd.set('date_retour', dateRetour)
    fd.set('num_vol_train', numVolTrain)
    fd.set('terminal', terminal)
    fd.set('heure_arrivee_vol', heureArrivee)
    startTransition(async () => {
      const res = await creerCourseAction(fd)
      if (res?.error) setError(res.error)
    })
  }

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Trajet */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500, marginBottom: 12 }}>
            Trajet
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <AddressInput
              name="adresse_depart" placeholder="Adresse de départ"
              dotColor="var(--green)" dotShape="circle"
              value={depart} onChange={setDepart}
            />

            {/* Étapes intermédiaires (max 2) */}
            {etapes.map((etape, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <input
                    type="text"
                    value={etape}
                    onChange={e => setEtapes(prev => prev.map((v, j) => j === i ? e.target.value : v))}
                    placeholder={`Étape ${i + 1} — adresse intermédiaire`}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 9, boxSizing: 'border-box' as const,
                      background: 'var(--elevated)', border: '1px solid rgba(201,168,76,.25)',
                      color: 'var(--t1)', fontSize: 13, outline: 'none',
                      fontFamily: 'var(--font-dm-sans), sans-serif',
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setEtapes(prev => prev.filter((_, j) => j !== i))}
                  style={{
                    width: 32, height: 32, borderRadius: 7, flexShrink: 0,
                    background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)',
                    color: 'var(--red)', cursor: 'pointer', fontSize: 16,
                  }}
                >×</button>
              </div>
            ))}

            {etapes.length < 2 && (
              <button
                type="button"
                onClick={() => setEtapes(prev => [...prev, ''])}
                style={{
                  alignSelf: 'flex-start', padding: '5px 12px', borderRadius: 7,
                  background: 'transparent', border: '1px dashed rgba(201,168,76,.35)',
                  color: 'var(--gold)', fontSize: 11, fontWeight: 500, cursor: 'pointer',
                }}
              >
                + Ajouter une étape
              </button>
            )}

            <AddressInput
              name="adresse_arrivee" placeholder="Adresse d'arrivée"
              dotColor="var(--red)" dotShape="square"
              value={arrivee} onChange={setArrivee}
            />
          </div>

          {/* Zones détectées */}
          {(zoneDepart || zoneArrivee) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {zoneDepart && (
                <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
                  Départ : {zoneDepart.nom}
                </div>
              )}
              {zoneArrivee && (
                <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.2)', color: 'var(--gold)' }}>
                  Arrivée : {zoneArrivee.nom}
                </div>
              )}
              <div style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: useForfait ? 'rgba(77,142,212,.12)' : 'rgba(201,168,76,.08)', border: `1px solid ${useForfait ? 'rgba(77,142,212,.25)' : 'rgba(201,168,76,.15)'}`, color: useForfait ? 'var(--blue)' : 'var(--t2)' }}>
                {useForfait ? 'Forfait zone' : distanceKm ? `${distanceKm} km` : 'Tarif au km'}
              </div>
            </div>
          )}
        </fieldset>

        {/* Date + Passagers */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 12 }}>
          <div>
            <label style={lbl}>Date et heure prévue</label>
            <input name="date_prevue" type="datetime-local" defaultValue={defaultDatetime}
              onChange={e => setDateHeure(e.target.value)} required style={inp} />
          </div>
          <div>
            <label style={lbl}>Passagers</label>
            <input name="nb_passagers" type="number" min={1} max={8} defaultValue={1} style={inp} />
          </div>
        </div>

        {/* Aller-Retour */}
        <div>
          <button
            type="button"
            onClick={() => { setAllerRetour(a => !a); if (allerRetour) setDateRetour('') }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 14px', borderRadius: 8, cursor: 'pointer',
              fontFamily: 'var(--font-dm-sans), sans-serif',
              border: `1px solid ${allerRetour ? 'rgba(201,168,76,.5)' : 'var(--t3)'}`,
              background: allerRetour ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
              color: allerRetour ? 'var(--gold)' : 'var(--t2)',
              fontSize: 12, fontWeight: allerRetour ? 600 : 400,
            }}
          >
            <span style={{ fontSize: 15 }}>↩</span>
            Aller-Retour
            <span style={{
              fontSize: 9, padding: '2px 6px', borderRadius: 4, fontWeight: 700,
              background: allerRetour ? 'rgba(201,168,76,.2)' : 'var(--floating)',
              color: allerRetour ? 'var(--gold)' : 'var(--t3)',
            }}>
              {allerRetour ? 'ON' : 'OFF'}
            </span>
          </button>

          {allerRetour && (
            <div style={{
              marginTop: 10, padding: '14px', borderRadius: 10,
              background: 'rgba(201,168,76,.05)', border: '1px solid rgba(201,168,76,.2)',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}>
              <div>
                <label style={lbl}>Date et heure du retour</label>
                <input type="datetime-local" value={dateRetour} required={allerRetour}
                  onChange={e => setDateRetour(e.target.value)} style={inp} />
              </div>
              {(depart.label || arrivee.label) && (
                <div style={{
                  fontSize: 11, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 7, background: 'var(--elevated)', border: '1px solid var(--t3)',
                }}>
                  <span style={{ color: 'var(--red)', fontSize: 9 }}>●</span>
                  <span style={{ color: 'var(--t3)' }}>{arrivee.label || '…'}</span>
                  <span style={{ color: 'var(--t3)' }}>→</span>
                  <span style={{ color: 'var(--grn)', fontSize: 9 }}>●</span>
                  <span style={{ color: 'var(--t3)' }}>{depart.label || '…'}</span>
                  <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--t3)' }}>(adresses inversées)</span>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                Le prix du retour sera à définir séparément sur la fiche course.
              </div>
            </div>
          )}
        </div>

        {/* Infos vol / train — affichage conditionnel selon les zones */}
        {(() => {
          const aeroTypes = ['aeroport']
          const gareTypes = ['gare']
          const depAero  = aeroTypes.includes(zoneDepart?.type  ?? '')
          const arrAero  = aeroTypes.includes(zoneArrivee?.type ?? '')
          const depGare  = gareTypes.includes(zoneDepart?.type  ?? '')
          const arrGare  = gareTypes.includes(zoneArrivee?.type ?? '')
          const showInfo = depAero || arrAero || depGare || arrGare
          if (!showInfo && !depart.label && !arrivee.label) return null
          // Fallback label-based detection si zones non encore détectées
          const labelAero = /aéroport|aeroport|cdg|orly|roissy|beauvais/i
          const labelGare = /\bgare\b/i
          const isAero = depAero || arrAero || labelAero.test(depart.label) || labelAero.test(arrivee.label)
          const isGare = !isAero && (depGare || arrGare || labelGare.test(depart.label) || labelGare.test(arrivee.label))
          if (!isAero && !isGare) return null
          const type = isAero ? 'vol' : 'train'
          const color = isAero ? '#4D8ED4' : '#3DB87A'
          const bg    = isAero ? 'rgba(77,142,212,.06)' : 'rgba(61,184,122,.06)'
          const border = isAero ? 'rgba(77,142,212,.2)' : 'rgba(61,184,122,.2)'
          return (
            <div style={{ padding: 14, borderRadius: 10, background: bg, border: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 9.5, letterSpacing: '.14em', textTransform: 'uppercase', color, fontWeight: 600 }}>
                {isAero ? '✈ Infos de vol' : '🚄 Infos de train'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>N° de {type}</label>
                  <input name="num_vol_train" value={numVolTrain} placeholder={isAero ? 'AF1234, EZY8521…' : 'TGV 6423, TER 87650…'}
                    onChange={e => setNumVolTrain(e.target.value)}
                    style={{ ...inp, fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '.06em' }} />
                </div>
                <div>
                  <label style={lbl}>{isAero ? 'Terminal' : 'Voie / Quai'}</label>
                  <input name="terminal" value={terminal} placeholder={isAero ? '2E, T1, 3…' : 'Voie 6, Hall 2…'}
                    onChange={e => setTerminal(e.target.value)} style={inp} />
                </div>
              </div>
              <div>
                <label style={lbl}>
                  Heure {(depAero || depGare) ? "d'arrivée" : "de départ"} du {type}
                  <span style={{ color: 'var(--t3)', textTransform: 'none', letterSpacing: 0, fontWeight: 400, marginLeft: 6 }}>
                    (pour anticiper la prise en charge)
                  </span>
                </label>
                <input name="heure_arrivee_vol" type="time" value={heureArrivee}
                  onChange={e => setHeureArrivee(e.target.value)}
                  style={{ ...inp, width: '50%' }} />
              </div>
            </div>
          )
        })()}

        {/* Véhicule */}
        <div>
          <label style={lbl}>Type de véhicule</label>
          <select name="type_vehicule" required style={sel} value={vehicule} onChange={e => setVehicule(e.target.value)}>
            <option value="berline">Berline</option>
            <option value="berline_premium">Berline Premium</option>
            <option value="van">Van / Minibus</option>
          </select>
        </div>

        {/* Prix calculé */}
        <div>
          <label style={lbl}>
            Prix estimé (€)
            {prixAuto !== null && (
              <span style={{ marginLeft: 8, color: 'var(--gold)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                — calculé : {prixAuto} €{useForfait ? ' (forfait)' : distanceKm ? ` (${distanceKm} km)` : ''}
              </span>
            )}
          </label>
          <input
            name="prix_estime" type="number" min={0} step={0.5}
            placeholder={prixAuto !== null ? String(prixAuto) : 'Ex : 45.00'}
            value={prixManuel}
            onChange={e => setPrixManuel(e.target.value)}
            style={inp}
          />
          {prixAuto !== null && prixManuel === '' && (
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
              Prix automatique appliqué — saisir une valeur pour le remplacer
            </div>
          )}
        </div>

        {/* Client + Collaborateur */}
        <div>
          <label style={lbl}>Client</label>
          <select name="client_id" value={clientId} onChange={e => setClientId(e.target.value)} style={sel}>
            <option value="">— Non assigné —</option>
            {clients.map(c => {
              const nom = c.type_compte === 'entreprise' ? (c.entreprise_nom ?? '—') : `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
              return <option key={c.id} value={c.id}>{nom}</option>
            })}
          </select>
        </div>

        {isEntreprise && filteredCollabs.length > 0 && (
          <div>
            <label style={lbl}>Collaborateur voyageur</label>
            <select name="collaborateur_id" style={sel}>
              <option value="">— Aucun —</option>
              {filteredCollabs.map(c => {
                const nom = c.profiles ? `${c.profiles.prenom} ${c.profiles.nom}` : '—'
                return <option key={c.id} value={c.id}>{nom}{c.poste ? ` — ${c.poste}` : ''}</option>
              })}
            </select>
          </div>
        )}

        {/* Chauffeur / Sous-traitant */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={lbl}>Chauffeur</label>
            <select name="chauffeur_id" style={sel}>
              <option value="">— Non assigné —</option>
              {chauffeurs.map((c: any) => {
                const nom = `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
                const veh = `${c.vehicule_marque ?? ''} ${c.vehicule_modele ?? ''}`.trim()
                return (
                  <option key={c.id} value={c.id}>
                    {nom}{veh ? ` — ${veh}` : ''}{c.statut === 'disponible' ? ' ✓' : ''}
                  </option>
                )
              })}
            </select>
          </div>
          <div>
            <label style={lbl}>Sous-traitant</label>
            <select name="sous_traitant_id" style={sel}>
              <option value="">— Aucun —</option>
              {sousTraitants.map((st: any) => (
                <option key={st.id} value={st.id}>{st.nom}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={lbl}>Prix sous-traitant (€)</label>
            <input type="number" name="prix_sous_traitant" min={0} step={0.5}
              placeholder="0.00"
              style={inp} />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label style={lbl}>Notes internes</label>
          <textarea name="notes" rows={3} placeholder="Instructions particulières, références client, etc."
            style={{ ...inp, resize: 'vertical', height: 'auto', paddingTop: 10, paddingBottom: 10 }} />
        </div>

        {/* Erreur */}
        {error && (
          <div style={{
            padding: '10px 14px', borderRadius: 8,
            background: 'rgba(217,80,80,.1)', border: '1px solid rgba(217,80,80,.2)',
            color: 'var(--red)', fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button type="submit" disabled={pending} style={{
            padding: '13px 32px', borderRadius: 10,
            background: pending ? 'var(--elevated)' : 'var(--gold)',
            border: 'none', color: pending ? 'var(--t2)' : 'var(--base)',
            fontSize: 13, fontWeight: 600, cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxShadow: pending ? 'none' : '0 4px 16px rgba(201,168,76,.3)',
          }}>
            {pending ? 'Création en cours…' : 'Créer la course'}
          </button>
          <a href="/admin/courses" style={{
            padding: '13px 24px', borderRadius: 10,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 13, fontWeight: 500,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textDecoration: 'none', display: 'flex', alignItems: 'center',
          }}>
            Annuler
          </a>
        </div>
      </div>
    </form>
  )
}
