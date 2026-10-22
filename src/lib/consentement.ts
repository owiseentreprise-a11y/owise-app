'use client'

/**
 * consentement.ts — une seule porte d'entrée et une seule porte de sortie pour
 * le choix du visiteur en matière de mesure d'audience.
 *
 * Pourquoi ce fichier existe (constats de l'étape 85, vérifiés à l'étape 88) :
 *
 *  - Google Analytics était chargé par `layout.tsx` sans condition. Le bandeau
 *    ne faisait que se masquer : refuser n'empêchait rien, et le suivi partait
 *    avant même que le visiteur ait vu la question.
 *  - L'interrupteur « Analytiques » du panneau de préférences n'était relié à
 *    rien : « Enregistrer » appelait toujours `acceptCookie()`.
 *  - Une fois la réponse donnée, le visiteur n'avait plus aucun moyen de la
 *    changer : la bannière disparaissait et rien ne rouvrait le panneau.
 *
 * Règles tenues ici, et nulle part ailleurs :
 *
 *  1. L'ABSENCE DE CHOIX N'EST PAS UNE ACCEPTATION. `lireConsentement()` rend
 *     `null`, et `analytiquesAutorisees()` rend `false`.
 *  2. Seule la valeur exacte « accepted » autorise la mesure. Toute autre
 *     valeur — « refused », vide, abîmée, illisible — vaut refus.
 *  3. Un changement est diffusé immédiatement, dans l'onglet courant
 *     (événement maison) comme dans les autres onglets (événement `storage`).
 *     Aucun rechargement n'est nécessaire pour que le refus prenne effet.
 *  4. Le refus efface les cookies de mesure déjà déposés, et lève le drapeau
 *     officiel `ga-disable-<ID>` que gtag.js consulte avant chaque envoi.
 *  5. Rien ici ne touche aux estimations, aux réservations ni aux paiements.
 */

export const CLE_CONSENTEMENT = 'owise_cookie_consent'
/** Ancienne clé, encore lue par la vitrine. On continue de l'écrire pour ne
 *  pas réafficher la bannière aux visiteurs qui ont déjà répondu. */
export const CLE_HERITEE = 'ow_cookie'

export const EVENEMENT_CONSENTEMENT = 'owise:consentement'
/** Demande d'ouverture du panneau de préférences, émise par un lien « Gérer
 *  mes cookies » depuis n'importe quelle page. */
export const EVENEMENT_OUVRIR_PANNEAU = 'owise:ouvrir-consentement'

export type Consentement = 'accepted' | 'refused' | null

export function lireConsentement(): Consentement {
  if (typeof window === 'undefined') return null
  try {
    const v = window.localStorage.getItem(CLE_CONSENTEMENT)
    if (v === 'accepted') return 'accepted'
    if (v === 'refused') return 'refused'
    return null
  } catch {
    /* localStorage inaccessible (navigation privée, WebView restrictive) :
       on ne peut pas prouver qu'un consentement a été donné, donc il n'y en
       a pas. */
    return null
  }
}

/** Vrai uniquement si le visiteur a explicitement accepté. */
export function analytiquesAutorisees(): boolean {
  return lireConsentement() === 'accepted'
}

export function ecrireConsentement(valeur: 'accepted' | 'refused'): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(CLE_CONSENTEMENT, valeur)
    window.localStorage.setItem(CLE_HERITEE, valeur === 'accepted' ? '1' : '0')
  } catch { /* stockage indisponible : le choix ne survivra pas au rechargement,
                mais il doit tout de même s'appliquer à la visite en cours. */ }

  if (valeur === 'refused') appliquerRefus()
  else libererMesure()

  try {
    window.dispatchEvent(new CustomEvent(EVENEMENT_CONSENTEMENT, { detail: valeur }))
  } catch { /* CustomEvent indisponible : les abonnés se mettront à jour au
                prochain rendu. */ }
}

/** S'abonner aux changements, dans cet onglet comme dans les autres. */
export function surChangementConsentement(rappel: (v: Consentement) => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const local = () => rappel(lireConsentement())
  const autreOnglet = (e: StorageEvent) => {
    if (e.key === null || e.key === CLE_CONSENTEMENT) rappel(lireConsentement())
  }
  window.addEventListener(EVENEMENT_CONSENTEMENT, local as EventListener)
  window.addEventListener('storage', autreOnglet)
  return () => {
    window.removeEventListener(EVENEMENT_CONSENTEMENT, local as EventListener)
    window.removeEventListener('storage', autreOnglet)
  }
}

export function demanderPanneauConsentement(): void {
  if (typeof window === 'undefined') return
  try { window.dispatchEvent(new CustomEvent(EVENEMENT_OUVRIR_PANNEAU)) } catch {}
}

/* ── Retrait du consentement ──────────────────────────────────────────────
   Démonter la balise <Script> ne désinstalle pas gtag.js : le code est déjà
   exécuté dans la page. Deux gestes sont donc nécessaires, et le premier est
   celui que Google documente. */

/** Préfixes des cookies déposés par gtag.js et par le pixel Meta. */
const PREFIXES_COOKIES_MESURE = ['_ga', '_gid', '_gat', '_gac', '_fbp', '_fbc']

export function effacerCookiesMesure(): void {
  if (typeof document === 'undefined') return
  const domaines = domainesCandidats()
  for (const brut of document.cookie.split(';')) {
    const nom = brut.split('=')[0]?.trim()
    if (!nom || !PREFIXES_COOKIES_MESURE.some(p => nom === p || nom.startsWith(p))) continue
    /* Un cookie ne s'efface que si le domaine ET le chemin correspondent à
       ceux de son dépôt. On ne les connaît pas : on essaie les candidats. */
    for (const d of domaines) {
      document.cookie = `${nom}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/${d ? `; domain=${d}` : ''}`
    }
  }
}

function domainesCandidats(): string[] {
  const hote = window.location.hostname
  const out: string[] = ['']
  if (!hote || hote === 'localhost') return out
  out.push(hote)
  const bouts = hote.split('.')
  for (let i = 1; i < bouts.length - 1; i++) out.push('.' + bouts.slice(i).join('.'))
  return out
}

function appliquerRefus(): void {
  try {
    /* Drapeau officiel de gtag.js : consulté avant chaque envoi, y compris
       par un gtag déjà chargé lors de cette même visite. */
    const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-4396NMMFQM'
    const aw = process.env.NEXT_PUBLIC_AW_ID ?? 'AW-18274455264'
    const w = window as unknown as Record<string, unknown>
    w[`ga-disable-${id}`] = true
    if (aw) w[`ga-disable-${aw}`] = true
  } catch {}
  effacerCookiesMesure()
}

function libererMesure(): void {
  try {
    const id = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? 'G-4396NMMFQM'
    const aw = process.env.NEXT_PUBLIC_AW_ID ?? 'AW-18274455264'
    const w = window as unknown as Record<string, unknown>
    w[`ga-disable-${id}`] = false
    if (aw) w[`ga-disable-${aw}`] = false
  } catch {}
}

/** À appeler au tout premier rendu client : si le visiteur n'a pas accepté,
 *  le drapeau est levé AVANT que quoi que ce soit ne puisse être envoyé. */
export function verrouillerSiPasDeConsentement(): void {
  if (typeof window === 'undefined') return
  if (!analytiquesAutorisees()) appliquerRefus()
}
