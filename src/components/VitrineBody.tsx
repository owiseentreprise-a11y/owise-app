'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { searchAddresses, getSuggestionIcon, fetchPlaceDetails } from '@/lib/addressSearch'
import { LIEUX_CONNUS } from '@/lib/lieux'

type BcAddr  = { label: string; lat?: number; lng?: number; cp?: string }
type ZoneMin = { id: string; code: string; type: string; prefixes_postaux: string[] }

function detectZoneMin(cp: string, label: string, zones: ZoneMin[]): ZoneMin | null {
  const l = label.toLowerCase()
  if (/charles de gaulle|roissy|\bcdg\b/i.test(l)) return zones.find(z => z.code === 'CDG') ?? null
  if (/\borly\b/i.test(l))     return zones.find(z => z.code === 'ORY') ?? null
  if (/\bbeauvais\b/i.test(l)) return zones.find(z => z.code === 'BVA') ?? null
  if (/\bgare\b/i.test(l))     return zones.find(z => z.type === 'gare') ?? null
  if (/\bparis\b/i.test(l))    return zones.find(z => z.code === 'Z1')  ?? null
  if (!cp) return null
  const sorted = [...zones].sort((a, b) =>
    Math.max(0, ...b.prefixes_postaux.map(p => p.trim().length)) -
    Math.max(0, ...a.prefixes_postaux.map(p => p.trim().length))
  )
  return sorted.find(z => z.prefixes_postaux.some(p => p.trim() && cp.startsWith(p.trim()))) ?? null
}

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

type TarifRow   = { vehicule: string; prise_en_charge: number; prix_km: number; cdg_fixe: number; orly_fixe: number; beauvais_fixe: number }
type GrilleMin  = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }

export default function VitrineBody({ tarifs: tarifsProp = [], zones: zonesProp = [], grille: grilleProp = [] }: { tarifs?: TarifRow[]; zones?: ZoneMin[]; grille?: GrilleMin[] }) {
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

  /* exit intent */
  const [exitVisible, setExitVisible] = useState(false)

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
  const cursorRef    = useRef<HTMLDivElement>(null)
  const ringRef      = useRef<HTMLDivElement>(null)
  const mxRef        = useRef(0); const myRef = useRef(0)
  const rxRef        = useRef(0); const ryRef = useRef(0)
  const rafRef       = useRef<number>(0)
  const autoEstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  /* ── Exit intent — souris quitte le haut de la page ───────────────────── */
  useEffect(() => {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('ow_exit_seen')) return
    let triggered = false
    const onMouseOut = (e: MouseEvent) => {
      if (triggered) return
      if (e.clientY <= 10 && e.relatedTarget === null) {
        triggered = true
        setExitVisible(true)
        localStorage.setItem('ow_exit_seen', '1')
      }
    }
    document.addEventListener('mouseout', onMouseOut)
    return () => document.removeEventListener('mouseout', onMouseOut)
  }, [])

  /* ── Auto-estimation — se déclenche dès que les 2 adresses sont saisies ── */
  useEffect(() => {
    const dep = bcDepart.label.trim()
    const arr = bcArrivee.label.trim()
    if (dep.length < 3 || arr.length < 3) return
    if (autoEstTimer.current) clearTimeout(autoEstTimer.current)
    autoEstTimer.current = setTimeout(async () => {
      setBcLoading(true)
      setBcPrice(null)
      const p = await bcEstimate()
      setBcPrice(p)
      setBcLoading(false)
    }, 900)
    return () => { if (autoEstTimer.current) clearTimeout(autoEstTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bcDepart.label, bcArrivee.label, bcPax, bcTime])

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
    const suppTotal = Object.values(sup).reduce((a,b)=>a+b,0)
    // Détection aéroport/gare depuis label OU destType (même logique que le widget)
    const dest = (f.dest || '').toLowerCase()
    const orig = (f.origin || '').toLowerCase()
    const isCDG      = /cdg|roissy|charles de gaulle/i.test(dest) || /cdg|roissy|charles de gaulle/i.test(orig) || f.destType === 'airport'
    const isOrly     = /orly/i.test(dest) || /orly/i.test(orig)
    const isBeauvais = /beauvais/i.test(dest) || /beauvais/i.test(orig)
    const isGare     = /\bgare\b|gare du nord|gare de lyon|montparnasse|saint-lazare/i.test(dest) || f.destType === 'gare'
    const tarif = bcTarifs.find(t => t.vehicule === v.name)
    if (tarif) {
      let base = 0
      if (isOrly)          base = Number(tarif.orly_fixe)
      else if (isBeauvais) base = Number(tarif.beauvais_fixe)
      else if (isCDG)      base = Number(tarif.cdg_fixe)
      else if (isGare)     base = Number(tarif.prise_en_charge) + Number(tarif.prix_km) * 15
      else                 base = Number(tarif.prise_en_charge) + Number(tarif.prix_km) * 20
      if (!base)           base = Number(tarif.prise_en_charge) + 30
      if (etapeOpen) base += 10
      const maj = (h >= 22 || h < 6) ? Math.round(base * 0.2) : 0
      return Math.round(base + maj + suppTotal)
    }
    // fallback hardcodé
    let base = v.base
    if (isCDG || isOrly || isBeauvais) base += 25
    else if (isGare)                   base += 12
    if (etapeOpen)                     base += 10
    const maj = (h >= 22 || h < 6) ? Math.round(base * 0.2) : 0
    return base + maj + suppTotal
  }

  async function bcEstimate(): Promise<number> {
    const v    = getVehicle(bcPax)
    const h    = parseInt((bcTime || '09:00').split(':')[0])
    const dest = bcArrivee.label.toLowerCase()
    const dep  = bcDepart.label.toLowerCase()

    // 1. Forfait aéroport — uniquement si les DEUX adresses ont une zone connue
    const tarif = bcTarifs.find(t => t.vehicule === v.name)
    const isCDGAddr  = /cdg|roissy|charles de gaulle/i.test(dest) || /cdg|roissy|charles de gaulle/i.test(dep)
    const isOrlyAddr = /\borly\b/i.test(dest) || /\borly\b/i.test(dep)
    const isBVAAddr  = /\bbeauvais\b/i.test(dest) || /\bbeauvais\b/i.test(dep)
    if (tarif && (isCDGAddr || isOrlyAddr || isBVAAddr)) {
      // Vérifier que l'autre adresse (non-aéroport) est dans une zone connue
      const geocode = async (addr: BcAddr): Promise<BcAddr> => {
        if (addr.lat) return addr
        try {
          const res  = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(addr.label)}&limit=1&autocomplete=0`)
          const json = await res.json()
          const f    = json.features?.[0]
          if (f) return { label: addr.label, lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], cp: f.properties.postcode }
        } catch {}
        return addr
      }
      const airportIsArr = /cdg|roissy|charles de gaulle|orly|beauvais/i.test(bcArrivee.label)
      const otherRaw = airportIsArr ? bcDepart : bcArrivee
      const other    = await geocode(otherRaw)
      const otherZone = detectZoneMin(other.cp ?? '', other.label, zonesProp)
      if (otherZone) {
        // Priorité 1 : grille zone-à-zone
        const airportCode = isCDGAddr ? 'CDG' : isOrlyAddr ? 'ORY' : 'BVA'
        const airportZone = zonesProp.find(z => z.code === airportCode)
        if (airportZone && grilleProp.length > 0) {
          const cell = grilleProp.find(g =>
            (g.zone_depart_id === airportZone.id && g.zone_arrivee_id === otherZone.id) ||
            (g.zone_depart_id === otherZone.id   && g.zone_arrivee_id === airportZone.id)
          )
          if (cell && cell.prix_berline) {
            const nom   = v.name
            const coef  = nom === 'Berline Premium' ? 1.25 : nom === 'Van 7 places' ? 1.5 : 1
            let prix    = Math.round(cell.prix_berline * coef)
            if (h >= 22 || h < 6) prix = Math.round(prix * 1.2)
            return prix
          }
        }
        // Fallback : tarif fixe aéroport
        let fixe = isCDGAddr ? Number(tarif.cdg_fixe) : isOrlyAddr ? Number(tarif.orly_fixe) : Number(tarif.beauvais_fixe)
        if (fixe > 0) {
          if (h >= 22 || h < 6) fixe = Math.round(fixe * 1.2)
          return fixe
        }
      }
      // Pas de zone connue → on passe au calcul km
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
      const params = new URLSearchParams()
      if (form.origin) params.set('depart',  form.origin)
      if (form.dest)   params.set('arrivee', form.dest)
      if (form.date)   params.set('date',    form.date)
      if (form.time)   params.set('time',    form.time)
      params.set('pax', String(pax))
      router.push('/reserver?' + params.toString())
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

      {/* ── Exit intent popup ────────────────────────────────── */}
      {exitVisible && (
        <div style={{
          position:'fixed',inset:0,zIndex:9000,
          background:'rgba(9,9,26,.75)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          padding:'20px',
          animation:'fadeIn .3s ease',
        }} onClick={()=>setExitVisible(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:'#111128',border:'1px solid rgba(201,168,76,.2)',
            borderRadius:20,padding:'40px 36px',maxWidth:440,width:'100%',
            boxShadow:'0 40px 100px rgba(0,0,0,.6)',
            position:'relative',textAlign:'center',
          }}>
            <button onClick={()=>setExitVisible(false)} style={{
              position:'absolute',top:14,right:14,width:28,height:28,
              borderRadius:8,background:'rgba(255,255,255,.06)',border:'none',
              color:'rgba(237,232,223,.5)',cursor:'pointer',fontSize:16,
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>✕</button>

            {/* Badge */}
            <div style={{
              display:'inline-flex',alignItems:'center',gap:6,
              background:'rgba(201,168,76,.1)',border:'1px solid rgba(201,168,76,.25)',
              borderRadius:20,padding:'5px 14px',fontSize:10,color:'#C9A84C',
              letterSpacing:'.1em',textTransform:'uppercase',marginBottom:20,
            }}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'#C9A84C',flexShrink:0}}/>
              Offre exclusive
            </div>

            <h3 style={{
              fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:500,
              color:'#EDE8DF',lineHeight:1.1,marginBottom:12,
            }}>
              Avant de partir…
            </h3>
            <p style={{fontSize:13,color:'rgba(237,232,223,.6)',lineHeight:1.7,marginBottom:28}}>
              Obtenez votre tarif en 30 secondes.<br/>
              Notre équipe vous répond <strong style={{color:'#EDE8DF'}}>immédiatement sur WhatsApp</strong> pour tout trajet Paris · IDF · Oise.
            </p>

            {/* CTA WhatsApp */}
            <a
              href="https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20un%20devis%20VTC"
              target="_blank" rel="noopener"
              onClick={()=>setExitVisible(false)}
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                background:'#25D366',color:'#fff',borderRadius:12,
                padding:'14px 24px',fontSize:14,fontWeight:700,
                textDecoration:'none',marginBottom:12,
                transition:'transform .15s,box-shadow .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(37,211,102,.35)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg>
              Demander un devis sur WhatsApp
            </a>

            {/* Ou réserver directement */}
            <button
              onClick={()=>{ setExitVisible(false); document.querySelector('.hero-booking-wrap')?.scrollIntoView({behavior:'smooth'}) }}
              style={{
                background:'none',border:'1px solid rgba(201,168,76,.2)',
                borderRadius:10,padding:'11px 20px',color:'rgba(237,232,223,.6)',
                fontSize:12,cursor:'pointer',width:'100%',
                transition:'border-color .15s,color .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(201,168,76,.5)';e.currentTarget.style.color='#C9A84C'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(201,168,76,.2)';e.currentTarget.style.color='rgba(237,232,223,.6)'}}
            >
              Voir les tarifs →
            </button>

            <p style={{fontSize:10,color:'rgba(237,232,223,.25)',marginTop:16,letterSpacing:'.04em'}}>
              Disponible 24h/24 · Tarif fixe garanti · Sans engagement
            </p>
          </div>
        </div>
      )}

      {/* scroll progress */}
      <div className="scroll-progress" id="scrollProgress" />

      {/* mobile menu */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        <div className="mm-links">
          {['#vehicules','#tarifs','#comment','#zones','#faq','#contact'].map((h,i) => (
            <a key={i} href={h} className="mm-link" onClick={()=>setMenuOpen(false)}>
              {h==='#vehicules'?'Véhicules':h==='#tarifs'?'Tarifs':h==='#comment'?'Comment ça marche':h==='#zones'?'Zones':h==='#faq'?'FAQ':'Contact'}
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
          {[['#vehicules','Véhicules'],['#tarifs','Tarifs'],['#comment','Comment ça marche'],['#zones','Zones'],['#faq','FAQ'],['#contact','Contact']].map(([h,l])=>(
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
          <div className="hero-photo-overlay"/>
          <div className="hero-vignette"/>
          <span className="orb orb-1"/>
          <span className="orb orb-2"/>
          <span className="orb orb-3"/>
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

        <div className="hero-center">
          <div className="hero-live-badge">
            <span className="live-dot"/>
            Disponible maintenant · Paris, IDF &amp; Oise
          </div>
          <h1 className="hero-headline">
            Votre chauffeur privé,<br/>
            <em className="hero-em">où vous le souhaitez.</em>
          </h1>
          <div className="hero-booking-wrap">
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
                {bcLoading && (
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(201,168,76,.06)',borderRadius:10,border:'1px solid rgba(201,168,76,.15)'}}>
                    <svg style={{animation:'spin 1s linear infinite',flexShrink:0}} width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span style={{fontSize:12,color:'#C9A84C',fontWeight:500}}>Calcul du tarif en cours…</span>
                  </div>
                )}
                {!bcLoading && bcPrice === null && bcDepart.label.length < 3 && (
                  <div style={{fontSize:11,color:'var(--t2)',textAlign:'center',padding:'8px 0',letterSpacing:'.04em'}}>
                    Saisissez vos adresses pour voir le prix instantanément
                  </div>
                )}
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
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:14,marginTop:4,flexWrap:'wrap'}}>
                  <span style={{display:'flex',alignItems:'center',gap:4,fontSize:10,color:'var(--t2)'}}>
                    <svg width="10" height="10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
                    Paiement sécurisé Stripe
                  </span>
                  <span style={{width:1,height:10,background:'var(--t3)',flexShrink:0}}/>
                  <span style={{fontSize:10,color:'var(--t2)'}}>✓ VTC certifié</span>
                  <span style={{width:1,height:10,background:'var(--t3)',flexShrink:0}}/>
                  <span style={{fontSize:10,color:'var(--t2)'}}>✓ Annulation gratuite</span>
                </div>
                {bcPrice !== null && (
                  <button onClick={async()=>{setBcLoading(true);setBcPrice(null);const p=await bcEstimate();setBcPrice(p);setBcLoading(false)}} style={{fontSize:10,color:'var(--t3)',background:'none',border:'none',cursor:'pointer',textAlign:'center',width:'100%',marginTop:2}}>
                    ↺ Recalculer
                  </button>
                )}
              </div>
            </div>
          </div>{/* /hero-booking-wrap */}
          <div className="hero-trust-bar">
            <div className="htb-item">★ 4.9 · 500+ courses</div>
            <div className="htb-sep"/>
            <div className="htb-item">Prix fixe garanti</div>
            <div className="htb-sep"/>
            <div className="htb-item">Disponible 24h/24</div>
            <div className="htb-sep"/>
            <div className="htb-item">Annulation gratuite</div>
          </div>
        </div>{/* /hero-center */}

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
          <div className="section-tag">Avis clients vérifiés</div>
          <h2 className="section-title">Ce que disent<br/><em className="chrome-gold-slow">nos clients</em></h2>
          {/* Badge Google */}
          <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:12,marginTop:20,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,background:'#fff',border:'1px solid rgba(0,0,0,.1)',borderRadius:10,padding:'8px 16px',boxShadow:'0 2px 8px rgba(0,0,0,.06)'}}>
              {/* Google logo SVG */}
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              <span style={{fontSize:15,fontWeight:700,color:'#0A0A0A'}}>4.9</span>
              <span style={{color:'#FBBC05',fontSize:13,letterSpacing:1}}>★★★★★</span>
              <span style={{fontSize:11,color:'#6B6B6B'}}>sur Google</span>
            </div>
            <a
              href="https://g.page/r/owise-vtc/review"
              target="_blank" rel="noopener"
              style={{fontSize:12,color:'#4285F4',textDecoration:'none',border:'1px solid rgba(66,133,244,.25)',borderRadius:8,padding:'7px 14px',transition:'background .15s'}}
              onMouseEnter={e=>(e.currentTarget.style.background='rgba(66,133,244,.06)')}
              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
            >
              Laisser un avis →
            </a>
          </div>
        </div>
        <div className="testimonials-grid">
          {[
            { text:"Transfert Creil → CDG à 5h du matin, le chauffeur était déjà là 10 minutes avant. Ponctualité parfaite, véhicule impeccable. Je réserve Owise pour tous mes déplacements professionnels depuis 4 mois.", name:'Karim B.', role:'Chef de projet · Creil', avatar:'https://randomuser.me/api/portraits/men/45.jpg', trajet:'Creil → CDG' },
            { text:"Nous utilisons Owise pour tous nos transferts aéroport depuis 6 mois. La ponctualité est irréprochable, les chauffeurs sont professionnels et discrets. Je recommande à toute entreprise.", name:'Sophie M.', role:'Directrice Marketing · Groupe Beaumont', avatar:'https://randomuser.me/api/portraits/women/44.jpg', trajet:'Paris → CDG' },
            { text:"Chantilly → Orly en pleine nuit, suivi de vol, chauffeur présent à l'heure exacte malgré le retard de 40 min. Le tarif fixe ne bouge pas. C'est exactement ce qu'on cherche pour une clientèle exigeante.", name:'Marc L.', role:'Directeur · Cabinet ML Conseil', avatar:'https://randomuser.me/api/portraits/men/32.jpg', trajet:'Chantilly → Orly' },
            { text:"Saint-Maximin → CDG régulièrement pour mon travail. Toujours ponctuel, toujours propre, toujours agréable. Le prix est fixe et annoncé à l'avance — aucune mauvaise surprise. Parfait.", name:'Nadia A.', role:'Commerciale · Saint-Maximin', avatar:'https://randomuser.me/api/portraits/women/68.jpg', trajet:'Saint-Maximin → CDG' },
            { text:"Le compte entreprise a simplifié notre gestion des déplacements. La facturation mensuelle et le portail multi-collaborateurs sont excellents. Notre assistante réserve en 2 minutes.", name:'Isabelle C.', role:'DRH · Groupe Legrand', avatar:'https://randomuser.me/api/portraits/women/52.jpg', trajet:'Compte entreprise' },
          ].map((t,i)=>(
            <div key={i} className={`testimonial-card reveal rd${i % 3 + 1}`}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
                <div className="t-stars">{'★★★★★'}</div>
                <span style={{fontSize:9,color:'rgba(0,0,0,.3)',letterSpacing:'.08em',textTransform:'uppercase',background:'rgba(0,0,0,.04)',padding:'2px 8px',borderRadius:10}}>{t.trajet}</span>
              </div>
              <p className="t-text">{t.text}</p>
              <div className="t-author">
                <div className="t-avatar"><img src={t.avatar} alt={t.name}/></div>
                <div>
                  <div className="t-name">{t.name}</div>
                  <div className="t-role">{t.role}</div>
                </div>
                <svg style={{marginLeft:'auto',opacity:.2}} width="14" height="14" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── TARIFS ───────────────────────────────────────────── */}
      <section id="tarifs" style={{ background:'#09091A', padding:'80px 24px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          {/* Header */}
          <div className="reveal" style={{ textAlign:'center', marginBottom:48 }}>
            <div className="section-tag">Tarification</div>
            <h2 className="section-title" style={{ marginBottom:12 }}>
              Prix fixe garanti<br/><em className="chrome-gold-slow">zéro surprise à l'arrivée</em>
            </h2>
            <p style={{ fontSize:15, color:'#848499', maxWidth:520, margin:'0 auto' }}>
              Le prix affiché est celui que vous payez. Pas de majoration, pas de frais cachés — quelles que soient les conditions de trafic.
            </p>
          </div>

          {/* Table */}
          {bcTarifs.length > 0 && (() => {
            const berline = bcTarifs.find(t => t.vehicule === 'Berline')
            const premium = bcTarifs.find(t => t.vehicule === 'Berline Premium')
            const van     = bcTarifs.find(t => t.vehicule === 'Van 7 places')

            const rows = [
              {
                icon: '✈', label: 'CDG / Roissy',
                sub: 'Aéroport Charles de Gaulle',
                berline: berline?.cdg_fixe, premium: premium?.cdg_fixe, van: van?.cdg_fixe,
                isFixed: true,
              },
              {
                icon: '✈', label: 'Orly',
                sub: 'Aéroport d\'Orly',
                berline: berline?.orly_fixe, premium: premium?.orly_fixe, van: van?.orly_fixe,
                isFixed: true,
              },
              {
                icon: '✈', label: 'Beauvais-Tillé',
                sub: 'Aéroport de Beauvais',
                berline: berline?.beauvais_fixe, premium: premium?.beauvais_fixe, van: van?.beauvais_fixe,
                isFixed: true,
              },
              {
                icon: '🚉', label: 'Gares parisiennes',
                sub: 'Nord, Lyon, Montparnasse…',
                berline: berline ? Math.round(Number(berline.prise_en_charge) + 10 * Number(berline.prix_km)) : null,
                premium: premium ? Math.round(Number(premium.prise_en_charge) + 10 * Number(premium.prix_km)) : null,
                van:     van     ? Math.round(Number(van.prise_en_charge)     + 10 * Number(van.prix_km))     : null,
                isFixed: false,
              },
            ]

            return (
              <div className="reveal" style={{ borderRadius:16, overflow:'hidden', border:'1px solid rgba(201,168,76,.15)' }}>
                {/* En-têtes colonnes */}
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr repeat(3,140px)',
                  background:'rgba(201,168,76,.06)',
                  borderBottom:'1px solid rgba(201,168,76,.12)',
                  padding:'14px 24px',
                }}>
                  <div style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'#848499' }}>Destination</div>
                  {[
                    { label:'Berline', emoji:'🚘' },
                    { label:'Premium', emoji:'⭐' },
                    { label:'Van 7 pl.', emoji:'🚐' },
                  ].map(v => (
                    <div key={v.label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'#EDE8DF' }}>{v.emoji} {v.label}</div>
                    </div>
                  ))}
                </div>

                {/* Lignes */}
                {rows.map((r, i) => (
                  <div key={i} style={{
                    display:'grid', gridTemplateColumns:'1fr repeat(3,140px)',
                    padding:'18px 24px', alignItems:'center',
                    borderBottom: i < rows.length-1 ? '1px solid rgba(201,168,76,.07)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.015)',
                  }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{r.icon}</span>
                        <span style={{ fontSize:14, fontWeight:600, color:'#EDE8DF' }}>{r.label}</span>
                      </div>
                      <div style={{ fontSize:11, color:'#848499', marginTop:2, paddingLeft:26 }}>{r.sub}</div>
                    </div>
                    {[r.berline, r.premium, r.van].map((prix, j) => (
                      <div key={j} style={{ textAlign:'center' }}>
                        {prix != null ? (
                          <div>
                            <span style={{
                              fontFamily:"'Courier New',monospace",
                              fontSize:20, fontWeight:700, color:'#C9A84C',
                            }}>{Math.round(Number(prix))}</span>
                            <span style={{ fontSize:12, color:'#848499', marginLeft:2 }}>€</span>
                            {!r.isFixed && <div style={{ fontSize:9, color:'#848499', letterSpacing:'.06em', textTransform:'uppercase' }}>dès</div>}
                          </div>
                        ) : <span style={{ color:'#3F3F5A' }}>—</span>}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Ligne tarif km */}
                <div style={{
                  display:'grid', gridTemplateColumns:'1fr repeat(3,140px)',
                  padding:'18px 24px', alignItems:'center',
                  background:'rgba(201,168,76,.04)',
                  borderTop:'1px solid rgba(201,168,76,.12)',
                }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{ fontSize:18 }}>📍</span>
                      <span style={{ fontSize:14, fontWeight:600, color:'#EDE8DF' }}>Autre destination</span>
                    </div>
                    <div style={{ fontSize:11, color:'#848499', marginTop:2, paddingLeft:26 }}>Tarif calculé selon la distance réelle</div>
                  </div>
                  {[berline, premium, van].map((t, j) => (
                    <div key={j} style={{ textAlign:'center' }}>
                      {t ? (
                        <div>
                          <span style={{ fontFamily:"'Courier New',monospace", fontSize:16, fontWeight:700, color:'#C9A84C' }}>
                            {Number(t.prix_km).toFixed(2)}
                          </span>
                          <span style={{ fontSize:11, color:'#848499' }}>€/km</span>
                          <div style={{ fontSize:9, color:'#3F3F5A', marginTop:1 }}>
                            + {Number(t.prise_en_charge).toFixed(0)}€ prise en charge
                          </div>
                        </div>
                      ) : <span style={{ color:'#3F3F5A' }}>—</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* Notes + CTA */}
          <div className="reveal" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24, flexWrap:'wrap', gap:16 }}>
            <div style={{ fontSize:12, color:'#848499', display:'flex', flexDirection:'column', gap:4 }}>
              <span>⏰ Majoration nuit +20% (22h – 6h) · 🧳 Bagages inclus · ✈ Suivi vol en temps réel</span>
              <span>💳 Paiement sécurisé par carte en ligne · 📞 Réservation aussi par WhatsApp</span>
            </div>
            <button
              onClick={() => scrollTo('#devis')}
              style={{
                background:'#C9A84C', color:'#09091A', border:'none', borderRadius:10,
                padding:'13px 28px', fontSize:14, fontWeight:700, cursor:'pointer',
                fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap',
              }}
            >
              Obtenir mon prix →
            </button>
          </div>
        </div>
      </section>

      {/* ENTERPRISE CTA */}
      <section className="enterprise-section">
        {/* Grain texture */}
        <svg style={{position:'absolute',inset:0,width:'100%',height:'100%',opacity:.025,pointerEvents:'none'}} aria-hidden="true">
          <filter id="ent-grain"><feTurbulence type="fractalNoise" baseFrequency=".75" numOctaves="4" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter>
          <rect width="100%" height="100%" filter="url(#ent-grain)"/>
        </svg>
        {/* Gold top line */}
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,#C9A84C 30%,#C9A84C 70%,transparent)'}}/>
        {/* Decorative circle */}
        <div style={{position:'absolute',right:-120,top:'50%',transform:'translateY(-50%)',width:500,height:500,borderRadius:'50%',border:'1px solid rgba(201,168,76,.06)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',right:-80,top:'50%',transform:'translateY(-50%)',width:340,height:340,borderRadius:'50%',border:'1px solid rgba(201,168,76,.04)',pointerEvents:'none'}}/>

        <div className="enterprise-inner reveal">
          {/* Left */}
          <div className="ent-left">
            <div className="ent-label">Comptes entreprises</div>
            <h2 className="ent-title">
              Vos équipes,<br/>
              <em>toujours à l'heure.</em>
            </h2>
            <p className="ent-desc">
              Tarifs négociés, facturation mensuelle centralisée, portail multi-collaborateurs — tout ce qu'il faut pour gérer les déplacements de votre société sans friction.
            </p>

            {/* Stats */}
            <div className="ent-stats">
              {[
                {n:'10+', label:'courses/mois pour les tarifs préférentiels'},
                {n:'24h', label:'délai de réponse garanti'},
                {n:'100%', label:'visibilité sur vos dépenses'},
              ].map((s,i)=>(
                <div key={i} className="ent-stat">
                  <div className="ent-stat-n">{s.n}</div>
                  <div className="ent-stat-l">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="ent-actions">
              <button className="btn-ent" onClick={()=>scrollTo('#contact')}>
                Demander un devis entreprise
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg>
              </button>
              <button className="btn-ent-ghost" onClick={()=>scrollTo('#devis')}>Ou réserver directement →</button>
            </div>
          </div>

          {/* Right — feature cards */}
          <div className="ent-features">
            {[
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg>,
                title:'Tarifs négociés',
                desc:'Accès aux grilles entreprise dès 10 courses/mois',
              },
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>,
                title:'Facturation mensuelle',
                desc:'Une facture consolidée + export comptable CSV/PDF',
              },
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>,
                title:'Portail collaborateurs',
                desc:'Chaque collaborateur réserve sans avancer de frais',
              },
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="#C9A84C" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
                title:'Gestionnaire dédié',
                desc:'Un interlocuteur unique, joignable 7j/7',
              },
            ].map((f,i)=>(
              <div key={i} className="ent-feature-card">
                <div className="ent-feature-icon">{f.icon}</div>
                <div>
                  <div className="ent-feature-title">{f.title}</div>
                  <div className="ent-feature-desc">{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ZONES — Destinations avec prix réels */}
      <section id="zones" style={{ background:'#F8F6F1', padding:'80px 24px' }}>
        <div style={{ maxWidth:1080, margin:'0 auto' }}>

          {/* Header */}
          <div className="reveal" style={{ textAlign:'center', marginBottom:52 }}>
            <div className="section-tag">Nos destinations</div>
            <h2 className="section-title">
              Partout où vous en<br/><em className="chrome-gold-slow">avez besoin</em>
            </h2>
            <p style={{ fontSize:15, color:'#6B6B6B', maxWidth:500, margin:'12px auto 0' }}>
              Disponible 24h/24 — Réservez en ligne ou par WhatsApp
            </p>
          </div>

          {/* Grid de cartes */}
          {(() => {
            const b = bcTarifs.find(t => t.vehicule === 'Berline')
            const destinations = [
              {
                emoji: '✈',
                color: '#4D8ED4',
                name: 'CDG / Roissy',
                villes: ['Terminal 1', 'Terminal 2', 'Terminal 3'],
                prix: b ? `${Number(b.cdg_fixe).toFixed(0)} €` : null,
                prixLabel: 'Prix fixe berline',
                tag: 'Tarif fixe garanti',
                tagColor: '#4D8ED4',
                dest: 'Aéroport Charles de Gaulle',
                cta: 'Réserver',
                href: '#devis',
              },
              {
                emoji: '✈',
                color: '#3DB87A',
                name: 'Orly',
                villes: ['Terminal 1', 'Terminal 2', 'Terminal 3 & 4'],
                prix: b ? `${Number(b.orly_fixe).toFixed(0)} €` : null,
                prixLabel: 'Prix fixe berline',
                tag: 'Tarif fixe garanti',
                tagColor: '#3DB87A',
                dest: 'Aéroport d\'Orly',
                cta: 'Réserver',
                href: '#devis',
              },
              {
                emoji: '✈',
                color: '#848499',
                name: 'Beauvais (BVA)',
                villes: ['Ryanair', 'Wizz Air', 'easyJet'],
                prix: b ? `${Number(b.beauvais_fixe).toFixed(0)} €` : null,
                prixLabel: 'Prix fixe berline',
                tag: 'Tarif fixe garanti',
                tagColor: '#848499',
                dest: 'Aéroport Paris-Beauvais',
                cta: 'Réserver',
                href: '#devis',
              },
              {
                emoji: '🏙',
                color: '#C9A84C',
                name: 'Paris & IDF',
                villes: ['Tous arrondissements', 'Versailles', 'Boulogne, Saint-Denis…'],
                prix: b ? `${Number(b.prix_km).toFixed(2)} €/km` : null,
                prixLabel: `+ ${b ? Number(b.prise_en_charge).toFixed(0) : '20'} € prise en charge`,
                tag: 'Tarif au kilomètre',
                tagColor: '#C9A84C',
                dest: 'Paris et Île-de-France',
                cta: 'Estimer mon prix',
                href: '#devis',
              },
              {
                emoji: '🚉',
                color: '#E8A030',
                name: 'Gares parisiennes',
                villes: ['Gare du Nord', 'Gare de Lyon', 'Montparnasse, Saint-Lazare…'],
                prix: b ? `dès ${Math.round(Number(b.prise_en_charge) + 8 * Number(b.prix_km))} €` : null,
                prixLabel: 'selon la distance',
                tag: 'Tarif calculé',
                tagColor: '#E8A030',
                dest: 'Toutes gares de Paris',
                cta: 'Estimer mon prix',
                href: '#devis',
              },
              {
                emoji: '🌿',
                color: '#C9A84C',
                name: 'Oise',
                villes: ['Chantilly', 'Creil', 'Compiègne, Senlis…'],
                prix: null,
                prixLabel: 'Devis personnalisé',
                tag: 'Sur devis',
                tagColor: '#C9A84C',
                dest: 'Oise (60)',
                cta: 'Demander un devis',
                href: 'https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20un%20devis%20pour%20l\'Oise',
                external: true,
              },
            ]

            return (
              <div style={{
                display:'grid',
                gridTemplateColumns:'repeat(3,1fr)',
                gap:16,
              }}>
                {destinations.map((d, i) => (
                  <div key={i} className="reveal" style={{
                    background:'#fff',
                    borderRadius:16,
                    border:'1px solid rgba(0,0,0,.07)',
                    overflow:'hidden',
                    boxShadow:'0 2px 20px rgba(0,0,0,.06)',
                    display:'flex',
                    flexDirection:'column',
                  }}>
                    {/* Bandeau couleur */}
                    <div style={{ height:4, background:d.color, flexShrink:0 }}/>

                    <div style={{ padding:'20px 22px', flex:1, display:'flex', flexDirection:'column', gap:12 }}>
                      {/* Header */}
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                          <span style={{ fontSize:22 }}>{d.emoji}</span>
                          <div>
                            <div style={{ fontSize:15, fontWeight:700, color:'#0A0A0A', lineHeight:1.2 }}>{d.name}</div>
                            <div style={{ fontSize:10, color:'#848499', marginTop:1 }}>{d.dest}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize:9, padding:'3px 8px', borderRadius:20, fontWeight:600,
                          background:`${d.tagColor}15`, color:d.tagColor,
                          border:`1px solid ${d.tagColor}30`,
                          whiteSpace:'nowrap',
                        }}>{d.tag}</span>
                      </div>

                      {/* Villes clés */}
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {d.villes.map((v, j) => (
                          <div key={j} style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:4, height:4, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                            <span style={{ fontSize:12, color:'#555', lineHeight:1.3 }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Prix */}
                      <div style={{
                        marginTop:'auto',
                        paddingTop:12,
                        borderTop:'1px solid rgba(0,0,0,.06)',
                        display:'flex',
                        alignItems:'flex-end',
                        justifyContent:'space-between',
                      }}>
                        <div>
                          {d.prix ? (
                            <div style={{ fontFamily:"'Courier New',monospace", fontSize:22, fontWeight:700, color:'#C9A84C', lineHeight:1 }}>
                              {d.prix}
                            </div>
                          ) : (
                            <div style={{ fontSize:14, fontWeight:600, color:'#C9A84C' }}>Sur devis</div>
                          )}
                          <div style={{ fontSize:10, color:'#848499', marginTop:2 }}>{d.prixLabel}</div>
                        </div>
                        {d.external ? (
                          <a href={d.href} target="_blank" rel="noopener" style={{
                            padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                            background:'#25D366', color:'#fff', textDecoration:'none',
                            display:'flex', alignItems:'center', gap:6,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            {d.cta}
                          </a>
                        ) : (
                          <button onClick={() => scrollTo(d.href)} style={{
                            padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                            background:'#09091A', color:'#C9A84C', border:'none', cursor:'pointer',
                            fontFamily:'DM Sans, sans-serif',
                          }}>
                            {d.cta} →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}

          {/* Disponibilité 24h/24 */}
          <div className="reveal" style={{
            marginTop:32, padding:'18px 28px', borderRadius:12,
            background:'#09091A', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'#3DB87A', boxShadow:'0 0 0 3px rgba(61,184,122,.2)' }}/>
              <span style={{ fontSize:14, color:'#EDE8DF', fontWeight:500 }}>Disponible 24h/24, 7j/7 — Réponse en moins de 2 minutes</span>
            </div>
            <a href="https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20réserver%20un%20VTC"
               target="_blank" rel="noopener"
               style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:8, background:'#25D366', color:'#fff', fontSize:13, fontWeight:600, textDecoration:'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Réserver par WhatsApp
            </a>
          </div>

        </div>
      </section>

      {/* FAQ */}
      <section className="faq-section" id="faq">
        <div className="faq-inner">
          {/* Header */}
          <div className="faq-header reveal">
            <div className="faq-eyebrow">Questions fréquentes</div>
            <h2 className="faq-title">
              Tout ce que vous<br/>
              <em>devez savoir</em>
            </h2>
          </div>

          {/* Accordion */}
          <div className="faq-list">
            {FAQS.map((f,i)=>(
              <div
                key={i}
                className={`faq-item${faqOpen===i?' open':''}`}
                onClick={()=>setFaqOpen(faqOpen===i?null:i)}
              >
                <div className="faq-q">
                  <span className="faq-num">{String(i+1).padStart(2,'0')}</span>
                  <span className="faq-q-text">{f.q}</span>
                  <span className="faq-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                      <line x1="6" y1="1" x2="6" y2="11" className="faq-icon-v"/>
                      <line x1="1" y1="6" x2="11" y2="6"/>
                    </svg>
                  </span>
                </div>
                <div className="faq-a">
                  <div className="faq-a-inner">{f.a}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="faq-footer reveal">
            <p className="faq-footer-text">Une question qui ne figure pas ici ?</p>
            <div className="faq-footer-btns">
              <a href="https://wa.me/33619106356" className="faq-btn-wa" target="_blank" rel="noopener">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
              <button onClick={()=>scrollTo('#devis')} className="faq-btn-devis">
                Obtenir un devis →
              </button>
            </div>
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
                      {/cdg|roissy|charles de gaulle|orly|beauvais/i.test(form.dest+form.origin)||form.destType==='airport'?'Transfert aéroport':/\bgare\b/i.test(form.dest+form.origin)||form.destType==='gare'?'Transfert gare':etapeOpen?'Avec étape':'Course standard'}
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
