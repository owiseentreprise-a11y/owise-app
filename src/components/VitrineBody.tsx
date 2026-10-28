'use client'

import { Fragment, useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { CSSProperties } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter, usePathname } from 'next/navigation'
import { searchAddresses, getSuggestionIcon, fetchPlaceDetails } from '@/lib/addressSearch'
import { LIEUX_CONNUS } from '@/lib/lieux'
import CarteParisEnMouvement from '@/components/CarteParisEnMouvement'

type BcAddr  = { label: string; lat?: number; lng?: number; cp?: string }
type ZoneMin = { id: string; code: string; type: string; prefixes_postaux: string[] }
// Détection de zone et calcul de prix : voir @/lib/calcPrix (source unique
// partagée avec /reserver et le serveur, pour garantir prix affiché = prix facturé)

async function fetchGoogleDist(dep: BcAddr, arr: BcAddr): Promise<number | null> {
  if (!dep.lat || !dep.lng || !arr.lat || !arr.lng) return null
  try {
    const url = `/api/distance?olat=${dep.lat}&olng=${dep.lng}&dlat=${arr.lat}&dlng=${arr.lng}`
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const json = await res.json()
    return json.km ?? null
  } catch { return null }
}

async function geocodeAddress(label: string): Promise<{ lat: number; lng: number; cp: string } | null> {
  try {
    const res  = await fetch(`/api/geocode?q=${encodeURIComponent(label)}`, { signal: AbortSignal.timeout(5000) })
    const json = await res.json()
    if (json.lat && json.lng) return { lat: json.lat, lng: json.lng, cp: json.codePostal ?? '' }
  } catch {}
  return null
}

/** Complète une adresse saisie au clavier avec ses coordonnées et son code postal. */
async function resoudreAdresse(addr: BcAddr): Promise<BcAddr> {
  if (addr.lat && addr.cp) return addr
  const gc = await geocodeAddress(addr.label)
  return gc ? { label: addr.label, lat: gc.lat, lng: gc.lng, cp: gc.cp } : addr
}
import { soumettreDevis } from '@/app/vitrine/actions'
import { fbLead, fbContact, initFbPixel } from '@/lib/pixel'
import { gtagEvent, initGA } from '@/lib/ga'
import {
  lireConsentement, ecrireConsentement, EVENEMENT_OUVRIR_PANNEAU,
} from '@/lib/consentement'
import { lieuPourStatistique } from '@/lib/estimation-anonyme'
import { logFunnel } from '@/lib/funnel'
import { calculerPrix, calculerPrixKm, calculerPrixEtapes, detectZone, prixAPartirDe, prixAffiche, BASE_AFFICHAGE_VITRINE, NOM_VERS_CLE, type TarifCalc as TarifRow2, type GrilleCalc, type ParamsCalc } from '@/lib/calcPrix'

/* ── vehicles ─────────────────────────────────────────── */
/* `from` a disparu de cette table : le badge « dès … € » de l'étape 2 du devis
   affichait 65/65/75/95 €, les mêmes constantes fausses que les cartes
   véhicules, à un deuxième endroit de la même page. Il lit désormais
   `prixAppel`, comme les cartes.

   `base` reste : ce n'est pas un affichage mais le dernier repli de
   `estimerPrixBase()`, utilisé quand ni la grille ni Google ne donnent de
   distance. Y toucher modifierait un prix de réservation — hors périmètre de
   ce sprint. Voir les risques résiduels du rapport. */
const VEHICLES = [
  { min:1,max:3, name:'Berline',         sub:'1–3 passagers · confort premium',   base:65 },
  { min:4,max:4, name:'Berline Premium', sub:'4 passagers · haut de gamme',       base:65 },
  { min:5,max:7, name:'Van 7 places',    sub:'5–7 passagers · transfert groupe',  base:75 },
  { min:8,max:8, name:'Grand Van',       sub:'8 passagers · sur réservation',     base:95 },
]
function getVehicle(p:number) { return VEHICLES.find(v=>p>=v.min&&p<=v.max)||VEHICLES[3] }

/* ── FAQ data ──────────────────────────────────────────── */
const FAQS = [
  { q:'Comment réserver un VTC Owise ?', a:'Réservez directement via notre formulaire en ligne, disponible 24h/24. Renseignez votre trajet, vos passagers et l\'horaire souhaité, et recevez une confirmation immédiate par e-mail et SMS. Vous pouvez aussi nous joindre par téléphone ou WhatsApp pour une réservation assistée.' },
  { q:'Les tarifs sont-ils fixes et garantis ?', a:'Oui. Chaque devis est calculé à l\'avance et garanti — aucune majoration en cours de route, aucune surprise à l\'arrivée. Le tarif communiqué lors de la réservation est celui que vous payez, quelle que soit la durée du trajet ou les conditions de circulation.' },
  { q:'Quelles sont vos conditions d\'annulation ?', a:'L\'annulation est gratuite tant qu\'aucun chauffeur n\'a été attribué. Après attribution : gratuite dans les 3 premières minutes, 3 € de 3 à 10 minutes, 8 € au-delà. Si le chauffeur est déjà arrivé, la prise en charge et 5 minutes d\'attente sont dues. Le détail figure dans nos mentions légales.' },
  { q:'Comment sont sélectionnés vos chauffeurs ?', a:'Tous nos chauffeurs sont titulaires de la carte professionnelle VTC, obligatoire en France, et justifient d\'un casier judiciaire vierge. Ils sont sélectionnés sur leur expérience de conduite et leur sens du service avant de rejoindre notre flotte, et nos véhicules disposent tous d\'une assurance transport de personnes en cours de validité.' },
  { q:'Quels moyens de paiement acceptez-vous ?', a:'Carte bancaire, Apple Pay et Google Pay, via un paiement 100% sécurisé (Stripe, chiffrement SSL/TLS). Aucune donnée bancaire n\'est stockée sur nos serveurs. Les comptes entreprise peuvent également être facturés mensuellement sur facture unique.' },
  { q:'Quels aéroports desservez-vous ?', a:'Nous assurons les transferts vers et depuis Paris-CDG (Roissy), Paris-Orly, et Beauvais-Tillé. Nous intervenons également sur les héliports parisiens et les aéroports secondaires d\'Île-de-France sur demande. Pour CDG, nous suivons les retards de vol en temps réel.' },
  { q:'Que se passe-t-il si mon vol est retardé ?', a:'Nous surveillons les horaires de vol en temps réel. Si votre vol est retardé, votre chauffeur ajuste son arrivée en conséquence, sans frais supplémentaires pour des retards raisonnables. En cas de délai important, notre équipe vous contacte directement pour adapter la prise en charge.' },
  { q:'Puis-je réserver à l\'avance ?', a:'Absolument — et c\'est même recommandé pour les transferts aéroport, les événements ou les déplacements d\'entreprise. Vous pouvez réserver jusqu\'à 6 mois à l\'avance. Votre confirmation est immédiate et votre chauffeur est attribué dès la réservation.' },
  { q:'Acceptez-vous les animaux de compagnie ?', a:'Les petits animaux en cage de transport sont acceptés dans tous nos véhicules. Pour les animaux de plus grande taille, merci de le mentionner lors de la réservation afin que nous adaptions le véhicule. Des frais de nettoyage peuvent s\'appliquer selon les cas.' },
  { q:'Proposez-vous des solutions pour les entreprises ?', a:'Oui. Nous proposons des comptes entreprise avec tableau de bord dédié, facturation mensuelle consolidée et gestion multi-collaborateurs. Vos équipes réservent facilement sans avoir à avancer de frais, et votre service comptable reçoit une facture unique en fin de mois.' },
  { q:'Couvrez-vous l\'Oise et les zones hors IDF ?', a:'Oui, nous opérons sur Paris, l\'ensemble de l\'Île-de-France et l\'Oise (Compiègne, Senlis, Chantilly, Creil, Beauvais). Pour les longues distances ou les destinations hors zone, contactez-nous directement — nous établissons un devis sur mesure avec tarif forfaitaire garanti.' },
  { q:'Comment obtenir une facture après ma course ?', a:'Une facture est automatiquement envoyée par e-mail à la fin de chaque course. Les clients ayant un compte entreprise reçoivent une facture mensuelle consolidée. Si vous avez besoin d\'une facture complémentaire ou d\'un justificatif spécifique, contactez notre service client.' },
]

/* ── services ──────────────────────────────────────────── */
// Palette resserrée à nuit + or (au lieu de 6 teintes hétérogènes) : 5 cartes
// nuit identiques + la carte événements en or, seule mise en avant.
const SERVICES = [
  { cls:'sc-dark',   title:'Course immédiate',     desc:'Réservez un chauffeur en quelques secondes. Prise en charge rapide, partout à Paris et en IDF.', cta:'Réserver',         href:'/reserver', icon:'bolt',      alt:'Course immédiate' },
  { cls:'sc-dark',   title:'Réserver à l\'avance', desc:'Planifiez votre trajet des jours à l\'avance. Votre chauffeur sera là, à l\'heure exacte.',        cta:'Planifier',         href:'/reserver', icon:'calendar',  alt:'Réserver à l\'avance' },
  { cls:'sc-dark',   title:'Transfert aéroport',   desc:'CDG, Orly, Beauvais — suivi de vol en temps réel, tarif fixe garanti, aucune attente.',             cta:'Réserver',         href:'/reserver', icon:'plane',     alt:'Transfert aéroport' },
  { cls:'sc-dark',   title:'Groupes & familles',   desc:'Van 7 ou 8 places, grand coffre. Idéal pour les transferts en famille ou entre collègues.',          cta:'Réserver',         href:'/reserver', icon:'group',     alt:'Groupes et familles' },
  { cls:'sc-dark',   title:'Comptes entreprise',   desc:'Facturation mensuelle centralisée, portail dédié, gestionnaire de compte. Zéro friction.',           cta:'En savoir plus',   href:'#contact',  icon:'briefcase', alt:'Comptes entreprise' },
  { cls:'sc-gold',   title:'Événements & soirées', desc:'Mariages, galas, soirées privées. Un chauffeur élégant, disponible le temps de votre événement.',   cta:'Demander un devis',href:'#devis',    icon:'sparkle',   alt:'Événements et soirées' },
]

function ServiceIcon({ name }: { name: string }) {
  const common = { width: 40, height: 40, viewBox: '0 0 24 24', fill: 'none' as const, stroke: 'currentColor', strokeWidth: 1.3, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'bolt':      return <svg {...common}><path className="icon-anim icon-bolt" d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>
    case 'calendar':  return (
      <svg {...common}>
        <rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>
        <path className="icon-anim icon-check" d="M8.5 14.5l2 2 4-4"/>
      </svg>
    )
    case 'plane':     return <svg {...common}><path className="icon-anim icon-plane" d="M12 2v20M12 2l-4 4v5l-6 3.5V17l6-1.5V20l-3 2v1l5-1 5 1v-1l-3-2v-3.5l6 1.5v-2.5L16 11V6l-4-4z"/></svg>
    case 'group':     return (
      <svg {...common}>
        <circle className="icon-anim icon-group-a" cx="9" cy="8" r="3.2"/><circle className="icon-anim icon-group-b" cx="17" cy="9.5" r="2.4"/>
        <path d="M3.5 20c.6-3.6 3-5.5 5.5-5.5s4.9 1.9 5.5 5.5M14.5 20c.4-2.6 1.8-4.3 3.5-4.7"/>
      </svg>
    )
    case 'briefcase': return (
      <svg {...common}>
        <rect x="3" y="8" width="18" height="12" rx="2"/>
        <path className="icon-anim icon-handle" d="M8 8V6a2 2 0 012-2h4a2 2 0 012 2v2M3 13h18"/>
      </svg>
    )
    case 'sparkle':   return (
      <svg {...common}>
        <path className="icon-anim icon-sparkle-big" d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z"/>
        <path className="icon-anim icon-sparkle-small" d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z"/>
      </svg>
    )
    default: return null
  }
}

/* Avis Google réels d'Owise — vérifiés sur la fiche Google Business, capture du 2026-09-12 */
/* `fg` : l'encre de l'initiale, appariée à son fond et non choisie une fois pour
   toutes. `--sur-fonce` est de l'ivoire (palette A) ou du blanc (palette ville) :
   il convient aux quatre fonds sombres ou moyens, mesurés de 4,84 à 13,61. Il ne
   convient PAS à l'or ni au terracotta — l'avatar de Nathalie M. mesurait 2,75
   (palette A) et 2,29 (ville) pour un seuil de 4,5. Avec `--sur-or`, l'encre
   prévue pour ce qui s'écrit sur une surface dorée : 6,07 et 8,62.
   Mesures : étape 144. Ne pas remettre une couleur unique sur les cinq. */
const TESTIMONIALS = [
  { name:'Nathalie M.', initial:'N', color:'var(--gold)', fg:'var(--sur-or)', when:'sept. 2026', text:'Super expérience. Société à recommander vivement.' },
  { name:'Joelle P.',   initial:'J', color:'var(--nuit-haute)', fg:'var(--sur-fonce)', when:'août 2026',  text:'Très bonne prestation, chauffeur ponctuel et serviable.' },
  { name:'Nabila B.',   initial:'N', color:'var(--avatar-bronze)', fg:'var(--sur-fonce)', when:'août 2026',  text:'Service de transport très professionnel, ponctuel et sérieux. Tout s\'est très bien passé du début à la fin. Je recommande sans hésiter !' },
  { name:'Michèle M.',  initial:'M', color:'var(--avatar-ardoise)', fg:'var(--sur-fonce)', when:'août 2026',  text:'Excellentes prestations. Ponctualité. À recommander.' },
  { name:'Khacim D.',   initial:'K', color:'var(--nuit-haute)', fg:'var(--sur-fonce)', when:'juil. 2026', text:'Impeccable, un service au top.' },
]

const TRUST_POINTS = [
  { icon:'shield',  title:'Chauffeurs vérifiés',       desc:'Carte professionnelle VTC et casier judiciaire vierge exigés avant la première course.' },
  { icon:'car',     title:'Véhicules assurés',         desc:'Assurance transport de personnes et contrôle technique à jour sur l\'ensemble de la flotte.' },
  { icon:'lock',    title:'Paiement 100% sécurisé',    desc:'Stripe, chiffrement SSL/TLS. Aucune donnée bancaire n\'est stockée sur nos serveurs.' },
  { icon:'headset', title:'Assistance humaine 7j/7',   desc:'Un imprévu, une question ? Notre équipe répond par téléphone ou WhatsApp, à toute heure.' },
]

function TrustIcon({ name }: { name: string }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none' as const, style: { stroke: 'var(--gold)' }, strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  switch (name) {
    case 'shield':  return <svg {...common}><path d="M12 3l7 3v6c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>
    case 'car':     return <svg {...common}><path d="M4 16V11l2-5h12l2 5v5"/><path d="M4 16a1.5 1.5 0 003 0M17 16a1.5 1.5 0 003 0M4 16h16M6 11h12"/></svg>
    case 'lock':    return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/></svg>
    case 'headset': return <svg {...common}><path d="M4 13v-1a8 8 0 0116 0v1"/><rect x="3" y="13" width="4" height="6" rx="1.5"/><rect x="17" y="13" width="4" height="6" rx="1.5"/><path d="M19 19v1a2 2 0 01-2 2h-3"/></svg>
    default: return null
  }
}

/* ── vehicles display ───────────────────────────────
   Les prix ne figurent plus ici : ils etaient ecrits en dur (65/65/75/95 EUR)
   et ne correspondaient a aucune ligne de la grille. Ils sont desormais
   derives de prixAPartirDe(), plus bas. `cle` relie chaque carte au vehicule
   que le moteur connait — 'Grand Van' est facture comme un van, regle portee
   par NOM_VERS_CLE dans calcPrix.ts et conservee telle quelle.───── */
const VEH_DISPLAY = [
  { name:'Berline', devis:false, cle:'berline',         cap:'1 à 3 passagers', feats:['Berline récente, intérieur soigné','Climatisation bi-zone','WiFi embarqué'], bg:'var(--vignette-ciel)', badge:null,       dark:false, img:'/brand_assets/vehicle-berline.png',          alt:'Illustration de la catégorie Berline Owise : berline blanche et chauffeur en costume' },
  { name:'Berline Premium', devis:false, cle:'berline_premium', cap:'1 à 4 passagers', feats:['Berline haut de gamme','Eau minérale offerte','Chargeurs universels, WiFi'], bg:'var(--vignette-nuit)', badge:'4 passagers',dark:true,  img:'/brand_assets/vehicle-berline-premium.png', alt:'Illustration de la catégorie Berline Premium Owise : berline blanche aux finitions dorées, chauffeur ouvrant la portière arrière' },
  { name:'Van 7 places', devis:false, cle:'van',    cap:'5 à 7 passagers', feats:['Van récent, 7 places assises','Grand coffre, idéal aéroport','Transferts groupes & familles'], bg:'var(--vignette-sable)', badge:null,       dark:false, img:'/brand_assets/vehicle-van7.png',             alt:'Illustration de la catégorie Van 7 places Owise : van blanc et une famille de quatre personnes' },
  { name:'Grand Van 8 pl.', cle:'van', cap:'8 passagers · sur devis', devis:true, feats:['Grand van, 8 places assises','Séminaires, événements d\'entreprise','Selon la disponibilité de nos partenaires'], bg:'var(--vignette-charbon)', badge:null, dark:true,  img:'/brand_assets/vehicle-grand-van.png',        alt:'Illustration de la catégorie Grand Van 8 places Owise : grand van blanc, porte latérale ouverte, chauffeur en costume' },
]

/* ── VtAddressInput — input adresse avec autocomplete landmarks + API ── */
import type { AddressSuggestion as VtSugg } from '@/lib/addressSearch'
import { formaterMontant } from '@/lib/montant'

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
  // Vrai seulement si la valeur vient d'une sélection (suggestion cliquée), pas d'une simple frappe.
  const resolvedRef           = useRef(false)

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
    resolvedRef.current = false
    onSelect({ label: e.target.value })
    setFocused(-1)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(e.target.value), 250)
  }

  // Filet de sécurité : si l'utilisateur quitte le champ sans avoir cliqué une
  // suggestion (clavier mobile qui masque la liste, Entrée sans sélection...),
  // on géocode quand même le texte tapé plutôt que de perdre l'adresse en
  // silence — même mécanisme que la résolution d'adresse pré-remplie sur /reserver.
  async function handleBlur() {
    if (resolvedRef.current || value.trim().length < 3) return
    const q = value.trim()
    try {
      const res  = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
      const json = await res.json()
      if (json.lat && json.lng) {
        resolvedRef.current = true
        onSelect({ label: json.label || q, lat: json.lat, lng: json.lng, cp: json.codePostal })
      }
    } catch {}
  }

  async function pick(s: VtSugg) {
    resolvedRef.current = true
    setSugg([]); setOpen(false); setFocused(-1)
    if (s.isLieu) {
      const lieu = LIEUX_CONNUS.find(l => l.label === s.label)
      onSelect({ label: s.label, lat: lieu?.lat, lng: lieu?.lng, cp: lieu?.codePostal })
      return
    }
    if (s.isGoogle && s.placeId) {
      onSelect({ label: s.label })
      const det = await fetchPlaceDetails(s.placeId)
      if (det) onSelect({ label: det.label || s.label, lat: det.lat, lng: det.lng, cp: det.codePostal })
      return
    }
    onSelect({ label: s.label, lat: s.lat, lng: s.lng, cp: s.codePostal })
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
        onBlur={handleBlur}
        placeholder={placeholder}
        autoComplete="off"
        style={style}
      />
      {open && sugg.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 500,
          background: 'var(--papier)', border: '1px solid rgba(var(--contraste-rvb),0.12)',
          borderTop: 'none', borderRadius: '0 0 10px 10px',
          boxShadow: '0 8px 24px rgba(var(--ombre-rvb),0.1)', overflow: 'hidden',
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
                background: i === focused ? 'rgba(var(--contraste-rvb),0.04)' : 'var(--papier)',
                border: 'none', cursor: 'pointer', textAlign: 'left',
                borderBottom: i < sugg.length - 1 ? '1px solid rgba(var(--contraste-rvb),0.05)' : 'none',
                fontFamily: "'Plus Jakarta Sans', sans-serif",
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                {getSuggestionIcon(s)}
              </span>
              <div>
                <div style={{ fontSize: 13, fontWeight: s.isLieu ? 500 : 400, color: 'var(--encre)' }}>{s.label}</div>
                {s.sublabel && <div style={{ fontSize: 10, color: 'var(--t2)', marginTop: 1 }}>{s.sublabel}</div>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

type TarifRow  = TarifRow2
type GrilleMin = GrilleCalc

/**
 * Transforme le libellé d'une fiche de `lieux.ts` en adresse prête à servir.
 *
 * Les quatre informations sont RECOPIÉES de la fiche, jamais inventées — ce
 * sont exactement celles que `pick()` enregistre quand le client choisit la
 * suggestion dans la liste (voir plus haut : `onSelect({ label, lat, lng, cp })`
 * dans la branche `s.isLieu`). L'état obtenu est donc le même, au caractère
 * près, que celui d'un choix manuel : même libellé, mêmes coordonnées, même
 * code postal, donc même zone reconnue et même prix.
 *
 * Fournir les quatre ensemble a une conséquence précise : `resoudreAdresse()`
 * rend l'adresse telle quelle dès qu'elle porte `lat` et `cp`, sans appeler le
 * géocodage. Le pré-remplissage n'ajoute donc aucun aller-retour réseau, et ne
 * peut pas retomber sur le prix de secours codé en dur d'`estimerPrixBase()`.
 *
 * Un libellé inconnu rend une adresse vide : le champ reste comme aujourd'hui.
 */
function adresseDepuisFiche(label?: string): BcAddr {
  if (!label) return { label: '' }
  const lieu = LIEUX_CONNUS.find(l => l.label === label)
  if (!lieu) return { label: '' }
  return { label: lieu.label, lat: lieu.lat, lng: lieu.lng, cp: lieu.codePostal }
}

/* `palette` — opt-in, et rien d'autre.
 *
 * La palette A est posée page par page, en commençant par l'accueil
 * (étape 143). Les 38 pages villes appellent ce composant sans la prop :
 * `palette` y vaut `undefined`, la classe n'est pas ajoutée, et pas une
 * couleur ne change chez elles. C'est le seul interrupteur : il n'y a
 * aucune détection de chemin, rien qui puisse se déclencher tout seul. */
export default function VitrineBody({ tarifs: tarifsProp = [], zones: zonesProp = [], grille: grilleProp = [], params: paramsProp = null, heroTitle, lieuDestination, palette }: { tarifs?: TarifRow[]; zones?: ZoneMin[]; grille?: GrilleMin[]; params?: ParamsCalc | null; heroTitle?: string; lieuDestination?: string; palette?: 'a' }) {
  const router   = useRouter()
  const pathname = usePathname()

  /* Prix d'appel des cartes vehicules.
   *
   * Derives de la grille via prixAPartirDe(), qui appelle calculerPrix() — la
   * meme fonction que /reserver et l'admin. Jusqu'au 2026-10-17 ces montants
   * etaient ecrits en dur (65/65/75/95 EUR) et ne correspondaient a aucune
   * ligne de la grille : la berline etait annoncee +36 EUR au-dessus du reel,
   * et la berline premium au MEME prix que la berline, ce qu'un coefficient
   * de 1,5 rend impossible.
   *
   * Aucune requete n'est ajoutee cote navigateur : grille, zones, tarifs et
   * parametres arrivent deja en props depuis le rendu serveur.
   *
   * Un vehicule sans prix calculable n'affiche pas de montant plutot qu'un
   * montant faux. */
  const prixAppel = useMemo(() => {
    const m: Record<string, number | null> = {}
    for (const v of VEH_DISPLAY) {
      if (m[v.cle] === undefined) {
        m[v.cle] = prixAPartirDe(v.cle, BASE_AFFICHAGE_VITRINE, grilleProp, tarifsProp as TarifRow2[], zonesProp, paramsProp)
      }
    }
    return m
  }, [grilleProp, tarifsProp, zonesProp, paramsProp])

  /* ── state ─────────────────────────────────────────────── */
  const [navScrolled,     setNavScrolled]     = useState(false)
  const [menuOpen,        setMenuOpen]         = useState(false)
  const [showFloating,    setShowFloating]     = useState(false)
  const [devisVisible,    setDevisVisible]     = useState(false)
  /* Les trois boutons flottants s'effacent devant le formulaire, mais
     SEULEMENT sous 1 024 px — au-dessus, ils sont dans les coins et ne
     gênent personne. La règle vit dans `vitrine.css` (@media max-width
     1023px, « .call-float.sur-formulaire »). Il faut la connaître ici pour
     savoir quand les sortir de l'ordre de tabulation : un bouton invisible
     qu'on peut encore atteindre au clavier est un arrêt dans le vide, et un
     bouton visible qu'on ne peut plus atteindre est pire. */
  const [etroit,          setEtroit]           = useState(false)
  const [faqOpen,         setFaqOpen]          = useState<number|null>(null)
  const [cookieVisible,   setCookieVisible]    = useState(false)
  const [cookieModalOpen, setCookieModalOpen]  = useState(false)
  /* L'absence de choix n'est pas une acceptation : l'interrupteur part donc
     à l'arrêt, et non à « activé » comme avant l'étape 88. Il est remis à la
     valeur enregistrée dès qu'on sait ce que le visiteur a déjà répondu. */
  const [analyticsOn,     setAnalyticsOn]      = useState(false)
  const [cookieDone,      setCookieDone]       = useState(false)
  const [cookieBannerH,   setCookieBannerH]    = useState(0)
  const cookieBannerRef   = useRef<HTMLDivElement>(null)

  /* exit intent */
  const [exitVisible, setExitVisible] = useState(false)

  /* booking widget */
  const [bcPax,      setBcPax]      = useState(1)
  const [bcEtape,    setBcEtape]    = useState(false)
  const [bcEtapeAddr, setBcEtapeAddr] = useState<BcAddr>({ label: '' })
  const [bcPrice,    setBcPrice]    = useState<number|null>(null)
  const [bcIsKm,     setBcIsKm]     = useState(false)
  const [bcLoading,  setBcLoading]  = useState(false)
  const [bcDepart,   setBcDepart]   = useState<BcAddr>({ label: '' })
  /* La destination est posée à la CRÉATION de l'état, pas par un `useEffect`.
     C'est la garantie qu'aucune saisie ne peut être écrasée : au moment où
     cette valeur existe, le champ n'a pas encore été affiché, le client n'a
     donc rien pu taper. Un effet différé, lui, aurait pu arriver après ses
     premières frappes. Ensuite, l'état vit sa vie normale : le client efface,
     corrige, remplace, et rien ne le remet. */
  const [bcArrivee,  setBcArrivee]  = useState<BcAddr>(() => adresseDepuisFiche(lieuDestination))
  // Trajet renseigné (les deux adresses) — anime la ligne dorée du radar hero
  const hasTrajet = bcDepart.label.length > 2 && bcArrivee.label.length > 2
  const [bcDate,     setBcDate]     = useState('')
  const [bcTime,     setBcTime]     = useState('09:00')

  /* devis form */
  const [step,         setStep]        = useState(1)
  const [pax,          setPaxN]        = useState(1)
  const [allerRetour,  setAllerRetour] = useState(false)
  const [etapeOpen,    setEtapeOpen]   = useState(false)
  const [suppls,       setSuppls]      = useState<Record<string,number>>({})
  // Adresses structurées pour le calcul de prix du devis (même type que bcDepart/bcArrivee)
  const [devisOrig,    setDevisOrig]   = useState<BcAddr>({ label: '' })
  const [desisDest,    setDesisDest]   = useState<BcAddr>({ label: '' })
  const [devisEtape,   setDevisEtape]  = useState<BcAddr>({ label: '' })
  const [devisPrix,    setDevisPrix]   = useState<number | null>(null)
  const [form, setForm] = useState({
    origin:'', dest:'', date:'', time:'09:00', destType:'addr',
    dateRetour:'', heureRetour:'09:00',
    nom:'', tel:'', email:'', societe:'',
  })
  const [submitErr,  setSubmitErr]  = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted,   setSubmitted]  = useState(false)
  const [confirmRef,  setConfirmRef] = useState('')
  const [reserverUrl, setReserverUrl] = useState('')

  /* ── refs ──────────────────────────────────────────────── */
  const cursorRef    = useRef<HTMLDivElement>(null)
  const ringRef      = useRef<HTMLDivElement>(null)
  const mxRef        = useRef(0); const myRef = useRef(0)
  const devisEstTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rxRef        = useRef(0); const ryRef = useRef(0)
  const rafRef       = useRef<number>(0)
  const autoEstTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastEstimRef  = useRef<string>('')

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
      /* Le formulaire de devis est-il à l'écran ?
         Mesuré à l'étape 86 sur un vrai gabarit de téléphone : à 390 px, le
         bouton noir « Réserver maintenant » se posait sur le champ « heure de
         prise en charge » et le clic n'atteignait plus le champ du tout.
         Aucun élément en position fixe ne peut promettre de ne rien recouvrir ;
         la seule garantie est de s'effacer tant que le formulaire est visible.
         Le CSS ne retient cette règle que sous 640 px : sur ordinateur les
         boutons sont dans les coins et aucun clic n'est bloqué. */
      const d = document.getElementById('devis')
      setDevisVisible(!!d && (() => {
        const r = d.getBoundingClientRect()
        return r.top < window.innerHeight && r.bottom > 0
      })())
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  /* ── hauteur bandeau cookies : évite que les boutons flottants (Appeler,
     WhatsApp, Réserver) se retrouvent masqués derrière le bandeau ── */
  useEffect(() => {
    if (!cookieVisible) return
    const measure = () => setCookieBannerH(cookieBannerRef.current?.offsetHeight || 0)
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [cookieVisible])
  // Valeur effective : 0 tant que le bandeau n'est pas visible, même si une
  // mesure précédente est restée en mémoire.
  const cookieOffset = cookieVisible ? cookieBannerH : 0

  /* ── les boutons flottants et le clavier ────────────────────
     Ils valent `opacity:0` dans deux cas : avant d'être apparus, et —
     sous 1 024 px seulement — quand le formulaire de devis est à l'écran.
     Dans ces deux cas ils doivent quitter l'ordre de tabulation.
     Au premier rendu, `showFloating` et `etroit` valent tous deux `false`
     des deux côtés : le serveur et le navigateur rendent donc le même
     `inert`, et l'hydratation ne signale rien. */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)')
    const maj = () => setEtroit(mq.matches)
    maj()
    mq.addEventListener('change', maj)
    return () => mq.removeEventListener('change', maj)
  }, [])
  const flottantsInertes = !showFloating || (devisVisible && etroit)

  const bcTarifs = tarifsProp

  /* ── cookie banner ──────────────────────────────────────── */
  useEffect(() => {
    const consent = lireConsentement()
    if (consent === null) {
      // Re-vérifier au déclenchement du timer (pas seulement au montage) : la
      // bannière globale (CookieBanner.tsx, montée dans layout.tsx) peut avoir
      // déjà obtenu une réponse entre-temps — sans ça, une deuxième bannière
      // s'affichait même après que l'utilisateur ait déjà répondu à la première.
      const t = setTimeout(() => {
        if (lireConsentement() === null) setCookieVisible(true)
        else setCookieDone(true)
      }, 2500)
      return () => clearTimeout(t)
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCookieDone(true)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAnalyticsOn(consent === 'accepted')
      if (consent === 'accepted') { initFbPixel(); initGA() }
    }
  }, [])

  /* Revenir sur son choix. Le lien « Gérer mes cookies » du pied de page, et
     le même lien sur la page Mentions légales, émettent cet événement.
     Avant l'étape 88, une fois la bannière refermée, plus rien ne permettait
     de rouvrir le panneau de préférences. */
  useEffect(() => {
    const ouvrir = () => {
      setAnalyticsOn(lireConsentement() === 'accepted')
      setCookieModalOpen(true)
    }
    window.addEventListener(EVENEMENT_OUVRIR_PANNEAU, ouvrir)
    return () => window.removeEventListener(EVENEMENT_OUVRIR_PANNEAU, ouvrir)
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

    /* ── Le compteur et « réduire les animations » ──────────────────────
       Les chiffres montent de 0 à leur valeur en deux secondes. C'est du
       mouvement, et il ignorait la préférence : elle est désormais lue aux
       TROIS endroits où une décision se prend — à l'entrée à l'écran, au
       démarrage différé de chaque chiffre, et à chaque image de
       l'animation.

       Lue EN DIRECT, et non capturée au montage. Deux raisons :
         · si la préférence change pendant que la page est ouverte, le
           chiffre en cours s'achève à l'image suivante, soit en moins de
           20 ms, au lieu de continuer à monter ;
         · aucun écouteur n'est ajouté, donc aucun ne peut fuir. C'est la
           réponse la plus simple à la question posée, et la seule qui ne
           crée pas le problème qu'elle devrait éviter.

       Une seule écriture de la valeur finale, `valeurFinale()`, employée
       par les quatre chemins qui la posent. Le piège de cette correction
       est connu : supprimer l'animation SANS écrire la valeur laisserait
       les chiffres à zéro, ce qui serait pire que le mouvement. */
    const mouvementReduit = () =>
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const valeurFinale = (el: HTMLElement) => {
      const cible = parseFloat(el.dataset.target || '0')
      return (el.dataset.float === '1' ? cible.toFixed(1) : String(cible)) + (el.dataset.suffix || '')
    }

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
          /* 1. La préférence est posée : la valeur finale, tout de suite. */
          if (mouvementReduit()) { el.textContent = valeurFinale(el); return }
          const delay   = idx * 120
          const dur     = 2000
          setTimeout(() => {
            /* 2. Elle a pu être posée pendant le délai d'attente. */
            if (mouvementReduit()) { el.textContent = valeurFinale(el); return }
            const start = performance.now()
            const tick = (now: number) => {
              /* 3. Ou pendant l'animation elle-même. */
              if (mouvementReduit()) { el.textContent = valeurFinale(el); return }
              const p    = Math.min((now - start) / dur, 1)
              // ease out quart — démarre vite, ralentit à la fin
              const ease = 1 - Math.pow(1 - p, 4)
              const v    = target * ease
              el.textContent = (isFloat ? v.toFixed(1) : Math.round(v)) + suffix
              if (p < 1) requestAnimationFrame(tick)
              else el.textContent = valeurFinale(el)
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
      let prixFinal: number
      let isKmFinal: boolean

      if (bcEtape && bcEtapeAddr.label.trim().length >= 3) {
        const result = await estimerAvecEtapes(bcDepart, [bcEtapeAddr], bcArrivee, bcPax, bcDate, bcTime)
        prixFinal = result.prix
        isKmFinal = result.isKm
      } else {
        // Étape ouverte mais adresse pas encore saisie : on ne peut pas mesurer
        // le détour, on n'annonce donc que le trajet direct. Le prix se remet à
        // jour dès que l'adresse de l'étape est renseignée.
        const result = await bcEstimate()
        prixFinal = result.prix
        isKmFinal = result.isKm
      }

      setBcPrice(prixFinal)
      setBcIsKm(isKmFinal)
      setBcLoading(false)
      const dep = bcDepart.label.trim()
      const arr = bcArrivee.label.trim()
      const vh  = NOM_VERS_CLE[getVehicle(bcPax).name] ?? 'berline'
      const key = `${dep}|${arr}|${vh}`
      const depResolved = bcDepart.lat != null || !!bcDepart.cp
      const arrResolved = bcArrivee.lat != null || !!bcArrivee.cp
      if (prixFinal > 0 && depResolved && arrResolved && key !== lastEstimRef.current) {
        lastEstimRef.current = key
        logFunnel('hero_widget_price_shown', { prix: prixFinal })
        /* Ce qui part en statistique n'est pas l'adresse tapée : seulement la
           zone tarifaire reconnue et la commune. Le numéro et la rue ne
           servent à aucune mesure et c'est eux qui rendent la ligne
           identifiante. `key` ci-dessus garde les libellés complets, mais il
           ne quitte jamais le navigateur : il ne sert qu'à ne pas enregistrer
           deux fois la même estimation. */
        const zDep = detectZone(bcDepart.cp ?? '', zonesProp, bcDepart.label)
        const zArr = detectZone(bcArrivee.cp ?? '', zonesProp, bcArrivee.label)
        fetch('/api/estimations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            adresse_depart:  lieuPourStatistique(dep, bcDepart.cp, zDep?.code),
            adresse_arrivee: lieuPourStatistique(arr, bcArrivee.cp, zArr?.code),
            vehicule:        vh,
            prix:            prixFinal,
            source:          'vitrine',
          }),
        }).catch(() => {})
      }
    }, 900)
    return () => { if (autoEstTimer.current) clearTimeout(autoEstTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // `bcEtapeAddr.label` fait partie des déclencheurs : sans lui, une adresse
  // d'étape tapée au clavier sans choisir de suggestion laissait le prix figé
  // sur le trajet sans étape.
  }, [bcDepart.label, bcArrivee.label, bcPax, bcTime, bcEtape, bcEtapeAddr.label, bcEtapeAddr.cp, bcEtapeAddr.lat])

  /* ── Estimation devis — même logique que le widget ──────── */
  useEffect(() => {
    const dep = devisOrig.label.trim()
    const arr = desisDest.label.trim()
    if (dep.length < 3 || arr.length < 3) { setDevisPrix(null); return }
    if (devisEstTimer.current) clearTimeout(devisEstTimer.current)
    devisEstTimer.current = setTimeout(async () => {
      const result = await estimerAvecEtapes(
        devisOrig, etapeOpen ? [devisEtape] : [], desisDest, pax, form.date, form.time,
      )
      const suppTotal = Object.values(suppls).reduce((a, b) => a + b, 0)
      setDevisPrix(Math.round(result.prix + suppTotal))
    }, 600)
    return () => { if (devisEstTimer.current) clearTimeout(devisEstTimer.current) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devisOrig.label, desisDest.label, pax, form.date, form.time, suppls, etapeOpen, devisEtape.label, devisEtape.cp, devisEtape.lat])

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

  // Source unique pour le calcul de prix — utilisée par le widget ET le devis
  async function estimerPrixBase(dep: BcAddr, arr: BcAddr, paxN: number, date: string, time: string): Promise<{ prix: number; isKm: boolean }> {
    const v     = getVehicle(paxN)
    const tarif = bcTarifs.find(t => t.vehicule === v.name)

    const realDate = date ? `${date}T${time || '09:00'}` : ''

    if (tarif && dep.label && arr.label) {
      const [depGc, arrGc] = await Promise.all([resoudreAdresse(dep), resoudreAdresse(arr)])
      const zoneDep = detectZone(depGc.cp ?? '', zonesProp, depGc.label)
      const zoneArr = detectZone(arrGc.cp ?? '', zonesProp, arrGc.label)

      if (zoneDep && zoneArr) {
        const cle = NOM_VERS_CLE[v.name] ?? 'berline'
        const px  = calculerPrix(zoneDep.id, zoneArr.id, cle, realDate, grilleProp, tarifsProp, zonesProp, paramsProp)
        if (px !== null) return { prix: Math.round(px), isKm: false }
      }

      if (depGc.lat && depGc.lng && arrGc.lat && arrGc.lng) {
        const distKm = await fetchGoogleDist(depGc, arrGc)
        if (distKm !== null) {
          const cle = NOM_VERS_CLE[v.name] ?? 'berline'
          const px = calculerPrixKm(distKm, cle, realDate, tarifsProp, paramsProp)
          if (px !== null) return { prix: Math.round(px), isKm: true }
        }
      }
    }

    const destL = arr.label.toLowerCase()
    const depL  = dep.label.toLowerCase()
    let base = v.base
    if (/aéroport|cdg|orly|roissy|beauvais/i.test(destL) || /aéroport|cdg|orly|roissy|beauvais/i.test(depL)) base += 25
    else if (/gare|nord|lyon|montparnasse|saint-lazare/i.test(destL)) base += 12
    return { prix: Math.round(base), isKm: false }
  }

  async function bcEstimate(): Promise<{ prix: number; isKm: boolean }> {
    return estimerPrixBase(bcDepart, bcArrivee, bcPax, bcDate, bcTime)
  }

  /**
   * Prix d'un trajet comportant une ou plusieurs étapes.
   *
   * On mesure le trajet direct et chaque tronçon par la route, puis on laisse
   * calcPrix.ts appliquer la règle (détour + frais par étape). Le tarif d'une
   * étape n'est défini qu'à cet endroit-là, jamais ici.
   */
  async function estimerAvecEtapes(
    dep: BcAddr, etapes: BcAddr[], arr: BcAddr, paxN: number, date: string, time: string,
  ): Promise<{ prix: number; isKm: boolean }> {
    const retenues = etapes.filter(e => e.label.trim().length >= 3)
    if (retenues.length === 0) return estimerPrixBase(dep, arr, paxN, date, time)

    const direct   = await estimerPrixBase(dep, arr, paxN, date, time)
    const realDate = date ? `${date}T${time || '09:00'}` : ''
    const cle      = NOM_VERS_CLE[getVehicle(paxN).name] ?? 'berline'

    const points = await Promise.all([dep, ...retenues, arr].map(resoudreAdresse))
    const troncons = await Promise.all(
      points.slice(0, -1).map((p, i) => fetchGoogleDist(p, points[i + 1])),
    )
    const distDirecte = await fetchGoogleDist(points[0], points[points.length - 1])

    // Une distance manquante rend le détour immesurable : on facture alors le
    // trajet direct plus les frais d'étape, jamais moins que sans étape.
    if (distDirecte === null || troncons.some(d => d === null)) {
      return {
        prix: calculerPrixEtapes(direct.prix, 0, retenues.map(() => 0).concat(0), cle, realDate, bcTarifs, paramsProp),
        isKm: direct.isKm,
      }
    }

    return {
      prix: calculerPrixEtapes(direct.prix, distDirecte, troncons as number[], cle, realDate, bcTarifs, paramsProp),
      isKm: direct.isKm,
    }
  }

  // Construit l'URL /reserver avec toutes les infos déjà saisies, pour que
  // le parcours direct (paiement) et le parcours rappel partagent la même
  // logique de pré-remplissage — pas de seconde implémentation qui diverge.
  function buildReserverUrl() {
    const params = new URLSearchParams()
    if (form.origin)  params.set('depart',  form.origin)
    if (form.dest)    params.set('arrivee', form.dest)
    // L'arrêt suit jusqu'au paiement, sinon le client paierait le trajet direct.
    if (etapeOpen && devisEtape.label.trim()) params.set('etape', devisEtape.label.trim())
    if (form.date)    params.set('date',    form.date)
    if (form.time)    params.set('time',    form.time)
    params.set('pax',   String(pax))
    if (form.nom)     params.set('nom',     form.nom)
    if (form.tel)     params.set('tel',     form.tel)
    if (form.email)   params.set('email',   form.email)
    // Reporter gclid/UTM de la page d'atterrissage vers /reserver,
    // sinon l'origine publicitaire du clic est perdue avant paiement.
    const currentParams = new URLSearchParams(window.location.search)
    for (const key of ['gclid','utm_source','utm_campaign','utm_content','utm_medium']) {
      const v = currentParams.get(key)
      if (v) params.set(key, v)
    }
    return '/reserver?' + params.toString()
  }

  // Chemin direct : paiement immédiat, sans passer par la demande de rappel.
  function goToReserver() {
    logFunnel('devis_cta_payer_click', { pax, price: devisPrix })
    router.push(buildReserverUrl())
  }

  async function submitDevis() {
    logFunnel('devis_cta_rappel_click', { pax, price: devisPrix })
    if (!form.nom.trim() || !form.tel.trim() || !form.email.trim()) {
      setSubmitErr('Veuillez renseigner votre nom, téléphone et e-mail.')
      logFunnel('devis_rappel_validation_error')
      return
    }
    setSubmitErr('')
    setSubmitting(true)
    const v       = getVehicle(pax)
    const price   = devisPrix
    const ref     = 'OW-' + Date.now().toString(36).toUpperCase()
    // La table `devis` n'a pas de colonne pour les étapes : l'adresse voyage
    // avec les suppléments, pour que l'admin la voie dans la demande.
    const etapeSaisie = etapeOpen ? devisEtape.label.trim() : ''
    const supList = [...Object.keys(suppls), ...(etapeSaisie ? [`Étape : ${etapeSaisie}`] : [])]

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
      fbContact()
      fbLead({ value: price ?? undefined, currency: 'EUR', content_category: 'VTC' })
      gtagEvent('generate_lead', { value: price ?? undefined, currency: 'EUR' })
      logFunnel('devis_rappel_submitted', { price })
      setReserverUrl(buildReserverUrl())
      setConfirmRef(ref)
      setStep(4)
      setSubmitted(true)
    } catch {
      setSubmitErr('Erreur lors de l\'envoi. Réessayez ou contactez-nous par WhatsApp.')
      logFunnel('devis_rappel_submit_error')
    } finally {
      setSubmitting(false)
    }
  }

  function resetDevis() {
    setStep(1); setSubmitted(false); setConfirmRef('')
    setForm({ origin:'', dest:'', date:'', time:'09:00', destType:'addr', dateRetour:'', heureRetour:'09:00', nom:'', tel:'', email:'', societe:'' })
    setDevisOrig({ label: '' }); setDesisDest({ label: '' }); setDevisPrix(null)
    setPaxN(1); setSuppls({}); setEtapeOpen(false); setAllerRetour(false)
  }

  /* « Accepter » du bandeau = tout accepter. */
  function acceptCookie() {
    ecrireConsentement('accepted')
    setAnalyticsOn(true)
    setCookieVisible(false); setCookieDone(true)
    initFbPixel(); initGA()
  }
  /* « Refuser » du bandeau = tout refuser. `ecrireConsentement` lève le
     drapeau ga-disable-<ID> et efface les cookies de mesure déjà déposés :
     refuser après avoir accepté arrête réellement le suivi, sans
     rechargement. */
  function refuseCookie() {
    ecrireConsentement('refused')
    setAnalyticsOn(false)
    setCookieVisible(false); setCookieDone(true)
  }
  /* « Enregistrer » du panneau de préférences. Avant l'étape 88, ce bouton
     appelait acceptCookie() quelle que soit la position de l'interrupteur :
     il était impossible de refuser depuis le panneau. */
  function enregistrerPreferences() {
    if (analyticsOn) acceptCookie()
    else refuseCookie()
    setCookieModalOpen(false)
  }

  /* Descendre jusqu'au formulaire de devis.
     Un seul `scrollIntoView` ne suffit pas : la page fait 13 135 px et son
     contenu se charge au fur et a mesure de la descente, si bien que la
     position visee est perimee avant d'etre atteinte. Mesure sur la
     previsualisation : le clic partait de 2 739 px, s'arretait a 3 604, et
     laissait #devis 6 376 px plus bas. Le defilement manuel depuis le haut
     de la page echouait pareillement.
     On recale donc jusqu'a quatre fois, a 220 ms d'intervalle, et on
     s'arrete des que la section est en haut de l'ecran. Le compteur borne
     la boucle : elle ne peut pas tourner indefiniment si la page continue
     de bouger. */
  function allerAuDevis() {
    let essais = 0
    const viser = () => {
      const el = document.getElementById('devis')
      if (!el) return
      const haut = el.getBoundingClientRect().top
      if (Math.abs(haut) < 80 || essais >= 4) return
      essais++
      window.scrollBy({ top: haut, behavior: 'auto' })
      setTimeout(viser, 220)
    }
    viser()
  }

  const currentEst = devisPrix
  const currentVeh = getVehicle(pax)
  /* Même source que les cartes véhicules : NOM_VERS_CLE fait correspondre le
     nom affiché à la clé tarifaire ('Grand Van' → 'van'). */
  const currentVehPrix = prixAppel[NOM_VERS_CLE[currentVeh.name] ?? 'berline']

  /* ── JSX ─────────────────────────────────────────────────── */
  return (
    <div className={palette === 'a' ? 'vt vt-palette-a' : 'vt'}>
      {/* custom cursor */}
      <div className="cursor" ref={cursorRef} />
      <div className="cursor-ring" ref={ringRef} />

      {/* ── Exit intent popup ────────────────────────────────── */}
      {exitVisible && (
        <div style={{
          position:'fixed',inset:0,zIndex:9000,
          background:'rgba(var(--nuit-rvb),0.75)',backdropFilter:'blur(8px)',
          display:'flex',alignItems:'center',justifyContent:'center',
          padding:'20px',
          animation:'fadeIn .3s ease',
        }} onClick={()=>setExitVisible(false)}>
          <div onClick={e=>e.stopPropagation()} style={{
            background:'var(--nuit-modale)',border:'1px solid rgba(var(--or-rvb),0.2)',
            borderRadius:20,padding:'40px 36px',maxWidth:440,width:'100%',
            boxShadow:'0 40px 100px rgba(var(--ombre-rvb),0.6)',
            position:'relative',textAlign:'center',
          }}>
            <button onClick={()=>setExitVisible(false)} style={{
              position:'absolute',top:14,right:14,width:28,height:28,
              borderRadius:8,background:'rgba(var(--sur-fonce-rvb),0.06)',border:'none',
              color:'rgba(var(--ivoire-rvb),0.5)',cursor:'pointer',fontSize:16,
              display:'flex',alignItems:'center',justifyContent:'center',
            }}>✕</button>

            {/* Badge */}
            <div style={{
              display:'inline-flex',alignItems:'center',gap:6,
              background:'rgba(var(--or-rvb),0.1)',border:'1px solid rgba(var(--or-rvb),0.25)',
              borderRadius:20,padding:'5px 14px',fontSize:10,color:'var(--gold)',
              letterSpacing:'.1em',textTransform:'uppercase',marginBottom:20,
            }}>
              <span style={{width:5,height:5,borderRadius:'50%',background:'var(--gold)',flexShrink:0}}/>
              Offre exclusive
            </div>

            <h3 style={{
              fontFamily:"'Cormorant Garamond',serif",fontSize:32,fontWeight:500,
              color:'var(--ivoire)',lineHeight:1.1,marginBottom:12,
            }}>
              Avant de partir…
            </h3>
            <p style={{fontSize:13,color:'rgba(var(--ivoire-rvb),0.6)',lineHeight:1.7,marginBottom:28}}>
              Obtenez votre tarif en 30 secondes.<br/>
              Notre équipe vous répond <strong style={{color:'var(--ivoire)'}}>immédiatement sur WhatsApp</strong> pour tout trajet Paris · IDF · Oise.
            </p>

            {/* CTA WhatsApp */}
            <a
              href="https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20un%20devis%20VTC"
              target="_blank" rel="noopener"
              onClick={()=>setExitVisible(false)}
              style={{
                display:'flex',alignItems:'center',justifyContent:'center',gap:10,
                background:'var(--marque-whatsapp)',color:'var(--sur-marque)',borderRadius:12,
                padding:'14px 24px',fontSize:14,fontWeight:700,
                textDecoration:'none',marginBottom:12,
                transition:'transform .15s,box-shadow .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-2px)';e.currentTarget.style.boxShadow='0 8px 24px rgba(var(--marque-whatsapp-rvb),0.35)'}}
              onMouseLeave={e=>{e.currentTarget.style.transform='';e.currentTarget.style.boxShadow=''}}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg>
              Demander un devis sur WhatsApp
            </a>

            {/* Ou réserver directement */}
            <button
              onClick={()=>{ setExitVisible(false); document.querySelector('.hero-booking-wrap')?.scrollIntoView({behavior:'smooth'}) }}
              style={{
                background:'none',border:'1px solid rgba(var(--or-rvb),0.2)',
                borderRadius:10,padding:'11px 20px',color:'rgba(var(--ivoire-rvb),0.6)',
                fontSize:12,cursor:'pointer',width:'100%',
                transition:'border-color .15s,color .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.borderColor='rgba(var(--or-rvb),0.5)';e.currentTarget.style.color='var(--gold)'}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor='rgba(var(--or-rvb),0.2)';e.currentTarget.style.color='rgba(var(--ivoire-rvb),0.6)'}}
            >
              Voir les tarifs →
            </button>

            <p style={{fontSize:10,color:'rgba(var(--ivoire-rvb),0.25)',marginTop:16,letterSpacing:'.04em'}}>
              Disponible 24h/24 · Tarif fixe garanti · Sans engagement
            </p>
          </div>
        </div>
      )}

      {/* scroll progress */}
      <div className="scroll-progress" id="scrollProgress" />

      {/* mobile menu
          `inert` tant qu'il est fermé : sans lui, ses six liens, son bouton
          « Espace client » et ses trois liens sociaux restent dans l'ordre
          de tabulation alors que le menu est à `opacity:0`. Mesuré à
          l'étape 120 : 40 arrêts du clavier dans le vide, sur les quatre
          gabarits, y compris sur ordinateur où le menu n'existe pas.
          `inert` et non `aria-hidden` : `aria-hidden` sur un conteneur qui
          garde des éléments focalisables est une faute — le lecteur
          d'écran les tait, mais le clavier continue de s'y arrêter. */}
      <div className={`mobile-menu${menuOpen ? ' open' : ''}`} inert={!menuOpen}>
        <div className="mm-links">
          {['#vehicules','#tarifs','#comment','#zones','#faq','#contact'].map((h,i) => (
            <a key={i} href={h} className="mm-link" onClick={()=>setMenuOpen(false)}>
              {h==='#vehicules'?'Véhicules':h==='#tarifs'?'Tarifs':h==='#comment'?'Comment ça marche':h==='#zones'?'Zones':h==='#faq'?'FAQ':'Contact'}
            </a>
          ))}
        </div>
        <Link href="/espace-client" className="mm-cta" onClick={()=>setMenuOpen(false)}>Espace client</Link>
        <div className="mm-sub">Chauffeur privé VTC · Paris & Oise</div>
        <div style={{display:'flex',gap:12,marginTop:28}}>
          <a href="https://www.facebook.com/Owise.vtc" className="fs-link" style={{width:44,height:44,borderRadius:12}} target="_blank" rel="noopener" aria-label="Facebook">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg>
          </a>
          <a href="https://www.tiktok.com/@owise857" className="fs-link" style={{width:44,height:44,borderRadius:12}} target="_blank" rel="noopener" aria-label="TikTok">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/></svg>
          </a>
          <a href="https://wa.me/33619106356" className="fs-link fs-wa" style={{width:44,height:44,borderRadius:12}} target="_blank" rel="noopener" aria-label="WhatsApp">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg>
          </a>
        </div>
      </div>

      {/* Call float */}
      <div className={`call-float${showFloating?' show':''}${devisVisible?' sur-formulaire':''}`} inert={flottantsInertes} style={{ '--ow-cb': `${cookieOffset}px` } as CSSProperties}>
        <a href="tel:+33619106356" className="call-btn" aria-label="Appeler Owise">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.362 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          <span className="fb-txt">Appeler</span>
        </a>
      </div>

      {/* WhatsApp float */}
      <div className={`wa-float${showFloating?' show':''}${devisVisible?' sur-formulaire':''}`} inert={flottantsInertes} style={{ '--ow-cb': `${cookieOffset}px` } as CSSProperties}>
        <a href="https://wa.me/33619106356" className="wa-btn" target="_blank" rel="noopener" aria-label="WhatsApp" style={{position:'relative'}}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.118 1.524 5.847L.053 23.693a.5.5 0 00.612.67l5.988-1.568A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.6a9.6 9.6 0 01-4.975-1.381l-.354-.21-3.684.964.984-3.59-.23-.37A9.6 9.6 0 1112 21.6z"/></svg>
          <span className="fb-txt">WhatsApp</span>
          <span className="wa-pulse" />
        </a>
      </div>

      {/* Floating CTA */}
      <div className={`float-cta${showFloating?' show':''}${devisVisible?' sur-formulaire':''}`} inert={flottantsInertes} style={{ '--ow-cb': `${cookieOffset}px` } as CSSProperties}>
        <a href="#devis" className="float-cta-btn" onClick={e=>{e.preventDefault();scrollTo('#devis')}}>
          <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
          <span className="fb-txt">Réserver maintenant</span>
        </a>
      </div>

      {/* NAV */}
      <nav className={`${navScrolled ? 'scrolled' : ''}${heroTitle ? ' nav-with-bar' : ''}`}>
        <Link
          href="/"
          className="nav-logo"
          style={{textDecoration:'none'}}
          onClick={e=>{
            // Sur la home, un Link vers "/" ne fait rien (route déjà active) — le clic
            // paraît cassé pour qui a scrollé loin. On remonte en haut à la place.
            if (pathname === '/') { e.preventDefault(); window.scrollTo({top:0, behavior:'smooth'}) }
          }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" style={{fill:'var(--nuit)'}}/>
            <circle cx="18" cy="18" r="10" style={{stroke:'rgba(var(--sur-fonce-rvb),0.88)'}} strokeWidth="1.8" fill="none"/>
            <path d="M18 8 A10 10 0 0 1 28 18" style={{stroke:'var(--gold)'}} strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <circle cx="18" cy="18" r="2.2" style={{fill:'var(--gold)'}}/>
          </svg>
          <div className="nav-divider" />
          <div className="nav-name-wrap">
            <span className="nav-name">OWISE</span>
            <span className="nav-sub">Chauffeur privé VTC</span>
          </div>
        </Link>
        <div className="nav-links">
          {[['#vehicules','Véhicules'],['#tarifs','Tarifs'],['#comment','Comment ça marche'],['#zones','Zones'],['#faq','FAQ'],['#contact','Contact']].map(([h,l])=>(
            <a key={h} href={h} className="nav-link" onClick={e=>{e.preventDefault();scrollTo(h)}}>{l}</a>
          ))}
          <Link href="/blog" className="nav-link">Blog</Link>
        </div>
        <div className="nav-r">
          <Link href="/espace-client" className="nav-ghost">Espace client</Link>
          <button className="nav-cta" onClick={()=>scrollTo('#devis')}>Obtenir un devis</button>
        </div>
        <button className={`nav-hamburger${menuOpen?' open':''}`} onClick={()=>setMenuOpen(v=>!v)} aria-label="Menu">
          <span/><span/><span/>
        </button>
      </nav>

      {/* HERO */}
      <section className={`hero${heroTitle ? ' hero-with-bar' : ''}`} id="hero">
        <div className="hero-bg">
          <div className="hero-photo-overlay"/>
          <div className="hero-vignette"/>
          <span className="orb orb-1"/>
          <span className="orb orb-2"/>
          <span className="orb orb-3"/>
          <div className="hero-rings">
            <svg width="700" height="700" viewBox="0 0 700 700" fill="none">
              <circle cx="350" cy="350" r="340" style={{stroke:'rgba(var(--decor-bleu-rvb),0.1)'}} strokeWidth="1"/>
              <circle cx="350" cy="350" r="300" style={{stroke:'rgba(var(--decor-turquoise-rvb),0.12)'}} strokeWidth="1" strokeDasharray="5 9"/>
              <circle cx="350" cy="350" r="255" style={{stroke:'rgba(var(--decor-bleu-rvb),0.14)'}} strokeWidth="1.5"/>
              <circle cx="350" cy="350" r="208" style={{stroke:'rgba(var(--decor-violet-rvb),0.1)'}} strokeWidth="1" strokeDasharray="3 7"/>
              <circle cx="350" cy="350" r="160" style={{stroke:'rgba(var(--decor-turquoise-rvb),0.16)'}} strokeWidth="1.5"/>
              <circle cx="350" cy="350" r="110" style={{stroke:'rgba(var(--or-rvb),0.13)'}} strokeWidth="1" strokeDasharray="2 5"/>
              <circle cx="350" cy="350" r="62" style={{stroke:'rgba(var(--or-rvb),0.2)'}} strokeWidth="2"/>
              <circle cx="350" cy="350" r="24" style={{stroke:'rgba(var(--or-rvb),0.26)'}} strokeWidth="1.5"/>
              <line x1="350" y1="6" x2="350" y2="36" style={{stroke:'rgba(var(--decor-turquoise-rvb),0.22)'}} strokeWidth="1.5"/>
              <line x1="350" y1="664" x2="350" y2="694" style={{stroke:'rgba(var(--decor-turquoise-rvb),0.22)'}} strokeWidth="1.5"/>
              <line x1="6" y1="350" x2="36" y2="350" style={{stroke:'rgba(var(--decor-turquoise-rvb),0.22)'}} strokeWidth="1.5"/>
              <line x1="664" y1="350" x2="694" y2="350" style={{stroke:'rgba(var(--decor-turquoise-rvb),0.22)'}} strokeWidth="1.5"/>
              <line x1="100" y1="100" x2="118" y2="118" style={{stroke:'rgba(var(--or-rvb),0.18)'}} strokeWidth="1.2"/>
              <line x1="600" y1="100" x2="582" y2="118" style={{stroke:'rgba(var(--or-rvb),0.18)'}} strokeWidth="1.2"/>
              <line x1="100" y1="600" x2="118" y2="582" style={{stroke:'rgba(var(--or-rvb),0.18)'}} strokeWidth="1.2"/>
              <line x1="600" y1="600" x2="582" y2="582" style={{stroke:'rgba(var(--or-rvb),0.18)'}} strokeWidth="1.2"/>
              {/* Trajet en direct : ligne dorée qui se dessine dès que départ + arrivée
                  sont renseignés, avant même l'affichage du prix — décor stylisé sur le
                  radar existant, pas une carte géographique réelle. */}
              <g className={`hero-route${hasTrajet ? ' active' : ''}`}>
                <circle cx="350" cy="350" r="5" style={{fill:'var(--gold)'}}/>
                <path className="hero-route-path" d="M350 350 C 430 300, 490 230, 540 165" fill="none" style={{stroke:'var(--gold)'}} strokeWidth="1.6" strokeLinecap="round"/>
                <circle className="hero-route-end" cx="540" cy="165" r="5" style={{fill:'var(--gold)'}}/>
              </g>
            </svg>
          </div>
        </div>

        <div className="hero-center">
          <div className="hero-live-badge">
            <span className="live-dot"/>
            Disponible maintenant · Paris, Île-de-France &amp; Oise
          </div>
          <h1 className="hero-headline">
            {heroTitle ? heroTitle : (
              <>Votre chauffeur privé,<br/>
              <em className="hero-em">où vous le souhaitez.</em></>
            )}
          </h1>
          <div className="hero-booking-wrap">
            <div className="booking-card">
              <div className="bc-header">
                <span className="bc-title">Estimation rapide</span>
                <span className="bc-badge">{bcIsKm && bcPrice !== null ? 'Tarif au km' : 'Tarif fixe garanti'}</span>
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
                      <span className="binput-dot" style={{width:7,height:7,background:'var(--ambre-vif)',border:'none',boxShadow:'0 0 5px rgba(var(--ambre-vif-rvb),0.4)'}}/>
                      <VtAddressInput className="binput" placeholder="Étape intermédiaire…" value={bcEtapeAddr.label} onSelect={setBcEtapeAddr}/>
                    </div>
                  )}
                  <div className="binput-row">
                    <span className="binput-dot e"/>
                    <VtAddressInput className="binput" placeholder="Destination, aéroport, gare…" value={bcArrivee.label} onSelect={setBcArrivee}/>
                  </div>
                </div>
                <button onClick={()=>{setBcEtape(v=>!v);setBcEtapeAddr({label:''})}} style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11,color:'var(--t2)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',padding:'2px 0 6px',transition:'color .15s'}}>
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
                  <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',background:'rgba(var(--or-rvb),0.06)',borderRadius:10,border:'1px solid rgba(var(--or-rvb),0.15)'}}>
                    <svg style={{animation:'spin 1s linear infinite',flexShrink:0,stroke:'var(--gold)'}} width="14" height="14" fill="none" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
                    <span style={{fontSize:12,color:'var(--gold)',fontWeight:500}}>Calcul du tarif en cours…</span>
                  </div>
                )}
                {!bcLoading && bcPrice === null && bcDepart.label.length < 3 && (
                  <div style={{fontSize:11,color:'var(--t2)',textAlign:'center',padding:'8px 0',letterSpacing:'.04em'}}>
                    Saisissez vos adresses pour voir le prix instantanément
                  </div>
                )}
                {bcPrice !== null && (
                  <div className="bc-price show">
                    <div className="bc-price-label">{bcIsKm ? 'Estimation TTC' : 'Tarif fixe TTC'}</div>
                    <div className="bc-price-amount"><sup className="chrome-gold-static">€</sup><span className="chrome-gold-static">{bcPrice}</span></div>
                    <div className="bc-price-sub">{getVehicle(bcPax).name} · {bcIsKm ? 'Tarif au km · Prix estimé' : 'Tarif fixe · Prix garanti'}</div>
                  </div>
                )}
                <button className="btn-book" onClick={()=>{
                  logFunnel('hero_widget_confirm_click', { prix: bcPrice })
                  const p = new URLSearchParams()
                  if (bcDepart.label)  p.set('depart',  bcDepart.label)
                  if (bcArrivee.label) p.set('arrivee', bcArrivee.label)
                  // Sans ce report, l'arrêt disparaissait entre l'estimation et
                  // le paiement : le client voyait le prix avec étape et payait
                  // celui du trajet direct.
                  if (bcEtape && bcEtapeAddr.label.trim()) p.set('etape', bcEtapeAddr.label.trim())
                  if (bcDate)    p.set('date',    bcDate)
                  if (bcTime)    p.set('time',    bcTime)
                  p.set('pax', String(bcPax))
                  // Reporter gclid/UTM de la page d'atterrissage vers /reserver,
                  // sinon l'origine publicitaire du clic est perdue avant paiement.
                  const current = new URLSearchParams(window.location.search)
                  for (const key of ['gclid','utm_source','utm_campaign','utm_content','utm_medium']) {
                    const v = current.get(key)
                    if (v) p.set(key, v)
                  }
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
                  <span style={{fontSize:10,color:'var(--t2)'}}>✓ Annulation gratuite avant attribution</span>
                </div>
                {bcPrice !== null && (
                  <button onClick={async()=>{
                    setBcLoading(true);setBcPrice(null);
                    const r = await estimerAvecEtapes(bcDepart, bcEtape ? [bcEtapeAddr] : [], bcArrivee, bcPax, bcDate, bcTime);
                    setBcPrice(r.prix);setBcIsKm(r.isKm);
                    setBcLoading(false);
                  }} style={{fontSize:10,color:'var(--t3)',background:'none',border:'none',cursor:'pointer',textAlign:'center',width:'100%',marginTop:2}}>
                    ↺ Recalculer
                  </button>
                )}
                <button onClick={()=>scrollTo('#devis')} style={{fontSize:11,color:'var(--gold)',background:'none',border:'none',cursor:'pointer',textAlign:'center',width:'100%',marginTop:8,padding:'8px 0',borderTop:'1px solid var(--gold-border)',fontFamily:'inherit'}}>
                  Pas encore prêt à réserver ? Demandez un devis sans engagement →
                </button>
              </div>
            </div>
          </div>{/* /hero-booking-wrap */}
          <div className="hero-trust-bar">
            {['Paris · IDF · Oise','Prix fixe garanti','Disponible 24h/24','Annulation gratuite avant attribution','Paiement sécurisé'].map((label,i)=>(
              <Fragment key={label}>
                {i>0 && <div className="htb-sep"/>}
                <div className="htb-item">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l4.5 4.5L19 7"/></svg>
                  {label}
                </div>
              </Fragment>
            ))}
          </div>
        </div>{/* /hero-center */}

        <div className="scroll-hint">
          <div className="scroll-line"/>
          <span className="scroll-label">Découvrir</span>
        </div>
      </section>

      {/* CARTE ANIMÉE — « Paris en mouvement »
          Posée juste après le premier écran, et non dedans : le formulaire
          reste le premier objet de la page, sur mobile comme sur ordinateur.
          Allumée le 2026-10-27. Elle a vécu derrière un drapeau de
          prévisualisation et rendait `null` sur le site ; le drapeau est
          retiré, le bloc est rendu comme les autres. Il reste décoratif :
          `aria-hidden`, aucun élément focalisable, et les mêmes villes
          sont listées en texte dans « Nos zones desservies ». */}
      <CarteParisEnMouvement />

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
          {[{t:'100',s:'%',l:'Tarif fixe garanti'},{t:'3',s:'',l:'Aéroports desservis'},{t:'100',s:'%',l:'Ponctualité garantie'},{t:'24',s:'/7',l:'Disponibilité'}].map((st,i)=>(
            <div key={i} className={`stat-item reveal${i>0?' rd'+i:''}`}>
              <span className="stat-num chrome-gold-static" data-target={st.t} data-suffix={st.s}>0</span>
              <span className="stat-lbl">{st.l}</span>
            </div>
          ))}
        </div>
      </div>

      {/* TRUST / SÉCURITÉ */}
      <section className="trust-section">
        <div className="trust-inner">
          <div className="section-header reveal" style={{marginBottom:40}}>
            <div className="section-tag">Sécurité &amp; confiance</div>
            <h2 className="section-title" style={{marginTop:10}}>Voyagez <em>l&apos;esprit tranquille</em></h2>
          </div>
          <div className="trust-grid">
            {TRUST_POINTS.map((t,i)=>(
              <div key={i} className={`trust-card reveal${i>0?' rd'+i:''}`}>
                <div className="trust-card-icon"><TrustIcon name={t.icon} /></div>
                <div>
                  <div className="trust-card-title">{t.title}</div>
                  <div className="trust-card-desc">{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

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
                  <button className="sc-btn" onClick={()=>s.href.startsWith('/')?router.push(s.href):scrollTo(s.href)}>{s.cta} <span className="sc-btn-arrow">→</span></button>
                </div>
                <div className="sc-img" aria-hidden="true">
                  <ServiceIcon name={s.icon} />
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
            <div key={i} className={`vehicle-card tilt-card reveal rd${i+1}${v.dark?' vc-dark':''}`} style={v.badge?{borderColor:'rgba(var(--sur-fonce-rvb),0.22)'}:{}}>
              <div className="vc-visual" style={{background:v.bg}}>
                {v.badge && <span className="vc-badge" style={{position:'absolute',top:12,right:12,zIndex:5,color:'rgba(var(--sur-fonce-rvb),0.82)',background:'rgba(var(--sur-fonce-rvb),0.08)',border:'1px solid rgba(var(--sur-fonce-rvb),0.14)',backdropFilter:'blur(4px)'}}>{v.badge}</span>}
                <Image src={v.img} alt={v.alt} fill sizes="(max-width:900px) 50vw, 25vw" style={{objectFit:'contain',objectPosition:'center'}}/>
              </div>
              <div className="vc-name">{v.name}</div>
              <div className="vc-cap">
                <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                {v.cap}
              </div>
              <div className="vc-features">
                {v.feats.map((f,j)=><div key={j} className="vc-feat"><div className="vc-feat-dot"/>{f}</div>)}
              </div>
              {/* Le 8 places n'affiche AUCUN prix, et c'est voulu.
                  Deux raisons, toutes deux verifiees : le moteur tarifaire
                  ne connait pas le Grand Van — `NOM_VERS_CLE` fait
                  'Grand Van' → 'van', donc il afficherait le tarif du van
                  7 places — et la disponibilite depend d'un chauffeur
                  partenaire, qu'Owise ne peut pas garantir. Un prix affiche
                  est un engagement ; ecrire « sur demande » a cote d'un
                  chiffre ferme ne l'annule pas, le client retient le
                  chiffre. */}
              {v.devis ? (
                <div className="vc-price" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 10 }}>
                  <span className="vc-amount" style={{ fontSize: 19, fontWeight: 600 }}>Sur devis</span>
                  <button
                    type="button"
                    className="vc-devis-btn"
                    onClick={() => {
                      setPaxN(8)
                      allerAuDevis()
                    }}
                  >
                    Demander un devis
                  </button>
                </div>
              ) : prixAppel[v.cle] != null && (
                <div className="vc-price">
                  <span className="vc-from">dès</span>
                  <span className="vc-amount chrome-gold-static">{prixAppel[v.cle]} €</span>
                  <span className="vc-unit">/ course</span>
                </div>
              )}
            </div>
          ))}
        </div>
        {/* Les textes alternatifs de ces quatre images disent déjà
            « Illustration de la catégorie… », mais rien ne le signalait à
            l'écran. Owise ne possède pas encore de photos de son parc : le
            dire visiblement vaut mieux que de laisser croire le contraire. */}
        <p style={{
          textAlign: 'center', marginTop: 28, fontSize: 12,
          color: 'rgba(var(--t2-rvb),0.85)', letterSpacing: '.02em',
        }}>
          Visuels d&apos;illustration. Le véhicule mis à disposition correspond à la catégorie réservée.
          <br />
          À partir de 4 passagers, une berline plus grande est nécessaire : c&apos;est
          ce que couvre la Berline Premium. Au-delà de 7 passagers, le véhicule
          dépend de la disponibilité de nos chauffeurs partenaires — nous
          établissons un devis avant toute réservation.
        </p>
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

      {/* ── TARIFS ───────────────────────────────────────────── */}
      <section id="tarifs" style={{ background:'var(--surface)', padding:'80px 24px' }}>
        <div style={{ maxWidth:960, margin:'0 auto' }}>
          {/* Header */}
          <div className="reveal" style={{ textAlign:'center', marginBottom:48 }}>
            <div className="faq-eyebrow" style={{ justifyContent:'center' }}>Tarification</div>
            <h2 style={{
              fontFamily:"'Cormorant Garamond',serif",
              fontSize:'clamp(36px,4vw,58px)',
              fontWeight:500,
              color:'var(--t1)',
              lineHeight:1.1,
              letterSpacing:'-.01em',
              marginBottom:12,
            }}>
              Prix fixe garanti<br/><em style={{ fontStyle:'italic', color:'var(--gold)' }}>zéro surprise à l&apos;arrivée</em>
            </h2>
            <p style={{ fontSize:15, color:'var(--t2)', maxWidth:520, margin:'0 auto' }}>
              Le prix affiché est celui que vous payez. Pas de majoration, pas de frais cachés — quelles que soient les conditions de trafic.
            </p>
          </div>

          {/* Table — prix lus dans la grille par prixAffiche(), jamais dans
              tarifs.cdg_fixe / orly_fixe / beauvais_fixe.

              Ces trois colonnes étaient l'ancien repli du moteur, retiré le
              2026-09-19. Plus rien ne les mettait à jour : sept des neuf
              cellules annonçaient MOINS que le prix facturé, jusqu'à 42 €
              d'écart sur un van Paris → Beauvais-Tillé, sous le titre « Prix
              fixe garanti, zéro surprise à l'arrivée » qui surplombe ce
              tableau.

              `prixAffiche` appelle `calculerPrix()` — la même fonction que le
              serveur rappelle avant de créer la session Stripe. Un prix
              affiché ici ne peut donc plus diverger de celui qui sera débité,
              et un changement de coefficient dans /admin/tarifs se répercute
              immédiatement. Une liaison sans forfait rend `null`, et la
              cellule affiche « — » au lieu d'un montant inventé.

              La condition porte sur la grille, et non plus sur `bcTarifs` :
              c'est la grille qui fournit désormais les prix. */}
          {grilleProp.length > 0 && (() => {
            const px = (code: string, cle: string) =>
              prixAffiche(code, 'Z1', cle, grilleProp, tarifsProp as TarifRow2[], zonesProp, paramsProp)

            const rows = [
              {
                icon: '✈', label: 'CDG / Roissy',
                sub: 'Paris → Aéroport Charles de Gaulle',
                berline: px('CDG', 'berline'), premium: px('CDG', 'berline_premium'), van: px('CDG', 'van'),
                isFixed: true,
              },
              {
                icon: '✈', label: 'Orly',
                sub: 'Paris → Aéroport d\'Orly',
                berline: px('ORY', 'berline'), premium: px('ORY', 'berline_premium'), van: px('ORY', 'van'),
                isFixed: true,
              },
              {
                icon: '✈', label: 'Beauvais-Tillé',
                sub: 'Paris → Aéroport de Beauvais',
                berline: px('BVA', 'berline'), premium: px('BVA', 'berline_premium'), van: px('BVA', 'van'),
                isFixed: true,
              },
            ]

            return (
              <div className="reveal" style={{ borderRadius:16, overflow:'hidden', border:'1px solid rgba(var(--contraste-rvb),0.1)', background:'var(--papier)' }}>
                {/* En-têtes colonnes */}
                <div className="tar-tete" style={{
                  display:'grid', gridTemplateColumns:'1fr repeat(3,140px)',
                  background:'rgba(var(--contraste-rvb),0.04)',
                  borderBottom:'1px solid rgba(var(--contraste-rvb),0.09)',
                  padding:'14px 24px',
                }}>
                  <div style={{ fontSize:10, letterSpacing:'.12em', textTransform:'uppercase', color:'var(--t2)' }}>Trajet</div>
                  {[
                    { label:'Berline', emoji:'🚘' },
                    { label:'Premium', emoji:'⭐' },
                    { label:'Van 7 pl.', emoji:'🚐' },
                  ].map(v => (
                    <div key={v.label} style={{ textAlign:'center' }}>
                      <div style={{ fontSize:11, fontWeight:600, color:'var(--t1)' }}>{v.emoji} {v.label}</div>
                    </div>
                  ))}
                </div>

                {/* Lignes */}
                {rows.map((r, i) => (
                  <div key={i} className="tar-ligne" style={{
                    display:'grid', gridTemplateColumns:'1fr repeat(3,140px)',
                    padding:'18px 24px', alignItems:'center',
                    borderBottom: i < rows.length-1 ? '1px solid rgba(var(--contraste-rvb),0.06)' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(var(--contraste-rvb),0.015)',
                  }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:18 }}>{r.icon}</span>
                        <span style={{ fontSize:14, fontWeight:600, color:'var(--t1)' }}>{r.label}</span>
                      </div>
                      <div style={{ fontSize:11, color:'var(--t2)', marginTop:2, paddingLeft:26 }}>{r.sub}</div>
                    </div>
                    {[r.berline, r.premium, r.van].map((prix, j) => (
                      <div key={j} style={{ textAlign:'center' }}>
                        {/* Sous 768 px l'en-tête du tableau disparaît : chaque
                            montant porte alors son propre libellé de véhicule,
                            sans quoi on ne saurait plus lequel on lit. */}
                        <div className="tar-lab">{['🚘 Berline','⭐ Premium','🚐 Van 7 pl.'][j]}</div>
                        {prix != null ? (
                          <div>
                            <span style={{
                              fontFamily:"'Courier New',monospace",
                              fontSize:20, fontWeight:700, color:'var(--gold)',
                            }}>{Math.round(Number(prix))}</span>
                            <span style={{ fontSize:12, color:'var(--t2)', marginLeft:2 }}>€</span>
                            {!r.isFixed && <div style={{ fontSize:9, color:'var(--t2)', letterSpacing:'.06em', textTransform:'uppercase' }}>dès</div>}
                          </div>
                        ) : <span style={{ color:'rgba(var(--contraste-rvb),0.2)' }}>—</span>}
                      </div>
                    ))}
                  </div>
                ))}

              </div>
            )
          })()}

          {/* Notes + CTA */}
          <div className="reveal" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:24, flexWrap:'wrap', gap:16 }}>
            <div style={{ fontSize:12, color:'var(--t2)', display:'flex', flexDirection:'column', gap:4 }}>
              <span>🧳 Bagages inclus · ✈ Suivi vol en temps réel</span>
              <span>💳 Paiement sécurisé par carte en ligne · 📞 Réservation aussi par WhatsApp</span>
            </div>
            <button
              onClick={() => scrollTo('#devis')}
              style={{
                background:'var(--gold)', color:'var(--sur-or)', border:'none', borderRadius:10,
                padding:'13px 28px', fontSize:14, fontWeight:700, cursor:'pointer',
                fontFamily:'DM Sans, sans-serif', whiteSpace:'nowrap',
              }}
            >
              Obtenir mon prix →
            </button>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS — avis Google réels et vérifiés */}
      <section className="testimonials-section">
        <div className="section-header reveal">
          <div className="section-tag" style={{justifyContent:'center'}}>Avis clients</div>
          <h2 className="section-title" style={{marginTop:10}}>Ils nous ont fait <em>confiance</em></h2>
        </div>
        <div className="testimonials-grid">
          {TESTIMONIALS.map((t,i)=>(
            <div key={i} className={`testimonial-card reveal${i>0?' rd'+(i%3):''}`}>
              <span className="t-quote-mark">&ldquo;</span>
              <div className="t-stars">{Array.from({length:5}).map((_,s)=>(<span key={s} className="t-star">★</span>))}</div>
              <p className="t-text">{t.text}</p>
              <div className="t-author">
                <div className="t-avatar" style={{background:t.color,display:'flex',alignItems:'center',justifyContent:'center',color:t.fg,fontFamily:"'Plus Jakarta Sans',sans-serif",fontWeight:600,fontSize:22}}>{t.initial}</div>
                <div>
                  <div className="t-name">{t.name}</div>
                  <div className="t-role">Avis Google vérifié · {t.when}</div>
                </div>
              </div>
            </div>
          ))}
          <a
            href="https://g.page/r/CY0-ORyXWwpXEAE"
            target="_blank" rel="noopener"
            className="testimonial-card reveal rd2"
            style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center',gap:12,textDecoration:'none',cursor:'pointer'}}
          >
            <div className="t-stars">{Array.from({length:5}).map((_,s)=>(<span key={s} className="t-star">★</span>))}</div>
            <div style={{fontSize:15,fontWeight:600,color:'var(--t1)'}}>Voir tous nos avis</div>
            <div style={{fontSize:12.5,color:'var(--t2)'}}>sur Google →</div>
          </a>
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
        <div style={{position:'absolute',top:0,left:0,right:0,height:1,background:'linear-gradient(90deg,transparent,var(--gold) 30%,var(--gold) 70%,transparent)'}}/>
        {/* Decorative circle */}
        <div style={{position:'absolute',right:-120,top:'50%',transform:'translateY(-50%)',width:500,height:500,borderRadius:'50%',border:'1px solid rgba(var(--or-rvb),0.06)',pointerEvents:'none'}}/>
        <div style={{position:'absolute',right:-80,top:'50%',transform:'translateY(-50%)',width:340,height:340,borderRadius:'50%',border:'1px solid rgba(var(--or-rvb),0.04)',pointerEvents:'none'}}/>

        <div className="enterprise-inner reveal">
          {/* Left */}
          <div className="ent-left">
            <div className="ent-label">Comptes entreprises</div>
            <h2 className="ent-title">
              Vos équipes,<br/>
              <em>toujours à l&apos;heure.</em>
            </h2>
            <p className="ent-desc">
              Tarifs négociés, facturation mensuelle centralisée, portail multi-collaborateurs — tout ce qu&apos;il faut pour gérer les déplacements de votre société sans friction.
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
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{stroke:'var(--gold)'}} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 14.25l6-6m4.5-3.493V21.75l-3.75-1.5-3.75 1.5-3.75-1.5-3.75 1.5V4.757c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0c1.1.128 1.907 1.077 1.907 2.185z"/></svg>,
                title:'Tarifs négociés',
                desc:'Accès aux grilles entreprise dès 10 courses/mois',
              },
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{stroke:'var(--gold)'}} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"/></svg>,
                title:'Facturation mensuelle',
                desc:'Une facture consolidée + export comptable CSV/PDF',
              },
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{stroke:'var(--gold)'}} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z"/></svg>,
                title:'Portail collaborateurs',
                desc:'Chaque collaborateur réserve sans avancer de frais',
              },
              {
                icon:<svg width="20" height="20" fill="none" viewBox="0 0 24 24" style={{stroke:'var(--gold)'}} strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M17.982 18.725A7.488 7.488 0 0012 15.75a7.488 7.488 0 00-5.982 2.975m11.963 0a9 9 0 10-11.963 0m11.963 0A8.966 8.966 0 0112 21a8.966 8.966 0 01-5.982-2.275M15 9.75a3 3 0 11-6 0 3 3 0 016 0z"/></svg>,
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
      <section id="zones" style={{ background:'var(--base)', padding:'80px 24px' }}>
        <div style={{ maxWidth:1080, margin:'0 auto' }}>

          {/* Header */}
          <div className="reveal" style={{ textAlign:'center', marginBottom:52 }}>
            <div className="section-tag">Nos destinations</div>
            <h2 className="section-title">
              Partout où vous en<br/><em className="chrome-gold-slow">avez besoin</em>
            </h2>
            <p style={{ fontSize:15, color:'var(--t2)', maxWidth:500, margin:'12px auto 0' }}>
              Disponible 24h/24 — Réservez en ligne ou par WhatsApp
            </p>
          </div>

          {/* Grid de cartes — mêmes prix, même source que le tableau plus haut.
              `prixAffiche` appelle `calculerPrix()` ; les colonnes
              tarifs.*_fixe ne sont plus lues. Le `.toFixed(0)` qui était ici
              disparaît avec elles : c'était une seconde écriture du format d'un
              montant, à côté de `formaterMontant()`. */}
          {(() => {
            const pxBerline = (code: string) =>
              prixAffiche(code, 'Z1', 'berline', grilleProp, tarifsProp as TarifRow2[], zonesProp, paramsProp)
            const prixCdg = pxBerline('CDG')
            const prixOrly = pxBerline('ORY')
            const prixBva = pxBerline('BVA')
            /* La carte « Gares parisiennes » annonce un MINIMUM : le forfait le
               plus bas vers une gare, qui part de Paris intramuros. */
            const prixGare = prixAffiche('Z1', 'GARE', 'berline', grilleProp, tarifsProp as TarifRow2[], zonesProp, paramsProp)
            /* `b` reste nécessaire pour les cartes « Paris & IDF » et « Gares
               parisiennes », qui annoncent un tarif au kilomètre : elles lisent
               `prix_km` et `prise_en_charge`, qui sont des entrées réelles du
               moteur — pas les colonnes aéroport abandonnées. */
            const b = bcTarifs.find(t => t.vehicule === 'Berline')
            const destinations = [
              {
                emoji: '✈',
                color: 'var(--bleu-info)',
                name: 'CDG / Roissy',
                villes: ['Terminal 1', 'Terminal 2', 'Terminal 3'],
                prix: prixCdg !== null ? `${prixCdg} €` : null,
                prixLabel: 'Prix fixe berline',
                tag: 'Tarif fixe garanti',
                tagColor: '--bleu-info', tagRvb: '--bleu-info-rvb',
                dest: 'Aéroport Charles de Gaulle',
                cta: 'Réserver',
                href: '#devis',
              },
              {
                emoji: '✈',
                color: 'var(--vert-vif)',
                name: 'Orly',
                villes: ['Terminal 1', 'Terminal 2', 'Terminal 3 & 4'],
                prix: prixOrly !== null ? `${prixOrly} €` : null,
                prixLabel: 'Prix fixe berline',
                tag: 'Tarif fixe garanti',
                tagColor: '--vert-vif', tagRvb: '--vert-vif-rvb',
                dest: 'Aéroport d\'Orly',
                cta: 'Réserver',
                href: '#devis',
              },
              {
                emoji: '✈',
                color: 'var(--gris-ardoise)',
                name: 'Beauvais (BVA)',
                villes: ['Ryanair', 'Wizz Air', 'easyJet'],
                prix: prixBva !== null ? `${prixBva} €` : null,
                prixLabel: 'Prix fixe berline',
                tag: 'Tarif fixe garanti',
                tagColor: '--gris-ardoise', tagRvb: '--gris-ardoise-rvb',
                dest: 'Aéroport Paris-Beauvais',
                cta: 'Réserver',
                href: '#devis',
              },
              {
                emoji: '🏙',
                color: 'var(--gold)',
                name: 'Paris & IDF',
                villes: ['Tous arrondissements', 'Versailles', 'Boulogne, Saint-Denis…'],
                prix: b ? `${formaterMontant(Number(b.prix_km))}/km` : null,
                prixLabel: `+ ${b ? Number(b.prise_en_charge).toFixed(0) : '20'} € prise en charge`,
                tag: 'Tarif au kilomètre',
                tagColor: '--sur-voile-or', tagRvb: '--or-rvb',
                dest: 'Paris et Île-de-France',
                cta: 'Estimer mon prix',
                href: '#devis',
              },
              {
                emoji: '🚉',
                color: 'var(--ambre-vif)',
                name: 'Gares parisiennes',
                villes: ['Gare du Nord', 'Gare de Lyon', 'Montparnasse, Saint-Lazare…'],
                /* Le prix vient de la grille, par prixAffiche(), comme les
                   cartes aéroport juste au-dessus.
                   Avant : `Math.round(prise_en_charge + 8 × prix_km)`, soit une
                   TROISIÈME écriture du calcul au kilomètre dans ce composant.
                   Elle rendait 49 €, alors que la grille porte Paris ↔ Gares
                   parisiennes à 40 € — 9 € annoncés en trop, qui font renoncer
                   un client sans le tromper. Et comme un forfait existe, parler
                   de « selon la distance » était faux deux fois. */
                prix: prixGare !== null ? `dès ${prixGare} €` : null,
                prixLabel: 'depuis Paris, prix fixe',
                tag: 'Tarif fixe garanti',
                tagColor: '--ambre-vif', tagRvb: '--ambre-vif-rvb',
                dest: 'Toutes gares de Paris',
                cta: 'Estimer mon prix',
                href: '#devis',
              },
              {
                emoji: '🌿',
                color: 'var(--gold)',
                name: 'Oise',
                villes: ['Chantilly', 'Creil', 'Compiègne, Senlis…'],
                prix: null,
                prixLabel: 'Devis personnalisé',
                tag: 'Sur devis',
                tagColor: '--sur-voile-or', tagRvb: '--or-rvb',
                dest: 'Oise (60)',
                cta: 'Demander un devis',
                href: 'https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20un%20devis%20pour%20l\'Oise',
                external: true,
              },
            ]

            return (
              <div style={{
                display:'grid',
                /* `repeat(3,1fr)` imposait trois colonnes quelle que soit la
                   place : à 320 px cela donnait trois colonnes de 80 px, et les
                   six boutons des cartes — larges de 76 à 110 px — étaient
                   rognés par `overflow:hidden`, invisibles mais toujours
                   atteignables au clavier. Ce style est écrit EN LIGNE : aucune
                   règle de `vitrine.css` ne peut l'atteindre, contrairement aux
                   onze grilles voisines qui ont toutes leur règle mobile.
                   `min(300px, 100%)` est le point important : le plancher cède
                   quand le conteneur est plus étroit que 300 px. Un
                   `minmax(300px, 1fr)` nu garderait une colonne de 300 px dans
                   un conteneur de 272 px et ferait déborder la page — c'est le
                   défaut des grilles de `page.tsx`. 300 px est le seuil qui
                   restitue exactement trois colonnes sur ordinateur. */
                gridTemplateColumns:'repeat(auto-fit, minmax(min(300px, 100%), 1fr))',
                gap:16,
              }}>
                {destinations.map((d, i) => (
                  <div key={i} className="reveal" style={{
                    background:'var(--papier)',
                    borderRadius:16,
                    border:'1px solid rgba(var(--contraste-rvb),0.07)',
                    overflow:'hidden',
                    boxShadow:'0 2px 20px rgba(var(--ombre-rvb),0.06)',
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
                            <div style={{ fontSize:15, fontWeight:700, color:'var(--encre)', lineHeight:1.2 }}>{d.name}</div>
                            <div style={{ fontSize:10, color:'var(--gris-ardoise)', marginTop:1 }}>{d.dest}</div>
                          </div>
                        </div>
                        <span style={{
                          fontSize:9, padding:'3px 8px', borderRadius:20, fontWeight:600,
                          background:`rgba(var(${d.tagRvb}),.082)`, color:`var(${d.tagColor})`,
                          border:`1px solid rgba(var(${d.tagRvb}),.188)`,
                          whiteSpace:'nowrap',
                        }}>{d.tag}</span>
                      </div>

                      {/* Villes clés */}
                      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                        {d.villes.map((v, j) => (
                          <div key={j} style={{ display:'flex', alignItems:'center', gap:6 }}>
                            <div style={{ width:4, height:4, borderRadius:'50%', background:d.color, flexShrink:0 }}/>
                            <span style={{ fontSize:12, color:'var(--gris-sombre)', lineHeight:1.3 }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Prix */}
                      <div style={{
                        marginTop:'auto',
                        paddingTop:12,
                        borderTop:'1px solid rgba(var(--contraste-rvb),0.06)',
                        display:'flex',
                        alignItems:'flex-end',
                        justifyContent:'space-between',
                      }}>
                        <div>
                          {d.prix ? (
                            <div style={{ fontFamily:"'Courier New',monospace", fontSize:22, fontWeight:700, color:'var(--gold)', lineHeight:1 }}>
                              {d.prix}
                            </div>
                          ) : (
                            <div style={{ fontSize:14, fontWeight:600, color:'var(--gold)' }}>Sur devis</div>
                          )}
                          <div style={{ fontSize:10, color:'var(--gris-ardoise)', marginTop:2 }}>{d.prixLabel}</div>
                        </div>
                        {d.external ? (
                          <a href={d.href} target="_blank" rel="noopener" style={{
                            padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                            background:'var(--marque-whatsapp)', color:'var(--sur-marque)', textDecoration:'none',
                            display:'flex', alignItems:'center', gap:6,
                          }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                            {d.cta}
                          </a>
                        ) : (
                          <button onClick={() => scrollTo(d.href)} style={{
                            padding:'9px 16px', borderRadius:8, fontSize:12, fontWeight:600,
                            background:'var(--nuit)', color:'var(--gold)', border:'none', cursor:'pointer',
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
            background:'var(--nuit)', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12,
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:'var(--vert-vif)', boxShadow:'0 0 0 3px rgba(var(--vert-vif-rvb),0.2)' }}/>
              <span style={{ fontSize:14, color:'var(--ivoire)', fontWeight:500 }}>Disponible 24h/24, 7j/7 — Réponse en moins de 2 minutes</span>
            </div>
            {/* `--sur-marque`, et non `--sur-fonce` : le vert de WhatsApp n'est pas une
                surface sombre, et `--sur-fonce` vaut de l'ivoire. Troisième bouton
                WhatsApp de la page : les deux autres (.wa-btn, .faq-btn-wa) ont reçu
                cette encre à l'étape 117, celui-ci portait sa couleur en style inline
                et y avait échappé. Mesuré étape 144 : 1,78 — corrigé à 9,98 (seuil 4,5),
                sur les deux palettes. L'adresse et la cible du lien sont inchangées. */}
            <a href="https://wa.me/33619106356?text=Bonjour%2C%20je%20souhaite%20réserver%20un%20VTC"
               target="_blank" rel="noopener"
               style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 20px', borderRadius:8, background:'var(--marque-whatsapp)', color:'var(--sur-marque)', fontSize:13, fontWeight:600, textDecoration:'none' }}>
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
                /* La question est un <button> : c'est LUI qui ouvre et ferme, au
                   clic comme au clavier. Ce gestionnaire-ci ne sert plus qu'au
                   reste de la boîte — cliquer la réponse la referme, comme avant
                   l'étape 149. Sans la garde, un clic sur le bouton remonterait
                   jusqu'ici et basculerait deux fois : ouvert puis refermé. */
                onClick={e=>{
                  if ((e.target as HTMLElement).closest('.faq-q')) return
                  setFaqOpen(faqOpen===i?null:i)
                }}
              >
                {/* `<button>` natif, et non un <div tabindex> : il apporte le
                    focus, Entrée et Espace sans une ligne de JavaScript. Avant
                    l'étape 149, les 12 questions étaient des <div> sans tabindex
                    ni rôle : aucune n'était atteignable au clavier, donc les 12
                    réponses étaient hors de portée de qui n'a pas de souris. */}
                <button
                  type="button"
                  className="faq-q"
                  id={`faq-q-${i}`}
                  aria-expanded={faqOpen===i}
                  aria-controls={`faq-a-${i}`}
                  onClick={()=>setFaqOpen(faqOpen===i?null:i)}
                >
                  <span className="faq-num">{String(i+1).padStart(2,'0')}</span>
                  <span className="faq-q-text">{f.q}</span>
                  <span className="faq-icon">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" focusable="false">
                      <line x1="6" y1="1" x2="6" y2="11" className="faq-icon-v"/>
                      <line x1="1" y1="6" x2="11" y2="6"/>
                    </svg>
                  </span>
                </button>
                {/* La réponse repliée garde sa place dans le document : elle est
                    masquée par `max-height:0`, ce qui anime l'ouverture mais ne
                    la retire NI de l'arbre d'accessibilité NI de l'ordre de
                    tabulation. Un lecteur d'écran lirait donc les 12 réponses
                    alors que `aria-expanded` annonce « fermé ». `inert` règle
                    les deux sans toucher à l'animation. */}
                <div
                  className="faq-a"
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  inert={faqOpen!==i}
                >
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
            color:'var(--encre)',marginTop:12,marginBottom:0,
          }}>Réservez<br/><span style={{color:'var(--gold)'}}>maintenant</span></h2>
          <p className="reveal rd2" style={{fontSize:16,color:'var(--t2)',marginTop:18,fontWeight:300,lineHeight:1.7}}>
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
                      <VtAddressInput placeholder="Adresse de départ, hôtel, bureau…" value={form.origin} onSelect={v=>{setForm(f=>({...f,origin:v.label}));setDevisOrig(v)}}/>
                    </div>
                  </div>
                  <div className="route-sep"/>
                  {etapeOpen && (
                    <div className="route-input-wrap" style={{marginBottom:8}}>
                      <div className="route-dot" style={{background:'var(--amber)',width:8,height:8,left:18}}/>
                      <div className="field" style={{flex:1}}>
                        <label>Étape intermédiaire</label>
                        <VtAddressInput placeholder="Adresse de l'étape" value={devisEtape.label} onSelect={v=>setDevisEtape(v)}/>
                      </div>
                    </div>
                  )}
                  <div className="route-input-wrap">
                    <div className="route-dot d"/>
                    <div className="field" style={{flex:1}}>
                      <label>Destination</label>
                      <VtAddressInput placeholder="Destination, aéroport, gare…" value={form.dest} onSelect={v=>{setForm(f=>({...f,dest:v.label}));setDesisDest(v)}}/>
                    </div>
                  </div>
                </div>
                <button style={{display:'inline-flex',alignItems:'center',gap:6,fontSize:12,color:'var(--t2)',cursor:'pointer',background:'none',border:'none',fontFamily:'inherit',padding:0,transition:'color .15s',marginBottom:16}} onClick={()=>setEtapeOpen(v=>{ if(v) setDevisEtape({label:''}); return !v })}>
                  <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                  {etapeOpen ? "Retirer l'étape" : 'Ajouter une étape intermédiaire'}
                </button>
                <div className="form-grid">
                  <div className="field"><label>Date</label><input type="date" value={form.date} onChange={e=>setForm(f=>({...f,date:e.target.value}))}/></div>
                  <div className="field"><label>Heure de prise en charge</label><input type="time" value={form.time} onChange={e=>setForm(f=>({...f,time:e.target.value}))}/></div>
                </div>

                {/* aller-retour */}
                <div style={{marginBottom:16}}>
                  <button type="button" onClick={()=>setAllerRetour(v=>!v)} style={{display:'inline-flex',alignItems:'center',gap:7,padding:'8px 14px',borderRadius:8,border:'1px solid rgba(var(--contraste-rvb),0.12)',background:'transparent',fontFamily:'inherit',fontSize:12,color:'var(--t2)',cursor:'pointer',transition:'all .15s'}}>
                    <span>↩</span> Aller-Retour
                    <span style={{fontSize:9,padding:'2px 6px',borderRadius:4,background:allerRetour?'rgba(var(--or-rvb),0.15)':'rgba(var(--contraste-rvb),0.06)',color:allerRetour?'var(--gold)':'var(--t2)',fontWeight:700,letterSpacing:'.04em',border:allerRetour?'1px solid rgba(var(--or-rvb),0.3)':'none'}}>
                      {allerRetour?'ON':'OFF'}
                    </span>
                  </button>
                  {allerRetour && (
                    <div style={{marginTop:10,padding:14,borderRadius:10,background:'rgba(var(--or-rvb),0.05)',border:'1px solid rgba(var(--or-rvb),0.2)'}}>
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
                  {/* Étape 97 : cet événement transmettait `form.origin` et
                      `form.dest`, c'est-à-dire l'adresse COMPLÈTE choisie
                      dans la liste de suggestions — « 12 Rue de Paris,
                      60500 Chantilly, France ». L'étape 88 avait généralisé
                      les adresses dans la table `estimations` ; celle-ci
                      était restée. On garde l'information utile — de quelle
                      zone part-on, vers quelle zone va-t-on — sans la rue
                      ni le numéro, avec le même généralisateur qu'ailleurs. */}
                  <button className="btn-next" onClick={()=>{logFunnel('devis_step2_enter', {
                    zone_depart:  lieuPourStatistique(devisOrig.label, devisOrig.cp, detectZone(devisOrig.cp ?? '', zonesProp, devisOrig.label)?.code),
                    zone_arrivee: lieuPourStatistique(desisDest.label, desisDest.cp, detectZone(desisDest.cp ?? '', zonesProp, desisDest.label)?.code),
                  }); setStep(2)}}>Suivant — Passagers <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></button>
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
                    <svg width="20" height="16" viewBox="0 0 20 16" fill="none"><path d="M2 8 L4 3 Q5 1 7.5 1 L12.5 1 Q15 1 16 3 L18 8 Z" style={{fill:'var(--encre)'}}/><path d="M5 8 Q6 3.5 8 3 L12 3 L12 8 Z" style={{fill:'var(--illu-bleu)'}} opacity=".7"/><rect x="18" y="6.5" width="1.5" height="2.5" rx=".7" style={{fill:'var(--illu-phare)'}}/><rect x=".5" y="6.5" width="1.5" height="2.5" rx=".7" style={{fill:'var(--illu-feu)'}} opacity=".8"/><path d="M2 8 L18 8 L18.5 9.5 L1.5 9.5 Z" style={{fill:'var(--encre-profonde)'}}/><circle cx="5.5" cy="11" r="2.5" style={{fill:'var(--encre-sourde)'}}/><circle cx="5.5" cy="11" r="1.3" style={{fill:'var(--encre-tiede)'}}/><circle cx="14.5" cy="11" r="2.5" style={{fill:'var(--encre-sourde)'}}/><circle cx="14.5" cy="11" r="1.3" style={{fill:'var(--encre-tiede)'}}/></svg>
                  </div>
                  <div>
                    <div className="vh-name">{currentVeh.name}</div>
                    <div className="vh-sub">{currentVeh.sub}</div>
                  </div>
                  {currentVehPrix != null && <div className="vh-badge">dès {currentVehPrix} €</div>}
                </div>
                <div className="supps">
                  {[
                    { key:'bagages', actif: paramsProp?.supplement_bagages_actif ?? true, prix: paramsProp?.supplement_bagages_prix ?? 10, label:'🧳 Bagages volumineux (ski, golf…)' },
                    { key:'panneau', actif: paramsProp?.supplement_panneau_actif ?? true, prix: paramsProp?.supplement_panneau_prix ?? 8,  label:'📋 Panneau nominatif à l\'arrivée' },
                    { key:'animaux', actif: paramsProp?.supplement_animaux_actif ?? true, prix: paramsProp?.supplement_animaux_prix ?? 15, label:'🐾 Animal de compagnie (cage requise)' },
                    { key:'siege_enfant', actif: paramsProp?.supplement_siege_enfant_actif ?? true, prix: paramsProp?.supplement_siege_enfant_prix ?? 10, label:'👶 Siège enfant' },
                  ].filter(o => o.actif).map(({key:k, prix:p, label})=>(
                    <div key={k} className={`supp-row${suppls[k]?' on':''}`} onClick={()=>setSuppls(s=>{const n={...s};if(n[k]) delete n[k]; else n[k]=p; return n})}>
                      <div className="supp-lbl"><div className="supp-check"/>{label}</div>
                      <span className="supp-price">+ {p} €</span>
                    </div>
                  ))}
                </div>
                <div className="form-nav">
                  <button className="btn-prev" onClick={()=>setStep(1)}>← Retour</button>
                  <button className="btn-next" onClick={()=>{logFunnel('devis_step3_enter', {pax, price:devisPrix}); setStep(3)}}>Voir l&apos;estimation <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7"/></svg></button>
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
                  Prix fixe garanti, confirmation immédiate. Coordonnées utiles pour votre réservation,
                  ou pour être rappelé(e) si vous préférez en parler avant.
                </p>
                <div className="form-grid" style={{marginBottom:20}}>
                  <div className="field"><label>Prénom &amp; Nom</label><input type="text" placeholder="Jean Dupont" value={form.nom} onChange={e=>setForm(f=>({...f,nom:e.target.value}))}/></div>
                  <div className="field"><label>Téléphone</label><input type="tel" placeholder="+33 6 00 00 00 00" value={form.tel} onChange={e=>setForm(f=>({...f,tel:e.target.value}))}/></div>
                  <div className="field"><label>E-mail</label><input type="email" placeholder="jean@entreprise.fr" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/></div>
                  <div className="field"><label>Société (optionnel)</label><input type="text" placeholder="Nom de l'entreprise" value={form.societe} onChange={e=>setForm(f=>({...f,societe:e.target.value}))}/></div>
                </div>
                {submitErr && (
                  <div style={{display:'block',background:'rgba(var(--rouge-doux-rvb),0.08)',border:'1px solid rgba(var(--rouge-doux-rvb),0.2)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--rouge-doux)',marginBottom:12,textAlign:'center'}}>{submitErr}</div>
                )}
                <button className="btn-next" onClick={goToReserver} style={{width:'100%',padding:'15px 36px',fontSize:14.5,marginBottom:14}}>
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                  Réserver et payer maintenant →
                </button>
                <div className="form-nav">
                  <button className="btn-prev" onClick={()=>setStep(2)}>← Retour</button>
                  <button onClick={submitDevis} disabled={submitting} style={{background:'none',border:'none',color:'var(--t2)',fontSize:12.5,textDecoration:'underline',cursor:'pointer',fontFamily:'inherit',opacity:submitting?.6:1}}>
                    {submitting ? 'Envoi…' : 'Plutôt être rappelé(e) sous 30 min →'}
                  </button>
                </div>
              </div>
            )}

            {/* step 4 — success */}
            {step===4 && submitted && (
              <div className="step-panel on" style={{textAlign:'center',padding:'20px 0 10px'}}>
                <div style={{width:60,height:60,borderRadius:'50%',background:'rgba(var(--vert-vif-rvb),0.1)',border:'1px solid rgba(var(--vert-vif-rvb),0.25)',display:'inline-flex',alignItems:'center',justifyContent:'center',marginBottom:20}}>
                  <svg width="26" height="26" fill="none" viewBox="0 0 24 24" style={{stroke:'var(--vert-vif)'}} strokeWidth={2.2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                </div>
                <div style={{fontFamily:"'Cormorant Garamond',serif",fontSize:26,fontWeight:500,color:'var(--encre)',marginBottom:10}}>Demande reçue !</div>
                <p style={{fontSize:13,color:'var(--t2)',lineHeight:1.7,maxWidth:340,margin:'0 auto 8px'}}>
                  {pax >= 8 ? (
                      <>Votre demande est enregistrée. Nous vérifions la disponibilité
                      d&apos;un véhicule {pax} places auprès de nos chauffeurs partenaires
                      et vous envoyons un devis. <strong>Rien n&apos;est réservé tant que
                      vous ne l&apos;avez pas accepté.</strong></>
                    ) : (
                      <>Nous avons bien reçu votre demande. Un conseiller vous
                      contactera dans les <strong>30 minutes</strong>.</>
                    )}
                </p>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'var(--t2)',background:'rgba(var(--contraste-rvb),0.04)',borderRadius:6,padding:'8px 14px',display:'inline-block',marginBottom:20}}>{confirmRef}</div>

                {/* Option : payer directement sans attendre le rappel.
                      MASQUEE au-dela de 7 passagers : ce bouton mene au
                      paiement, et la disponibilite d'un 8 places n'est pas
                      acquise — elle depend d'un chauffeur partenaire. Faire
                      payer avant de l'avoir verifiee serait vendre ce qu'on
                      n'a pas. */}
                  {pax < 8 && (<>
                <div style={{background:'rgba(var(--or-rvb),0.06)',border:'1px solid rgba(var(--or-rvb),0.2)',borderRadius:10,padding:'14px 20px',marginBottom:20,maxWidth:360,margin:'0 auto 20px'}}>
                  <div style={{fontSize:11,color:'var(--t2)',marginBottom:10}}>Vous souhaitez confirmer et payer maintenant sans attendre ?</div>
                  <button onClick={()=>router.push(reserverUrl)} style={{
                    display:'inline-flex',alignItems:'center',gap:8,
                    background:'linear-gradient(135deg,var(--gold),var(--gold-bright))',
                    color:'var(--sur-fonce)',border:'none',borderRadius:8,
                    padding:'10px 22px',fontSize:13,fontWeight:600,
                    cursor:'pointer',fontFamily:'inherit',
                  }}>
                    <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                    Réserver et payer maintenant
                  </button>
                </div>
                  </>)}

                  <button onClick={resetDevis} style={{background:'none',border:'1px solid rgba(var(--contraste-rvb),0.15)',borderRadius:8,padding:'8px 18px',fontSize:12,color:'var(--t2)',cursor:'pointer',fontFamily:'inherit'}}>
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
                <rect width="36" height="36" rx="8" style={{fill:'var(--encre)'}}/>
                <text x="18" y="26" textAnchor="middle" fontFamily="Plus Jakarta Sans, sans-serif" fontSize="18" fontWeight="800" fill="var(--sur-encre)">O</text>
              </svg>
              <div>
                <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",fontSize:22,fontWeight:800,letterSpacing:'.2em',color:'var(--encre)'}}>OWISE</div>
                <div style={{fontSize:8,letterSpacing:'.32em',textTransform:'uppercase',color:'rgba(var(--contraste-rvb),0.59)',marginTop:2}}>Chauffeur privé VTC</div>
              </div>
            </div>
            <div className="brand-sub">Paris, Île-de-France & Oise.</div>
            <span className="footer-social-label">Suivez-nous</span>
            <div className="footer-social">
              <a href="https://www.facebook.com/Owise.vtc" className="fs-link" title="Facebook" target="_blank" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z"/></svg></a>
              <a href="#" className="fs-link soon" title="Instagram" rel="noopener"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".8" fill="currentColor" strokeWidth="0"/></svg></a>
              <a href="https://www.tiktok.com/@owise857" className="fs-link" title="TikTok" target="_blank" rel="noopener"><svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.79 1.53V6.77a4.85 4.85 0 01-1.02-.08z"/></svg></a>
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
              <Link href="/blog" className="footer-link">Blog & Guides VTC</Link>
              <Link href="/mentions-legales" className="footer-link">Conditions générales</Link>
              <Link href="/mentions-legales" className="footer-link">Politique de confidentialité</Link>
              <Link href="/mentions-legales" className="footer-link">Mentions légales</Link>
              {/* Plus de lien vers /admin ici (2026-09-21). Ce pied de page est
                  rendu sur ~170 pages publiques ; robots.txt interdisant /admin,
                  Google decouvrait l'adresse sans pouvoir la lire et la listait a
                  vide — c'est l'avertissement « Indexee malgre le blocage par le
                  fichier robots.txt » recu le 2026-09-20. L'acces se fait
                  desormais en tapant owise.fr/admin. */}
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
          {/* Revenir sur son choix. Avant l'étape 88, la réponse donnée à la
              bannière était définitive : rien ne rouvrait le panneau. */}
          <button
            type="button"
            className="lien-cookies"
            onClick={() => { setAnalyticsOn(lireConsentement() === 'accepted'); setCookieModalOpen(true) }}
          >
            Gérer mes cookies
          </button>
          <span>SIRET : 477 534 135 00041</span>
        </div>
      </footer>

      {/* COOKIE BANNER */}
      {!cookieDone && (
        <div ref={cookieBannerRef} className={`cookie-banner${cookieVisible?' visible':''}`}>
          <div className="cookie-text">
            <div className="cookie-title">Gestion des cookies</div>
            <div className="cookie-desc">
              {/* Étape 89 : le texte doit dire ce que le code fait. Les
                  mesures ne démarrent qu'après « Accepter ». */}
              Les cookies de mesure d&apos;audience (Google Analytics, PostHog, Meta Pixel) ne sont
              activés qu&apos;après votre acceptation. Sans réponse de votre part, aucune statistique
              n&apos;est collectée. Consultez notre{' '}
              <Link href="/mentions-legales">politique de confidentialité</Link>.
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
            {/* « données anonymisées » était inexact : Google Analytics et
                PostHog attribuent chacun un identifiant de visiteur et
                déposent un cookie. Le panneau doit le dire. */}
            <div><div className="cm-cat-name">Analytiques</div><div className="cm-cat-desc">Mesure d&apos;audience (Google Analytics, PostHog, Meta Pixel). Déposent un cookie et un identifiant de visiteur. Désactivés tant que vous n&apos;avez pas accepté.</div></div>
            <label className="cm-toggle"><input type="checkbox" checked={analyticsOn} onChange={e=>setAnalyticsOn(e.target.checked)}/><div className="cm-track"/><div className="cm-thumb"/></label>
          </div>
          <div className="cm-footer">
            <button className="cm-cancel" onClick={()=>setCookieModalOpen(false)}>Annuler</button>
            <button className="cm-save" onClick={enregistrerPreferences}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  )
}
