/**
 * contact-clic.ts — QUI APPELLE, ET D'OÙ IL VIENT.
 *
 * Demandé par l'exploitant le 2026-11-22 : « savoir d'où il est venu, un
 * maximum d'informations qui nous permettront d'améliorer le service […] de
 * passer les prospects en clients ».
 *
 * Pourquoi : les clients d'Owise réservent surtout par TÉLÉPHONE et par
 * WHATSAPP, et jusqu'ici le site ne comptait aucun de ces clics. Un prospect
 * qui voyait son prix puis appelait laissait une estimation… et rien d'autre :
 * impossible de savoir quelle page, quel canal, quel trajet font sonner le
 * téléphone.
 *
 * Ce qui est mesuré, et seulement ça :
 *   - le TYPE de contact (téléphone, WhatsApp, e-mail) et le bouton cliqué ;
 *   - la page, le chemin parcouru dans l'onglet (10 dernières pages), le temps
 *     passé avant de cliquer ;
 *   - la provenance (Google, ChatGPT, direct…) relevée à l'arrivée ;
 *   - le dernier prix vu dans l'onglet, en ZONE + COMMUNE (jamais la rue) ;
 *   - le type d'appareil, la langue, la largeur d'écran (arrondie).
 * Aucun nom, aucun numéro, aucune adresse IP, aucun cookie, aucun identifiant
 * qui suive la personne d'une visite à l'autre : le stockage est celui de
 * L'ONGLET (sessionStorage), effacé à sa fermeture. C'est une mesure
 * d'audience anonyme, comme les estimations de prix.
 *
 * Seuls les liens vers les coordonnées d'OWISE comptent : le numéro d'un
 * chauffeur affiché dans l'espace client n'est pas un prospect.
 *
 * Seul import : identite-owise.ts, lui-même sans aucun import — appelable
 * depuis le navigateur ET depuis la route serveur.
 * Contrôle : scripts/test-contact-clic.mts.
 */
import { IDENTITE_OWISE } from './identite-owise'

export type TypeContact = 'telephone' | 'whatsapp' | 'email'

/** Les 9 derniers chiffres du numéro d'Owise, lus dans la source unique. */
const CHIFFRES_OWISE = IDENTITE_OWISE.telephone.replace(/\D/g, '').slice(-9)
const EMAIL_OWISE = IDENTITE_OWISE.email.toLowerCase()

/** Le type de contact d'un lien, ou null s'il ne mène pas à Owise. */
export function typeDeLien(href: string | null | undefined): TypeContact | null {
  const h = (href ?? '').trim()
  if (!h) return null
  const bas = h.toLowerCase()
  if (bas.startsWith('tel:')) return h.replace(/\D/g, '').endsWith(CHIFFRES_OWISE) ? 'telephone' : null
  if (/^https?:\/\/(wa\.me|api\.whatsapp\.com|(web\.)?whatsapp\.com)\//.test(bas) || bas.startsWith('whatsapp:')) {
    // wa.me/<numéro>?text=… : le numéro est dans le chemin, ou dans ?phone=
    const dansChemin = h.split('?')[0].replace(/\D/g, '').endsWith(CHIFFRES_OWISE)
    const phone = (bas.match(/[?&]phone=([^&]*)/)?.[1] ?? '').replace(/\D/g, '')
    return dansChemin || phone.endsWith(CHIFFRES_OWISE) ? 'whatsapp' : null
  }
  if (bas.startsWith('mailto:')) {
    let dest = bas.slice(7).split('?')[0]
    try { dest = decodeURIComponent(dest) } catch { /* adresse mal encodée : on la lit telle quelle */ }
    return dest.trim() === EMAIL_OWISE ? 'email' : null
  }
  return null
}

/** Les pages où ce n'est pas un prospect qui clique. */
export function estPageInterne(chemin: string): boolean {
  return /^\/(admin|chauffeur|sous-traitant|espace-client)(\/|$)/.test(chemin)
    || /^\/(login|client-login|sous-traitant-login)(\/|$)/.test(chemin)
}

/** « mobile », « tablette » ou « ordinateur », d'après l'en-tête du navigateur. */
export function appareilDepuisUA(ua: string | null | undefined): 'mobile' | 'tablette' | 'ordinateur' {
  const u = ua ?? ''
  if (/ipad|tablet|android(?!.*mobile)/i.test(u)) return 'tablette'
  if (/mobi|iphone|ipod|android/i.test(u)) return 'mobile'
  return 'ordinateur'
}

/* ── Côté navigateur : le parcours de l'onglet ───────────────────────── */

export const CLE_PARCOURS = 'ow_parcours'
export const CLE_DERNIERE_ESTIMATION = 'ow_derniere_estim'

export type Parcours = { debut: number; pages: string[] }
export type DerniereEstimation = { depart: string; arrivee: string; vehicule: string | null; prix: number | null; t: number }

const lire = <T>(cle: string): T | null => {
  try { const b = sessionStorage.getItem(cle); return b ? (JSON.parse(b) as T) : null } catch { return null }
}
const ecrire = (cle: string, v: unknown) => { try { sessionStorage.setItem(cle, JSON.stringify(v)) } catch { /* stockage refusé */ } }

/** Une page de plus dans le parcours de l'onglet (on garde les 10 dernières). */
export function noterPage(chemin: string): void {
  if (typeof window === 'undefined') return
  const p = lire<Parcours>(CLE_PARCOURS) ?? { debut: Date.now(), pages: [] }
  if (p.pages[p.pages.length - 1] !== chemin) p.pages = [...p.pages, chemin].slice(-10)
  ecrire(CLE_PARCOURS, p)
}

/**
 * Le dernier prix montré dans l'onglet. On ne reçoit ici QUE des lieux déjà
 * généralisés (zone + commune, `lieuPourStatistique`) : la rue ne quitte pas
 * le formulaire par ce chemin.
 */
export function memoriserEstimation(e: Omit<DerniereEstimation, 't'>): void {
  if (typeof window === 'undefined') return
  ecrire(CLE_DERNIERE_ESTIMATION, { ...e, t: Date.now() })
}

export type MesureContact = {
  type: TypeContact
  emplacement: string
  page: string
  parcours: string[]
  secondes_avant_clic: number | null
  derniere_estimation: (Omit<DerniereEstimation, 't'> & { il_y_a_s: number }) | null
  langue: string
  largeur_ecran: number | null
}

/** Ce qui part au serveur au moment du clic. La provenance est ajoutée par l'appelant. */
export function construireMesure(type: TypeContact, emplacement: string, chemin: string, maintenant = Date.now()): MesureContact {
  const p = lire<Parcours>(CLE_PARCOURS)
  const e = lire<DerniereEstimation>(CLE_DERNIERE_ESTIMATION)
  return {
    type,
    emplacement: emplacement.replace(/\s+/g, ' ').trim().slice(0, 80),
    page: chemin.slice(0, 200),
    parcours: (p?.pages ?? []).map(x => x.slice(0, 120)).slice(-10),
    secondes_avant_clic: p ? Math.max(0, Math.round((maintenant - p.debut) / 1000)) : null,
    derniere_estimation: e ? { depart: e.depart, arrivee: e.arrivee, vehicule: e.vehicule, prix: e.prix, il_y_a_s: Math.max(0, Math.round((maintenant - e.t) / 1000)) } : null,
    langue: (typeof navigator !== 'undefined' ? navigator.language : '').slice(0, 2).toLowerCase(),
    /* Arrondie à 50 px : assez pour distinguer un téléphone d'un écran, pas assez pour reconnaître un appareil. */
    largeur_ecran: typeof window !== 'undefined' ? Math.round(window.innerWidth / 50) * 50 : null,
  }
}

type ElementLien = {
  getAttribute(n: string): string | null
  textContent: string | null
  closest(s: string): { id: string; tagName: string; getAttribute(n: string): string | null } | null
}

/** Le libellé du bouton : un nom explicite s'il existe, sinon son texte ; suivi de la zone de la page. */
export function libelleBouton(lien: ElementLien): string {
  const explicite = lien.getAttribute('data-contact') || lien.getAttribute('aria-label') || lien.getAttribute('title')
  const texte = (lien.textContent ?? '').replace(/\s+/g, ' ').trim()
  const s = lien.closest('[data-section],section[id],footer,header,nav')
  const ou = s ? (s.getAttribute('data-section') || s.id || s.tagName.toLowerCase()) : ''
  const quoi = explicite || texte || '(icône)'
  return ou ? `${quoi} · ${ou}` : quoi
}
