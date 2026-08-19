'use client'

import { useState, useTransition, useMemo, useRef, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { createReservationCheckout } from './actions'
import { validerCodeParrainage } from '@/app/espace-client/actions-parrainage'
import { searchLieux, LIEUX_CONNUS } from '@/lib/lieux'
import { searchAddresses, fetchPlaceDetails, getSuggestionIcon, type AddressSuggestion } from '@/lib/addressSearch'
import { fbInitCheckout, fbLead, fbViewContent } from '@/lib/pixel'
import ReservationSummary from './ReservationSummary'
import {
  calculerPrix,
  calculerPrixKm,
  detectZone,
  isForfaitZone,
  AIRPORT_COL,
  VEHICULE_NOM,
  type TarifCalc,
  type GrilleCalc,
  type ZoneCalc,
  type ParamsCalc,
} from '@/lib/calcPrix'

// ── Types ─────────────────────────────────────────────────────────────────────

type Zone         = { id: string; nom: string; code: string; type: string; prefixes_postaux: string[] }
type Grille       = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }
type TarifVehicule = { vehicule: string; prise_en_charge: number; prix_km: number; cdg_fixe: number; orly_fixe: number; beauvais_fixe: number }
type AdresseVal   = { label: string; codePostal: string; lat?: number; lng?: number }

// ── Helpers ───────────────────────────────────────────────────────────────────
// detectZone / isForfaitZone / calculerPrix / calculerPrixKm vivent dans
// @/lib/calcPrix — source unique partagée avec actions.ts (serveur) et la
// vitrine, pour garantir que le prix affiché = le prix facturé.

async function fetchDistanceKm(dep: AdresseVal, arr: AdresseVal): Promise<number | null> {
  if (!dep.lng || !dep.lat || !arr.lng || !arr.lat) return null
  try {
    const url = `/api/distance?olat=${dep.lat}&olng=${dep.lng}&dlat=${arr.lat}&dlng=${arr.lng}`
    const res  = await fetch(url)
    const json = await res.json()
    return json.km ?? null
  } catch {
    return null
  }
}

// ── AddressInput ──────────────────────────────────────────────────────────────

type Suggestion = AddressSuggestion & { postcode?: string; city?: string }

function AddressInput({
  value, placeholder, icon, onSelect,
}: {
  value: AdresseVal
  placeholder: string
  icon: React.ReactNode
  onSelect: (val: AdresseVal) => void
}) {
  const [query, setQuery]             = useState(value.label)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen]               = useState(false)
  const [focused, setFocused]         = useState(-1)
  const [loading, setLoading]         = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef  = useRef<HTMLDivElement>(null)

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setQuery(value.label) }, [value.label])

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }
    setLoading(true)
    try {
      const all = await searchAddresses(q)
      setSuggestions(all)
      setOpen(all.length > 0)
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

  async function pick(s: Suggestion) {
    setQuery(s.label)
    setSuggestions([])
    setOpen(false)
    setFocused(-1)
    // Adresse sélectionnée — récupérer lat/lng si c'est un lieu Google
    if (s.isGoogle && s.placeId) {
      onSelect({ label: s.label, codePostal: '' })
      const details = await fetchPlaceDetails(s.placeId)
      if (details) onSelect({ label: details.label || s.label, codePostal: details.codePostal, lat: details.lat, lng: details.lng })
    } else {
      onSelect({ label: s.label, codePostal: s.codePostal ?? s.postcode ?? '', lat: s.lat, lng: s.lng })
    }
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
        <span style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', zIndex: 1, display: 'flex', alignItems: 'center' }}>
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
          background: '#FFFFFF', border: '1px solid rgba(201,168,76,.25)',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,.08)',
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
                borderBottom: i < suggestions.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
                transition: 'background .1s',
              }}
              onMouseEnter={() => setFocused(i)}
              onMouseLeave={() => setFocused(-1)}
            >
              <span style={{ fontSize: 14, flexShrink: 0 }}>{getSuggestionIcon(s)}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: '#09091A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.label}</div>
                {(s.sublabel || s.postcode) && (
                  <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 1 }}>
                    {s.sublabel ?? `${s.postcode} ${s.city}`}
                  </div>
                )}
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
  {
    value: 'berline',
    label: 'Berline',
    places: '1–4 passagers',
    models: 'Peugeot 508, Volkswagen Passat',
    image: '/brand_assets/vehicle-berline.png',
    badge: null,
  },
  {
    value: 'berline_premium',
    label: 'Berline Premium',
    places: '1–4 passagers',
    models: 'BMW Série 5, Mercedes Classe E',
    image: '/brand_assets/vehicle-berline-premium.png',
    badge: 'Populaire',
  },
  {
    value: 'van',
    label: 'Van 7 places',
    places: '1–7 passagers',
    models: 'Mercedes Vito, VW Caravelle',
    image: '/brand_assets/vehicle-van7.png',
    badge: null,
  },
]

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 7, fontWeight: 500 }}>
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

export default function ReserverClient({ zones, grille, tarifs, params, profil }: {
  zones: Zone[]
  grille: Grille[]
  tarifs: TarifVehicule[]
  params?: ParamsCalc | null
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
      // Lieux connus en priorité
      const lower = label.toLowerCase()
      const lieu  = LIEUX_CONNUS.find(l => l.keywords.some(k => k === lower || l.label.toLowerCase() === lower))
      if (lieu) {
        const cpMatch = lieu.sublabel.match(/\b(\d{5})\b/)
        setter({ label: lieu.label, codePostal: cpMatch?.[1] ?? '', lat: lieu.lat, lng: lieu.lng })
        return
      }
      // Google Geocoding
      try {
        const res  = await fetch(`/api/geocode?q=${encodeURIComponent(label)}`)
        const json = await res.json()
        if (json.lat && json.lng) {
          setter({ label: json.label || label, codePostal: json.codePostal ?? '', lat: json.lat, lng: json.lng })
        }
      } catch {}
    }
    const dep = searchParams.get('depart')
    const arr = searchParams.get('arrivee')
    if (dep) resolve(dep, setDepart)
    if (arr) resolve(arr, setArrivee)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [dateOnly, setDateOnly] = useState(() => searchParams.get('date') || '')
  const [timeOnly, setTimeOnly] = useState(() => searchParams.get('time') || '09:00')
  const date = dateOnly ? `${dateOnly}T${timeOnly}` : ''
  const [vehicule,  setVehicule] = useState('berline')
  const [passagers, setPassagers] = useState(() => parseInt(searchParams.get('pax') || '1') || 1)

  const [nom,       setNom]       = useState(profil?.nom       ?? searchParams.get('nom')   ?? '')
  const [prenom,    setPrenom]    = useState(profil?.prenom    ?? searchParams.get('prenom') ?? '')
  const [email,     setEmail]     = useState(profil?.email     ?? searchParams.get('email')  ?? '')
  const [telephone, setTelephone] = useState(profil?.telephone ?? searchParams.get('tel')    ?? '')
  const [allerRetour,     setAllerRetour]     = useState(false)
  const [dateRetourOnly,  setDateRetourOnly]  = useState('')
  const [timeRetourOnly,  setTimeRetourOnly]  = useState('10:00')
  const dateRetour = dateRetourOnly ? `${dateRetourOnly}T${timeRetourOnly}` : ''
  const [numVolTrain,  setNumVolTrain]  = useState('')
  const [terminal,     setTerminal]     = useState('')
  const [heureArrivee, setHeureArrivee] = useState('')

  const [step1Error, setStep1Error] = useState<string | null>(null)
  const [step2Error, setStep2Error] = useState<string | null>(null)

  // Code parrainage
  const [codeParrain,  setCodeParrain]  = useState('')
  const [codeValide,   setCodeValide]   = useState(false)
  const [codeLoading,  setCodeLoading]  = useState(false)
  const [codeMsg,      setCodeMsg]      = useState('')
  const datePast = !!date && new Date(date) < new Date()

  // Distance OSRM (pour mode km)
  const [distanceKm,   setDistanceKm]   = useState<number | null>(null)
  const [loadingRoute, setLoadingRoute] = useState(false)

  const activeZones = zones.filter(z => z.code !== 'HORS')
  const zoneDepart  = useMemo(() => detectZone(depart.codePostal,  activeZones, depart.label),  [depart.codePostal,  depart.label])
  const zoneArrivee = useMemo(() => detectZone(arrivee.codePostal, activeZones, arrivee.label), [arrivee.codePostal, arrivee.label])

  // Forfait uniquement si les DEUX zones sont connues et au moins une est forfait
  const mightBeForfait = useMemo(() =>
    !!(zoneDepart && zoneArrivee && (isForfaitZone(zoneDepart) || isForfaitZone(zoneArrivee))),
    [zoneDepart, zoneArrivee]
  )

  // Prix forfait — null si montant = 0 (non configuré) ou zones inconnues
  const forfaitPrix = useMemo(() => {
    if (!mightBeForfait) return null
    return calculerPrix(zoneDepart?.id ?? '', zoneArrivee?.id ?? '', vehicule, date, grille, tarifs, activeZones, params)
  }, [mightBeForfait, zoneDepart, zoneArrivee, vehicule, date, grille, tarifs, activeZones, params])

  // Forfait actif uniquement si le montant est configuré (> 0) — sinon fallback km
  const useForfait = forfaitPrix !== null

  // Charger la distance OSRM uniquement si pas de forfait disponible
  useEffect(() => {
    if (useForfait || !depart.lat || !arrivee.lat) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    if (useForfait) return forfaitPrix
    if (distanceKm === null) return null
    return calculerPrixKm(distanceKm, vehicule, date, tarifs, params)
  }, [useForfait, forfaitPrix, distanceKm, vehicule, date, tarifs, params])

  // Fire ViewContent la première fois qu'un prix est calculé (signal d'intention forte)
  const prixCalculéRef = useRef(false)
  useEffect(() => {
    if (prix !== null && !prixCalculéRef.current) {
      prixCalculéRef.current = true
      fbViewContent({ value: prix, currency: 'EUR', content_name: `${depart.label} → ${arrivee.label}`, content_category: 'VTC' })
      fetch('/api/estimations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adresse_depart:  depart.label,
          adresse_arrivee: arrivee.label,
          vehicule,
          prix:            Math.round(prix),
          source:          'reservation',
        }),
      }).catch(() => {})
    }
    if (prix === null) prixCalculéRef.current = false
  }, [prix, depart.label, arrivee.label, vehicule])

  // Prix total : aller × 2 si aller-retour activé
  const prixTotal = useMemo(() => prix === null ? null : allerRetour ? Math.round(prix * 2 * 100) / 100 : prix, [prix, allerRetour])

  // Prix avec réduction parrainage -10%
  const prixFinal = useMemo(() => prixTotal === null ? null : codeValide ? Math.round(prixTotal * 0.9) : prixTotal, [prixTotal, codeValide])

  function handleDateChange(d: string)        { setDateOnly(d) }
  function handleTimeChange(t: string)        { setTimeOnly(t || '09:00') }
  function handleDateRetourChange(d: string)  { setDateRetourOnly(d) }
  function handleTimeRetourChange(t: string)  { setTimeRetourOnly(t || '10:00') }

  async function checkCodeParrain(code: string) {
    const c = code.toUpperCase().trim()
    if (c.length < 6) { setCodeValide(false); setCodeMsg(''); return }
    setCodeLoading(true)
    const { valid } = await validerCodeParrainage(c)
    setCodeValide(valid)
    setCodeMsg(valid ? '✓ Code valide — -10% appliqué !' : 'Code invalide ou expiré')
    setCodeLoading(false)
  }

  function handleStep1() {
    if (!depart.label.trim())  return setStep1Error('Adresse de départ requise.')
    if (!arrivee.label.trim()) return setStep1Error('Adresse d\'arrivée requise.')
    if (!date)                                                                     return setStep1Error('Date et heure requises.')
    if (isNaN(new Date(date).getTime()))                                           return setStep1Error('Date invalide.')
    if (new Date(date) < new Date())                                               return setStep1Error('La date de prise en charge doit être dans le futur.')
    if (new Date(date) > new Date(Date.now() + 730 * 86400000))                   return setStep1Error('Date trop lointaine (max 2 ans).')
    // Accepter si le lieu est reconnu par zone (landmark) même sans code postal
    if (!depart.codePostal && !zoneDepart && !depart.lat)    return setStep1Error('Sélectionnez une adresse de départ dans la liste.')
    if (!arrivee.codePostal && !zoneArrivee && !arrivee.lat)  return setStep1Error('Sélectionnez une adresse d\'arrivée dans la liste.')
    if (prix === null && !loadingRoute) return setStep1Error('Prix non calculé — vérifiez les adresses.')
    setStep1Error(null)
    fbInitCheckout({ value: prixTotal ?? undefined, currency: 'EUR', content_category: 'VTC', num_items: 1 })
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function handlePayer() {
    if (!nom.trim() || !prenom.trim())        return setStep2Error('Nom et prénom requis.')
    if (!email.trim() || !email.includes('@')) return setStep2Error('Email valide requis.')
    if (prixFinal === null) return setStep2Error('Erreur de tarification.')
    setStep2Error(null)
    fbLead({ value: prixFinal, currency: 'EUR', content_name: `${depart.label} → ${arrivee.label}`, content_category: 'VTC' })
    startTransition(async () => {
      const result = await createReservationCheckout({
        adresse_depart:  depart.label,
        adresse_arrivee: arrivee.label,
        date_prevue:     date,
        type_vehicule:   vehicule,
        nb_passagers:    passagers,
        prix:            Math.round(prixFinal!),
        nom, prenom, email, telephone,
        zone_depart_id:  zoneDepart?.id ?? '',
        zone_arrivee_id: zoneArrivee?.id ?? '',
        distance_km:     distanceKm ?? undefined,
        aller_retour:    allerRetour,
        date_retour:     allerRetour ? dateRetour : '',
        num_vol_train:   numVolTrain || undefined,
        terminal:        terminal || undefined,
        heure_arrivee_vol: heureArrivee || undefined,
        code_parrainage: codeValide ? codeParrain.toUpperCase().trim() : undefined,
      })
      if (result?.error) setStep2Error(`Erreur Stripe: ${result.error}`)
    })
  }

  const fmtDateShort = (iso: string) => iso ? new Date(iso + (iso.length === 16 ? '' : 'T00:00')).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : ''

  const fmtDate = (iso: string) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
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
    <div style={{ minHeight: '100vh', background: '#F8F6F1', fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif', color: '#09091A' }}>
      <style>{`
        .res-input { background: #FFFFFF !important; border: 1px solid rgba(0,0,0,.12) !important; color: #09091A !important; }
        .res-input:focus { border-color: rgba(201,168,76,.6) !important; background: #FFFFFF !important; outline: none !important; box-shadow: 0 0 0 3px rgba(201,168,76,.1) !important; }
        .res-input::placeholder { color: rgba(9,9,26,.35) !important; }
        .veh-card { cursor: pointer; transition: border-color .15s, background .15s; }
        .veh-card:hover { background: rgba(201,168,76,.05) !important; border-color: rgba(201,168,76,.4) !important; }
        .veh-card.active { border-color: #C9A84C !important; background: rgba(201,168,76,.08) !important; }
        .pas-btn:hover { background: rgba(0,0,0,.06) !important; }
        .pay-btn:hover:not(:disabled) { background: #09091A !important; transform: translateY(-1px); box-shadow: 0 6px 24px rgba(0,0,0,.15) !important; }
        .back-btn:hover { color: #09091A !important; }
        .res-time { color: #C9A84C !important; }
        .res-time::-webkit-datetime-edit { color: #C9A84C !important; }
        .res-time::-webkit-datetime-edit-hour-field,
        .res-time::-webkit-datetime-edit-minute-field { color: #C9A84C !important; background: transparent; }
        .res-time:focus { border-color: rgba(201,168,76,.6) !important; box-shadow: 0 0 0 3px rgba(201,168,76,.12) !important; }
        @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }
        @media (max-width: 1024px) {
          .reservation-summary-col { order: -1; width: 100%; max-width: none !important; }
          .reservation-summary-panel { position: static !important; margin-bottom: 24px; }
          .reservation-summary-detail { display: none !important; }
        }
      `}</style>

      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(0,0,0,.08)',
        padding: '16px 28px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#FFFFFF',
        boxShadow: '0 1px 8px rgba(0,0,0,.04)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none' }}>
          <img src="/brand_assets/logo.svg" alt="Owise" style={{ height: 28 }} onError={e => { (e.target as HTMLImageElement).style.display='none' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-cormorant, Georgia), serif', fontSize: 20, fontWeight: 600, letterSpacing: '.12em', color: '#09091A', lineHeight: 1 }}>OWISE</div>
            <div style={{ fontSize: 8, letterSpacing: '.22em', textTransform: 'uppercase', color: '#9B9B9B', fontWeight: 400 }}>Transport de prestige</div>
          </div>
        </Link>
        {/* Étapes */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {[1, 2].map(s => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: s <= step ? '#09091A' : 'rgba(0,0,0,.06)',
                border: `1px solid ${s <= step ? '#09091A' : 'rgba(0,0,0,.12)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 9, fontWeight: 700,
                color: s <= step ? '#FFFFFF' : '#9B9B9B',
                transition: 'all .3s',
              }}>
                {s < step ? '✓' : s}
              </div>
              <span style={{ fontSize: 10, color: s <= step ? '#09091A' : '#9B9B9B', display: s === 2 ? 'none' : undefined }}>
                {s === 1 ? 'Trajet' : ''}
              </span>
              {s === 1 && <div style={{ width: 20, height: 1, background: 'rgba(0,0,0,.1)' }} />}
            </div>
          ))}
          <div style={{ fontSize: 10, color: step === 2 ? '#09091A' : '#9B9B9B', marginLeft: 2 }}>Paiement</div>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 100px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div>
            {/* Titre */}
            <div style={{ marginBottom: 32, textAlign: 'center' }}>
              <div style={{ fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase', color: '#C9A84C', fontWeight: 500, marginBottom: 10 }}>
                Réservation en ligne
              </div>
              <h1 style={{ fontFamily: 'var(--font-cormorant, Georgia), serif', fontSize: 38, fontWeight: 500, color: '#09091A', margin: '0 0 8px', lineHeight: 1.15 }}>
                Réservez votre course
              </h1>
              <p style={{ fontSize: 13, color: '#6B6B6B', margin: 0 }}>Service VTC premium · Paris & Île-de-France</p>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <span style={{ fontSize: 13, color: '#C9A84C', letterSpacing: 1 }}>★★★★★</span>
                <span style={{ fontSize: 12, color: '#9B9B9B' }}>
                  <span style={{ color: '#09091A', fontWeight: 600 }}>5 / 5</span>
                  {' · '}4 avis Google vérifiés
                </span>
              </div>
            </div>

            {/* ── Carte Trajet ── */}
            <div style={{
              background: '#FFFFFF', borderRadius: 14,
              border: '1px solid rgba(0,0,0,.08)',
              boxShadow: '0 2px 16px rgba(0,0,0,.06)',
              padding: '20px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 16, fontWeight: 500 }}>
                Itinéraire
              </div>
              {/* Adresses */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 16 }}>
              {/* Départ */}
              <div>
                <FieldLabel>Adresse de départ</FieldLabel>
                <AddressInput value={depart} placeholder="15 Rue de la Paix, 75001 Paris" icon={
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="#3DB87A" strokeWidth="1.5" fill="rgba(61,184,122,.12)"/>
                    <circle cx="8" cy="8" r="3.5" fill="#3DB87A"/>
                  </svg>
                } onSelect={setDepart} />
                {depart.label && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    {zoneDepart
                      ? <span style={{ color: '#3DB87A' }}>✓ Zone : {zoneDepart.nom}</span>
                      : (depart.codePostal || depart.lat)
                        ? <span style={{ color: '#6B6B6B' }}>Tarif calculé au km</span>
                        : <span style={{ color: '#6B6B6B' }}>Sélectionnez dans la liste</span>
                    }
                  </div>
                )}
              </div>

              {/* Arrivée */}
              <div>
                <FieldLabel>Adresse d&apos;arrivée</FieldLabel>
                <AddressInput value={arrivee} placeholder="Aéroport CDG, Terminal 2, 95700 Roissy" icon={
                  <svg width="16" height="18" viewBox="0 0 16 18" fill="none">
                    <path d="M8 0C4.686 0 2 2.686 2 6c0 4.418 6 12 6 12s6-7.582 6-12c0-3.314-2.686-6-6-6z" fill="#C9A84C"/>
                    <circle cx="8" cy="6" r="2.2" fill="#fff"/>
                  </svg>
                } onSelect={setArrivee} />
                {arrivee.label && (
                  <div style={{ marginTop: 6, fontSize: 11 }}>
                    {zoneArrivee
                      ? <span style={{ color: '#3DB87A' }}>✓ Zone : {zoneArrivee.nom}</span>
                      : (arrivee.codePostal || arrivee.lat)
                        ? <span style={{ color: '#6B6B6B' }}>Tarif calculé au km</span>
                        : <span style={{ color: '#6B6B6B' }}>Sélectionnez dans la liste</span>
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
                    <span style={{ fontSize: 11, color: '#6B6B6B' }}>{distanceKm} km</span>
                  )}
                  {!useForfait && loadingRoute && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#848499" strokeWidth={2} style={{ animation: 'spin 1s linear infinite' }}>
                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                    </svg>
                  )}
                </div>
              )}
              </div>{/* fin .gap-14 adresses */}

              {/* Date + Heure */}
              <div style={{ borderTop: '1px solid rgba(201,168,76,.08)', paddingTop: 16, marginTop: 4 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10 }}>
                  {/* Date */}
                  <div>
                    <FieldLabel>Date de prise en charge</FieldLabel>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#9B9B9B' }}>
                        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                          <rect x="3" y="4" width="18" height="18" rx="3"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
                        </svg>
                      </span>
                      <input className="res-input" type="date"
                        style={{ ...baseInput, paddingLeft: 34,
                          border: `1px solid ${datePast ? '#D95454' : 'rgba(0,0,0,.12)'}`,
                          boxShadow: datePast ? '0 0 0 3px rgba(217,84,84,.1)' : 'none',
                        }}
                        value={dateOnly}
                        min={new Date().toISOString().slice(0, 10)}
                        max={new Date(Date.now() + 730 * 86400000).toISOString().slice(0, 10)}
                        onChange={e => handleDateChange(e.target.value)} />
                    </div>
                  </div>
                  {/* Heure */}
                  <div>
                    <FieldLabel>Heure</FieldLabel>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                        <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={2}>
                          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                        </svg>
                      </span>
                      <input className="res-input res-time" type="time"
                        style={{ ...baseInput, paddingLeft: 32,
                          fontFamily: 'var(--font-jetbrains, monospace)',
                          fontSize: 17, fontWeight: 700, textAlign: 'center',
                          border: `1px solid ${datePast ? '#D95454' : 'rgba(201,168,76,.35)'}`,
                        }}
                        value={timeOnly}
                        onChange={e => handleTimeChange(e.target.value)} />
                    </div>
                  </div>
                </div>
                {datePast && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#D95454', display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    Cette date est déjà passée — choisissez une date future.
                  </div>
                )}
              </div>

              {/* Aller-Retour */}
              <div style={{ marginTop: 16 }}>
                <button type="button"
                  onClick={() => { setAllerRetour(a => !a); if (allerRetour) { setDateRetourOnly(''); setTimeRetourOnly('10:00') } }}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    width: '100%', padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                    fontFamily: 'inherit',
                    border: `1.5px solid ${allerRetour ? '#C9A84C' : 'rgba(201,168,76,.25)'}`,
                    background: allerRetour ? 'rgba(201,168,76,.08)' : 'rgba(201,168,76,.03)',
                    transition: 'all .15s',
                    boxShadow: allerRetour ? '0 0 0 3px rgba(201,168,76,.1)' : 'none',
                  }}>
                  {/* Gauche */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                      background: allerRetour ? 'rgba(201,168,76,.15)' : 'rgba(0,0,0,.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background .15s',
                    }}>
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke={allerRetour ? '#C9A84C' : '#9B9B9B'} strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"/>
                      </svg>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: allerRetour ? '#C9A84C' : '#09091A' }}>
                        Ajouter un retour
                      </div>
                      <div style={{ fontSize: 11, color: '#9B9B9B', marginTop: 1 }}>
                        {allerRetour ? 'Prix aller × 2 — même tarif garanti' : 'Économisez avec un trajet retour inclus'}
                      </div>
                    </div>
                  </div>
                  {/* Toggle switch */}
                  <div style={{
                    width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                    background: allerRetour ? '#C9A84C' : 'rgba(0,0,0,.12)',
                    position: 'relative', transition: 'background .2s',
                  }}>
                    <div style={{
                      position: 'absolute', top: 3, borderRadius: '50%',
                      width: 18, height: 18, background: '#fff',
                      left: allerRetour ? 23 : 3,
                      transition: 'left .2s',
                      boxShadow: '0 1px 4px rgba(0,0,0,.2)',
                    }}/>
                  </div>
                </button>

                {allerRetour && (
                  <div style={{ marginTop: 10, padding: '12px 14px', borderRadius: 10, background: 'rgba(201,168,76,.06)', border: '1px solid rgba(201,168,76,.2)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <FieldLabel>Date du retour</FieldLabel>
                        <input className="res-input" type="date"
                          style={{ ...baseInput, background: '#FFFFFF', border: '1px solid rgba(0,0,0,.12)', color: '#09091A' }}
                          value={dateRetourOnly}
                          min={dateOnly || new Date().toISOString().slice(0, 10)}
                          onChange={e => handleDateRetourChange(e.target.value)} />
                      </div>
                      <div>
                        <FieldLabel>Heure</FieldLabel>
                        <input className="res-input res-time" type="time"
                          style={{ ...baseInput, background: '#FFFFFF', fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 17, fontWeight: 700, border: '1px solid rgba(201,168,76,.35)' }}
                          value={timeRetourOnly}
                          onChange={e => handleTimeRetourChange(e.target.value)} />
                      </div>
                    </div>
                    {(depart.label || arrivee.label) && (
                      <div style={{ fontSize: 11, color: '#6B6B6B', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
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
              </div>{/* fin aller-retour wrapper */}
            </div>{/* fin carte trajet */}

            {/* ── Carte Vol / Train — apparaît si aéroport ou gare détecté ── */}
            {showVolInfo && (
              <div style={{
                background: '#FFFFFF', borderRadius: 14,
                border: `1px solid ${isAero ? 'rgba(77,142,212,.25)' : 'rgba(61,184,122,.25)'}`,
                boxShadow: `0 2px 12px rgba(0,0,0,.06)`,
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
                      style={{ ...baseInput, background: '#FFFFFF', border: `1px solid ${isAero ? 'rgba(77,142,212,.3)' : 'rgba(61,184,122,.3)'}`, color: '#09091A', fontFamily: 'var(--font-jetbrains, monospace)', letterSpacing: '.08em' }} />
                  </div>
                  <div>
                    <FieldLabel>{isAero ? 'Terminal' : 'Voie / Quai'}</FieldLabel>
                    <input className="res-input" value={terminal}
                      placeholder={isAero ? '2E, T1…' : 'Voie 6…'}
                      onChange={e => setTerminal(e.target.value)}
                      style={{ ...baseInput, background: '#FFFFFF', border: `1px solid ${isAero ? 'rgba(77,142,212,.3)' : 'rgba(61,184,122,.3)'}`, color: '#09091A' }} />
                  </div>
                </div>
                <div>
                  <FieldLabel>Heure {(isAeroDepart || isGareDepart) ? "d'arrivée" : "de départ"} du {typeVol}</FieldLabel>
                  <input className="res-input" type="time" value={heureArrivee}
                    onChange={e => setHeureArrivee(e.target.value)}
                    style={{ ...baseInput, background: '#FFFFFF', border: `1px solid ${isAero ? 'rgba(77,142,212,.3)' : 'rgba(61,184,122,.3)'}`, color: '#09091A', width: '50%' }} />
                </div>
              </div>
            )}

            {/* ── Carte Véhicule + Passagers ── */}
            <div style={{
              background: '#FFFFFF', borderRadius: 14,
              border: '1px solid rgba(0,0,0,.08)',
              boxShadow: '0 2px 12px rgba(0,0,0,.06)',
              padding: '20px', marginBottom: 16,
            }}>
              <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 16, fontWeight: 500 }}>Véhicule & passagers</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {VEHICULES.map(v => {
                  const active = vehicule === v.value
                  return (
                    <div key={v.value} className={`veh-card${active ? ' active' : ''}`}
                      onClick={() => setVehicule(v.value)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 0,
                        borderRadius: 12,
                        border: `1.5px solid ${active ? '#C9A84C' : 'rgba(0,0,0,.09)'}`,
                        background: active ? 'rgba(201,168,76,.06)' : '#FAFAF8',
                        cursor: 'pointer', overflow: 'hidden',
                        boxShadow: active ? '0 0 0 3px rgba(201,168,76,.12)' : 'none',
                        transition: 'border-color .15s, box-shadow .15s, background .15s',
                      }}>
                      {/* Image véhicule */}
                      <div style={{
                        width: 150, minWidth: 150, height: 96,
                        background: 'linear-gradient(135deg, #f0ede8 0%, #e8e4de 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                      }}>
                        <img
                          src={v.image} alt={v.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                        />
                      </div>
                      {/* Infos */}
                      <div style={{ flex: 1, padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#09091A' }}>{v.label}</div>
                          {v.badge && (
                            <span style={{
                              fontSize: 8.5, fontWeight: 600, letterSpacing: '.08em',
                              textTransform: 'uppercase', padding: '2px 7px', borderRadius: 20,
                              background: '#C9A84C', color: '#fff',
                            }}>{v.badge}</span>
                          )}
                        </div>
                        <div style={{ fontSize: 10.5, color: '#6B6B6B', marginBottom: 2 }}>{v.models}</div>
                        <div style={{ fontSize: 10, color: '#C9A84C', fontWeight: 500 }}>{v.places}</div>
                      </div>
                      {/* Check */}
                      <div style={{ paddingRight: 14 }}>
                        <div style={{
                          width: 22, height: 22, borderRadius: '50%',
                          background: active ? '#C9A84C' : 'rgba(0,0,0,.08)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 11, color: active ? '#fff' : 'transparent',
                          fontWeight: 700, transition: 'background .15s',
                        }}>✓</div>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ borderTop: '1px solid rgba(201,168,76,.08)', paddingTop: 16 }}>
                <FieldLabel>Nombre de passagers</FieldLabel>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <button className="pas-btn" type="button" onClick={() => setPassagers(p => Math.max(1, p - 1))}
                    style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>−</button>
                  <span style={{ fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 22, fontWeight: 700, color: '#09091A', minWidth: 24, textAlign: 'center' }}>{passagers}</span>
                  <button className="pas-btn" type="button" onClick={() => setPassagers(p => Math.min(vehicule === 'van' ? 7 : 4, p + 1))}
                    style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(201,168,76,.1)', border: '1px solid rgba(201,168,76,.25)', color: '#C9A84C', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>+</button>
                </div>
              </div>
            </div>

            {/* Prix estimé */}
            {(prix !== null || loadingRoute) && (depart.codePostal || zoneDepart || depart.lat) && (arrivee.codePostal || zoneArrivee || arrivee.lat) && (
              <div style={{
                background: 'linear-gradient(135deg,rgba(201,168,76,.1),rgba(201,168,76,.05))',
                border: '1px solid rgba(201,168,76,.25)',
                borderRadius: 12, padding: '16px 20px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                marginBottom: 20,
              }}>
                <div>
                  <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B6B6B' }}>
                    {allerRetour ? 'Prix aller-retour' : 'Prix estimé'}
                  </div>
                  <div style={{ fontSize: 10, color: '#9B9B9B', marginTop: 3 }}>
                    {useForfait && zoneDepart && zoneArrivee
                      ? `${zoneDepart.nom} → ${zoneArrivee.nom} · ${labelVehicule}${allerRetour ? ' · ×2' : ''}`
                      : distanceKm !== null
                        ? `${distanceKm} km · ${labelVehicule}${allerRetour ? ' · ×2' : ''}`
                        : 'Calcul de l\'itinéraire…'
                    }
                  </div>
                </div>
                {prixTotal !== null ? (
                  <div style={{ textAlign: 'right' }}>
                    {allerRetour && prix !== null && (
                      <div style={{ fontSize: 10, color: '#6B6B6B', marginBottom: 2 }}>{Math.round(prix)} € × 2</div>
                    )}
                    <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: '#C9A84C' }}>
                      {Math.round(prixTotal)} €
                    </div>
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
              style={{ width: '100%', padding: '14px', borderRadius: 10, background: '#09091A', color: '#FFFFFF', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '.04em', transition: 'background .15s, transform .15s' }}>
              Continuer →
            </button>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div>
            <button className="back-btn" type="button" onClick={() => setStep(1)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6B6B6B', marginBottom: 24, padding: 0, transition: 'color .15s' }}>
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7"/>
              </svg>
              Modifier le trajet
            </button>

            <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 30, fontWeight: 500, color: '#09091A', margin: '0 0 6px' }}>
              Vos informations
            </h1>
            <p style={{ fontSize: 13, color: '#6B6B6B', margin: '0 0 28px' }}>Un email de confirmation vous sera envoyé après le paiement.</p>

            {/* Récap */}
            <div style={{ background: '#FFFFFF', border: '1px solid rgba(0,0,0,.08)', borderRadius: 10, padding: '14px 18px', marginBottom: 28 }}>
              <div style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#6B6B6B', marginBottom: 10 }}>Récapitulatif</div>
              <div style={{ fontSize: 13, color: '#09091A', marginBottom: 4 }}>
                <span style={{ color: '#6B6B6B', fontSize: 11 }}>Départ · </span>{depart.label}
              </div>
              <div style={{ fontSize: 13, color: '#09091A', marginBottom: 10 }}>
                <span style={{ color: '#6B6B6B', fontSize: 11 }}>Arrivée · </span>{arrivee.label}
              </div>
              <div style={{ display: 'flex', gap: 20, paddingTop: 10, borderTop: '1px solid rgba(201,168,76,.06)', alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: 9, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '.1em' }}>Date</div>
                  <div style={{ fontSize: 12, color: '#09091A' }}>{fmtDate(date)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '.1em' }}>Véhicule</div>
                  <div style={{ fontSize: 12, color: '#09091A' }}>{labelVehicule}</div>
                </div>
                {!useForfait && distanceKm && (
                  <div>
                    <div style={{ fontSize: 9, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '.1em' }}>Distance</div>
                    <div style={{ fontSize: 12, color: '#09091A' }}>{distanceKm} km</div>
                  </div>
                )}
                {prixTotal !== null && (
                  <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                    <div style={{ fontSize: 9, color: '#9B9B9B', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                      {allerRetour ? 'Total aller-retour' : 'Total'}
                    </div>
                    {allerRetour && prix !== null && (
                      <div style={{ fontSize: 10, color: '#6B6B6B' }}>{Math.round(prix)} € × 2</div>
                    )}
                    <div style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 700, color: '#C9A84C' }}>{Math.round(prixTotal)} €</div>
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

            {/* Code parrainage */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#6B6B6B', letterSpacing: '.06em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>
                Code parrain <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optionnel — -10%)</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="res-input"
                  style={{ ...baseInput, flex: 1, textTransform: 'uppercase', letterSpacing: '.1em', fontFamily: 'monospace', fontSize: 15 }}
                  placeholder="OWR-XXXXXX"
                  value={codeParrain}
                  onChange={e => { setCodeParrain(e.target.value); setCodeValide(false); setCodeMsg('') }}
                  onBlur={e => checkCodeParrain(e.target.value)}
                  maxLength={10}
                />
                <button
                  type="button"
                  onClick={() => checkCodeParrain(codeParrain)}
                  disabled={codeLoading}
                  style={{ padding: '0 16px', borderRadius: 8, border: '1px solid rgba(0,0,0,.12)', background: '#F7F7F7', fontSize: 12, color: '#09091A', cursor: 'pointer', flexShrink: 0 }}
                >
                  {codeLoading ? '…' : 'Vérifier'}
                </button>
              </div>
              {codeMsg && (
                <div style={{ marginTop: 6, fontSize: 12, color: codeValide ? '#3DB87A' : '#D95454', display: 'flex', alignItems: 'center', gap: 5 }}>
                  {codeMsg}
                  {codeValide && prixTotal !== null && (
                    <span style={{ marginLeft: 8, fontFamily: 'monospace', fontWeight: 700 }}>
                      <span style={{ textDecoration: 'line-through', color: '#9B9B9B', marginRight: 6 }}>{Math.round(prixTotal)} €</span>
                      <span style={{ color: '#C9A84C' }}>{Math.round(prixFinal ?? prixTotal)} €</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {step2Error && (
              <div style={{ color: '#D95454', fontSize: 12, marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: 'rgba(217,84,84,.08)', border: '1px solid rgba(217,84,84,.2)' }}>
                {step2Error}
              </div>
            )}

            <button type="button" onClick={handlePayer} disabled={pending} className="pay-btn"
              style={{ width: '100%', padding: '16px', borderRadius: 10, background: pending ? 'rgba(9,9,26,.5)' : '#09091A', color: '#FFFFFF', fontSize: 14, fontWeight: 700, border: 'none', cursor: pending ? 'wait' : 'pointer', letterSpacing: '.04em', transition: 'background .15s, transform .15s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
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
                  Payer {prixFinal !== null ? `${Math.round(prixFinal)} €` : ''} — Paiement sécurisé
                </>
              )}
            </button>

            <div style={{ marginTop: 14, textAlign: 'center', fontSize: 11, color: '#9B9B9B' }}>
              Paiement sécurisé par Stripe · SSL/TLS · Aucune donnée bancaire stockée
            </div>
          </div>
        )}
        </div>

        <div className="reservation-summary-col" style={{ flex: '1 1 320px', minWidth: 280, maxWidth: 360 }}>
          <ReservationSummary
            departLabel={depart.label}
            arriveeLabel={arrivee.label}
            dateOnly={dateOnly}
            timeOnly={timeOnly}
            vehiculeLabel={VEHICULE_NOM[vehicule] ?? vehicule}
            passagers={passagers}
            prix={prixFinal}
            allerRetour={allerRetour}
          />
        </div>
      </div>
    </div>
  )
}
