'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { searchAddresses, getSuggestionIcon, fetchPlaceDetails } from '@/lib/addressSearch'
import { LIEUX_CONNUS } from '@/lib/lieux'

type BcAddr = { label: string; lat?: number; lng?: number }

async function fetchOsrmDist(dep: BcAddr, arr: BcAddr): Promise<number | null> {
  if (!dep.lat || !dep.lng || !arr.lat || !arr.lng) return null
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${dep.lng},${dep.lat};${arr.lng},${arr.lat}?overview=false`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    const json = await res.json()
    if (json.code !== 'Ok' || !json.routes?.[0]) return null
    return Math.round(json.routes[0].distance / 100) / 10
  } catch { return null }
}
import { soumettreDevis } from '@/app/vitrine/actions'
import { fbLead, fbContact } from '@/lib/pixel'

/* ── vehicles ─────────────────────────────────────────── */
const VEHICLES = [
  { min:1,max:3, name:'Berline',         sub:'1–3 passagers · confort premium',   from:'dès 45 €', base:45 },
  { min:4,max:4, name:'Berline Premium', sub:'4 passagers · haut de gamme',        from:'dès 65 €', base:65 },
  { min:5,max:7, name:'Van 7 places',    sub:'5–7 passagers · transfert groupe',   from:'dès 75 €', base:75 },
  { min:8,max:8, name:'Grand Van',       sub:'8 passagers · sur réservation',      from:'dès 95 €', base:95 },
]
function getVehicle(p:number) { return VEHICLES.find(v=>p>=v.min&&p<=v.max)||VEHICLES[3] }

/* ── FAQ data ──────────────────────────────────────────── */
const FAQS = [
  { q:'Comment réserver un VTC Owise ?', a:'Réservez directement via notre formulaire en ligne, disponible 24h/24. Renseignez votre trajet, vos passagers et l\'horaire souhaité, et recevez une confirmation immédiate par e-mail et SMS. Vous pouvez aussi nous joindre par téléphone ou WhatsApp pour une réservation assistée.' },
  { q:'Les tarifs sont-ils fixes et garantis ?', a:'Oui. Chaque devis est calculé à l\'avance et garanti — aucune majoration en cours de route, aucune surprise à l\'arrivée. Le tarif communiqué lors de la réservation est celui que vous payez, quelle que soit la durée du trajet ou les conditions de circulation.' },
  { q:'Quelles sont vos conditions d\'annulation ?', a:'L\'annulation est gratuite jusqu\'à 2 heures avant le départ prévu. Au-delà, des frais d\'annulation peuvent s\'appliquer. En cas d\'annulation tardive répétée, une empreinte bancaire peut être demandée à la réservation suivante.' },
  { q:'Quels aéroports desservez-vous ?', a:'Nous assurons les transferts vers et depuis Paris-CDG (Roissy), Paris-Orly, et Beauvais-Tillé. Nous intervenons également sur les héliports parisiens et les aéroports secondaires d\'Île-de-France sur demande. Pour CDG, nous suivons les retards de vol en temps réel.' },
  { q:'Que se passe-t-il si mon vol est retardé ?', a:'Nous surveillons les horaires de vol en temps réel. Si votre vol est retardé, votre chauffeur ajuste son arrivée en conséquence, sans frais supplémentaires pour des retards raisonnables. En cas de délai important, notre équipe vous contacte directement pour adapter la prise en charge.' },
  { q:'Puis-je réserver à l\'avance ?', a:'Absolument — et c\'est même recommandé pour les transferts aéroport, les événements ou les déplacements d\'entreprise. Vous pouvez réserver jusqu\'à 6 mois à l\'avance. Votre confirmation est immédiate et votre chauffeur est attribué dès la réservation.' },
  { q:'Acceptez-vous les animaux de compagnie ?', a:'Les petits animaux en cage de transport sont acceptés dans tous nos véhicules. Pour les animaux de plus grande taille, merci de le mentionner lors de la réservation afin que nous adaptions le véhicule. Des frais de nettoyage peuvent s\'appliquer selon les cas.' },
  { q:'Proposez-vous des solutions pour les entreprises ?', a:'Oui. Nous proposons des comptes entreprise avec tableau de bord dédié, facturation mensuelle consolidée et gestion multi-collaborateurs. Vos équipes réservent facilement sans avoir à avancer de frais, et votre service comptable reçoit une facture unique en fin de mois.' },
  { q:'Couvrez-vous l\'Oise et les zones hors IDF ?', a:'Oui, nous opérons sur Paris, l\'ensemble de l\'Île-de-France et l\'Oise (Compiègne, Senlis, Chantilly, Creil, Beauvais). Pour les longues distances ou les destinations hors zone, contactez-nous directement — nous établissons un devis sur mesure avec tarif forfaitaire garanti.' },
  { q:'Comment obtenir une facture après ma course ?', a:'Une facture est automatiquement envoyée par e-mail à la fin de chaque course. Les clients ayant un compte entreprise reçoivent une facture mensuelle consolidée. Si vous avez besoin d\'une facture complémentaire ou d\'un justificatif spécifique, contactez notre service client.' },
]

/* ── services ──────────────────────────────────────────── */
const SERVICES = [
  { cls:'sc-dark',   title:'Course immédiate',     desc:'Réservez un chauffeur en quelques secondes. Prise en charge rapide, partout à Paris et en IDF.', cta:'Réserver',         href:'#devis',   img:'/brand_assets/service-immediat.png',   alt:'Course immédiate' },
  { cls:'sc-teal',   title:'Réserver à l\'avance', desc:'Planifiez votre trajet des jours à l\'avance. Votre chauffeur sera là, à l\'heure exacte.',        cta:'Planifier',         href:'#devis',   img:'/brand_assets/service-avance.png',     alt:'Réserver à l\'avance' },
  { cls:'sc-blue',   title:'Transfert aéroport',   desc:'CDG, Orly, Beauvais — suivi de vol en temps réel, tarif fixe garanti, aucune attente.',             cta:'Réserver',         href:'#devis',   img:'/brand_assets/service-aeroport.png',   alt:'Transfert aéroport' },
  { cls:'sc-indigo', title:'Groupes & familles',   desc:'Van 7 ou 8 places, grand coffre. Idéal pour les transferts en famille ou entre collègues.',          cta:'Réserver',         href:'#devis',   img:'/brand_assets/service-groupes.png',    alt:'Groupes et familles' },
  { cls:'sc-navy',   title:'Comptes entreprise',   desc:'Facturation mensuelle centralisée, portail dédié, gestionnaire de compte. Zéro friction.',           cta:'En savoir plus',   href:'#contact', img:'/brand_assets/service-entreprise.png', alt:'Comptes entreprise' },
  { cls:'sc-gold',   title:'Événements & soirées', desc:'Mariages, galas, soirées privées. Un chauffeur élégant, disponible le temps de votre événement.',   cta:'Demander un devis',href:'#devis',   img:'/brand_assets/service-evenements.png', alt:'Événements et soirées' },
]

/* ── vehicles display ──────────────────────────────────── */
const VEH_DISPLAY = [
  { name:'Berline',         cap:'1 à 3 passagers', feats:['Peugeot 508, Volkswagen Passat','Climatisation bi-zone','WiFi embarqué'],               price:'45 €', bg:'#C8D8EE', badge:null,       dark:false, img:'/brand_assets/vehicle-berline.png',          alt:'Berline VTC Owise' },
  { name:'Berline Premium', cap:'1 à 4 passagers', feats:['BMW Série 5, Mercedes Classe E','Cuir, eau minérale offerte','Chargeurs universels, WiFi'], price:'65 €', bg:'#08081A', badge:'Populaire',dark:true,  img:'/brand_assets/vehicle-berline-premium.png', alt:'Berline Premium VTC Owise' },
  { name:'Van 7 places',    cap:'5 à 7 passagers', feats:['Mercedes Vito, VW Caravelle','Grand coffre, idéal aéroport','Transferts groupes & familles'],price:'75 €', bg:'#D8D4CA', badge:null,       dark:false, img:'/brand_assets/vehicle-van7.png',             alt:'Van 7 places VTC Owise' },
  { name:'Grand Van 8 pl.', cap:'8 passagers · Sur demande', feats:['Mercedes Sprinter','Séminaires, événements d\'entreprise','Disponible sur réservation'], price:'95 €', bg:'#0D0D0D', badge:null, dark:true,  img:'/brand_assets/vehicle-grand-van.png',        alt:'Grand Van 8 places VTC Owise' },
]

/* ── VtAddressInput — input adresse avec autocomplete landmarks + API ── */
import type { AddressSuggestion as VtSugg } from '@/lib/addressSearch'

function VtAddressInput({ value, onSelect, placeholder, className, style }: {
  value: string
  onSelect: (v: BcAddr) => void
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}) {
  const [sugg, setSugg]       = useState<VtSugg[]>([])
  const [open, setOpen]       = useState(false)
  const [focused, setFocused] = useState(-1)
  const timerRef              = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapRef               = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setSugg([]); setOpen(false); return }
    const all = await searchAddresses(q)
    setSugg(all); setOpen(all.length > 0)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    onSelect({ label: e.target.value })
    setFocused(-1)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(e.target.value), 250)
  }

  async function pick(s: VtSugg) {
    setSugg([]); setOpen(false); setFocused(-1)
    if (s.isLieu) {
      const lieu = LIEUX_CONNUS.find(l => l.label === s.label)
      onSelect({ label: s.label, lat: lieu?.lat, lng: lieu?.lng })
      return
    }
    if (s.isGoogle && s.placeId) {
      onSelect({ label: s.label })
      const det = await fetchPlaceDetails(s.placeId)
      if (det) onSelect({ label: det.label || s.label, lat: det.lat, lng: det.lng })
      return
    }
    onSelect({ label: s.label })
  }

  function handleKey(e: React.KeyboardEvent) {
    if (!open) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocused(f => Math.min(f + 1, sugg.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocused(f => Math.max(f - 1, 0)) }
    if (e.key === 'Enter' && focused >= 0) { e.preventDefault(); pick(sugg[focused]) }
    if (e.key === 'Escape') { setOpen(false); setFocused(-1) }
  }



  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <input
        className={className}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        onFocus={() => { if (sugg.length > 0) setOpen(true) }}
        placeholder={placeholder}
        autoComplete="off"
        style={style}
      />
      {open && sugg.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500,
          background: '#fff', border: '1px solid rgba(0,0,0,.12)',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          boxShadow: '0 8px 24px rgba(0,0,0,.1)', overflow: 'hidden',
        }}>
          {sugg.map((s, i) => (
            <button
              key={i} type="button"
              onMouseDown={() => pick(s)}
              onMouseEnter={() => setFocused(i)}
              onMouseLeave={() => setFocused(-1)}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                width: '100%', padding: '9px 14px',
                background: i === focused ? 'rgba(0,0,0,.04)' : '#fff',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderBottom: i < sugg.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                {getSuggestionIcon(s)}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: s.isLieu ? 500 : 400, color: '#0A0A0A' }}>{s.label}</div>
                {s.sublabel && <div style={{ fontSize: 10, color: '#6B6B6B', marginTop: 1 }}>{s.sublabel}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type TarifRow = { vehicule: string; prise_en_charge: number; prix_km: number; cdg_fixe: number; orly_fixe: number; beauvais_fixe: number }

export default function VitrineBody({ tarifs: tarifsProp = [] }: { tarifs?: TarifRow[] }) {
  const router = useRouter()

  /* ── state ─────────────────────────────────────────────── */
  const [navScrolled,     setNavScrolled]     = useState(false)
  const [menuOpen,        setMenuOpen]         = useState(false)
  const [showFloating,    setShowFloating]     = useState(false)
  const [faqOpen,         setFaqOpen]          = useState<number|null>(null)
  const [cookieVisible,   setCookieVisible]    = useState(false)
  const [cookieModalOpen, setCookieModalOpen]  = useState(false)
  const [analyticsOn,     setAnalyticsOn]      = useState(true)
  const [cookieDone,      setCookieDone]       = useState(false)

  /* booking widget */
  const [bcPax,      setBcPax]      = useState(1)
  const [bcEtape,    setBcEtape]    = useState(false)
  const [bcPrice,    setBcPrice]    = useState<number|null>(null)
  const [bcLoading,  setBcLoading]  = useState(false)
  const [bcDepart,   setBcDepart]   = useState<BcAddr>({ label: '' })
  const [bcArrivee,  setBcArrivee]  = useState<BcAddr>({ label: '' })
  const [bcDate,     setBcDate]     = useState('')
  const [bcTime,     setBcTime]     = useState('09:00')

  /* devis form */
  const [step,         setStep]        = useState(1)
  const [pax,          setPaxN]        = useState(1)
  const [allerRetour,  setAllerRetour] = useState(false)
  const [etapeOpen,    setEtapeOpen]   = useState(false)
  const [suppls,       setSuppls]      = useState<Record<string,number>>({})
  const [form, setForm] = useState({
    origin:'', dest:'', date:'', time:'09:00', destType:'addr',
    dateRetour:'', heureRetour:'09:00',
    nom:'', tel:'', email:'', societe:'',
  })
  const [submitErr,  setSubmitErr]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,  setSubmitted]  = useState(false)
  const [confirmRef, setConfirmRef] = useState('')

  /* ── refs ──────────────────────────────────────────────── */
  const cursorRef  = useRef<HTMLDivElement>(null)
  const ringRef    = useRef<HTMLDivElement>(null)
  const mxRef      = useRef(0); const myRef = useRef(0)
  const rxRef      = useRef(0); const ryRef = useRef(0)
  const rafRef     = useRef<number>(0)

  /* ── cursor ────────────────────────────────────────────── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      mxRef.current = e.clientX; myRef.current = e.clientY
      if (cursorRef.current) {
        cursorRef.current.style.left = e.clientX + 'px'
        cursorRef.current.style.top  = e.clientY + 'px'
      }
    }
    const animate = () => {
      rxRef.current += (mxRef.current - rxRef.current) * 0.14
      ryRef.current += (myRef.current - ryRef.current) * 0.14
      if (ringRef.current) {
        ringRef.current.style.left = rxRef.current + 'px'
        ringRef.current.style.top  = ryRef.current + 'px'
      }
      rafRef.current = requestAnimationFrame(animate)
    }
    document.addEventListener('mousemove', onMove)
    rafRef.current = requestAnimationFrame(animate)
    return () => {
      document.removeEventListener('mousemove', onMove)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  /* ── scroll effects ─────────────────────────────────────── */
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setNavScrolled(y > 60)
      setShowFloating(y > window.innerHeight - 100)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const bcTarifs = tarifsProp

  /* ── cookie banner ──────────────────────────────────────── */
  useEffect(() => {
    if (!localStorage.getItem('ow_cookie')) {
      const t = setTimeout(() => setCookieVisible(true), 2500)
      return () => clearTimeout(t)
    } else {
      setCookieDone(true)
    }
  }, [])

  /* ── scroll reveal + countup ────────────────────────────── */
  useEffect(() => {
    const revealObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); revealObs.unobserve(e.target) } })
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale').forEach(el => revealObs.observe(el))
    // fallback : rend tout visible après 2s si observer bloqué
    const fallback = setTimeout(() => {
      document.querySelectorAll('.reveal,.reveal-left,.reveal-right,.reveal-scale').forEach(el => el.classList.add('visible'))
    }, 2000)

    const countObs = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const allStats = Array.from(document.querySelectorAll('[data-target]')) as HTMLElement[]
        allStats.forEach((el, idx) => {
          if (el.dataset.counted) return
          el.dataset.counted = '1'
          const target  = parseFloat(el.dataset.target || '0')
          const suffix  = el.dataset.suffix || ''
          const isFloat = el.dataset.float === '1'
          const delay   = idx * 120
          const dur     = 2000
          setTimeout(() => {
            const start = performance.now()
            const tick = (now: number) => {
              const p    = Math.min((now - start) / dur, 1)
              // ease out quart — démarre vite, ralentit à la fin
              const ease = 1 - Math.pow(1 - p, 4)
              const v    = target * ease
              el.textContent = (isFloat ? v.toFixed(1) : Math.round(v)) + suffix
              if (p < 1) requestAnimationFrame(tick)
              else el.textContent = (isFloat ? target.toFixed(1) : String(target)) + suffix
            }
            requestAnimationFrame(tick)
          }, delay)
        })
        countObs.disconnect()
      })
    }, { threshold: 0.2 })
    const firstStat = document.querySelector('[data-target]')
    if (firstStat) countObs.observe(firstStat)

    return () => { revealObs.disconnect(); countObs.disconnect(); clearTimeout(fallback) }
  }, [])

  /* ── Parallax souris hero ───────────────────────────────── */
  useEffect(() => {
    const hero = document.getElementById('hero')
    if (!hero) return
    const orb1 = hero.querySelector<HTMLElement>('.orb-1')
    const orb2 = hero.querySelector<HTMLElement>('.orb-2')
    const orb3 = hero.querySelector<HTMLElement>('.orb-3')
    const rings = hero.querySelector<HTMLElement>('.hero-rings')
    const onMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2
      const cy = window.innerHeight / 2
      const dx = (e.clientX - cx) / cx
      const dy = (e.clientY - cy) / cy
      if (orb1)  orb1.style.transform  = `translate(${dx * -28}px, ${dy * -20}px) scale(1.12)`
      if (orb2)  orb2.style.transform  = `translate(${dx *  22}px, ${dy *  18}px)`
      if (orb3)  orb3.style.transform  = `translate(${dx * -14}px, ${dy *  10}px) scale(1.09)`
      if (rings) rings.style.transform = `translateY(-52%) rotate(${dx * 4}deg)`
    }
    hero.addEventListener('mousemove', onMove)
    return () => hero.removeEventListener('mousemove', onMove)
  }, [])


  /* ── 3D tilt ─────────────────────────────────────────────── */
  useEffect(() => {
    document.querySelectorAll<HTMLElement>('.tilt-card').forEach(card => {
      const onMove = (e: MouseEvent) => {
        const r = card.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width  - 0.5
        const y = (e.clientY - r.top)  / r.height - 0.5
        card.style.transform = `perspective(800px) rotateY(${x*10}deg) rotateX(${-y*7}deg) translateZ(6px)`
        card.style.transition = 'transform 0.05s'
      }
      const onLeave = () => {
        card.style.transform = ''
        card.style.transition = 'transform 0.5s ease, border-color 0.25s, box-shadow 0.25s'
      }
      card.addEventListener('mousemove', onMove)
      card.addEventListener('mouseleave', onLeave)
    })
  }, [])

  /* ── helpers ─────────────────────────────────────────────── */
  const scrollTo = (id: string) => {
    document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' })
  }

  function calcEstimate(overrides?: Partial<typeof form>, overridePax?: number, overrideSuppls?: Record<string,number>): number {
    const f   = { ...form, ...overrides }
    const p   = overridePax   ?? pax
    const sup = overrideSuppls ?? suppls
    const v   = getVehicle(p)
    const h   = parseInt((f.time || '09:00').split(':')[0])
    let base  = v.base
    if (f.destType === 'airport') base += 25
    if (f.destType === 'gare')    base += 12
    if (etapeOpen)                base += 10
    const suppTotal = Object.values(sup).reduce((a,b)=>a+b,0)
    const maj = (h >= 22 || h < 6) ? Math.round(base * 0.2) : 0
    return base + maj + suppTotal
  }

  async function bcEstimate(): Promise<number> {
    const v    = getVehicle(bcPax)
    const h    = parseInt((bcTime || '09:00').split(':')[0])
    const dest = bcArrivee.label.toLowerCase()
    const dep  = bcDepart.label.toLowerCase()

    // 1. Forfait aéroport depuis tarifs Supabase
    const tarif = bcTarifs.find(t => t.vehicule === v.name)
    if (tarif) {
      let fixe = 0
      if (/cdg|roissy|charles de gaulle/i.test(dest) || /cdg|roissy|charles de gaulle/i.test(dep)) fixe = Number(tarif.cdg_fixe)
      else if (/orly/i.test(dest) || /orly/i.test(dep)) fixe = Number(tarif.orly_fixe)
      else if (/beauvais/i.test(dest) || /beauvais/i.test(dep)) fixe = Number(tarif.beauvais_fixe)
      if (fixe > 0) {
        if (h >= 22 || h < 6) fixe = Math.round(fixe * 1.2)
        return fixe
      }
    }

    // 2. Tarif km via OSRM — géocode si pas de coordonnées
    const geocode = async (addr: BcAddr): Promise<BcAddr> => {
      if (addr.lat) return addr
      try {
        const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addr.label)}&limit=1&autocomplete=0`)
        const json = await res.json()
        const f    = json.features?.[0]
        if (f) return { label: addr.label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] }
      } catch {}
      return addr
    }
    if (tarif && bcDepart.label && bcArrivee.label) {
      const [dep, arr] = await Promise.all([geocode(bcDepart), geocode(bcArrivee)])
      const distKm = await fetchOsrmDist(dep, arr)
      if (distKm !== null) {
        let prix = Number(tarif.prise_en_charge) + distKm * Number(tarif.prix_km)
        if (h >= 22 || h < 6) prix = Math.round(prix * 1.2)
        return Math.round(prix)
      }
    }

    // 3. Fallback base price
    let base = v.base
    if (/aéroport|cdg|orly|roissy|beauvais/i.test(dest) || /aéroport|cdg|orly|roissy|beauvais/i.test(dep)) base += 25
    else if (/gare|nord|lyon|montparnasse|saint-lazare/i.test(dest)) base += 12
    if (h >= 22 || h < 6) base = Math.round(base * 1.2)
    return base
  }

  async function submitDevis() {
    if (!form.nom.trim() || !form.tel.trim() || !form.email.trim()) {
      setSubmitErr('Veuillez renseigner votre nom, téléphone et e-mail.')
      return
    }
    setSubmitErr('')
    setSubmitting(true)
    const v       = getVehicle(pax)
    const price   = calcEstimate()
    const ref     = 'OW-' + Date.now().toString(36).toUpperCase()
    const supList = Object.keys(suppls)

    try {
      await soumettreDevis({
        nom:         form.nom,
        tel:         form.tel,
        email:       form.email,
        societe:     form.societe || null,
        origin:      form.origin,
        destination: form.dest,
        date_course: form.date || null,
        heure:       form.time || null,
        pax,
        vehicle:     v.name,
        price:       price ?? null,
        supplements: supList.length ? supList : null,
        dest_type:   form.destType,
      })
      fbLead({ content_category: 'devis', content_name: v.name })
      fbContact()
      setConfirmRef(ref)
      setSubmitted(true)
      setStep(4)
    } catch {
      setSubmitErr('Erreur lors de l\'envoi. Réessayez ou contactez-nous par WhatsApp.')
    } finally {
      setSubmitting(false)
    }
  }

  function resetDevis() {
    setStep(1); setSubmitted(false); setConfirmRef('')
    setForm({ origin:'', dest:'', date:'', time:'09:00', destType:'addr', dateRetour:'', heureRetour:'09:00', nom:'', tel:'', email:'', societe:'' })
    setPaxN(1); setSuppls({}); setEtapeOpen(false); setAllerRetour(false)
  }

  function acceptCookie() {
    localStorage.setItem('ow_cookie', '1')
    setCookieVisible(false); setCookieDone(true)
  }
  function refuseCookie() {
    localStorage.setItem('ow_cookie', '0')
    setCookieVisible(false); setCookieDone(true)
  }

  const currentEst = calcEstimate()
  const currentVeh = getVehicle(pax)

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div className="vt">
      {/* custom cursor */}
      <div className="cursor" ref={cursorRef} />
      <div className="cursor-ring" ref={ringRef} />

      {/* scroll progress */}
      <div className="scroll-progress" id="scrollProgress" />

      {/* mobile menu */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <div className="mm-links">
          {['#vehicules','#comment','#zones','#faq','#contact'].map((h,i) => (
            <a key={i} href={h} className="mm-link" onClick={()=>setMenuOpen(false)}>
              {h==='#vehicules'?'Véhicules':h==='#comment'?'Comment ça marche':h==='#zones'?'Zones':h==='#faq'?'FAQ':'Contact'}
            </a>
          ))}
        </div>
        <a href="/espace-client" className="mm-cta" onClick={()=>setMenuOpen(false)}>Espace client</a>
        <div className="mm-sub">Transport de prestige · Paris · IDF</div>
        <div style={{display:'flex',gap:12,marginTop:28}}>
          <a href="#" className="fs-link soon" style={{width:44,height:44,borderRadius:12}} aria-label="Facebook">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
          </a>
          <a href="https://wa.me/33619106356" className="fs-link fs-wa" style={{width:44,height:44,borderRadius:12}} target="_blank" rel="noopener" aria-label="WhatsApp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg>
          </a>
        </div>
      </div>

      {/* WhatsApp float */}
      <div className={`wa-float${showFloating?' show':''}`}>
        <a href="https://wa.me/33619106356" className="wa-btn" target="_blank" rel="noopener" aria-label="WhatsApp" style={{position:'relative'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg>
          WhatsApp
          <span className="wa-pulse" />
        </a>
      </div>

      {/* Floating CTA */}
      <div className={`float-cta${showFloating?' show':''}`}>
        <a href="#devis" className="float-cta-btn" onClick={e=>{e.preventDefault();scrollTo('#devis')}}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          Réserver maintenant
        </a>
      </div>

      {/* NAV */}
      <nav className={navScrolled ? 'scrolled' : ''}>
        <a href="/" className="nav-logo" style={{textDecoration:'none'}}>
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="#09091A"/>
            <circle cx="18" cy="18" r="10" stroke="rgba(255,255,255,0.88)" strokeWidth="1.8" fill="none"/>
            <path d="M18 8 A10 10 0 0 1 28 18" stroke="#C9A84C" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <circle cx="18" cy="18" r="2.2" fill="#C9A84C"/>
          </svg>
          <div className="nav-divider" />
          <div className="nav-name-wrap">
            <span className="nav-name">OWISE</span>
            <span className="nav-sub">Transport de prestige</span>
          </div>
        </a>
        <div className="nav-links">
          {[['#vehicules','Véhicules'],['#comment','Comment ça marche'],['#zones','Zones'],['#faq','FAQ'],['#contact','Contact']].map(([h,l])=>(
            <a key={h} href={h} className="nav-link" onClick={e=>{e.preventDefault();scrollTo(h)}}>{l}</a>
          ))}
        </div>
        <div className="nav-r">
          <a href="/espace-client" className="nav-ghost">Espace client</a>
          <button className="nav-cta" onClick={()=>scrollTo('#devis')}>Obtenir un devis</button>
        </div>
        <button className={`nav-hamburger${menuOpen?' open':''}`} onClick={()=>setMenuOpen(v=>!v)} aria-label="Menu">
          <span/><span/><span/>
        </button>
      </nav>

      {/* HERO */}
      <section className="hero" id="hero">
        <div className="hero-bg">
          <span className="orb orb-1"/>
          <span className="orb orb-2"/>
          <span className="orb orb-3"/>
          <div className="hero-grid-lines"/>
          <div className="hero-fade-bottom"/>
          <div className="hero-rings">
            <svg width="700" height="700" viewBox="0 0 700 700" fill="none">
              <circle cx="350" cy="350" r="340" stroke="rgba(91,143,212,.1)" strokeWidth="1"/>
              <circle cx="350" cy="350" r="300" stroke="rgba(116,192,200,.12)" strokeWidth="1" strokeDasharray="5 9"/>
              <circle cx="350" cy="350" r="255" stroke="rgba(91,143,212,.14)" strokeWidth="1.5"/>
              <circle cx="350" cy="350" r="208" stroke="rgba(123,130,214,.1)" strokeWidth="1" strokeDasharray="3 7"/>
              <circle cx="350" cy="350" r="160" stroke="rgba(116,192,200,.16)" strokeWidth="1.5"/>
              <circle cx="350" cy="350" r="110" stroke="rgba(201,168,76,.13)" strokeWidth="1" strokeDasharray="2 5"/>
              <circle cx="350" cy="350" r="62" stroke="rgba(201,168,76,.2)" strokeWidth="2"/>
              <circle cx="350" cy="350" r="24" stroke="rgba(201,168,76,.26)" strokeWidth="1.5"/>
              <line x1="350" y1="6" x2="350" y2="36" stroke="rgba(116,192,200,.22)" strokeWidth="1.5"/>
              <line x1="350" y1="664" x2="350" y2="694" stroke="rgba(116,192,200,.22)" strokeWidth="1.5"/>
              <line x1="6" y1="350" x2="36" y2="350" stroke="rgba(116,192,200,.22)" strokeWidth="1.5"/>
              <line x1="664" y1="350" x2="694" y2="350" stroke="rgba(116,192,200,.22)" strokeWidth="1.5"/>
              <line x1="100" y1="100" x2="118" y2="118" stroke="rgba(201,168,76,.18)" strokeWidth="1.2"/>
              <line x1="600" y1="100" x2="582" y2="118" stroke="rgba(201,168,76,.18)" strokeWidth="1.2"/>
              <line x1="100" y1="600" x2="118" y2="582" stroke="rgba(201,168,76,.18)" strokeWidth="1.2"/>
              <line x1="600" y1="600" x2="582" y2="582" stroke="rgba(201,168,76,.18)" strokeWidth="1.2"/>
            </svg>
          </div>
        </div>

        <div className="hero-inner">
          <div className="hero-left">
            <div className="hero-tag">
              <span className="hero-tag-dot"/>
              Transport VTC de Prestige · Paris · IDF · Oise · Aéroports
            </div>
            <h1 className="hero-title">
              <span className="line">Voyagez avec</span>
              <span className="line"><strong className="chrome-gold">l&apos;excellence</strong></span>
              <span className="line">où que vous alliez</span>
            </h1>
            <p className="hero-sub">Chauffeurs professionnels certifiés, véhicules haut de gamme, ponctualité garantie. Pour vos déplacements d&apos;affaires, transferts aéroport et événements — Paris, Île-de-France et l&apos;Oise.</p>
            <div className="hero-actions">
              <button className="btn-primary" onClick={()=>scrollTo('#devis')}>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                Réserver maintenant
              </button>
              <button className="btn-secondary" onClick={()=>scrollTo('#vehicules')}>Nos véhicules</button>
            </div>
            <div className="hero-trust">
              {[['4.9 ★','#C9A84C','Note moyenne'],['24/7','#74C0C8','Disponible'],['100%','#5B8FD4','Prix fixe garanti'],['Certifiés','#7B82D6','Professionnels']].map(([v,c,l],i)=>(
                <span key={i} style={{display:'contents'}}>
                  {i>0&&<div className="trust-sep"/>}
                  <div className="trust-item">
                    <span className="trust-val" style={{color:c}}>{v}</span>
                    <span className="trust-lbl">{l}</span>
                  </div>
                </span>
              ))}
            </div>
          </div>

          {/* booking card */}
          <div className="hero-right">
            <div className="booking-card-wrap">
            <div className="booking-card">
              <div className="bc-header">
                <span className="bc-title">Estimation rapide</span>
                <span className="bc-badge">Tarif fixe garanti</span>
              </div>
              <div className="bc-body">
                <div className="route-wrap">
                  <div className="route-connector"/>
                  <div className="binput-row" style={{marginBottom:8}}>
                    <span className="binput-dot s"/>
                    <VtAddressInput className="binput" placeholder="Adresse de départ…" value={bcDepart.label} onSelect={setBcDepart}/>
                  </div>
                  {bcEtape && (
                    <div className="binput-row" style={{marginBottom:8}}>
                      <span className="binput-dot" style={{width:7,height:7,background:'#E8A030',border:'none',boxShadow:'0 0 5px rgba(232,160,48,.4)'}}/>
                      <input className="binput" type="text" placeholder="Étape intermédiaire…"/>
                    </div>
                  )}
                  <div className="binput-row">
                    <span className="binput-dot e"/>
                    <VtAddressInput className="binput" placeholder="Destination, aéroport, gare…" value={bcArrivee.label} onSelect={setBcArrivee}/>
                  </div>
                </div>
                <button onClick={()=>setBcEtape(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'var(--t2)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',padding:'2px 0 6px',transition:'color .15s'}}>
                  <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  {bcEtape ? "Retirer l'étape" : 'Ajouter une étape'}
                </button>
                <div className="bg2">
                  <div>
                    <span className="bc-label">Date</span>
                    <input className="binput" type="date" value={bcDate} onChange={e=>setBcDate(e.target.value)} style={{padding:'12px 14px'}}/>
                  </div>
                  <div>
                    <span className="bc-label">Heure</span>
                    <input className="binput" type="time" value={bcTime} onChange={e=>setBcTime(e.target.value)} style={{padding:'12px 14px'}}/>
                  </div>
                </div>
                <div>
                  <span className="bc-label" style={{marginBottom:8,display:'block'}}>Passagers</span>
                  <div className="bc-pax-row">
                    {[1,2,3,4,5,6,7,8].map(n=>(
                      <div key={n} className={`bc-pax-btn${bcPax===n?' on':''}`} onClick={()=>setBcPax(n)}>{n}</div>
                    ))}
                  </div>
                </div>
                <button className="btn-estimate" disabled={bcLoading} onClick={async ()=>{ setBcLoading(true); setBcPrice(null); const p=await bcEstimate(); setBcPrice(p); setBcLoading(false) }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                  {bcLoading ? 'Calcul en cours…' : 'Calculer mon estimation'}
                </button>
                {bcPrice !== null && (
                  <div className="bc-price show">
                    <div className="bc-price-label">Estimation TTC</div>
                    <div className="bc-price-amount"><sup className="chrome-gold-static">€</sup><span className="chrome-gold-static">{bcPrice}</span></div>
                    <div className="bc-price-sub">{getVehicle(bcPax).name} · Tarif fixe · Prix garanti</div>
                  </div>
                )}
                <button className="btn-book" onClick={()=>{
                  const p = new URLSearchParams()
                  if (bcDepart.label)  p.set('depart',  bcDepart.label)
                  if (bcArrivee.label) p.set('arrivee', bcArrivee.label)
                  if (bcDate)    p.set('date',    bcDate)
                  if (bcTime)    p.set('time',    bcTime)
                  p.set('pax', String(bcPax))
                  router.push('/reserver?' + p.toString())
                }}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Confirmer la réservation
                </button>
                <p style={{fontSize:10,color:'var(--t3)',textAlign:'center',lineHeight:1.6,marginTop:-4}}>
                  Estimation indicative · Tarif définitif confirmé à la réservation
                </p>
              </div>
            </div>
            </div>{/* /booking-card-wrap */}
          </div>
        </div>

        <div className="scroll-hint">
          <div className="scroll-line"/>
          <span className="scroll-label">Découvrir</span>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="marquee-section">
        <div className="marquee-track">
          {[0,1].map(i=>(
            <div key={i} className="marquee-item" aria-hidden={i===1||undefined}>
              Paris <span className="m-dot"/> Aéroport CDG <span className="m-dot"/> Orly <span className="m-dot"/> Beauvais <span className="m-dot"/> Gare du Nord <span className="m-dot"/> Gare de Lyon <span className="m-dot"/> Gare Montparnasse <span className="m-dot"/> Versailles <span className="m-dot"/> Compiègne <span className="m-dot"/> Chantilly <span className="m-dot"/> Senlis <span className="m-dot"/> Roissy <span className="m-dot"/> Saint-Germain-en-Laye <span className="m-dot"/> Opéra <span className="m-dot"/>
            </div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <div className="stats-section">
        <div className="stats-inner">
          {[{t:'4.9',f:'1',s:'',l:'Note client moyenne'},{t:'500',s:'+',l:'Courses réalisées'},{t:'100',s:'%',l:'Ponctualité garantie'},{t:'24',s:'/7',l:'Disponibilité'}].map((st,i)=>(
            <div key={i} className={`stat-item reveal${i>0?' rd'+i:''}`}>
              <span className="stat-num chrome-gold-static" data-target={st.t} data-suffix={st.s} data-float={st.f||undefined}>0</span>
              <span className="stat-lbl">{st.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* SERVICES */}
      <section className="services-section">
        <div className="services-inner">
          <div className="section-header reveal" style={{marginBottom:44}}>
            <div className="section-tag">Nos services</div>
            <h2 className="section-title" style={{marginTop:10}}>Choisissez votre <em>expérience de voyage</em></h2>
          </div>
          <div className="services-grid">
            {SERVICES.map((s,i)=>(
              <div key={i} className={`service-card ${s.cls} reveal${i%2===1?' rd1':i%3===2?' rd2':''}`}>
                <div className="sc-left">
                  <div className="sc-title">{s.title}</div>
                  <div className="sc-desc">{s.desc}</div>
                  <button className="sc-btn" onClick={()=>scrollTo(s.href)}>{s.cta} <span className="sc-btn-arrow">→</span></button>
                </div>
                <div className="sc-img">
                  <img src={s.img} alt={s.alt} style={{maxWidth:130,maxHeight:120,objectFit:'contain',display:'block'}}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* VEHICLES */}
      <section className="vehicles-section" id="vehicules">
        <div className="section-header reveal">
          <div className="section-tag">Notre flotte</div>
          <h2 className="section-title">Des véhicules<br/><em className="chrome-gold-slow">à la hauteur de vos exigences</em></h2>
        </div>
        <div className="vehicles-grid">
          {VEH_DISPLAY.map((v,i)=>(
            <div key={i} className={`vehicle-card tilt-card reveal rd${i+1}${v.dark?' vc-dark':''}`} style={v.badge?{borderColor:'rgba(255,255,255,.22)'}:{}}>
              <div className="vc-visual" style={{background:v.bg}}>
                {v.badge && <span className="vc-badge" style={{position:'absolute',top:12,right:12,zIndex:5,color:'rgba(255,255,255,.82)',background:'rgba(255,255,255,.08)',border:'1px solid rgba(255,255,255,.14)',backdropFilter:'blur(4px)'}}>{v.badge}</span>}
                <img src={v.img} alt={v.alt} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center',display:'block'}}/>
              </div>
              <div className="vc-name">{v.name}</div>
              <div className="vc-cap">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                {v.cap}
              </div>
              <div className="vc-features">
                {v.feats.map((f,j)=><div key={j} className="vc-feat"><div className="vc-feat-dot"/>{f}</div>)}
              </div>
              <div className="vc-price">
                <span className="vc-from">dès</span>
                <span className="vc-amount chrome-gold-static">{v.price}</span>
                <span className="vc-unit">/ course</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* PROCESS */}
      <section className="process-section" id="comment">
        <div className="section-header reveal" style={{maxWidth:900,margin:'0 auto 60px'}}>
          <div className="section-tag">Simple & rapide</div>
          <h2 className="section-title">Comment ça marche</h2>
        </div>
        <div className="process-steps">
          {[
            { num:'01', title:'Renseignez votre trajet', desc:"Indiquez votre départ, votre destination et l'heure de prise en charge. Notre estimateur calcule le tarif en quelques secondes.", icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg> },
            { num:'02', title:'Confirmez la réservation', desc:"Renseignez vos coordonnées et validez. Confirmation immédiate par e-mail avec tous les détails de votre course.", icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> },
            { num:'03', title:'Votre chauffeur arrive', desc:"Le jour J, votre chauffeur est ponctuel et vous attend. Tarif fixe, aucune mauvaise surprise en fin de course.", icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M5 3l14 9-14 9V3z"/></svg> },
          ].map((s,i)=>(
            <div key={i} className={`process-step reveal${i===0?' reveal-left':i===2?' reveal-right':''}${i>0?' rd'+i:''}`}>
              <div className="process-num chrome-gold-static">{s.num}</div>
              <div className="process-icon">{s.icon}</div>
              <div className="process-step-title">{s.title}</div>
              <div className="process-step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="testimonials-section">
        <div className="section-header reveal">
          <div className="section-tag">Ils nous font confiance</div>
          <h2 className="section-title">Ce que disent<br/><em className="chrome-gold-slow">nos clients</em></h2>
        </div>
        <div className="testimonials-grid">
          {[
            { text:"Nous utilisons Owise pour tous nos transferts aéroport depuis 6 mois. La ponctualité est irréprochable, les chauffeurs sont professionnels et discrets. Je recommande à toute entreprise.", name:'Sophie M.', role:'Directrice Marketing · Groupe Beaumont', avatar:'https://randomuser.me/api/portraits/women/44.jpg' },
            { text:"Premier trajet Paris-CDG : le chauffeur était 10 minutes en avance, Mercedes Classe E impeccable. Le tarif fixe sans surprise, c'est exactement ce dont j'avais besoin.", name:'Thomas R.', role:'Entrepreneur · Paris', avatar:'https://randomuser.me/api/portraits/men/32.jpg' },
            { text:"Le compte entreprise a simplifié notre gestion des déplacements. La facturation mensuelle consolidée et le portail de réservation dédié à nos collaborateurs sont parfaits.", name:'Isabelle C.', role:'DRH · Groupe Legrand', avatar:'https://randomuser.me/api/portraits/women/68.jpg' },
          ].map((t,i)=>(
            <div key={i} className={`testimonial-card reveal rd${i+1}`}>
              <span className="t-quote-mark">&ldquo;</span>
              <div className="t-stars">{'★★★★★'}</div>
              <p className="t-text">{t.text}</p>
              <div className="t-author">
                <div className="t-avatar"><img src={t.avatar} alt={t.name}/></div>
                <div><div className="t-name">{t.name}</div><div className="t-role">{t.role}</div></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ENTERPRISE CTA */}
      <section className="enterprise-section">
        <div className="enterprise-inner reveal reveal-scale">
          <div>
            <div className="ent-label">Comptes entreprises</div>
            <h2 className="ent-title">Vous gérez les<br/>déplacements de votre<br/><em className="chrome-gold-slow">équipe ?</em></h2>
            <p className="ent-desc">Owise propose des solutions dédiées aux entreprises : tarifs négociés, facturation mensuelle centralisée, portail de réservation multi-utilisateurs et reporting détaillé.</p>
            <div className="ent-perks">
              {['Tarifs préférentiels dès 10 courses/mois','Facturation mensuelle consolidée + export comptable','Portail de réservation pour vos collaborateurs','Gestionnaire de compte dédié'].map((p,i)=>(
                <div key={i} className="ent-perk"><div className="ent-perk-dot"/>{p}</div>
              ))}
            </div>
          </div>
          <div className="ent-actions">
            <button className="btn-ent" onClick={()=>scrollTo('#contact')}>
              Nous contacter
              <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
            </button>
            <button className="btn-ent-ghost" onClick={()=>scrollTo('#devis')}>Ou réserver directement →</button>
          </div>
        </div>
      </section>

      {/* ZONES */}
      <section className="zones-section" id="zones">
        <div className="reveal" style={{marginBottom:52}}>
          <div className="section-tag">Zones desservies</div>
          <h2 className="section-title">Paris, IDF & Oise<br/><em className="chrome-gold-slow">et tous les aéroports</em></h2>
        </div>
        <div className="zones-grid">
          <div className="zones-map-wrap reveal reveal-left">
            <div className="zones-map-grid"/>
            <svg style={{position:'absolute',inset:0,width:'100%',height:'100%'}} viewBox="0 0 400 360" fill="none">
              <ellipse cx="200" cy="180" rx="150" ry="105" stroke="rgba(0,0,0,.08)" strokeWidth="8" fill="none"/>
              <ellipse cx="200" cy="180" rx="95" ry="68" stroke="rgba(0,0,0,.12)" strokeWidth="3" fill="none"/>
              <ellipse cx="200" cy="180" rx="44" ry="32" fill="rgba(0,0,0,.05)" stroke="rgba(0,0,0,.2)" strokeWidth="1.5"/>
              <text x="200" y="184" fontFamily="DM Sans" fontSize="9" fill="rgba(0,0,0,.65)" textAnchor="middle" letterSpacing="2">PARIS</text>
              <circle cx="148" cy="108" r="6" fill="rgba(74,142,208,.85)"/>
              <text x="148" y="96" fontFamily="DM Sans" fontSize="8" fill="rgba(74,142,208,.75)" textAnchor="middle">CDG</text>
              <circle cx="188" cy="272" r="6" fill="rgba(74,142,208,.85)"/>
              <text x="188" y="286" fontFamily="DM Sans" fontSize="8" fill="rgba(74,142,208,.75)" textAnchor="middle">Orly</text>
              <circle cx="68" cy="60" r="5" fill="rgba(74,142,208,.7)"/>
              <text x="68" y="50" fontFamily="DM Sans" fontSize="7" fill="rgba(74,142,208,.65)" textAnchor="middle">BVA</text>
              <circle cx="78" cy="188" r="5" fill="rgba(60,196,124,.7)"/>
              <text x="54" y="191" fontFamily="DM Sans" fontSize="7" fill="rgba(60,196,124,.6)" textAnchor="middle">Versailles</text>
              <circle cx="338" cy="82" r="5" fill="rgba(232,160,48,.75)"/>
              <text x="356" y="85" fontFamily="DM Sans" fontSize="7" fill="rgba(232,160,48,.65)" textAnchor="middle">Oise</text>
              <path d="M200,180 L148,108" stroke="rgba(0,0,0,.1)" strokeWidth="1" strokeDasharray="4,4"/>
              <path d="M200,180 L188,272" stroke="rgba(0,0,0,.1)" strokeWidth="1" strokeDasharray="4,4"/>
              <path d="M200,180 L338,82" stroke="rgba(0,0,0,.07)" strokeWidth="1" strokeDasharray="4,4"/>
              <path d="M200,180 L68,60" stroke="rgba(0,0,0,.07)" strokeWidth="1" strokeDasharray="4,4"/>
            </svg>
            <div className="zones-vignette"/>
          </div>
          <div className="zones-list reveal reveal-right rd1">
            {[
              { color:'var(--gold)', name:'Paris intramuros', desc:'Tous les arrondissements', tag:'Couverture totale' },
              { color:'var(--green)', name:'Île-de-France', desc:'Versailles, Boulogne, Saint-Denis…', tag:'+15 à 45 min' },
              { color:'var(--blue)', name:'Aéroports CDG & Orly', desc:'Tous terminaux, toutes compagnies', tag:'Tarif fixe' },
              { color:'var(--blue)', opacity:.7, name:'Beauvais (BVA)', desc:'Aéroport Paris-Beauvais', tag:'Tarif fixe' },
              { color:'var(--amber)', name:'Oise', desc:'Compiègne, Senlis, Chantilly…', tag:'Sur devis' },
            ].map((z,i)=>(
              <div key={i} className="zone-item">
                <div className="zone-dot" style={{background:z.color,opacity:(z as any).opacity}}/>
                <div className="zone-info"><div className="zone-name">{z.name}</div><div className="zone-desc">{z.desc}</div></div>
                <span className="zone-tag">{z.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="faq">
        <div className="faq-inner">
          <div className="section-header reveal" style={{textAlign:'center'}}>
            <div className="section-tag">Questions fréquentes</div>
            <h2 className="section-title rd1">Tout ce que vous<br/><em className="chrome-gold-slow">devez savoir</em></h2>
          </div>
          <div className="faq-list">
            {FAQS.map((f,i)=>(
              <div key={i} className={`faq-item reveal${i%2===0?' rd1':' rd2'}${faqOpen===i?' open':''}`}>
                <div className="faq-q" onClick={()=>setFaqOpen(faqOpen===i?null:i)}>
                  <span className="faq-q-text">{f.q}</span>
                  <span className="faq-icon">
                    <svg className="faq-icon-svg" viewBox="0 0 10 10" stroke="rgba(0,0,0,.5)" strokeWidth="1.8" fill="none">
                      <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
                    </svg>
                  </span>
                </div>
                <div className="faq-a"><div className="faq-a-inner">{f.a}</div></div>
              </div>
            ))}
          </div>
          <div className="faq-cta-row reveal">
            <span style={{fontSize:14,color:'#6B6B6B'}}>Vous ne trouvez pas la réponse ?</span>
            <a href="https://wa.me/33619106356" style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 22px',borderRadius:8,background:'#25D366',color:'#fff',fontSize:14,fontWeight:500,transition:'opacity .15s'}} target="_blank" rel="noopener">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Nous contacter
            </a>
            <button onClick={()=>scrollTo('#devis')} style={{display:'inline-flex',alignItems:'center',gap:8,padding:'10px 22px',borderRadius:8,border:'1.5px solid rgba(0,0,0,.15)',color:'#0A0A0A',fontSize:14,fontWeight:500,background:'none',cursor:'pointer',transition:'border-color .15s'}}>
              Obtenir un devis
            </button>
          </div>
        </div>
      </section>

      {/* DEVIS FORM */}
      <section className="devis-section" id="devis">
        <div style={{maxWidth:880,margin:'0 auto',position:'relative',zIndex:1,textAlign:'center',paddingBottom:56}}>
          <div className="section-tag reveal" style={{justifyContent:'center'}}>Réservation</div>
          <h2 className="reveal rd1" style={{
            fontFamily:"'Plus Jakarta Sans',sans-serif",
            fontSize:'clamp(52px,6vw,92px)',
            fontWeight:800,letterSpacing:'-.03em',lineHeight:1.02,
            color:'#0A0A0A',marginTop:12,marginBottom:0,
          }}>Réservez<br/><span style={{color:'#C9A84C'}}>maintenant</span></h2>
          <p className="reveal rd2" style={{fontSize:16,color:'#6B6B6B',marginTop:18,fontWeight:300,lineHeight:1.7}}>
            Tarif fixe garanti · Confirmation immédiate · 0 surprise en fin de course
          </p>
        </div>
        <div className="devis-card-wrap reveal rd3">
        <div className="devis-card">
          <div className="devis-tabs">
            {[['1','Itinéraire'],['2','Options'],['3','Estimation']].map(([n,l])=>{
              const ni = parseInt(n)
              return (
                <div key={n} className={`dtab${step===ni?' on':''}${step>ni?' done':''}`}>
                  <span className="dtab-num">{n}</span>{l}
                </div>
              )
            })}
          </div>
          <div className="devis-body">

            {/* step 1 */}
            {step===1 && (
              <div className="step-panel on">
                <div className="route-fields">
                  <div className="route-input-wrap" style={{marginBottom:8}}>
                    <div className="route-dot o"/>
                    <div className="field" style={{flex:1}}>
                      <label>Prise en charge</label>
                      <VtAddressInput placeholder="Adresse de départ, hôtel, bureau…" value={form.origin} onSelect={v=>setForm(f=>({...f,origin:v.label}))}/>
                    </div>
                  </div>
                  <div className="route-sep"/>
                  {etapeOpen && (
                    <div className="route-input-wrap" style={{marginBottom:8}}>
                      <div className="route-dot" style={{background:'var(--amber)',width:8,height:8,left:18}}/>
                      <div className="field" style={{flex:1}}>
                        <label>Étape intermédiaire</label>
                        <input type="text" placeholder="Adresse de l'étape"/>
                      </div>
                    </div>
                  )}
                  <div className="route-input-wrap">
                    <div className="route-dot d"/>
                    <div className="field" style={{flex:1}}>
                      <label>Destination</label>
                      <VtAddressInput placeholder="Destination, aéroport, gare…" value={form.dest} onSelect={v=>setForm(f=>({...f,dest:v.label}))}/>
                    </div>
                  </div>
                </div>
                <button style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'var(--t2)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',padding:0,transition:'color .15s',marginBottom:16}} onClick={()=>setEtapeOpen(v=>!v)}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  {etapeOpen ? "Retirer l'étape" : 'Ajouter une étape intermédiaire'}
                </button>
                <div className="form-grid">
                  <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
                  <div className="field"><label>Heure de prise en charge</label><input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/></div>
                </div>

                {/* aller-retour */}
                <div style={{marginBottom:16}}>
                  <button type="button" onClick={()=>setAllerRetour(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 14px',borderRadius:8,border:'1px solid rgba(0,0,0,.12)',background:'transparent',fontFamily:'inherit',fontSize:12,color:'var(--t2)',cursor:'pointer',transition:'all .15s'}}>
                    <span>↩</span> Aller-Retour
                    <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:allerRetour?'rgba(201,168,76,.15)':'rgba(0,0,0,.06)',color:allerRetour?'#C9A84C':'var(--t3)',fontWeight:700,letterSpacing:'.04em',border:allerRetour?'1px solid rgba(201,168,76,.3)':'none'}}>
                      {allerRetour?'ON':'OFF'}
                    </span>
                  </button>
                  {allerRetour && (
                    <div style={{marginTop:10,padding:14,borderRadius:10,background:'rgba(201,168,76,.05)',border:'1px solid rgba(201,168,76,.2)'}}>
                      <div className="form-grid" style={{marginBottom:10}}>
                        <div className="field"><label>Date de retour</label><input type="date" value={form.dateRetour} onChange={e=>setForm(f=>({...f,dateRetour:e.target.value}))}/></div>
                        <div className="field"><label>Heure de retour</label><input type="time" value={form.heureRetour} onChange={e=>setForm(f=>({...f,heureRetour:e.target.value}))}/></div>
                      </div>
                      <div style={{fontSize:11,color:'var(--t2)',display:'flex',alignItems:'center',gap:6,flexWrap:'wrap'}}>
                        <span style={{color:'var(--red)',fontSize:9}}>●</span>
                        <span>Destination</span>
                        <span style={{color:'var(--t3)'}}>→</span>
                        <span style={{color:'var(--green)',fontSize:9}}>●</span>
                        <span>Départ de l&apos;aller</span>
                        <span style={{color:'var(--t3)',fontSize:10}}>(adresses automatiquement inversées)</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="field" style={{marginBottom:16}}>
                  <label>Type de destination</label>
                  <select value={form.destType} onChange={e=>setForm(f=>({...f,destType:e.target.value}))}>
                    <option value="addr">Adresse standard</option>
                    <option value="airport">Aéroport (CDG, Orly, Beauvais…)</option>
                    <option value="gare">Gare (Nord, Lyon, Montparnasse…)</option>
                    <option value="event">Événement / soirée</option>
                  </select>
                </div>
                <div className="form-nav">
                  <button className="btn-next" onClick={()=>setStep(2)}>Suivant — Passagers <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                </div>
              </div>
            )}

            {/* step 2 */}
            {step===2 && (
              <div className="step-panel on">
                <span className="pax-lbl">Nombre de passagers</span>
                <div className="pax-selector">
                  {[1,2,3,4,5,6,7,8].map(n=>(
                    <div key={n} className={`pax-btn${pax===n?' on':''}`} onClick={()=>setPaxN(n)}>{n}</div>
                  ))}
                </div>
                <div className="vehicle-hint">
                  <div className="vh-icon">
                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none"><path d="M2 8 L4 3 Q5 1 7.5 1 L12.5 1 Q15 1 16 3 L18 8 Z" fill="#0A0A0A"/><path d="M5 8 Q6 3.5 8 3 L12 3 L12 8 Z" fill="#4A6FA5" opacity=".7"/><rect x="18" y="6.5" width="1.5" height="2.5" rx=".7" fill="#FFE080"/><rect x=".5" y="6.5" width="1.5" height="2.5" rx=".7" fill="#FC8181" opacity=".8"/><path d="M2 8 L18 8 L18.5 9.5 L1.5 9.5 Z" fill="#111"/><circle cx="5.5" cy="11" r="2.5" fill="#222"/><circle cx="5.5" cy="11" r="1.3" fill="#444"/><circle cx="14.5" cy="11" r="2.5" fill="#222"/><circle cx="14.5" cy="11" r="1.3" fill="#444"/></svg>
                  </div>
                  <div>
                    <div className="vh-name">{currentVeh.name}</div>
                    <div className="vh-sub">{currentVeh.sub}</div>
                  </div>
                  <div className="vh-badge">{currentVeh.from}</div>
                </div>
                <div className="supps">
                  {[['bagages',10,'🧳 Bagages volumineux (ski, golf…)'],['panneau',8,'📋 Panneau nominatif à l\'arrivée'],['animaux',15,'🐾 Animal de compagnie (cage requise)']].map(([key,price,label])=>{
                    const k = key as string; const p = price as number
                    return (
                      <div key={k} className={`supp-row${suppls[k]?' on':''}`} onClick={()=>setSuppls(s=>{const n={...s};if(n[k]) delete n[k]; else n[k]=p; return n})}>
                        <div className="supp-lbl"><div className="supp-check"/>{label}</div>
                        <span className="supp-price">+ {p} €</span>
                      </div>
                    )
                  })}
                </div>
                <div className="form-nav">
                  <button className="btn-prev" onClick={()=>setStep(1)}>← Retour</button>
                  <button className="btn-next" onClick={()=>setStep(3)}>Voir l&apos;estimation <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></button>
                </div>
              </div>
            )}

            {/* step 3 */}
            {step===3 && !submitted && (
              <div className="step-panel on">
                <div className="estimate-display">
                  <div className="est-lbl">Estimation TTC</div>
                  <div className="est-price"><span className="est-cur">€</span><span>{currentEst}</span> <span className="est-ttc">TTC</span></div>
                  <div className="est-details">
                    <span>{currentVeh.name}</span> · <span>
                      {form.destType==='airport'?'Avec supplément aéroport':form.destType==='gare'?'Avec supplément gare':etapeOpen?'Avec étape intermédiaire':'Course standard'}
                    </span>
                  </div>
                </div>
                <p style={{fontSize:11,color:'var(--t2)',textAlign:'center',marginBottom:20,lineHeight:1.6}}>
                  Estimation indicative — Prix fixe confirmé à la réservation. Aucune surprise en fin de course.
                </p>
                <div className="form-grid" style={{marginBottom:20}}>
                  <div className="field"><label>Prénom &amp; Nom</label><input type="text" placeholder="Jean Dupont" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
                  <div className="field"><label>Téléphone</label><input type="tel" placeholder="+33 6 00 00 00 00" value={form.tel} onChange={e=>setForm(f=>({...f,tel:e.target.value}))}/></div>
                  <div className="field"><label>E-mail</label><input type="email" placeholder="jean@entreprise.fr" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
                  <div className="field"><label>Société (optionnel)</label><input type="text" placeholder="Nom de l'entreprise" value={form.societe} onChange={e=>setForm(f=>({...f,societe:e.target.value}))}/></div>
                </div>
                {submitErr && (
                  <div style={{display:'block',background:'rgba(217,80,80,.08)',border:'1px solid rgba(217,80,80,.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'#D95454',marginBottom:12,textAlign:'center'}}>{submitErr}</div>
                )}
                <div className="form-nav">
                  <button className="btn-prev" onClick={()=>setStep(2)}>← Retour</button>
                  <button className="btn-next" onClick={submitDevis} disabled={submitting} style={{padding:'14px 36px',fontSize:14,opacity:submitting?.6:1}}>
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    {submitting ? 'Envoi…' : 'Confirmer la réservation'}
                  </button>
                </div>
              </div>
            )}

            {/* step 4 — success */}
            {step===4 && submitted && (
              <div className="step-panel on" style={{textAlign:'center',padding:'20px 0 10px'}}>
                <div style={{width:60,height:60,borderRadius:'50%',background:'rgba(61,184,122,.1)',border:'1px solid rgba(61,184,122,.25)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                  <svg width="26" height="26" fill="none" viewBox="0 0 24 24" stroke="#3DB87A" strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:500,color:'#0A0A0A',marginBottom:10}}>Demande envoyée !</div>
                <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.7,maxWidth:340,margin:'0 auto 24px'}}>
                  Nous avons bien reçu votre demande. Un conseiller vous contactera dans les <strong>30 minutes</strong> pour confirmer votre réservation.
                </p>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--t2)',background:'rgba(0,0,0,.04)',borderRadius:6,padding:'8px 14px',display:'inline-block',marginBottom:28}}>{confirmRef}</div>
                <br/>
                <button onClick={resetDevis} style={{background:'none',border:'1px solid rgba(0,0,0,.15)',borderRadius:8,padding:'10px 22px',fontSize:13,color:'var(--t2)',cursor:'pointer',fontFamily:'inherit',transition:'all .15s'}}>
                  Nouvelle demande
                </button>
              </div>
            )}
          </div>
        </div>{/* /devis-card */}
        </div>{/* /devis-card-wrap */}
      </section>

      {/* FOOTER */}
      <footer id="contact">
        <div className="footer-inner">
          <div className="footer-brand">
            <div className="brand-name" style={{alignItems:'center',gap:12,marginBottom:12}}>
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{flexShrink:0}}>
                <rect width="36" height="36" rx="8" fill="#0A0A0A"/>
                <text x="18" y="26" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="18" fontWeight="800" fill="#FFFFFF">O</text>
              </svg>
              <div>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:22,fontWeight:800,letterSpacing:'.2em',color:'#0A0A0A'}}>OWISE</div>
                <div style={{fontSize:8,letterSpacing:'.32em',textTransform:'uppercase',color:'rgba(0,0,0,.4)',marginTop:2}}>Transport de prestige</div>
              </div>
            </div>
            <div className="brand-sub">Paris, Île-de-France & Oise.</div>
            <span className="footer-social-label">Suivez-nous</span>
            <div className="footer-social">
              <a href="#" className="fs-link soon" title="Facebook" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
              <a href="#" className="fs-link soon" title="Instagram" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" strokeWidth="0"/></svg></a>
              <a href="#" className="fs-link soon" title="TikTok" rel="noopener"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/></svg></a>
              <a href="https://wa.me/33619106356" className="fs-link fs-wa" title="WhatsApp" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg></a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Services</div>
            <div className="footer-links">
              <button className="footer-link" style={{background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}} onClick={()=>scrollTo('#devis')}>Réservation immédiate</button>
              <button className="footer-link" style={{background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}} onClick={()=>scrollTo('#vehicules')}>Transferts aéroport</button>
              <button className="footer-link" style={{background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}} onClick={()=>scrollTo('#devis')}>Comptes entreprises</button>
              <button className="footer-link" style={{background:'none',border:'none',padding:0,cursor:'pointer',fontFamily:'inherit',textAlign:'left'}} onClick={()=>scrollTo('#devis')}>Événements & soirées</button>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Informations</div>
            <div className="footer-links">
              <a href="/mentions-legales" className="footer-link">Conditions générales</a>
              <a href="/mentions-legales" className="footer-link">Politique de confidentialité</a>
              <a href="/mentions-legales" className="footer-link">Mentions légales</a>
              <a href="/admin" className="footer-link">Espace administration</a>
            </div>
          </div>
          <div>
            <div className="footer-col-title">Contact</div>
            <div className="footer-contact">
              <div className="fc-item">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"/></svg>
                +33 6 19 10 63 56
              </div>
              <div className="fc-item">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
                owise.entreprise@gmail.com
              </div>
              <div className="fc-item" style={{alignItems:'flex-start'}}>
                <svg style={{marginTop:2,flexShrink:0}} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/></svg>
                Paris · IDF · Oise · Aéroports<br/>Disponible 24h/24, 7j/7
              </div>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 Owise — Tous droits réservés</span>
          <span>SIRET : 477 534 135 00041</span>
        </div>
      </footer>

      {/* COOKIE BANNER */}
      {!cookieDone && (
        <div className={`cookie-banner${cookieVisible?' visible':''}`}>
          <div className="cookie-text">
            <div className="cookie-title">Gestion des cookies</div>
            <div className="cookie-desc">
              Nous utilisons des cookies pour améliorer votre expérience. Consultez notre{' '}
              <a href="/mentions-legales">politique de confidentialité</a>.
            </div>
          </div>
          <div className="cookie-actions">
            <button className="c-btn-accept" onClick={acceptCookie}>Accepter</button>
            <button className="c-btn-refuse" onClick={refuseCookie}>Refuser</button>
            <button className="c-btn-manage" onClick={()=>setCookieModalOpen(true)}>Gérer</button>
          </div>
        </div>
      )}

      {/* COOKIE MODAL */}
      <div className={`cookie-overlay${cookieModalOpen?' open':''}`} onClick={e=>{if(e.target===e.currentTarget)setCookieModalOpen(false)}}>
        <div className="cookie-modal">
          <div className="cm-title">Préférences de cookies</div>
          <div className="cm-sub">Choisissez les catégories de cookies que vous acceptez.</div>
          <div className="cm-cat">
            <div><div className="cm-cat-name">Essentiels</div><div className="cm-cat-desc">Nécessaires au bon fonctionnement du site. Ne peuvent pas être désactivés.</div></div>
            <label className="cm-toggle"><input type="checkbox" checked readOnly/><div className="cm-track"/><div className="cm-thumb"/></label>
          </div>
          <div className="cm-cat">
            <div><div className="cm-cat-name">Analytiques</div><div className="cm-cat-desc">Nous aident à comprendre comment vous utilisez le site (données anonymisées).</div></div>
            <label className="cm-toggle"><input type="checkbox" checked={analyticsOn} onChange={e=>setAnalyticsOn(e.target.checked)}/><div className="cm-track"/><div className="cm-thumb"/></label>
          </div>
          <div className="cm-footer">
            <button className="cm-cancel" onClick={()=>setCookieModalOpen(false)}>Annuler</button>
            <button className="cm-save" onClick={()=>{acceptCookie();setCookieModalOpen(false)}}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  )
}
