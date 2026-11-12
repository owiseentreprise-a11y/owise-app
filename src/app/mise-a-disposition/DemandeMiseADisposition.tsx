'use client'

/**
 * Le simulateur et la demande de mise à disposition.
 *
 * POURQUOI UN SEUL COMPOSANT POUR LES DEUX
 *
 * Le prix affiché et le prix envoyé doivent être le même nombre, calculé une
 * fois. Les séparer en deux composants obligerait à le recalculer ou à le
 * faire transiter, et c'est précisément ainsi que naissent les divergences
 * que `calcPrix.ts` existe pour empêcher.
 *
 * LE CALCUL N'EST PAS ÉCRIT ICI. Il vient de `prixMiseADisposition()`, dans
 * `calcPrix.ts`, avec toutes les autres règles de prix du projet. Ce fichier
 * ne fait que l'appeler et montrer le résultat.
 *
 * LES PRIX NON PLUS. Ils arrivent en `props`, lus depuis la table `tarifs`
 * par la page serveur. Aucun montant n'est écrit dans ce fichier : un prix
 * en dur ici serait un second barème, hors de portée d'/admin/tarifs.
 */

import { useMemo, useState, useTransition } from 'react'
import { prixMiseADisposition, type TarifCalc } from '@/lib/calcPrix'
import { vehiculeParCle } from '@/lib/gamme'
import { formaterMontant } from '@/lib/montant'
import {
  DUREES_PROPOSEES, MENTION_TARIFS, MENTION_TARIFS_EN, destinationPourDemande,
} from '@/lib/mise-a-disposition'
import { soumettreDevis } from '@/app/vitrine/actions'

export type VehiculeMAD = {
  cle: string
  nom: string
  places: string
  /** `null` = sur devis. Jamais remplacé par une valeur de repli. */
  prixHeure: number | null
}

/**
 * LES DEUX LANGUES, COTE A COTE.
 *
 * Meme choix que `/en/book` : un composant, un calcul, deux dictionnaires.
 * Semer des `langue === 'en' ? ... : ...` dans le rendu garantit qu'une
 * phrase finira par n'exister que dans une langue, sans que rien ne le dise.
 * Ici, une cle absente ne compile pas.
 */
const MOTS = {
  fr: {
    vehicule: 'Votre véhicule',
    surDevis: 'sur devis',
    duree: 'Durée',
    heures: (h: number) => `${h} heures`,
    prix: 'Prix annoncé',
    mention: MENTION_TARIFS,
    adresse: 'Adresse de prise en charge',
    adressePlaceholder: 'Numéro, rue, ville',
    jour: 'Jour',
    debut: 'Heure de début',
    passagers: 'Passagers',
    nom: 'Nom et prénom',
    tel: 'Téléphone',
    email: 'E-mail',
    societe: 'Société (facultatif)',
    envoyer: 'Demander cette mise à disposition',
    envoiEnCours: 'Envoi\u2026',
    echec: 'Envoi impossible. Réessayez ou appelez-nous.',
    merciTitre: 'Votre demande est partie.',
    merciDebut: 'Nous vous répondons avec un devis à ',
    merciFin: '. Si votre demande est urgente, appelez-nous : c\u2019est plus rapide.',
  },
  en: {
    vehicule: 'Your vehicle',
    surDevis: 'on request',
    duree: 'Duration',
    heures: (h: number) => `${h} hours`,
    prix: 'Quoted price',
    mention: MENTION_TARIFS_EN,
    adresse: 'Pick-up address',
    adressePlaceholder: 'Number, street, town',
    jour: 'Date',
    debut: 'Start time',
    passagers: 'Passengers',
    nom: 'Full name',
    tel: 'Phone',
    email: 'Email',
    societe: 'Company (optional)',
    envoyer: 'Request this booking',
    envoiEnCours: 'Sending\u2026',
    echec: 'Could not send. Please try again, or call us.',
    merciTitre: 'Your request has been sent.',
    merciDebut: 'We will reply with a quote at ',
    merciFin: '. If your request is urgent, calling us is faster.',
  },
} as const

const OR = '#C9A84C'
const CREME = '#EDE8DF'
const DOUX = 'rgba(237,232,223,.72)'
const PALE = 'rgba(237,232,223,.60)'

const champStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'rgba(237,232,223,.04)',
  border: '1px solid rgba(201,168,76,.22)',
  borderRadius: 9, padding: '11px 13px',
  fontSize: 14, color: CREME,
  fontFamily: 'inherit', outline: 'none',
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: PALE }}>
        {label}
      </span>
      {children}
    </label>
  )
}

export default function DemandeMiseADisposition(
  { vehicules, langue = 'fr' }: { vehicules: VehiculeMAD[]; langue?: 'fr' | 'en' },
) {
  const m = MOTS[langue]

  /* Le premier véhicule réellement tarifé ouvre la page : proposer d'emblée
     un véhicule « sur devis » cacherait le prix, qui est la raison d'être
     de cette page. */
  const premier = vehicules.find(v => v.prixHeure != null) ?? vehicules[0]

  const [cle, setCle]       = useState(premier?.cle ?? '')
  const [heures, setHeures] = useState<number>(4)
  const [adresse, setAdresse] = useState('')
  const [jour, setJour]     = useState('')
  const [heureDebut, setHeureDebut] = useState('')
  const [pax, setPax]       = useState(2)
  const [nom, setNom]       = useState('')
  const [tel, setTel]       = useState('')
  const [email, setEmail]   = useState('')
  const [societe, setSociete] = useState('')

  const [envoi, demarrer]   = useTransition()
  const [envoye, setEnvoye] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const choisi = vehicules.find(v => v.cle === cle) ?? null

  /* `TarifCalc` attend une ligne complète ; seul `prix_heure` sert ici, mais
     on passe par le vrai type pour que la fonction du moteur de prix soit
     appelée telle quelle, sans variante maison.

     LE NOM EMPLOYÉ ICI EST CELUI DE `gamme.ts`, JAMAIS `v.nom`.
     `v.nom` est le nom AFFICHÉ, et la page anglaise le traduit : « Sedan »,
     « Large van, 8 seats ». Or `prixMiseADisposition` retrouve la ligne de
     tarif par ce nom. Avec le nom traduit, la recherche échouait et le
     calculateur anglais affichait « on request » pour tous les véhicules,
     alors que les cartes juste au-dessus montraient bien 60 €/h — défaut
     vu à l'écran le 2026-11-13, invisible à la compilation.

     Règle générale du projet : le nom qui relie un véhicule à son tarif
     vient de `gamme.ts` et ne se traduit pas. */
  const lignes: TarifCalc[] = useMemo(() => vehicules.map(v => ({
    vehicule: vehiculeParCle(v.cle)?.nomTarif ?? v.nom,
    prise_en_charge: 0, prix_km: 0,
    cdg_fixe: 0, orly_fixe: 0, beauvais_fixe: 0,
    prix_heure: v.prixHeure,
  })), [vehicules])

  const calcul = useMemo(
    () => (cle ? prixMiseADisposition(cle, heures, lignes) : null),
    [cle, heures, lignes],
  )

  function envoyer(e: React.FormEvent) {
    e.preventDefault()
    setErreur(null)
    demarrer(async () => {
      try {
        await soumettreDevis({
          nom, tel, email,
          societe: societe.trim() || null,
          origin: adresse,
          /* Pas d'adresse d'arrivée : une mise à disposition n'en a pas.
             On y écrit la durée, pour que « Demandes reçues » reste lisible
             sans qu'aucun écran d'administration connaisse ce service. */
          destination: destinationPourDemande(heures),
          date_course: jour || null,
          heure: heureDebut || null,
          pax,
          vehicle: choisi?.nom ?? '',
          price: calcul?.prix ?? null,
          dest_type: 'mise_a_disposition',
        })
        setEnvoye(true)
      } catch (err) {
        setErreur(err instanceof Error ? err.message : m.echec)
      }
    })
  }

  if (envoye) {
    return (
      <div style={{
        background: 'rgba(61,184,122,.08)', border: '1px solid rgba(61,184,122,.32)',
        borderRadius: 14, padding: '28px 26px', color: CREME,
      }}>
        <div style={{
          fontFamily: "var(--font-cormorant), 'Cormorant Garamond', serif",
          fontSize: 26, marginBottom: 10,
        }}>
          {m.merciTitre}
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.7, color: DOUX, margin: 0 }}>
          {m.merciDebut}
          <strong style={{ color: CREME }}>{email}</strong>{m.merciFin}
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={envoyer} style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

      {/* ── Le véhicule ─────────────────────────────────────────────── */}
      <div>
        <p style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: PALE, marginBottom: 10 }}>
          {m.vehicule}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
          {vehicules.map(v => {
            const actif = v.cle === cle
            return (
              <button
                key={v.cle} type="button" onClick={() => setCle(v.cle)}
                aria-pressed={actif}
                style={{
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  background: actif ? 'rgba(201,168,76,.12)' : 'rgba(237,232,223,.03)',
                  border: `1px solid ${actif ? 'rgba(201,168,76,.55)' : 'rgba(201,168,76,.16)'}`,
                  borderRadius: 12, padding: '14px 15px', minHeight: 44,
                  transition: 'border-color .15s, background .15s',
                }}
              >
                <div style={{ fontSize: 14.5, fontWeight: 600, color: actif ? OR : CREME, marginBottom: 3 }}>
                  {v.nom}
                </div>
                <div style={{ fontSize: 11.5, color: PALE, marginBottom: 8 }}>{v.places}</div>
                <div style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 15, fontWeight: 600, color: v.prixHeure == null ? DOUX : OR,
                }}>
                  {v.prixHeure == null ? m.surDevis : `${formaterMontant(v.prixHeure)} / h`}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── La durée, et le prix ────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(200px, 1fr) minmax(200px, 1fr)', gap: 14, alignItems: 'end' }}>
        <Champ label={m.duree}>
          <select value={heures} onChange={e => setHeures(Number(e.target.value))} style={champStyle}>
            {DUREES_PROPOSEES.map(h => (
              <option key={h} value={h}>{m.heures(h)}</option>
            ))}
          </select>
        </Champ>

        <div style={{
          background: 'rgba(201,168,76,.07)', border: '1px solid rgba(201,168,76,.22)',
          borderRadius: 12, padding: '13px 16px',
        }}>
          <div style={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: PALE, marginBottom: 4 }}>
            {m.prix}
          </div>
          <div style={{
            fontFamily: "var(--font-jetbrains), monospace",
            fontSize: 24, fontWeight: 600, color: calcul ? OR : DOUX, lineHeight: 1.1,
          }}>
            {calcul ? formaterMontant(calcul.prix) : m.surDevis}
          </div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, lineHeight: 1.65, color: PALE, margin: 0 }}>
        {m.mention}
      </p>

      {/* ── La prestation ───────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <Champ label={m.adresse}>
          <input required value={adresse} onChange={e => setAdresse(e.target.value)}
            placeholder={m.adressePlaceholder} style={champStyle} />
        </Champ>
        <Champ label={m.jour}>
          <input required type="date" value={jour} onChange={e => setJour(e.target.value)} style={champStyle} />
        </Champ>
        <Champ label={m.debut}>
          <input required type="time" value={heureDebut} onChange={e => setHeureDebut(e.target.value)} style={champStyle} />
        </Champ>
        <Champ label={m.passagers}>
          <input required type="number" min={1} max={8} value={pax}
            onChange={e => setPax(Math.max(1, Math.min(8, Number(e.target.value) || 1)))} style={champStyle} />
        </Champ>
      </div>

      {/* ── Vous ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
        <Champ label={m.nom}>
          <input required value={nom} onChange={e => setNom(e.target.value)} style={champStyle} />
        </Champ>
        <Champ label={m.tel}>
          <input required type="tel" value={tel} onChange={e => setTel(e.target.value)} style={champStyle} />
        </Champ>
        <Champ label={m.email}>
          <input required type="email" value={email} onChange={e => setEmail(e.target.value)} style={champStyle} />
        </Champ>
        <Champ label={m.societe}>
          <input value={societe} onChange={e => setSociete(e.target.value)} style={champStyle} />
        </Champ>
      </div>

      {erreur && (
        <div style={{ fontSize: 13, color: '#F07070' }}>{erreur}</div>
      )}

      <button
        type="submit" disabled={envoi}
        style={{
          alignSelf: 'flex-start', minHeight: 48, padding: '13px 28px',
          borderRadius: 11, border: 'none', cursor: envoi ? 'wait' : 'pointer',
          background: OR, color: '#09091A',
          fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit',
          opacity: envoi ? .6 : 1, transition: 'opacity .15s',
        }}
      >
        {envoi ? m.envoiEnCours : m.envoyer}
      </button>
    </form>
  )
}
