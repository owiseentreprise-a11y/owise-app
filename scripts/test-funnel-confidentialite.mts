/**
 * test-funnel-confidentialite.mts — étape 97.
 *
 * Ce qu'un événement de parcours a le droit d'emporter. La fonction testée
 * ici est celle qui tourne des DEUX côtés : dans le navigateur avant
 * l'envoi, et dans la route serveur avant l'écriture. C'est elle qui porte
 * la garantie, donc c'est elle qu'on éprouve.
 *
 * Les messages d'erreur Stripe ne peuvent pas être déclenchés dans un
 * navigateur sans provoquer un vrai paiement. On les traite ici, à la
 * source, avec les textes que le code renvoie réellement.
 *
 * Lancer depuis owise-app : npx tsx scripts/test-funnel-confidentialite.mts
 */
import {
  nettoyerMetaFunnel, codeErreur, nettoyerEtape, nettoyerPage,
} from '../src/lib/funnel-confidentialite'

const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'
let ko = 0, n = 0

function eq(titre: string, obtenu: unknown, attendu: unknown) {
  n++
  const o = JSON.stringify(obtenu), a = JSON.stringify(attendu)
  const ok = o === a
  if (!ok) ko++
  console.log(`  ${ok ? V + '✓' : R + '✗'} ${titre}${Z}`)
  if (!ok) console.log(`     ${R}attendu ${a}\n     obtenu  ${o}${Z}`)
}
function vrai(titre: string, cond: boolean, detail = '') {
  n++
  if (!cond) ko++
  console.log(`  ${cond ? V + '✓' : R + '✗'} ${titre}${Z}${detail ? `  ${G}${detail}${Z}` : ''}`)
}

/* ═══════════════════════════════════════════════════════════════════════ */
console.log(`\n${B}1. Ce qui passait avant l'étape 97 ne passe plus${Z}`)
eq('adresses complètes de devis_step2_enter',
  nettoyerMetaFunnel({ origin: '12 Rue de Paris, 60500 Chantilly, France', dest: 'Aéroport CDG' }),
  null)
eq('message Stripe brut',
  nettoyerMetaFunnel({ error: 'HTTP 402 Your card was declined for j.dupont@exemple.fr' }),
  null)
eq('message de validation sous la clé « reason »',
  nettoyerMetaFunnel({ reason: 'Sélectionnez une adresse de départ dans la liste.' }),
  null)

console.log(`\n${B}2. Ce qui doit passer${Z}`)
eq('nombres et booléens', nettoyerMetaFunnel({ prix: 59, pax: 2, prefilled: true }),
  { prix: 59, pax: 2, prefilled: true })
eq('code d’erreur déjà propre', nettoyerMetaFunnel({ code: 'depart_non_resolu' }),
  { code: 'depart_non_resolu' })
eq('message traduit en code sous la clé « code »',
  nettoyerMetaFunnel({ code: 'Sélectionnez une adresse de départ dans la liste.' }),
  { code: 'depart_non_resolu' })
eq('lieu déjà généralisé', nettoyerMetaFunnel({ zone_depart: 'CHA, 60500 Chantilly' }),
  { zone_depart: 'CHA, 60500 Chantilly' })
eq('lieu non généralisé : raboté',
  nettoyerMetaFunnel({ zone_depart: '12 Rue de Paris, 60500 Chantilly, France' }),
  { zone_depart: '60500 Chantilly' })

console.log(`\n${B}3. Entrées hostiles${Z}`)
eq('e-mail sous une clé inconnue', nettoyerMetaFunnel({ email: 'a@b.fr' }), null)
eq('téléphone sous une clé inconnue', nettoyerMetaFunnel({ tel: '0612345678' }), null)
eq('nom sous une clé inconnue', nettoyerMetaFunnel({ nom: 'Dupont' }), null)
eq('coordonnées sous une clé inconnue', nettoyerMetaFunnel({ lat: '49.0097' }), null)
eq('coordonnées numériques — gardées comme nombres mais sous clé inconnue… ',
  nettoyerMetaFunnel({ latitude: 49.0097 }), { latitude: 49.01 })
eq('objet imbriqué', nettoyerMetaFunnel({ client: { nom: 'Dupont' } }), null)
eq('tableau', nettoyerMetaFunnel({ adresses: ['a', 'b'] }), null)
eq('meta non objet', nettoyerMetaFunnel('12 rue de Paris'), null)
eq('null', nettoyerMetaFunnel(null), null)
eq('clé au nom suspect', nettoyerMetaFunnel({ 'Adresse-Client': 'x' }), null)
vrai('un objet très large est tronqué',
  Object.keys(nettoyerMetaFunnel(Object.fromEntries(
    Array.from({ length: 40 }, (_, i) => [`n${i}`, i]))) ?? {}).length <= 12)

console.log(`\n${B}4. Les deux chemins d'erreur Stripe — textes réels du code${Z}`)
eq('clé Stripe manquante', codeErreur('Clé Stripe manquante'), 'stripe_non_configure')
eq('tarif introuvable', codeErreur('Tarif introuvable pour ce trajet. Veuillez contacter le support.'), 'tarif_introuvable')
eq('erreur réseau', codeErreur('Connexion: fetch failed'), 'reseau')
eq('réponse HTTP de Stripe', codeErreur('HTTP 402'), 'stripe_http')
eq('message libre inconnu — jamais conservé tel quel',
  codeErreur('Your card was declined (j.dupont@exemple.fr)'), 'autre')
eq('message vide', codeErreur(''), 'autre')
eq('entrée non texte', codeErreur({ a: 1 }), 'autre')

console.log(`\n${B}5. Les messages de validation réels deviennent des codes${Z}`)
for (const [msg, attendu] of [
  ['Adresse de départ requise.', 'depart_manquant'],
  ['Adresse d’arrivée requise.', 'arrivee_manquante'],
  ['Date et heure requises.', 'date_manquante'],
  ['Date invalide.', 'date_invalide'],
  ['La date de prise en charge doit être dans le futur.', 'date_passee'],
  ['Date trop lointaine (max 2 ans).', 'date_trop_loin'],
  ['Sélectionnez une adresse d\'arrivée dans la liste.', 'arrivee_non_resolue'],
  ['Prix non calculé — vérifiez les adresses.', 'prix_indisponible'],
  ['Erreur de tarification.', 'tarif_introuvable'],
  ['Cette adresse e-mail semble incomplète.', 'email_invalide'],
  ['Merci d’indiquer votre nom.', 'nom_manquant'],
] as [string, string][]) eq(`« ${msg.slice(0, 44)} »`, codeErreur(msg), attendu)

console.log(`\n${B}6. Étape et page${Z}`)
eq('étape valide', nettoyerEtape('reserver_page_view'), 'reserver_page_view')
eq('étape avec espaces ou accents', nettoyerEtape('étape libre'), null)
eq('étape trop longue', nettoyerEtape('a'.repeat(80)), null)
eq('page simple', nettoyerPage('/reserver'), '/reserver')
eq('la chaîne de requête est coupée',
  nettoyerPage('/reserver?depart=12%20rue%20de%20Paris%2C%2060500%20Chantilly'), '/reserver')
eq('fragment coupé', nettoyerPage('/reserver#devis'), '/reserver')
eq('page absolue refusée', nettoyerPage('https://exemple.fr/x'), null)

console.log(`\n${B}7. Aucune adresse ne survit, quel que soit le chemin${Z}`)
const entrees = [
  { origin: '12 Rue de Paris, 60500 Chantilly, France' },
  { zone_depart: '4b avenue des Champs-Élysées, 75008 Paris, France' },
  { code: 'Échec pour 7 Impasse du Moulin, 60740 Saint-Maximin' },
  { reason: 'Chemin des Vignes, 60260 Lamorlaye' },
]
for (const e of entrees) {
  const s = JSON.stringify(nettoyerMetaFunnel(e) ?? {})
  vrai(`« ${JSON.stringify(e).slice(0, 46)}… » → ${s}`,
    !/(rue|avenue|boulevard|impasse|chemin|allée|quai|route)\s/i.test(s)
    && !/\d{1,4}\s*[a-z]?\s+(rue|avenue|impasse|chemin)/i.test(s))
}

console.log(`\n${'─'.repeat(62)}`)
console.log(ko ? `${R}${B}${ko} échec(s) sur ${n}.${Z}\n` : `${V}${B}${n} contrôles au vert.${Z}\n`)
process.exit(ko ? 1 : 0)
