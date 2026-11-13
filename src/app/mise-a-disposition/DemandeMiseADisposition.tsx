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

import Image from 'next/image'
import { useMemo, useState, useTransition } from 'react'
import { prixMiseADisposition, type TarifCalc } from '@/lib/calcPrix'
import { vehiculeParCle } from '@/lib/gamme'
import { formaterMontant } from '@/lib/montant'
import { MENTION_ILLUSTRATION, MENTION_ILLUSTRATION_EN } from '@/lib/presentation-vehicules'
import {
  DUREES_PROPOSEES, MENTION_TARIFS, MENTION_TARIFS_EN, destinationPourDemande,
  phraseKilometres, MEME_ZONE, MEME_ZONE_EN, FRAIS_EN_SUS, FRAIS_EN_SUS_EN,
} from '@/lib/mise-a-disposition'
import { soumettreDevis } from '@/app/vitrine/actions'

export type VehiculeMAD = {
  cle: string
  nom: string
  places: string
  /** `null` = sur devis. Jamais remplacé par une valeur de repli. */
  prixHeure: number | null
  /** Prix du km au-delà du forfait. `null` : aucun dépassement facturé. */
  prixKmSup: number | null
  /** L'illustration de la catégorie, celle que la flotte affiche déjà sur
      l'accueil. `null` : la carte s'affiche sans bulle, sans casser. */
  image: string | null
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
    /* SEULEMENT LE PRIX DU KM AU-DELA, sur la carte du vehicule.
       La phrase complete disait aussi « 20 km compris par heure » — vrai,
       mais IDENTIQUE pour les quatre vehicules, et deja ecrit dans les
       reperes du bandeau. Sur un telephone, cette redite occupait trois
       lignes par carte et portait leur hauteur a 217 px : le prix total
       finissait 448 px sous le pli. Ne reste ici que ce qui DISTINGUE un
       vehicule d'un autre. Le forfait complet, lui, s'affiche sous le prix
       des qu'une duree est choisie. */
    kmSup: (kmSup: number) => `+ ${formaterMontant(kmSup)} / km au-delà`,
    illustration: MENTION_ILLUSTRATION,
    duree: 'Durée',
    heures: (h: number) => `${h} heures`,
    prix: 'Prix annoncé',
    mention: MENTION_TARIFS,
    memeZone: MEME_ZONE,
    fraisEnSus: FRAIS_EN_SUS,
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
    kmSup: (kmSup: number) => `+ ${formaterMontant(kmSup)} / km beyond`,
    illustration: MENTION_ILLUSTRATION_EN,
    duree: 'Duration',
    heures: (h: number) => `${h} hours`,
    prix: 'Quoted price',
    mention: MENTION_TARIFS_EN,
    memeZone: MEME_ZONE_EN,
    fraisEnSus: FRAIS_EN_SUS_EN,
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

/* LES JETONS VIENNENT DE `vitrine.css`, SOUS `.vt` — ET CE COMPOSANT SERT
   AUSSI LA PAGE ANGLAISE, qui n'est pas sous `.vt` et garde sa charte bleu
   nuit. Chaque `var()` porte donc un repli. Sans lui, le 2026-11-13, le
   bouton « Request this booking » s'est affiche en creme sur or :
   contraste 1,87, illisible, alors que la page francaise etait parfaite.
   Un composant partage ne doit dependre d'aucun jeton qu'il ne garantit pas. */
const OR = 'var(--gold)'
const CREME = 'var(--t1)'
const DOUX = 'var(--t2)'
const PALE = 'var(--t2)'

const champStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--papier, rgba(237,232,223,.04))',
  border: '1px solid rgba(var(--contraste-rvb, 237,232,223),.14)',
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
    prix_km_sup: v.prixKmSup,
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
        background: 'var(--papier, rgba(237,232,223,.04))', border: '1px solid var(--gold)',
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
        {/* 145 px ET NON 190 — mesuré. Sur un téléphone de 390 px, la
            largeur utile à l'intérieur du panneau est de 310 px : avec
            190 px de minimum, les quatre véhicules s'empilaient sur quatre
            lignes et repoussaient le prix à 1292 px du haut, soit 448 px
            sous le pli. À 145 px ils tiennent en 2 × 2. Sur grand écran,
            `auto-fit` efface les colonnes vides : les quatre restent sur
            une seule ligne. */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: 10 }}>
          {vehicules.map(v => {
            const actif = v.cle === cle
            return (
              <button
                key={v.cle} type="button" onClick={() => setCle(v.cle)}
                aria-pressed={actif}
                style={{
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  /* MÊME FOND POUR LES QUATRE, et c'est mesuré. La carte
                     active portait `--gm`, un voile doré : il éclaircit le
                     fond juste assez pour que le prix en terracotta tombe à
                     4,43 au lieu des 4,5 exigés. La sélection se lit au trait
                     doré et à la bordure épaisse, qui ne changent rien au
                     contraste du texte. */
                  background: 'var(--papier, rgba(237,232,223,.04))',
                  border: `1px solid ${actif ? 'var(--gold)' : 'rgba(var(--contraste-rvb, 237,232,223),.10)'}`,
                  borderLeft: `3px solid ${actif ? 'var(--gold)' : 'rgba(var(--contraste-rvb, 237,232,223),.10)'}`,
                  borderRadius: 12, padding: '14px 15px', minHeight: 44,
                  transition: 'border-color .15s',
                }}
              >
                {/* LA BULLE : on reconnaît une catégorie de véhicule d'un
                    coup d'œil, bien avant d'avoir lu son nom. Demande de
                    l'exploitant le 2026-11-13 : « il faut faire une bulle
                    pour illustrer la catégorie ». L'illustration est celle
                    que la flotte affiche déjà sur l'accueil, lue dans
                    `presentation-vehicules.ts` — pas un second jeu d'images.

                    `aria-hidden` : le nom et la capacité sont juste à côté,
                    en toutes lettres. Annoncer en plus « berline blanche et
                    chauffeur en costume » ferait répéter la même chose à un
                    lecteur d'écran. */}
                {/* `flexWrap` : dans une colonne de 150 px, la bulle et le
                    nom ne tiennent pas côte à côte. Plutôt qu'une requête
                    média, on laisse le nom passer SOUS la bulle quand la
                    place manque — la carte reste lisible à toute largeur. */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: 9, flexWrap: 'wrap' }}>
                  {/* `cover`, ET NON `contain`. Les quatre illustrations sont
                      des PNG OPAQUES (type de couleur 2, verifie) : chacune
                      porte deja son propre fond. Avec `contain`, l'image est
                      posee en boite aux lettres et il reste, autour, des
                      bandes de la couleur de la bulle — deux vignettes
                      claires et deux sombres, cernees de gris. `cover` la
                      laisse remplir la bulle : les quatre se lisent alors
                      comme une meme serie. Le vehicule est centre dans chaque
                      fichier, le rognage ne le coupe pas.

                      (Le commentaire etait d'abord ECRIT A L'INTERIEUR du
                      `{v.image && ( … )}` : une parenthese n'y attend qu'un
                      seul element, et la compilation a echoue net.) */}
                  {v.image && (
                    <span aria-hidden="true" style={{
                      position: 'relative', flexShrink: 0,
                      width: 56, height: 42, borderRadius: 9, overflow: 'hidden',
                      border: '1px solid rgba(var(--contraste-rvb, 237,232,223),.10)',
                    }}>
                      <Image
                        src={v.image} alt="" fill sizes="56px"
                        style={{ objectFit: 'cover', objectPosition: 'center' }}
                      />
                    </span>
                  )}
                  <span style={{ flex: '1 1 72px', minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 14.5, fontWeight: 600, color: actif ? OR : CREME }}>
                      {v.nom}
                    </span>
                    <span style={{ display: 'block', fontSize: 11.5, color: PALE, marginTop: 2 }}>{v.places}</span>
                  </span>
                </div>
                <div style={{
                  fontFamily: "var(--font-jetbrains), monospace",
                  fontSize: 15, fontWeight: 600, color: v.prixHeure == null ? DOUX : OR,
                }}>
                  {v.prixHeure == null ? m.surDevis : `${formaterMontant(v.prixHeure)} / h`}
                </div>
                {/* LE KILOMÉTRAGE EST ICI, ET PLUS DANS UNE GRILLE AU-DESSUS.
                    La page affichait la même information deux fois : une
                    grille « Tarif horaire par véhicule », puis ces mêmes
                    quatre véhicules dans le simulateur. Le doublon repoussait
                    le simulateur sous la ligne de flottaison — « pour faire la
                    simulation, c'est tout en bas », 2026-11-13. Une seule
                    écriture, à l'endroit où l'on choisit. */}
                {v.prixHeure != null && v.prixKmSup != null && (
                  <div style={{ fontSize: 11, color: PALE, marginTop: 6, lineHeight: 1.45 }}>
                    {m.kmSup(v.prixKmSup)}
                  </div>
                )}
              </button>
            )
          })}
        </div>
        {/* LA MÊME MENTION QUE SOUS LA FLOTTE DE L'ACCUEIL.
            Owise n'a pas de photographies de son parc : ces quatre images
            sont des illustrations, et le dire se fait à l'écran, pas
            seulement dans un texte alternatif que personne ne lit. La
            phrase vient de `presentation-vehicules.ts`, à côté des images
            qu'elle concerne — recopiée ici, elle aurait fini par ne plus
            exister que sur une des deux pages. */}
        <p style={{ fontSize: 11.5, lineHeight: 1.5, color: PALE, margin: '10px 0 0' }}>
          {m.illustration}
        </p>
      </div>

      {/* ── La durée, et le prix ──────────────────────────────────────
          UN FLEX QUI PASSE À LA LIGNE, ET PAS DEUX COLONNES FIXES.
          C'était `minmax(200px, 1fr) minmax(200px, 1fr)` : deux colonnes
          d'au moins 200 px plus 14 px d'écart, soit 414 px minimum. Sur un
          téléphone de 390 px, l'encart du prix sortait de l'écran — mesuré
          le 2026-11-13, il s'arrêtait à 455 px. `minmax` ne descend jamais
          sous son minimum : il déborde.
          Avec `flex: 1 1 220px`, les deux blocs se partagent la ligne quand
          il y a la place et s'empilent quand il n'y en a plus. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
          <Champ label={m.duree}>
            <select value={heures} onChange={e => setHeures(Number(e.target.value))} style={champStyle}>
              {DUREES_PROPOSEES.map(h => (
                <option key={h} value={h}>{m.heures(h)}</option>
              ))}
            </select>
          </Champ>
        </div>

        <div style={{
          flex: '1 1 220px', minWidth: 0,
          background: 'var(--nuit, #0D0D20)', border: '1px solid rgba(var(--contraste-rvb, 237,232,223),.14)',
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

      {/* LE FORFAIT KILOMETRIQUE, SOUS LE PRIX ET PAS EN BAS DE PAGE.
          Une limite qu'on decouvre a la facturation est une mauvaise
          surprise ; lue a cote du montant, c'est une condition. */}
      {calcul && (
        <div style={{
          background: 'var(--papier, rgba(237,232,223,.04))', border: '1px solid rgba(var(--contraste-rvb, 237,232,223),.08)',
          borderRadius: 11, padding: '12px 15px',
        }}>
          <div style={{ fontSize: 13.5, color: CREME, fontWeight: 600, marginBottom: 4 }}>
            {phraseKilometres(calcul.kmInclus, calcul.prixKmSup, formaterMontant, langue === 'en')}
          </div>
          <div style={{ fontSize: 12.5, lineHeight: 1.6, color: PALE }}>
            {m.memeZone}
          </div>
        </div>
      )}

      <p style={{ fontSize: 12.5, lineHeight: 1.65, color: PALE, margin: 0 }}>
        {m.mention} {m.fraisEnSus}
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
        <div style={{ fontSize: 13, color: 'var(--rouge, #F07070)' }}>{erreur}</div>
      )}

      <button
        type="submit" disabled={envoi}
        style={{
          alignSelf: 'flex-start', minHeight: 48, padding: '13px 28px',
          borderRadius: 11, border: 'none', cursor: envoi ? 'wait' : 'pointer',
          background: OR, color: 'var(--sur-or, #09091A)',
          fontSize: 14.5, fontWeight: 700, fontFamily: 'inherit',
          opacity: envoi ? .6 : 1, transition: 'opacity .15s',
        }}
      >
        {envoi ? m.envoiEnCours : m.envoyer}
      </button>
    </form>
  )
}
