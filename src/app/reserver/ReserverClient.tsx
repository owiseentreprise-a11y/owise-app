'use client'

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createReservationCheckout } from './actions'

// ── Types ─────────────────────────────────────────────────────────────────────

type Zone         = { id: string; nom: string; code: string; type: string; prefixes_postaux: string[] }
type Grille       = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }
type TarifVehicule = { vehicule: string; prise_en_charge: number; prix_km: number; cdg_fixe: number; orly_fixe: number; beauvais_fixe: number }
type AdresseVal   = { label: string; codePostal: string; lat?: number; lng?: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function detectZone(codePostal: string, zones: Zone[], addressLabel?: string): Zone | null {
  if (addressLabel) {
    const lower = addressLabel.toLowerCase()
    // Aéroports en priorité absolue (avant le test "paris")
    if (lower.includes('charles de gaulle') || lower.includes('roissy') || /\bcdg\b/.test(lower)) {
      const z = zones.find(z => z.code === 'CDG')
      if (z) return z
    }
    if (lower.includes('orly')) {
      const z = zones.find(z => z.code === 'ORY')
      if (z) return z
    }
    if (lower.includes('beauvais')) {
      const z = zones.find(z => z.code === 'BVA')
      if (z) return z
    }
    // "gare" dans l'adresse → zone gare (Gare du Nord, Gare de Lyon…)
    if (lower.includes('gare ') || lower.startsWith('gare') || lower.includes(' gare')) {
      const gareZone = zones.find(z => z.type === 'gare')
      if (gareZone) return gareZone
    }
    // "paris" dans l'adresse → Paris intramuros (Z1)
    if (/\bparis\b/.test(lower)) {
      const parisZone = zones.find(z => z.code === 'Z1')
      if (parisZone) return parisZone
    }
  }
  if (!codePostal) return null
  // Sort by prefix length descending so more specific prefixes win (e.g. "60550" > "60")
  const sorted = [...zones].sort((a, b) => {
    const maxA = Math.max(0, ...(a.prefixes_postaux as string[]).map(p => p.trim().length))
    const maxB = Math.max(0, ...(b.prefixes_postaux as string[]).map(p => p.trim().length))
    return maxB - maxA
  })
  return sorted.find(z =>
    (z.prefixes_postaux as string[]).some(p => p.trim() && codePostal.startsWith(p.trim()))
  ) ?? null
}

/** Forfait si l'une des zones est un aéroport, une gare, ou Paris intramuros (Z1) */
function isForfaitZone(zone: Zone): boolean {
  return zone.type === 'aeroport' || zone.type === 'gare' || zone.code === 'Z1'
}

// Codes de zone aéroport → colonne dans tarifs
const AIRPORT_COL: Record<string, keyof TarifVehicule> = {
  CDG: 'cdg_fixe',
  ORY: 'orly_fixe',
  BVA: 'beauvais_fixe',
}

function calculerPrixForfait(
  zoneDepId: string,
  zoneArrId: string,
  vehicule: string,
  dateHeure: string,
  grille: Grille[],
  params: any,
  tarifs: TarifVehicule[],
  zones: Zone[],
): number | null {
  // Priorité : si une zone est un aéroport, utiliser les tarifs par véhicule
  const zDep = zones.find(z => z.id === zoneDepId)
  const zArr = zones.find(z => z.id === zoneArrId)
  const airportZone = [zDep, zArr].find(z => z?.type === 'aeroport' && AIRPORT_COL[z.code])

  if (airportZone) {
    const tarif = tarifs.find(t => t.vehicule === VEHICULE_NOM[vehicule])
    const col   = AIRPORT_COL[airportZone.code]
    if (tarif && col) {
      const prix_base = Number(tarif[col])
      if (prix_base > 0) {
        let prix = prix_base
        if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
        prix = appliquerSupplements(prix, dateHeure, params)
        return Math.round(prix * 100) / 100
      }
    }
  }

  // Fallback : matrice zone-à-zone
  const cell = grille.find(g => g.zone_depart_id === zoneDepId && g.zone_arrivee_id === zoneArrId)
  if (!cell || !cell.prix_berline) return null

  let coef = 1
  if (vehicule === 'berline_premium') coef = params?.coef_berline_premium ?? 1.25
  if (vehicule === 'van')             coef = params?.coef_van ?? 1.5

  let prix = cell.prix_berline * coef
  if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
  prix = appliquerSupplements(prix, dateHeure, params)
  return Math.round(prix * 100) / 100
}

const VEHICULE_NOM: Record<string, string> = {
  berline:         'Berline',
  berline_premium: 'Berline Premium',
  van:             'Van 7 places',
}

function calculerPrixKm(
  distanceKm: number,
  vehicule: string,
  dateHeure: string,
  params: any,
  tarifs: TarifVehicule[],
): number | null {
  const tarif = tarifs.find(t => t.vehicule === VEHICULE_NOM[vehicule])
  const base  = tarif ? Number(tarif.prise_en_charge) : (params?.tarif_base_particulier ?? 15)
  const km    = tarif ? Number(tarif.prix_km)         : (params?.tarif_km_particulier   ?? 2)

  let prix = base + distanceKm * km
  if (params?.tarif_pec_actif) prix += params.tarif_frais_pec ?? 0
  prix = appliquerSupplements(prix, dateHeure, params)
  return Math.round(prix * 100) / 100
}

function appliquerSupplements(prix: number, dateHeure: string, params: any): number {
  if (!dateHeure) return prix
  const d = new Date(dateHeure)
  const h = d.getHours()
  const j = d.getDay()
  if (h >= 20 || h < 6)   prix *= 1 + (params?.supplement_nuit    ?? 0) / 100
  if (j === 0 || j === 6)  prix *= 1 + (params?.supplement_weekend ?? 0) / 100
  return prix
}

async function fetchDistanceKm(dep: AdresseVal, arr: AdresseVal): Promise<number | null> {
  if (!dep.lng || !dep.lat || !arr.lng || !arr.lat) return null
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${dep.lng},${dep.lat};${arr.lng},${arr.lat}?overview=false`
    const res  = await fetch(url)
    const json = await res.json()
    const meters = json.routes?.[0]?.distance
    return meters ? Math.round((meters / 1000) * 10) / 10 : null
  } catch {
    return null
  }
}

// ── AddressInput ──────────────────────────────────────────────────────────────

type Suggestion = { label: string; postcode: string; city: string; lat: number; lng: number }

function AddressInput({
  value, placeholder, icon, onSelect,
}: {
  value: AdresseVal
  placeholder: string
  icon: string
  onSelect: (val: AdresseVal) => void
}) {
  const [query, setQuery]             = useState(value.label)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]               = useState(false)
  const [focused, setFocused]         = useState(-1)
  const [loading, setLoading]         = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  useEffect(() => { setQuery(value.label) }, [value.label])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 3) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=6&autocomplete=1`)
      const json = await res.json()
      const items: Suggestion[] = (json.features ?? []).map((f: any) => ({
        label:    f.properties.label,
        postcode: f.properties.postcode ?? '',
        city:     f.properties.city ?? '',
        lng:      f.geometry.coordinates[0],
        lat:      f.geometry.coordinates[1],
      }))
      setSuggestions(items)
      setOpen(items.length > 0)
    } catch {
      setSuggestions([])
    } finally {
      setLoading(false)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value
    setQuery(q)
    setFocused(-1)
    if (value.label && q !== value.label) onSelect({ label: q, codePostal: '' })
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(q), 280)
  }

  function pick(s: Suggestion) {
    setQuery(s.label)
    setSuggestions([])
    setOpen(false)
    setFocused(-1)
    onSelect({ label: s.label, codePostal: s.postcode, lat: s.lat, lng: s.lng })
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); pick(suggestions[focused]) }
    if (e.key === 'Escape') { setOpen(false); setFocused(-1) }
  }

  const hasSelection = !!value.codePostal

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontSize: 16, pointerEvents: 'none', zIndex: 1 }}>
          {icon}
        </span>
        {loading && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#848499" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </span>
        )}
        {hasSelection && !loading && (
          <span style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#3DB87A', fontSize: 14, pointerEvents: 'none' }}>✓</span>
        )}
        <input
          className="res-input"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'rgba(255,255,255,.95)',
            border: `1px solid ${hasSelection ? 'rgba(61,184,122,.35)' : open ? 'rgba(201,168,76,.5)' : 'rgba(10,10,10,.12)'}`,
            borderRadius: open && suggestions.length > 0 ? '10px 10px 0 0' : 10,
            padding: '13px 40px 13px 40px',
            fontSize: 14, color: '#09091A', outline: 'none',
            fontFamily: 'inherit', transition: 'border-color .15s',
          }}
          placeholder={placeholder}
          value={query}
          onChange={handleChange}
          onKeyDown={handleKey}
          onFocus={() => { if (suggestions.length > 0) setOpen(true) }}
          autoComplete="off"
        />
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#111128', border: '1px solid rgba(201,168,76,.25)',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,.5)',
        }}>
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              onMouseDown={() => pick(s)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                width: '100%', padding: '11px 16px',
                background: i === focused ? 'rgba(201,168,76,.1)' : 'transparent',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(255,255,255,.04)' : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={() => setFocused(i)}
              onMouseLeave={() => setFocused(-1)}
            >
              <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#848499" strokeWidth={2} style={{ flexShrink: 0 }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#EDE8DF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                {s.postcode && <div style={{ fontSize: 10, color: '#848499', marginTop: 1 }}>{s.postcode} {s.city}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const VEHICULES = [
  { value: 'berline',         label: 'Berline',        places: '1–4 passagers', icon: '🚘' },
  { value: 'berline_premium', label: 'Berline Premium', places: '1–4 passagers', icon: '🚙' },
  { value: 'van',             label: 'Van',             places: '1–7 passagers', icon: '🚐' },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#848499', marginBottom: 7, fontWeight: 500 }}>
      {children}
    </div>
  )
}

const baseInput: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(255,255,255,.95)',
  border: '1px solid rgba(10,10,10,.12)',
  borderRadius: 10, padding: '13px 16px',
  fontSize: 14, color: '#09091A', outline: 'none', fontFamily: 'inherit',
}

// ── Main Component ────────────────────────────────────────────────────────────

type Profil = { prenom: string; nom: string; email: string; telephone: string }

export default function ReserverClient({ zones, grille, params, tarifs, profil }: {
  zones: Zone[]
  grille: Grille[]
  params: any
  tarifs: TarifVehicule[]
  profil?: Profil | null
}) {
  const searchParams = useSearchParams()
  const [step, setStep] = useState<1 | 2>(1)
  const [pending, startTransition] = useTransition()

  const [depart,    setDepart]   = useState<AdresseVal>({ label: searchParams.get('depart') || '', codePostal: '' })
  const [arrivee,   setArrivee]  = useState<AdresseVal>({ label: searchParams.get('arrivee') || '', codePostal: '' })

  // Auto-résolution des adresses pré-remplies depuis l'URL
  useEffect(() => {
    async function resolve(label: string, setter: (v: AdresseVal) => void) {
      if (label.length < 3) return
      try {
        const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(label)}&limit=1&autocomplete=0`)
        const json = await res.json()
        const f    = json.features?.[0]
        if (f) setter({
          label:      f.properties.label,
          codePostal: f.properties.postcode ?? '',
          lat:        f.geometry.coordinates[1],
          lng:        f.geometry.coordinates[0],
        })
      } catch {}
    }
    const dep = searchParams.get('depart')
    const arr = searchParams.get('arrivee')
    if (dep) resolve(dep, setDepart)
    if (arr) resolve(arr, setArrivee)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [date,      setDate]     = useState(() => {
    const d = searchParams.get('date'), t = searchParams.get('time')
    return d && t ? `${d}T${t}` : d ? `${d}T09:00` : ''
  })
  const [vehicule,  setVehicule] = useState('berline')
  const [passagers, setPassagers] = useState(() => parseInt(searchParams.get('pax') || '1') || 1)

  const [nom,       setNom]       = useState(profil?.nom       ?? '')
  const [prenom,    setPrenom]    = useState(profil?.prenom    ?? '')
  const [email,     setEmail]     = useState(profil?.email     ?? '')
  const [telephone, setTelephone] = useState(profil?.telephone ?? '')
  const [allerRetour,  setAllerRetour]  = useState(false)
  const [dateRetour,   setDateRetour]   = useState('')
  const [numVolTrain,  setNumVolTrain]  = useState('')
  const [terminal,     setTerminal]     = useState('')
  const [heureArrivee, setHeureArrivee] = useState('')

  const [step1Error, setStep1Error] = useState<string | null>(null)
  const [step2Error, setStep2Error] = useState<string | null>(null)

  // Distance OSRM (pour mode km)
  const [distanceKm,   setDistanceKm]   = useState<number | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  const activeZones = zones.filter(z => z.code !== 'HORS')
  const zoneDepart  = useMemo(() => detectZone(depart.codePostal,  activeZones, depart.label),  [depart.codePostal,  depart.label])
  const zoneArrivee = useMemo(() => detectZone(arrivee.codePostal, activeZones, arrivee.label), [arrivee.codePostal, arrivee.label])

  // Forfait uniquement si les DEUX zones sont définies et au moins une est forfait
  const useForfait = useMemo(() =>
    !!(zoneDepart && zoneArrivee && (isForfaitZone(zoneDepart) || isForfaitZone(zoneArrivee))),
    [zoneDepart, zoneArrivee]
  )

  // Charger la distance OSRM quand les deux adresses sont connues et qu'on est en mode km
  useEffect(() => {
    if (useForfait || !depart.lat || !arrivee.lat) {
      setDistanceKm(null)
      return
    }
    setLoadingRoute(true)
    fetchDistanceKm(depart, arrivee).then(d => {
      setDistanceKm(d)
      setLoadingRoute(false)
    })
  }, [useForfait, depart.lat, depart.lng, arrivee.lat, arrivee.lng])

  const prix = useMemo(() => {
    if (useForfait && zoneDepart && zoneArrivee) {
      return calculerPrixForfait(zoneDepart.id, zoneArrivee.id, vehicule, date, grille, params, tarifs, activeZones)
    }
    // Si une zone manque → tarif km (OSRM × prix/km)
    if (distanceKm === null) return null
    return calculerPrixKm(distanceKm, vehicule, date, params, tarifs)
  }, [zoneDepart, zoneArrivee, useForfait, distanceKm, vehicule, date, grille, params])

  function handleStep1() {
    if (!depart.label.trim())  return setStep1Error('Adresse de départ requise.')
    if (!arrivee.label.trim()) return setStep1Error('Adresse d\'arrivée requise.')
    if (!date)                 return setStep1Error('Date et heure requises.')
    if (!depart.codePostal)    return setStep1Error('Sélectionnez une adresse de départ dans la liste.')
    if (!arrivee.codePostal)   return setStep1Error('Sélectionnez une adresse d\'arrivée dans la liste.')
    if (prix === null && !loadingRoute) return setStep1Error('Prix non calculé — vérifiez les adresses.')
    setStep1Error(null)
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePayer() {
    if (!nom.trim() || !prenom.trim())        return setStep2Error('Nom et prénom requis.')
    if (!email.trim() || !email.includes('@')) return setStep2Error('Email valide requis.')
    if (prix === null) return setStep2Error('Erreur de tarification.')
    setStep2Error(null)
    startTransition(async () => {
      const result = await createReservationCheckout({
        adresse_depart:  depart.label,
        adresse_arrivee: arrivee.label,
        date_prevue:     date,
        type_vehicule:   vehicule,
        nb_passagers:    passagers,
        prix:            Math.round(prix!),
        nom, prenom, email, telephone,
        zone_depart_id:  zoneDepart?.id ?? '',
        zone_arrivee_id: zoneArrivee?.id ?? '',
        aller_retour:    allerRetour,
        date_retour:     allerRetour ? dateRetour : '',
        num_vol_train:   numVolTrain || undefined,
        terminal:        terminal || undefined,
        heure_arrivee_vol: heureArrivee || undefined,
      })
      if (result?.error) setStep2Error(`Erreur Stripe: ${result.error}`)
    })
  }

  const fmtDateShort = (iso: string) => iso ? new Date(iso + (iso.length === 16 ? '' : 'T00:00')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
      + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  const labelVehicule = VEHICULES.find(v => v.value === vehicule)?.label ?? vehicule

  // Détection aéroport / gare (zones + fallback labels)
  const reAero = /aéroport|aeroport|cdg|orly|roissy|beauvais|le bourget/i
  const reGare = /\bgare\b/i
  const isAeroDepart  = zoneDepart?.type  === 'aeroport' || reAero.test(depart.label)
  const isAeroArrivee = zoneArrivee?.type === 'aeroport' || reAero.test(arrivee.label)
  const isGareDepart  = zoneDepart?.type  === 'gare'     || reGare.test(depart.label)
  const isGareArrivee = zoneArrivee?.type === 'gare'     || reGare.test(arrivee.label)
  const showVolInfo   = isAeroDepart || isAeroArrivee || isGareDepart || isGareArrivee
  const isAero        = isAeroDepart || isAeroArrivee
  const typeVol       = isAero ? 'vol' : 'train'

  // Badge de tarification
  const pricingBadge = useForfait
    ? { label: 'Forfait zone', color: '#4A8ED0' }
    : { label: 'Tarif au km', color: '#C9A84C' }

  return (
    <div style={{ minHeight: '100vh', background: '#09091A', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif', color: '#EDE8DF' }}>
      <style>{`
        .res-input { background: rgba(255,255,255,.06) !important; border: 1px solid rgba(201,168,76,.15) !important; color: #EDE8DF !important; }
        .res-input:focus { border-color: rgba(201,168,76,.5) !important; background: rgba(255,255,255,.08) !important; outline: none !important; }
        .res-input::placeholder { color: rgba(237,232,223,.3) !important; }
        .veh-card { cursor: pointer; transition: border-color .15s, background .15s; }
        .veh-card:hover { background: rgba(201,168,76,.06) !important; border-color: rgba(201,168,76,.3) !important; }
        .veh-card.active { border-color: rgba(201,168,76,.5) !important; background: rgba(201,168,76,.1) !important; }
        .pas-btn:hover { background: rgba(201,168,76,.15) !important; }
        .pay-btn:hover:not(:disabled) { background: #DDB95A !important; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(201,168,76,.4) !important; }
        .back-btn:hover { color: #C9A84C !important; }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(201,168,76,.1)',
        padding: '16px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#111128',
        boxShadow: '0 1px 0 rgba(201,168,76,.08)',
      }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/brand_assets/logo.svg" alt="Owise" style={{ height: 28 }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant, Georgia), serif', fontSize: 20, fontWeight: 600, letterSpacing: '.12em', color: '#C9A84C', lineHeight: 1 }}>OWISE</div>
            <div style={{ fontSize: 8, letterSpacing: '.22em', textTransform: 'uppercase', color: '#848499', fontWeight: 400 }}>Transport de prestige</div>
          </div>
        </a>
        {/* Étapes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: s <= step ? '#C9A84C' : 'rgba(201,168,76,.12)',
                border: `1px solid ${s <= step ? '#C9A84C' : 'rgba(201,168,76,.2)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                color: s <= step ? '#09091A' : '#848499',
                transition: 'all .3s',
              }}>
                {s < step ? '✓' : s}
              </div>
              <span style={{ fontSize: 10, color: s <= step ? '#C9A84C' : '#848499', display: s === 2 ? 'none' : undefined }}>
                {s === 1 ? 'Trajet' : ''}
              </span>
              {s === 1 && <div style={{ width: 20, height: 1, background: 'rgba(201,168,76,.2)' }} />}
            </div>
          ))}
          <div style={{ fontSize: 10, color: step === 2 ? '#C9A84C' : '#848499', marginLeft: 2 }}>Paiement</div>
        </div>
      </div>

      <div style={{ maxWidth: 580, margin: '0 auto', padding: '40px 20px 100px' }}>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div>
            {/* Titre */}
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: '#C9A84C', fontWeight: 500, marginBottom: 10 }}>
                Réservation en ligne
              </div>
              <h1 style={{ fontFamily: 'var(--font-cormorant, Georgia), serif', fontSize: 38, fontWeight: 500, color: '#EDE8DF', margin: '0 0 8px', lineHeight: 1.15 }}>
                Réservez votre course
              </h1>
              <p style={{ fontSize: 13, color: '#848499', margin: 0 }}>Service VTC premium · Paris & Île-de-France</p>
            </div>

            {/* ── Carte Trajet ── */}
            <div style={{
              background: '#111128', borderRadius: 14,
              border: '1px solid rgba(201,168,76,.12)',
              boxShadow: '0 4px 24px rgba(0,0,0,.4), 0 0 0 1px rgba(201,168,76,.04)',
              padding: '20px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#848499', marginBottom: 16, fontWeight: 500 }}>
                Itinéraire
              </div>
              {/* Adresses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              {/* Départ */}
              <div>
                <FieldLabel>Adresse de départ</FieldLabel>
                <AddressInput value={depart} placeholder="15 Rue de la Paix, 75001 Paris" icon="📍" onSelect={setDepart} />
                {depart.label && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    {zoneDepart
                      ? <span style={{ color: '#3DB87A' }}>✓ Zone : {zoneDepart.nom}</span>
                      : depart.codePostal
                        ? <span style={{ color: '#848499' }}>Tarif calculé au km</span>
                        : <span style={{ color: '#848499' }}>Sélectionnez dans la liste</span>
                    }
                  </div>
                )}
              </div>

              {/* Arrivée */}
              <div>
                <FieldLabel>Adresse d'arrivée</FieldLabel>
                <AddressInput value={arrivee} placeholder="Aéroport CDG, Terminal 2, 95700 Roissy" icon="🏁" onSelect={setArrivee} />
                {arrivee.label && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    {zoneArrivee
                      ? <span style={{ color: '#3DB87A' }}>✓ Zone : {zoneArrivee.nom}</span>
                      : arrivee.codePostal
                        ? <span style={{ color: '#848499' }}>Tarif calculé au km</span>
                        : <span style={{ color: '#848499' }}>Sélectionnez dans la liste</span>
                    }
                  </div>
                )}
              </div>

              {/* Badge mode de tarification */}
              {depart.codePostal && arrivee.codePostal && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 4 }}>
                  <span style={{
                    fontSize: 10, padding: '3px 10px', borderRadius: 10, fontWeight: 500,
                    color: pricingBadge.color,
                    background: `${pricingBadge.color}14`,
                    border: `1px solid ${pricingBadge.color}28`,
                    letterSpacing: '.08em', textTransform: 'uppercase',
                  }}>
                    {pricingBadge.label}
                  </span>
                  {!useForfait && distanceKm !== null && (
                    <span style={{ fontSize: 11, color: '#848499' }}>{distanceKm} km</span>
                  )}
                  {!useForfait && loadingRoute && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#848499" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  )}
                </div>
              )}
              </div>{/* fin .gap-14 adresses */}

              {/* Date */}
              <div style={{ borderTop: '1px solid rgba(201,168,76,.08)', paddingTop: 16, marginTop: 4 }}>
                <FieldLabel>Date et heure de prise en charge</FieldLabel>
                <input className="res-input" type="datetime-local" style={{ ...baseInput, colorScheme: 'dark', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.15)', color: '#EDE8DF' }}
                  value={date} min={new Date().toISOString().slice(0, 16)} onChange={e => setDate(e.target.value)} />
              </div>

              {/* Aller-Retour */}
              <div style={{ marginTop: 12 }}>
                <button type="button"
                  onClick={() => { setAllerRetour(a => !a); if (allerRetour) setDateRetour('') }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 8,
                    padding: '7px 13px', borderRadius: 8, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 12,
                    border: `1px solid ${allerRetour ? 'rgba(201,168,76,.5)' : 'rgba(201,168,76,.15)'}`,
                    background: allerRetour ? 'rgba(201,168,76,.12)' : 'rgba(201,168,76,.04)',
                    color: allerRetour ? '#C9A84C' : '#848499',
                    fontWeight: allerRetour ? 600 : 400, transition: 'all .15s',
                  }}>
                  <span style={{ fontSize: 14 }}>↩</span>
                  Aller-Retour
                  <span style={{ fontSize: 9, padding: '1px 6px', borderRadius: 3, fontWeight: 700, letterSpacing: '.04em', background: allerRetour ? 'rgba(201,168,76,.25)' : 'rgba(255,255,255,.06)', color: allerRetour ? '#C9A84C' : '#848499' }}>
                    {allerRetour ? 'ON' : 'OFF'}
                  </span>
                </button>

                {allerRetour && (
                  <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)' }}>
                    <FieldLabel>Date et heure du retour</FieldLabel>
                    <input className="res-input" type="datetime-local" style={{ ...baseInput, colorScheme: 'dark', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(201,168,76,.15)', color: '#EDE8DF', marginBottom: 10 }}
                      value={dateRetour} min={date || new Date().toISOString().slice(0, 16)}
                      onChange={e => setDateRetour(e.target.value)} />
                    {(depart.label || arrivee.label) && (
                      <div style={{ fontSize: 11, color: '#848499', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ color: '#D95454', fontSize: 9 }}>●</span>
                        <span>{arrivee.label || '…'}</span>
                        <span>→</span>
                        <span style={{ color: '#3DB87A', fontSize: 9 }}>●</span>
                        <span>{depart.label || '…'}</span>
                        <span style={{ fontSize: 10, opacity: .6 }}>(adresses inversées)</span>
                      </div>
                    )}
                  </div>
              )}
            </div>{/* fin carte trajet */}

            {/* ── Carte Vol / Train — apparaît si aéroport ou gare détecté ── */}
            {showVolInfo && (
              <div style={{
                background: '#111128', borderRadius: 14,
                border: `1px solid ${isAero ? 'rgba(77,142,212,.25)' : 'rgba(61,184,122,.25)'}`,
                boxShadow: `0 4px 24px rgba(0,0,0,.4), 0 0 0 1px ${isAero ? 'rgba(77,142,212,.05)' : 'rgba(61,184,122,.05)'}`,
                padding: '20px', marginBottom: 16,
              }}>
                <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 16, color: isAero ? '#4D8ED4' : '#3DB87A' }}>
                  {isAero ? '✈ Informations de vol' : '🚄 Informations train'}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <FieldLabel>N° de {typeVol}</FieldLabel>
                    <input className="res-input" value={numVolTrain}
                      placeholder={isAero ? 'AF1234, EZY8521…' : 'TGV 6423…'}
                      onChange={e => setNumVolTrain(e.target.value)}
                      style={{ ...baseInput, background: 'rgba(255,255,255,.05)', border: `1px solid ${isAero ? 'rgba(77,142,212,.2)' : 'rgba(61,184,122,.2)'}`, color: '#EDE8DF', fontFamily: 'var(--font-jetbrains, monospace)', letterSpacing: '.08em' }} />
                  </div>
                  <div>
                    <FieldLabel>{isAero ? 'Terminal' : 'Voie / Quai'}</FieldLabel>
                    <input className="res-input" value={terminal}
                      placeholder={isAero ? '2E, T1…' : 'Voie 6…'}
                      onChange={e => setTerminal(e.target.value)}
                      style={{ ...baseInput, background: 'rgba(255,255,255,.05)', border: `1px solid ${isAero ? 'rgba(77,142,212,.2)' : 'rgba(61,184,122,.2)'}`, color: '#EDE8DF' }} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Heure {(isAeroDepart || isGareDepart) ? "d'arrivée" : "de départ"} du {typeVol}</FieldLabel>
                  <input className="res-input" type="time" value={heureArrivee}
                    onChange={e => setHeureArrivee(e.target.value)}
                    style={{ ...baseInput, background: 'rgba(255,255,255,.05)', border: `1px solid ${isAero ? 'rgba(77,142,212,.2)' : 'rgba(61,184,122,.2)'}`, color: '#EDE8DF', width: '50%' }} />
                </div>
              </div>
            )}

            {/* ── Carte Véhicule + Passagers ── */}
            <div style={{
              background: '#111128', borderRadius: 14,
              border: '1px solid rgba(201,168,76,.12)',
              boxShadow: '0 4px 24px rgba(0,0,0,.4)',
              padding: '20px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#848499', marginBottom: 16, fontWeight: 500 }}>Véhicule & passagers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {VEHICULES.map(v => (
                  <div key={v.value} className={`veh-card${vehicule === v.value ? ' active' : ''}`}
                    onClick={() => setVehicule(v.value)}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '13px 16px', borderRadius: 10, border: `1px solid ${vehicule === v.value ? 'rgba(201,168,76,.4)' : 'rgba(201,168,76,.1)'}`, background: vehicule === v.value ? 'rgba(201,168,76,.08)' : 'rgba(255,255,255,.02)', cursor: 'pointer' }}>
                    <span style={{ fontSize: 22 }}>{v.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#EDE8DF' }}>{v.label}</div>
                      <div style={{ fontSize: 11, color: '#848499' }}>{v.places}</div>
                    </div>
                    {vehicule === v.value && (
                      <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#09091A', fontWeight: 700 }}>✓</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid rgba(201,168,76,.08)', paddingTop: 16 }}>
                <FieldLabel>Nombre de passagers</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="pas-btn" type="button" onClick={() => setPassagers(p => Math.max(1, p - 1))}
                    style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>−</button>
                  <span style={{ fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 22, fontWeight: 700, color: '#EDE8DF', minWidth: 24, textAlign: 'center' }}>{passagers}</span>
                  <button className="pas-btn" type="button" onClick={() => setPassagers(p => Math.min(vehicule === 'van' ? 7 : 4, p + 1))}
                    style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>+</button>
                </div>
              </div>
            </div>

            {/* Prix estimé */}
            {(prix !== null || loadingRoute) && depart.codePostal && arrivee.codePostal && (
              <div style={{
                background: 'linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.05))',
                border: '1px solid rgba(201,168,76,.25)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 20,
              }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#848499' }}>Prix estimé</div>
                  <div style={{ fontSize: 10, color: '#3F3F5A', marginTop: 3 }}>
                    {useForfait && zoneDepart && zoneArrivee
                      ? `${zoneDepart.nom} → ${zoneArrivee.nom} · ${labelVehicule}${params?.tarif_pec_actif ? ' · PEC inclus' : ''}`
                      : distanceKm !== null
                        ? `${distanceKm} km · ${labelVehicule}${params?.tarif_pec_actif ? ' · PEC inclus' : ''}`
                        : 'Calcul de l\'itinéraire…'
                    }
                  </div>
                </div>
                {prix !== null ? (
                  <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: '#C9A84C' }}>
                    {Math.round(prix)} €
                  </div>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                )}
              </div>
            )}

            {step1Error && (
              <div style={{ color: '#D95454', fontSize: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)' }}>
                {step1Error}
              </div>
            )}

            <button type="button" onClick={handleStep1} className="pay-btn"
              style={{ width: '100%', padding: '14px', borderRadius: 10, background: '#C9A84C', color: '#09091A', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.04em', transition: 'background .15s, transform .15s' }}>
              Continuer →
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <button className="back-btn" type="button" onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#848499', marginBottom: 24, padding: 0, transition: 'color .15s' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Modifier le trajet
            </button>

            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 500, color: '#09091A', margin: '0 0 6px' }}>
              Vos informations
            </h1>
            <p style={{ fontSize: 13, color: '#848499', margin: '0 0 28px' }}>Un email de confirmation vous sera envoyé après le paiement.</p>

            {/* Récap */}
            <div style={{ background: 'rgba(255,255,255,.03)', border: '1px solid rgba(201,168,76,.12)', borderRadius: 10, padding: '14px 18px', marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#848499', marginBottom: 10 }}>Récapitulatif</div>
              <div style={{ fontSize: 13, color: '#09091A', marginBottom: 4 }}>
                <span style={{ color: '#848499', fontSize: 11 }}>Départ · </span>{depart.label}
              </div>
              <div style={{ fontSize: 13, color: '#09091A', marginBottom: 10 }}>
                <span style={{ color: '#848499', fontSize: 11 }}>Arrivée · </span>{arrivee.label}
              </div>
              <div style={{ display: 'flex', gap: 20, paddingTop: 10, borderTop: '1px solid rgba(201,168,76,.06)', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 9, color: '#3F3F5A', textTransform: 'uppercase', letterSpacing: '.1em' }}>Date</div>
                  <div style={{ fontSize: 12, color: '#09091A' }}>{fmtDate(date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#3F3F5A', textTransform: 'uppercase', letterSpacing: '.1em' }}>Véhicule</div>
                  <div style={{ fontSize: 12, color: '#09091A' }}>{labelVehicule}</div>
                </div>
                {!useForfait && distanceKm && (
                  <div>
                    <div style={{ fontSize: 9, color: '#3F3F5A', textTransform: 'uppercase', letterSpacing: '.1em' }}>Distance</div>
                    <div style={{ fontSize: 12, color: '#09091A' }}>{distanceKm} km</div>
                  </div>
                )}
                {prix !== null && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#3F3F5A', textTransform: 'uppercase', letterSpacing: '.1em' }}>Total</div>
                    <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#C9A84C' }}>{Math.round(prix)} €</div>
                  </div>
                )}
              </div>
            </div>

            {/* Identité */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
              {[
                { label: 'Prénom', val: prenom, set: setPrenom, ph: 'Jean' },
                { label: 'Nom',    val: nom,    set: setNom,    ph: 'Dupont' },
              ].map(f => (
                <div key={f.label}>
                  <FieldLabel>{f.label}</FieldLabel>
                  <input className="res-input" style={baseInput} placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
                </div>
              ))}
            </div>
            {[
              { label: 'Email', val: email, set: setEmail, type: 'email', ph: 'jean.dupont@email.com' },
              { label: 'Téléphone', val: telephone, set: setTelephone, type: 'tel', ph: '+33 6 00 00 00 00' },
            ].map(f => (
              <div key={f.label} style={{ marginBottom: 14 }}>
                <FieldLabel>{f.label}</FieldLabel>
                <input className="res-input" style={baseInput} type={f.type} placeholder={f.ph} value={f.val} onChange={e => f.set(e.target.value)} />
              </div>
            ))}

            <div style={{ marginBottom: 28 }} />

            {step2Error && (
              <div style={{ color: '#D95454', fontSize: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)' }}>
                {step2Error}
              </div>
            )}

            <button type="button" onClick={handlePayer} disabled={pending} className="pay-btn"
              style={{ width: '100%', padding: '16px', borderRadius: 10, background: pending ? 'rgba(201,168,76,.4)' : '#C9A84C', color: '#09091A', fontSize: 14, fontWeight: 700, border: 'none', cursor: pending ? 'wait' : 'pointer', letterSpacing: '.04em', transition: 'background .15s, transform .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
              {pending ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  Redirection vers le paiement…
                </>
              ) : (
                <>
                  <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
                  </svg>
                  Payer {prix !== null ? `${Math.round(prix)} €` : ''} — Paiement sécurisé
                </>
              )}
            </button>

            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: '#3F3F5A' }}>
              Paiement sécurisé par Stripe · SSL/TLS · Aucune donnée bancaire stockée
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
