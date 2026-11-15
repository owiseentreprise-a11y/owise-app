'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { textes } from '@/lib/langue'
import { initFbPixel } from '@/lib/pixel'
import { initGA } from '@/lib/ga'
import {
  lireConsentement, ecrireConsentement, EVENEMENT_OUVRIR_PANNEAU,
} from '@/lib/consentement'

/**
 * Consentement.tsx — LA SEULE SURFACE DE CONSENTEMENT DU SITE.
 *
 * ── POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Le site en avait DEUX, écrits dans deux fichiers :
 *
 *   · `.cookie-banner`  — rendu par `VitrineBody`, donc sur l'accueil et les
 *     39 pages villes. Lui seul portait le panneau de préférences détaillé,
 *     et son texte était écrit en clair, en français uniquement.
 *   · `.bandeau-cookies` — rendu par `CookieBanner.tsx`, monté dans le
 *     layout, donc partout ailleurs. Bilingue, mais sans panneau.
 *
 * Pour qu'ils ne se montrent pas tous les deux, `CookieBanner.tsx` DEVINAIT
 * quelles pages rendent `VitrineBody` : une liste de premiers segments
 * écrite à la main, plus la règle « un chemin à un seul segment inconnu de
 * la liste est une page ville ».
 *
 * Cette devinette s'est trompée. `/mise-a-disposition` est un chemin à un
 * seul segment, elle ne figurait pas dans la liste, et elle ne rend pas
 * `VitrineBody` : elle n'a donc reçu AUCUN bandeau. Mesuré en production le
 * 2026-11-15 — zéro surface de consentement sur cette page, sur les 56
 * routes publiques du site. Conséquence : un visiteur dont c'est la
 * première page n'est jamais interrogé, donc jamais mesuré, et la page
 * n'offrait aucune façon de donner ou de retirer son accord.
 *
 * Invisible sans ouvrir la page : une page sans bandeau a exactement
 * l'apparence d'une page dont le visiteur a déjà répondu.
 *
 * ── CE QUI CHANGE, ET CE QUI NE CHANGE PAS ───────────────────────────────
 *
 * Un seul composant, monté une seule fois dans `layout.tsx`. Il n'y a plus
 * de liste de routes à tenir à jour, donc plus rien à oublier d'y mettre :
 * la question est posée partout, sauf dans l'administration — et ce
 * « sauf » est la seule règle qui reste, écrite une fois, juste en dessous.
 *
 * Le dessin retenu est le RICHE, celui de la vitrine, parce qu'il porte le
 * panneau de préférences : c'est la surface la mieux-disante pour le
 * visiteur. Ses textes viennent désormais de `langue.ts`, donc en deux
 * langues — ce qui n'était pas le cas.
 *
 * ── CE QU'IL NE FAUT PAS DÉFAIRE ─────────────────────────────────────────
 *
 * 1. LE CSS EST DANS `globals.css`, PAS DANS `vitrine.css`. Ce composant
 *    s'affiche sur l'administration, l'espace client et le portail
 *    sous-traitant, qui n'importent pas `vitrine.css`. Y remettre ces
 *    règles rendrait un bloc nu — présent, mesurable, et illisible.
 *    `vitrine.css` ne garde que les JETONS DE PALETTE du bandeau
 *    (`html:has(.vt) …`), pour qu'il suive la couleur de la page.
 * 2. `--bandeau-cookies` EST PUBLIÉE ICI, ET NULLE PART AILLEURS. Le
 *    bandeau est en position fixe : `globals.css` fait
 *    `body { padding-bottom: var(--bandeau-cookies, 0px) }`, la barre
 *    d'action du tunnel s'y ancre, et les trois boutons flottants de la
 *    vitrine s'en servent pour se soulever. Une seule mesure, un seul nom.
 * 3. L'ABSENCE DE RÉPONSE VAUT REFUS. C'est `consentement.ts` qui le tient.
 */

/**
 * L'administration n'est pas une page publique : celui qui l'ouvre est
 * l'exploitant, pas un visiteur. Lui demander son consentement à la mesure
 * d'audience n'a pas de sens, et le bandeau recouvrait le bas de chaque
 * écran — sur téléphone, le tiers inférieur, boutons de validation compris
 * (constaté le 2026-11-02 sur l'écran d'envoi d'un devis).
 *
 * Conséquence volontaire : ni GA ni le pixel ne démarrent sur /admin. C'est
 * ce qu'on veut — les visites de l'exploitant ne doivent pas être comptées.
 */
function estEspaceInterne(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

/* Le bandeau ne surgit pas à la première milliseconde : il laisse la page
   s'afficher. Délai repris de la vitrine, où il valait 2 500 ms. */
const DELAI_AVANT_QUESTION = 2500

export default function Consentement() {
  const pathname = usePathname() ?? '/'
  /* La langue suit celle de la PAGE, déduite du chemin : les pages anglaises
     vivent sous /en/. Sans ça, un anglophone se voyait demander son
     consentement avec « Refuser / Accepter ». */
  const L = textes(pathname.startsWith('/en/') ? 'en' : 'fr')
  const interne = estEspaceInterne(pathname)

  /* `rendu` : le bandeau est dans le DOM. `monte` : il a glissé en place.
     Deux états, parce que l'animation d'entrée porte sur `transform` — on
     ne peut pas animer ce qui n'existe pas encore. */
  const [rendu, setRendu] = useState(false)
  const [monte, setMonte] = useState(false)
  const [panneauOuvert, setPanneauOuvert] = useState(false)
  const [mesureAcceptee, setMesureAcceptee] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  /* ── Faut-il poser la question ? ─────────────────────────────────────── */
  useEffect(() => {
    if (interne) return
    const choix = lireConsentement()
    if (choix === 'accepted') {
      initFbPixel()
      initGA()
      return
    }
    if (choix !== null) return
    /* Pas de choix enregistré — y compris quand localStorage est
       inaccessible (navigation privée, WebView restrictive). On demande,
       on ne présume pas. */
    const t = setTimeout(() => {
      if (lireConsentement() !== null) return
      setRendu(true)
      /* Une image d'écran entre le rendu et la montée, sinon le navigateur
         applique les deux dans le même calcul et rien ne glisse. */
      requestAnimationFrame(() => requestAnimationFrame(() => setMonte(true)))
    }, DELAI_AVANT_QUESTION)
    return () => clearTimeout(t)
  }, [interne])

  /* ── Revenir sur son choix ───────────────────────────────────────────
     Le lien « Gérer mes cookies » du pied de page de la vitrine, et le même
     lien sur la page Mentions légales, émettent cet événement
     (`demanderPanneauConsentement()`). Sans cela, une fois la question
     répondue, le choix était définitif. */
  useEffect(() => {
    if (interne) return
    const ouvrir = () => {
      setMesureAcceptee(lireConsentement() === 'accepted')
      setPanneauOuvert(true)
    }
    window.addEventListener(EVENEMENT_OUVRIR_PANNEAU, ouvrir)
    return () => window.removeEventListener(EVENEMENT_OUVRIR_PANNEAU, ouvrir)
  }, [interne])

  /* ── Le bandeau réserve sa place, il ne se pose pas dessus ───────────
     Mesuré le 2026-09-19 sur /admin/courses/nouvelle en 1400×900 : le
     bouton « Créer la course » occupait 823→868 px et le bandeau 825→900,
     soit 43 px sur 45 masqués — le clic partait dans le bandeau et la
     création semblait ne rien faire. Même constat le 2026-11-15 sur le
     bouton « Confirmer la réservation » de la vitrine.

     On publie donc la hauteur réelle dans une variable CSS. Une seule
     écriture : `globals.css` l'applique au corps de page, la barre
     d'action du tunnel s'y ancre, les boutons flottants s'en servent.
     Le nettoyage remet 0 — une valeur oubliée laisserait un vide en bas
     de page après la réponse. */
  useEffect(() => {
    const racine = document.documentElement
    if (!rendu) { racine.style.setProperty('--bandeau-cookies', '0px'); return }
    const maj = () => {
      const h = ref.current?.getBoundingClientRect().height ?? 0
      racine.style.setProperty('--bandeau-cookies', `${Math.ceil(h)}px`)
    }
    maj()
    const ro = new ResizeObserver(maj)
    if (ref.current) ro.observe(ref.current)
    window.addEventListener('resize', maj)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', maj)
      racine.style.setProperty('--bandeau-cookies', '0px')
    }
  }, [rendu])

  /** « Accepter » = tout accepter. */
  function accepter() {
    ecrireConsentement('accepted')
    setMesureAcceptee(true)
    setMonte(false); setRendu(false)
    initFbPixel(); initGA()
  }

  /** « Refuser » = tout refuser. `ecrireConsentement` lève le drapeau
   *  ga-disable-<ID> et efface les cookies de mesure déjà déposés : refuser
   *  après avoir accepté arrête réellement le suivi, sans rechargement. */
  function refuser() {
    ecrireConsentement('refused')
    setMesureAcceptee(false)
    setMonte(false); setRendu(false)
  }

  /** « Enregistrer » du panneau. Avant l'étape 88, ce bouton appelait
   *  toujours l'acceptation, quelle que soit la position de l'interrupteur :
   *  il était impossible de refuser depuis le panneau. */
  function enregistrer() {
    if (mesureAcceptee) accepter()
    else refuser()
    setPanneauOuvert(false)
  }

  if (interne) return null

  return (
    <>
      {rendu && (
        <div ref={ref} className={`cookie-banner${monte ? ' visible' : ''}`}>
          <div className="cookie-text">
            <div className="cookie-title">{L.cookies_titre}</div>
            <div className="cookie-desc">
              {/* Le texte doit dire ce que le code fait : les mesures ne
                  démarrent qu'après « Accepter ». Une seule écriture de
                  cette phrase, dans `langue.ts`. */}
              {L.cookies_texte}{' '}
              <a href="/mentions-legales">{L.cookies_en_savoir}</a>
            </div>
          </div>
          <div className="cookie-actions">
            <button type="button" className="c-btn-accept" onClick={accepter}>{L.cookies_accepter}</button>
            <button type="button" className="c-btn-refuse" onClick={refuser}>{L.cookies_refuser}</button>
            <button type="button" className="c-btn-manage" onClick={() => setPanneauOuvert(true)}>{L.cookies_gerer}</button>
          </div>
        </div>
      )}

      <div
        className={`cookie-overlay${panneauOuvert ? ' open' : ''}`}
        onClick={e => { if (e.target === e.currentTarget) setPanneauOuvert(false) }}
      >
        <div className="cookie-modal">
          <div className="cm-title">{L.cookies_panneau_titre}</div>
          <div className="cm-sub">{L.cookies_panneau_sous}</div>
          <div className="cm-cat">
            <div>
              <div className="cm-cat-name">{L.cookies_cat_essentiels}</div>
              <div className="cm-cat-desc">{L.cookies_cat_essentiels_desc}</div>
            </div>
            <label className="cm-toggle">
              <input type="checkbox" checked readOnly aria-label={L.cookies_cat_essentiels} />
              <div className="cm-track" /><div className="cm-thumb" />
            </label>
          </div>
          <div className="cm-cat">
            <div>
              <div className="cm-cat-name">{L.cookies_cat_mesure}</div>
              <div className="cm-cat-desc">{L.cookies_cat_mesure_desc}</div>
            </div>
            <label className="cm-toggle">
              <input
                type="checkbox"
                checked={mesureAcceptee}
                onChange={e => setMesureAcceptee(e.target.checked)}
                aria-label={L.cookies_cat_mesure}
              />
              <div className="cm-track" /><div className="cm-thumb" />
            </label>
          </div>
          <div className="cm-footer">
            <button type="button" className="cm-cancel" onClick={() => setPanneauOuvert(false)}>{L.cookies_annuler}</button>
            <button type="button" className="cm-save" onClick={enregistrer}>{L.cookies_enregistrer}</button>
          </div>
        </div>
      </div>
    </>
  )
}
