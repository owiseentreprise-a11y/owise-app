'use client'

import { useState, useEffect, useRef, useTransition, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { creerCourseAction } from './actions'
import { searchLieux } from '@/lib/lieux'
import { searchAddresses, fetchPlaceDetails, getSuggestionIcon } from '@/lib/addressSearch'
import { calculerPrix, calculerPrixKm, detectZone, isForfaitZone, type ParamsCalc } from '@/lib/calcPrix'

// ── Types ─────────────────────────────────────────────────────────────────────

type Zone          = { id: string; nom: string; code: string; type: string; prefixes_postaux: string[] }
type Grille        = { zone_depart_id: string; zone_arrivee_id: string; prix_berline: number }
type TarifVehicule = { vehicule: string; prise_en_charge: number; prix_km: number; cdg_fixe: number; orly_fixe: number; beauvais_fixe: number }
type AdresseVal    = { label: string; codePostal: string; lat?: number; lng?: number }

type ClientOption = {
  id: string; type_compte: string; entreprise_nom: string | null
  profiles: { prenom: string; nom: string } | null
}
type CollabOption = { id: string; client_id: string; nom: string | null; prenom: string | null; poste: string | null }
type ChauffeurOption = { id: string; statut: string; vehicule_marque: string | null; vehicule_modele: string | null; sous_traitant_id: string | null; profiles: { prenom: string; nom: string } | null }
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

// Regroupe visuellement les champs par thème (Trajet / Planification / Tarif /
// Passager / Attribution) — avant, tout s'enchaînait dans une seule liste plate
// sans repère visuel, difficile à scanner rapidement.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--gb)',
      borderRadius: 12, padding: '18px 20px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--t2)', fontWeight: 500 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

// detectZone / isForfaitZone / calculerPrix / calculerPrixKm vivent dans
// @/lib/calcPrix — source unique partagée avec /reserver et la vitrine.

async function fetchDistanceKm(dep: AdresseVal, arr: AdresseVal): Promise<number | null> {
  if (!dep.lng || !dep.lat || !arr.lng || !arr.lat) return null
  try {
    const res  = await fetch(`/api/distance?olat=${dep.lat}&olng=${dep.lng}&dlat=${arr.lat}&dlng=${arr.lng}`)
    const json = await res.json()
    return json.km ?? null
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
  zones, grille, tarifs, params,
  defaultDatetime, coursesAssignees = [],
}: {
  clients: ClientOption[]; collabs: CollabOption[]
  chauffeurs: ChauffeurOption[]; sousTraitants: SousTraitantOption[]
  zones: Zone[]; grille: Grille[]; tarifs: TarifVehicule[]
  params?: ParamsCalc | null
  defaultDatetime: string
  coursesAssignees?: { id: string; chauffeur_id: string; date_prevue: string; adresse_depart: string }[]
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError]          = useState<string | null>(null)
  // Avertissements affichés avant création : un premier clic les révèle, un
  // second confirme. Une course sans prix n'envoie ni reçu ni demande d'avis,
  // et une date erronée disparaît du planning sans que personne ne la voie.
  const [avertissements, setAvertissements] = useState<string[]>([])

  const [depart,  setDepart]  = useState<AdresseVal>({ label: '', codePostal: '' })
  const [arrivee, setArrivee] = useState<AdresseVal>({ label: '', codePostal: '' })
  const [etapes,  setEtapes]  = useState<AdresseVal[]>([])
  const [dateHeure, setDateHeure] = useState(defaultDatetime)
  const [vehicule, setVehicule]   = useState('berline')
  const [prixManuel, setPrixManuel] = useState<string>('')
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [clientId, setClientId]     = useState('')
  const [passagerMode, setPassagerMode] = useState<'compte' | 'libre'>('compte')
  const [passagerPrenom, setPassagerPrenom] = useState('')
  const [passagerNom, setPassagerNom]       = useState('')
  const [passagerTel, setPassagerTel]       = useState('')
  const [passagerEmail, setPassagerEmail]   = useState('')
  const [creerCompte, setCreerCompte]       = useState(false)
  const [allerRetour, setAllerRetour] = useState(false)
  const [dateRetour, setDateRetour]   = useState('')
  // Vide = le retour ramène à l'adresse de départ de l'aller (cas courant).
  const [arriveeRetour, setArriveeRetour] = useState<AdresseVal>({ label: '', codePostal: '' })
  const [numVolTrain, setNumVolTrain] = useState('')
  const [terminal, setTerminal]       = useState('')
  const [heureArrivee, setHeureArrivee] = useState('')
  const [chauffeurId, setChauffeurId]         = useState('')
  const [sousTraitantId, setSousTraitantId]   = useState('')
  const [collaborateurId, setCollaborateurId] = useState('')

  function handleChauffeurChange(id: string) {
    setChauffeurId(id)
    const c = chauffeurs.find((c: ChauffeurOption) => c.id === id)
    if (c?.sous_traitant_id) setSousTraitantId(c.sous_traitant_id)
    else setSousTraitantId('')
  }

  function handleClientChange(id: string) {
    setClientId(id)
    setCollaborateurId('')
  }

  const activeZones = useMemo(() => zones.filter(z => z.code !== 'HORS'), [zones])
  const zoneDepart  = useMemo(() => detectZone(depart.codePostal,  activeZones, depart.label),  [depart,  activeZones])
  const zoneArrivee = useMemo(() => detectZone(arrivee.codePostal, activeZones, arrivee.label), [arrivee, activeZones])

  const mightBeForfait = !!(zoneDepart && zoneArrivee && (isForfaitZone(zoneDepart) || isForfaitZone(zoneArrivee)))

  const forfaitPrix = useMemo(() => {
    if (!mightBeForfait || !zoneDepart || !zoneArrivee) return null
    return calculerPrix(zoneDepart.id, zoneArrivee.id, vehicule, dateHeure, grille, tarifs, activeZones, params)
  }, [mightBeForfait, zoneDepart, zoneArrivee, vehicule, dateHeure, grille, tarifs, activeZones, params])

  const useForfait = forfaitPrix !== null

  const prixAuto = useMemo(() => {
    if (useForfait) return forfaitPrix
    if (distanceKm) return calculerPrixKm(distanceKm, vehicule, dateHeure, tarifs, params)
    return null
  }, [useForfait, forfaitPrix, vehicule, distanceKm, dateHeure, tarifs, params])

  // Fetch OSRM distance when in km mode
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (useForfait || !depart.lat || !arrivee.lat) { setDistanceKm(null); return }
    let alive = true
    fetchDistanceKm(depart, arrivee).then(d => { if (alive) setDistanceKm(d) })
    return () => { alive = false }
  }, [useForfait, depart.lat, depart.lng, arrivee.lat, arrivee.lng])

  const prixFinal = prixManuel !== '' ? parseFloat(prixManuel) : prixAuto

  const selectedClient    = clients.find(c => c.id === clientId)
  const isEntreprise      = selectedClient?.type_compte === 'entreprise'
  const filteredCollabs   = collabs.filter(c => c.client_id === clientId)
  const selectedChauffeur = chauffeurs.find((c: ChauffeurOption) => c.id === chauffeurId)
  const isInternalChauffeur = !!chauffeurId && !selectedChauffeur?.sous_traitant_id

  /** Date dans le passé = toujours une erreur de saisie : on bloque. */
  function erreurBloquante(): string | null {
    const d = new Date(dateHeure)
    if (isNaN(d.getTime())) return 'Date invalide.'
    if (d.getTime() < Date.now()) {
      return `La date saisie (${d.toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' })}) est déjà passée.`
    }
    return null
  }

  /** Situations douteuses mais parfois légitimes : on demande confirmation. */
  function calculerAvertissements(): string[] {
    const out: string[] = []
    const heures = (new Date(dateHeure).getTime() - Date.now()) / 3_600_000

    if (heures < 24) {
      // Arrondir en minutes d'abord : sinon 2,999 h donne « 2 h 60 ».
      const totalMin = Math.round(heures * 60)
      const delai = totalMin >= 60
        ? `${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, '0')}`
        : `${totalMin} minutes`
      out.push(`Cette course démarre dans ${delai}. Vérifiez qu'un chauffeur est disponible.`)
    }
    if (heures > 24 * 183) {
      out.push(`La date est à plus de 6 mois (${new Date(dateHeure).toLocaleDateString('fr-FR', { dateStyle: 'long' })}). Erreur d'année ?`)
    }
    if (prixFinal === null) {
      out.push("Aucun prix n'est renseigné. Sans prix, le client ne recevra ni reçu ni demande d'avis Google à la fin de la course.")
    } else if (allerRetour) {
      // Deux courses sont créées, chacune au prix saisi : le montant réellement
      // facturé est le double, et rien ne le disait avant de valider.
      out.push(`Aller-retour : deux courses à ${prixFinal} € seront créées, soit ${prixFinal * 2} € facturés au client.`)
    }

    // Chauffeur déjà pris. Les courses n'ont pas de durée en base : on signale
    // toute autre course du même chauffeur à moins de 2 h, à l'admin de juger.
    if (chauffeurId) {
      const cible = new Date(dateHeure).getTime()
      const proches = coursesAssignees.filter(c =>
        c.chauffeur_id === chauffeurId &&
        Math.abs(new Date(c.date_prevue).getTime() - cible) < 2 * 3_600_000
      )
      for (const c of proches) {
        const quand = new Date(c.date_prevue).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
        out.push(`Ce chauffeur a déjà une course le ${quand} au départ de ${c.adresse_depart}. Vérifiez qu'il peut enchaîner.`)
      }
    }
    return out
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const bloquant = erreurBloquante()
    if (bloquant) { setAvertissements([]); setError(bloquant); return }

    // Premier clic : on révèle les avertissements sans créer. Second clic : on crée.
    // On compare le contenu et pas seulement la présence : si l'utilisateur corrige
    // un point entre les deux clics, la nouvelle liste doit être relue avant de créer.
    const nouveaux = calculerAvertissements()
    if (nouveaux.length > 0 && nouveaux.join('|') !== avertissements.join('|')) {
      setAvertissements(nouveaux)
      return
    }

    const fd = new FormData(e.currentTarget)
    fd.set('adresse_depart', depart.label || (fd.get('adresse_depart') as string))
    fd.set('adresse_arrivee', arrivee.label || (fd.get('adresse_arrivee') as string))
    fd.set('etapes', JSON.stringify(etapes.map(e => e.label).filter(e => e.trim())))
    if (prixFinal !== null) fd.set('prix_estime', String(prixFinal))
    fd.set('passager_mode', passagerMode)
    fd.set('passager_prenom', passagerPrenom)
    fd.set('passager_nom', passagerNom)
    fd.set('passager_tel', passagerTel)
    fd.set('passager_email', passagerEmail)
    fd.set('creer_compte', creerCompte ? 'true' : 'false')
    fd.set('aller_retour', allerRetour ? 'true' : 'false')
    fd.set('date_retour', dateRetour)
    fd.set('adresse_arrivee_retour', arriveeRetour.label)
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
        <Section title="Trajet">
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
                  <AddressInput
                    name={`etape_${i}`}
                    placeholder={`Étape ${i + 1} — adresse intermédiaire`}
                    dotColor="var(--amber)"
                    dotShape="circle"
                    value={etape}
                    onChange={v => setEtapes(prev => prev.map((old, j) => j === i ? v : old))}
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
                onClick={() => setEtapes(prev => [...prev, { label: '', codePostal: '' }])}
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
        </Section>

        {/* Planification : date, passagers, aller-retour, vol/train */}
        <Section title="Planification">
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
              {/* Le retour ne ramène pas toujours au point de départ : hôtel,
                  domicile d'un proche, autre adresse. Sans ce champ, il fallait
                  corriger la course après coup — ou ne pas s'en apercevoir. */}
              <div>
                <label style={lbl}>Adresse d'arrivée du retour</label>
                <AddressInput
                  name="adresse_arrivee_retour_visible"
                  placeholder={depart.label ? `Par défaut : ${depart.label}` : "Par défaut : adresse de départ de l'aller"}
                  dotColor="var(--green)" dotShape="circle"
                  value={arriveeRetour} onChange={setArriveeRetour}
                />
              </div>
              {(depart.label || arrivee.label) && (
                <div style={{
                  fontSize: 11, color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '6px 10px', borderRadius: 7, background: 'var(--elevated)', border: '1px solid var(--t3)',
                  flexWrap: 'wrap',
                }}>
                  <span style={{ color: 'var(--red)', fontSize: 9 }}>●</span>
                  <span style={{ color: 'var(--t3)' }}>{arrivee.label || '…'}</span>
                  <span style={{ color: 'var(--t3)' }}>→</span>
                  <span style={{ color: 'var(--grn)', fontSize: 9 }}>●</span>
                  <span style={{ color: arriveeRetour.label ? 'var(--gold)' : 'var(--t3)' }}>
                    {arriveeRetour.label || depart.label || '…'}
                  </span>
                  <span style={{ marginLeft: 4, fontSize: 9, color: 'var(--t3)' }}>
                    {arriveeRetour.label ? '(adresse de retour spécifique)' : '(adresses inversées)'}
                  </span>
                </div>
              )}
              <div style={{ fontSize: 10, color: 'var(--t3)' }}>
                Le retour reprend le prix saisi ci-dessous, modifiable ensuite sur sa fiche.
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
        </Section>

        {/* Véhicule & tarif */}
        <Section title="Véhicule & tarif">
        <div>
          <label style={lbl}>Type de véhicule</label>
          <select name="type_vehicule" required style={sel} value={vehicule} onChange={e => setVehicule(e.target.value)}>
            <option value="berline">Berline</option>
            <option value="berline_premium">Berline Premium</option>
            <option value="van">Van / Minibus</option>
          </select>
        </div>

        <div>
          <label style={lbl}>
            {allerRetour ? 'Prix par trajet (€)' : 'Prix estimé (€)'}
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
          {/* Le prix saisi vaut pour UN trajet : l'aller-retour crée deux courses
              qui portent chacune ce montant. Sans ce rappel, un admin qui raisonne
              en total fait payer le double. */}
          {allerRetour && prixFinal !== null && (
            <div style={{
              marginTop: 8, padding: '9px 12px', borderRadius: 7,
              background: 'rgba(201,168,76,.08)', border: '1px solid rgba(201,168,76,.22)',
              fontSize: 12, color: 'var(--t1)',
            }}>
              <span style={{ fontFamily: 'var(--font-jetbrains), monospace' }}>{prixFinal} €</span>
              {' par trajet, aller et retour — '}
              <strong style={{ fontFamily: 'var(--font-jetbrains), monospace', color: 'var(--gold)' }}>
                {prixFinal * 2} € au total
              </strong>
              {' facturés au client.'}
            </div>
          )}
          {prixAuto !== null && prixManuel === '' && (
            <div style={{ fontSize: 10, color: 'var(--t3)', marginTop: 4 }}>
              Prix automatique appliqué — saisir une valeur pour le remplacer
            </div>
          )}
        </div>
        </Section>

        {/* Passager */}
        <Section title="Passager">
          {/* Toggle compte / libre */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['compte', 'libre'] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => { setPassagerMode(mode); if (mode === 'compte') { setPassagerPrenom(''); setPassagerNom(''); setPassagerTel('') } else { setClientId('') } }}
                style={{
                  padding: '6px 14px', borderRadius: 7, cursor: 'pointer',
                  fontFamily: 'var(--font-dm-sans), sans-serif', fontSize: 12, fontWeight: passagerMode === mode ? 600 : 400,
                  border: `1px solid ${passagerMode === mode ? 'rgba(201,168,76,.5)' : 'var(--t3)'}`,
                  background: passagerMode === mode ? 'rgba(201,168,76,.1)' : 'var(--elevated)',
                  color: passagerMode === mode ? 'var(--gold)' : 'var(--t2)',
                }}
              >
                {mode === 'compte' ? '👤 Compte client' : '✏️ Saisie libre'}
              </button>
            ))}
          </div>

          {passagerMode === 'compte' ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label style={lbl}>Client (compte enregistré)</label>
                <select name="client_id" value={clientId} onChange={e => handleClientChange(e.target.value)} style={sel}>
                  <option value="">— Non assigné —</option>
                  {clients.map(c => {
                    const nom = c.type_compte === 'entreprise' ? (c.entreprise_nom ?? '—') : `${c.profiles?.prenom ?? ''} ${c.profiles?.nom ?? ''}`.trim()
                    return <option key={c.id} value={c.id}>{nom}</option>
                  })}
                </select>
              </div>
              {isEntreprise && (
                <div>
                  <label style={lbl}>Collaborateur voyageur</label>
                  <select name="collaborateur_id" value={collaborateurId} onChange={e => setCollaborateurId(e.target.value)} style={sel}>
                    <option value="">— Aucun (course entreprise générale) —</option>
                    {filteredCollabs.length === 0
                      ? <option disabled value="">Aucun collaborateur enregistré pour ce compte</option>
                      : filteredCollabs.map(c => {
                          const nom = `${c.prenom ?? ''} ${c.nom ?? ''}`.trim() || '—'
                          return <option key={c.id} value={c.id}>{nom}{c.poste ? ` — ${c.poste}` : ''}</option>
                        })
                    }
                  </select>
                </div>
              )}
            </>
          ) : (
            <div style={{
              padding: 16, borderRadius: 10,
              background: 'rgba(201,168,76,.04)', border: '1px solid rgba(201,168,76,.15)',
              display: 'flex', flexDirection: 'column', gap: 12,
            }}>
              <div style={{ fontSize: 10, color: 'var(--t2)', marginBottom: 2 }}>
                Client ponctuel — renseignez l'email pour créer un compte automatiquement
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Prénom *</label>
                  <input
                    value={passagerPrenom} onChange={e => setPassagerPrenom(e.target.value)}
                    placeholder="Prénom du passager" style={inp}
                  />
                </div>
                <div>
                  <label style={lbl}>Nom *</label>
                  <input
                    value={passagerNom} onChange={e => setPassagerNom(e.target.value)}
                    placeholder="Nom du passager" style={inp}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={lbl}>Téléphone</label>
                  <input
                    value={passagerTel} onChange={e => setPassagerTel(e.target.value)}
                    placeholder="06 XX XX XX XX" type="tel"
                    style={{ ...inp, fontFamily: 'var(--font-jetbrains), monospace', letterSpacing: '.04em' }}
                  />
                </div>
                <div>
                  <label style={lbl}>Email client</label>
                  <input
                    value={passagerEmail} onChange={e => { setPassagerEmail(e.target.value); if (!e.target.value) setCreerCompte(false) }}
                    placeholder="client@email.com" type="email"
                    style={inp}
                  />
                </div>
              </div>
              {passagerEmail && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', padding: '10px 14px', background: creerCompte ? 'rgba(61,184,122,.08)' : 'rgba(201,168,76,.04)', borderRadius: 8, border: `1px solid ${creerCompte ? 'rgba(61,184,122,.3)' : 'rgba(201,168,76,.15)'}`, transition: 'all .15s' }}>
                  <input
                    type="checkbox" checked={creerCompte} onChange={e => setCreerCompte(e.target.checked)}
                    style={{ width: 16, height: 16, accentColor: '#3DB87A', cursor: 'pointer' }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--t1)' }}>Créer un compte client et envoyer les identifiants par email</div>
                    <div style={{ fontSize: 11, color: 'var(--t2)', marginTop: 2 }}>Un mot de passe temporaire sera généré automatiquement et envoyé à {passagerEmail}</div>
                  </div>
                </label>
              )}
            </div>
          )}
        </Section>

        {/* Chauffeur / Sous-traitant */}
        <Section title="Attribution">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={isInternalChauffeur ? { gridColumn: '1 / -1' } : {}}>
            <label style={lbl}>Chauffeur</label>
            <select name="chauffeur_id" style={sel} value={chauffeurId} onChange={e => handleChauffeurChange(e.target.value)}>
              <option value="">— Non assigné —</option>
              {chauffeurs.map((c: ChauffeurOption) => {
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
          {!isInternalChauffeur && (
            <div>
              <label style={lbl}>Sous-traitant</label>
              <select name="sous_traitant_id" style={sel} value={sousTraitantId} onChange={e => setSousTraitantId(e.target.value)}>
                <option value="">— Aucun —</option>
                {sousTraitants.map((st: SousTraitantOption) => (
                  <option key={st.id} value={st.id}>{st.nom}</option>
                ))}
              </select>
            </div>
          )}
          {!isInternalChauffeur && (
            <div>
              <label style={lbl}>Prix sous-traitant (€)</label>
              <input type="number" name="prix_sous_traitant" min={0} step={0.5}
                placeholder="0.00"
                style={inp} />
            </div>
          )}
        </div>
        </Section>

        {/* Notes */}
        <Section title="Notes">
        <div>
          <textarea name="notes" rows={3} placeholder="Instructions particulières, références client, etc."
            style={{ ...inp, resize: 'vertical', height: 'auto', paddingTop: 10, paddingBottom: 10 }} />
        </div>
        </Section>

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

        {/* Avertissements — à confirmer avant création */}
        {avertissements.length > 0 && (
          <div style={{
            padding: '14px 16px', borderRadius: 8,
            background: 'rgba(232,160,48,.08)', border: '1px solid rgba(232,160,48,.28)',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
              color: 'var(--amber)', marginBottom: 10,
            }}>
              {avertissements.length > 1 ? `${avertissements.length} points à vérifier` : 'Point à vérifier'}
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 7 }}>
              {avertissements.map((a, i) => (
                <li key={i} style={{ fontSize: 12.5, color: 'var(--t1)', lineHeight: 1.5 }}>{a}</li>
              ))}
            </ul>
            <div style={{ fontSize: 11.5, color: 'var(--t2)', marginTop: 11 }}>
              Corrigez si nécessaire, ou cliquez à nouveau sur « Créer » pour confirmer.
            </div>
          </div>
        )}

        {/* Submit */}
        <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
          <button type="submit" disabled={pending} style={{
            padding: '13px 32px', borderRadius: 10,
            background: pending ? 'var(--elevated)' : avertissements.length ? 'var(--amber)' : 'var(--gold)',
            border: 'none', color: pending ? 'var(--t2)' : 'var(--base)',
            fontSize: 13, fontWeight: 600, cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'var(--font-dm-sans), sans-serif',
            boxShadow: pending ? 'none'
              : avertissements.length ? '0 4px 16px rgba(232,160,48,.3)' : '0 4px 16px rgba(201,168,76,.3)',
          }}>
            {pending ? 'Création en cours…'
              : avertissements.length ? 'Créer malgré tout'
              : 'Créer la course'}
          </button>
          <Link href="/admin/courses" style={{
            padding: '13px 24px', borderRadius: 10,
            background: 'var(--elevated)', border: '1px solid var(--t3)',
            color: 'var(--t2)', fontSize: 13, fontWeight: 500,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            textDecoration: 'none', display: 'flex', alignItems: 'center',
          }}>
            Annuler
          </Link>
        </div>
      </div>
    </form>
  )
}
