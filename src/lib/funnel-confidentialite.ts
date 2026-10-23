import { generaliserLieu } from './estimation-anonyme'

/**
 * funnel-confidentialite.ts — ce qu'un événement de parcours a le droit
 * d'emporter.
 *
 * ── Ce qui partait avant l'étape 97 ──────────────────────────────────────
 *
 *   devis_step2_enter      { origin: "12 Rue de Paris, 60500 Chantilly, France",
 *                            dest:   "Aéroport Paris-Charles de Gaulle (CDG)" }
 *   reserver_checkout_error{ error: <message brut renvoyé par Stripe> }
 *   reserver_step1_error   { reason: "Sélectionnez une adresse de départ…" }
 *
 * La première ligne est la plus parlante : l'étape 88 avait généralisé les
 * adresses dans la table `estimations`, mais pas dans `funnel_events`, où
 * elles continuaient d'arriver entières.
 *
 * ── Le principe retenu : une liste blanche, pas une liste noire ──────────
 *
 * Interdire ce qu'on sait dangereux laisse passer ce qu'on n'a pas prévu.
 * Ici, seules trois formes de valeur sont acceptées :
 *
 *   · un nombre fini ;
 *   · un booléen ;
 *   · une chaîne, UNIQUEMENT sous une clé connue, et seulement après être
 *     passée par le filtre propre à cette clé.
 *
 * Tout le reste est écarté : les objets, les tableaux, les chaînes sous une
 * clé inconnue. Un futur `logFunnel('x', { email })` ne passera pas, sans
 * qu'il faille y penser.
 *
 * ── Deux côtés, une seule écriture de la règle ───────────────────────────
 *
 * Le navigateur nettoie avant d'envoyer, et la route serveur renettoie
 * avant d'écrire. Les deux appellent cette fonction. Le serveur ne fait pas
 * confiance au navigateur : c'est lui qui a le dernier mot.
 */

/** Clés dont la valeur texte est un code court et sans danger. */
const CLES_CODE = new Set(['code', 'raison', 'etape'])

/** Clés dont la valeur texte est un lieu, passé au généralisateur. */
const CLES_LIEU = new Set(['zone_depart', 'zone_arrivee'])

/** Au-delà, c'est qu'on enregistre autre chose qu'une mesure d'étape. */
const MAX_CLES = 12

const FORME_CODE = /^[a-z0-9_-]{1,40}$/

/**
 * Traduit un message d'erreur en code court.
 *
 * Le point important est la dernière ligne : un message non reconnu devient
 * `autre`, JAMAIS le message lui-même. C'est ce qui garantit qu'un texte
 * venu de Stripe ou d'une exception réseau ne peut pas se retrouver en base,
 * quoi qu'il contienne.
 */
export function codeErreur(message: unknown): string {
  const m = typeof message === 'string' ? message : ''
  const regles: [RegExp, string][] = [
    [/adresse de d[ée]part requise/i,          'depart_manquant'],
    [/adresse d.arriv[ée]e requise/i,          'arrivee_manquante'],
    [/s[ée]lectionnez une adresse de d[ée]part/i, 'depart_non_resolu'],
    [/s[ée]lectionnez une adresse d.arriv[ée]e/i, 'arrivee_non_resolue'],
    [/date et heure requises/i,                'date_manquante'],
    [/date (et heure )?invalide/i,             'date_invalide'],
    [/d[ée]j[àa] pass[ée]e|dans le futur/i,    'date_passee'],
    [/trop lointaine/i,                        'date_trop_loin'],
    [/prix non calcul[ée]/i,                   'prix_indisponible'],
    [/erreur de tarification|tarif introuvable/i, 'tarif_introuvable'],
    [/vol ou de votre train/i,                 'heure_vol_manquante'],
    [/num[ée]ro de vol/i,                      'num_vol_manquant'],
    [/votre nom/i,                             'nom_manquant'],
    [/votre pr[ée]nom/i,                       'prenom_manquant'],
    [/adresse e-mail/i,                        'email_invalide'],
    [/t[ée]l[ée]phone/i,                       'telephone_invalide'],
    [/cl[ée] stripe manquante/i,               'stripe_non_configure'],
    [/^connexion:/i,                           'reseau'],
    [/^http \d{3}/i,                           'stripe_http'],
  ]
  for (const [re, code] of regles) if (re.test(m)) return code
  /* Inconnu : on garde la trace qu'une erreur a eu lieu, pas son texte. */
  return 'autre'
}

/**
 * Le filtre appliqué avant chaque écriture, des deux côtés.
 * Rend `null` plutôt qu'un objet vide : la colonne reste propre.
 */
export function nettoyerMetaFunnel(meta: unknown): Record<string, unknown> | null {
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null
  const sortie: Record<string, unknown> = {}
  let n = 0
  for (const [cle, valeur] of Object.entries(meta as Record<string, unknown>)) {
    if (n >= MAX_CLES) break
    if (!/^[a-z0-9_]{1,30}$/.test(cle)) continue

    if (typeof valeur === 'number') {
      if (!Number.isFinite(valeur)) continue
      sortie[cle] = Math.round(valeur * 100) / 100
      n++
      continue
    }
    if (typeof valeur === 'boolean') { sortie[cle] = valeur; n++; continue }

    if (typeof valeur === 'string') {
      if (CLES_CODE.has(cle)) {
        /* Déjà un code ? on le garde. Sinon c'est un message : on le
           traduit. Un texte libre ne survit jamais tel quel. */
        sortie[cle] = FORME_CODE.test(valeur) ? valeur : codeErreur(valeur)
        n++
        continue
      }
      if (CLES_LIEU.has(cle)) {
        /* Même généralisateur que les estimations : zone et commune, jamais
           le numéro ni la rue. Idempotent, donc sans effet sur une valeur
           déjà propre venue du navigateur. */
        sortie[cle] = generaliserLieu(valeur)
        n++
        continue
      }
      /* Chaîne sous une clé inconnue : écartée. */
      continue
    }
    /* Objet, tableau, null, undefined, fonction : écartés. */
  }
  return n > 0 ? sortie : null
}

/** Le nom d'étape : un identifiant court, jamais un texte libre. */
export function nettoyerEtape(step: unknown): string | null {
  if (typeof step !== 'string') return null
  const s = step.trim()
  return /^[a-z0-9_]{1,60}$/.test(s) ? s : null
}

/**
 * La page : seulement le chemin. Une chaîne de requête peut porter
 * `?depart=12 rue de Paris…` — c'est exactement ce qu'on retire ailleurs.
 */
export function nettoyerPage(page: unknown): string | null {
  if (typeof page !== 'string' || !page) return null
  const sansRequete = page.split(/[?#]/)[0]
  if (!sansRequete.startsWith('/')) return null
  return sansRequete.slice(0, 120)
}
