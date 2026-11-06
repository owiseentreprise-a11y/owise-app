/**
 * Remplace, dans `ReserverClient.tsx`, chaque texte français visible par sa
 * clé de dictionnaire. Outil à usage unique, conservé pour la trace.
 *
 *   npx tsx scripts/appliquer-langue-reserver.mts [--appliquer]
 *
 * La propriété qui compte : chaque paire déclare COMBIEN de fois elle doit
 * s'appliquer. Un remplacement qui ne trouve rien, ou qui en trouve trois là
 * où on en attendait un, arrête tout sans rien écrire. Un `sed` silencieux
 * sur un tunnel de paiement, c'est exactement comme ça qu'on livre une page
 * aux libellés vides.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ICI = dirname(fileURLToPath(import.meta.url))
const CIBLE = resolve(ICI, '../src/app/reserver/ReserverClient.tsx')
const APPLIQUER = process.argv.includes('--appliquer')
const V = '\x1b[32m', R = '\x1b[31m', G = '\x1b[90m', B = '\x1b[1m', Z = '\x1b[0m'

/** [ancien, nouveau, nombre d'occurrences attendues] */
const PAIRES: [string, string, number][] = [
  // ── Descriptions de véhicules (constante de module : on pose la clé) ──
  ["models: 'Berline récente, intérieur soigné'", "descCle: 'veh_berline_desc' as const", 1],
  ["models: 'Berline haut de gamme'",             "descCle: 'veh_premium_desc' as const", 1],
  ["models: 'Van récent, 7 places assises'",      "descCle: 'veh_van_desc' as const", 1],
  ["badge: 'Populaire'",                          "badgeCle: 'populaire' as const", 1],
  ["places: '1–3 passagers'", "places: '1–3'", 1],
  ["places: '1–4 passagers'", "places: '1–4'", 1],
  ["places: '1–7 passagers'", "places: '1–7'", 1],

  // ── Badge de tarification ────────────────────────────────────────────
  ["{ label: 'Forfait zone', color: 'var(--blue)' }", "{ label: L.forfait_zone, color: 'var(--blue)' }", 1],
  ["{ label: 'Tarif au km', color: 'var(--gold)' }",  "{ label: L.tarif_au_km, color: 'var(--gold)' }", 1],

  // ── Parrainage ───────────────────────────────────────────────────────
  ["valid ? '✓ Code valide — -10% appliqué !' : 'Code invalide ou expiré'",
   "valid ? L.code_valide : L.code_invalide", 1],

  // ── Validation côté client ───────────────────────────────────────────
  ["fail('Adresse de départ requise.')",                                  "fail(L.err_depart_requis)", 1],
  ["fail('Sélectionnez une adresse de départ dans la liste.')",           "fail(L.err_depart_liste)", 1],
  ["fail('Sélectionnez une adresse d\\'arrivée dans la liste.')",         "fail(L.err_arrivee_liste)", 1],
  ["fail('Prix non calculé — vérifiez les adresses.')",                   "fail(L.err_prix)", 1],
  ["fail('Erreur de tarification.')",                                     "fail(L.err_tarification)", 1],
  ["`Erreur de paiement : ${result.error}`",                              "`${L.err_paiement} : ${result.error}`", 1],

  // ── Chrome ───────────────────────────────────────────────────────────
  ['<div className="confirm-seal-label">Votre réservation se scelle…</div>',
   '<div className="confirm-seal-label">{L.sceau}</div>', 1],
  ['>Chauffeur privé VTC</div>', '>{L.marque_sous_titre}</div>', 1],
  ["{s === 1 ? 'Trajet' : ''}", '{s === 1 ? L.etape_trajet : \'\'}', 1],
  [">Paiement</div>", '>{L.etape_paiement}</div>', 1],
  ['<strong>Navigateur intégré détecté.</strong> Pour finaliser votre paiement en sécurité, ouvrez cette page dans votre navigateur.',
   '<strong>{L.navigateur_titre}</strong> {L.navigateur_texte}', 1],
  /* Pas d'ancrage sur la fin de ligne : ce fichier est en CRLF, et un motif
     terminé par « \n » n'y correspond jamais. L'unicité du texte suffit. */
  ['              Ouvrir dans Chrome / Safari', '              {L.navigateur_lien}', 1],

  // ── Titre ────────────────────────────────────────────────────────────
  ['                Réservation en ligne', '                {L.surtitre}', 1],
  ['                Réservez votre course', '                {L.titre}', 1],
  ['>Service VTC premium · Paris & Île-de-France</p>', '>{L.sous_titre}</p>', 1],
  ['{` · ${avis.nombre} avis Google vérifiés`}', '{` · ${avis.nombre} ${L.avis_suffixe}`}', 1],

  // ── Itinéraire ───────────────────────────────────────────────────────
  ['                Itinéraire', '                {L.itineraire}', 1],
  ['<FieldLabel>Adresse de départ</FieldLabel>', '<FieldLabel>{L.adresse_depart}</FieldLabel>', 1],
  ['placeholder="15 Rue de la Paix, 75001 Paris"', 'placeholder={L.adresse_depart_exemple}', 1],
  ['<FieldLabel>Adresse d&apos;arrivée</FieldLabel>', '<FieldLabel>{L.adresse_arrivee}</FieldLabel>', 1],
  ['placeholder="Aéroport CDG, Terminal 2, 95700 Roissy"', 'placeholder={L.adresse_arrivee_exemple}', 1],
  ['>Tarif calculé au km</span>', '>{L.tarif_calcule_km}</span>', 2],
  ['>Sélectionnez dans la liste</span>', '>{L.selectionnez_liste}</span>', 2],
  ['aria-label="Retirer cet arrêt"', 'aria-label={L.retirer_arret}', 1],
  ['<FieldLabel>Date de prise en charge</FieldLabel>', '<FieldLabel>{L.date_prise_en_charge}</FieldLabel>', 1],

  // ── Aller-retour ─────────────────────────────────────────────────────
  ["{allerRetour ? 'Prix aller × 2 — même tarif garanti' : 'Économisez avec un trajet retour inclus'}",
   '{allerRetour ? L.aller_retour_detail : L.aller_retour_titre}', 1],
  ['<FieldLabel>Date du retour</FieldLabel>', '<FieldLabel>{L.date_retour}</FieldLabel>', 1],
  ['<FieldLabel>Adresse d&apos;arrivée du retour</FieldLabel>', '<FieldLabel>{L.adresse_retour}</FieldLabel>', 1],
  ["placeholder={depart.label || 'Votre adresse de retour'}", 'placeholder={depart.label || L.adresse_retour_exemple}', 1],
  ["{arriveeRetour.label ? '(adresse de retour différente)' : '(adresses inversées)'}",
   '{arriveeRetour.label ? L.adresse_retour_autre : L.adresses_inversees}', 1],

  // ── Vol et train ─────────────────────────────────────────────────────
  ["{isAero ? '✈ Informations de vol' : '🚄 Informations train'}", '{isAero ? L.infos_vol : L.infos_train}', 1],
  ["<FieldLabel>N° de {typeVol}{(isAeroDepart || isGareDepart) ? ' ou provenance' : ''}</FieldLabel>",
   "<FieldLabel>{isAero ? L.numero_vol : L.numero_train}{(isAeroDepart || isGareDepart) ? ` ${L.ou_provenance}` : ''}</FieldLabel>", 1],

  // ── Véhicule, passagers, prix ────────────────────────────────────────
  ['>Demandez un devis</strong>', '>{L.demandez_devis}</strong>', 1],
  ["{allerRetour ? 'Prix aller-retour' : 'Prix estimé'}", '{allerRetour ? L.prix_aller_retour : L.prix_estime}', 1],
  ["                        : 'Calcul de l\\'itinéraire…'", '                        : L.calcul_itineraire', 1],

  // ── Étape 2 ──────────────────────────────────────────────────────────
  ['>Un email de confirmation vous sera envoyé après le paiement.</p>', '>{L.email_confirmation}</p>', 1],
  ['<option value="">Je préfère ne pas répondre</option>', '<option value="">{L.prefere_pas_repondre}</option>', 1],
]

let src = readFileSync(CIBLE, 'utf8')
const avant = src
const echecs: string[] = []
let faits = 0

for (const [ancien, nouveau, attendu] of PAIRES) {
  const trouves = src.split(ancien).length - 1
  const court = ancien.replace(/\s+/g, ' ').slice(0, 62)
  if (trouves !== attendu) {
    echecs.push(`${trouves} occurrence(s) au lieu de ${attendu} : « ${court} »`)
    console.log(`  ${R}✗${Z} ${trouves}/${attendu}  ${court}`)
    continue
  }
  src = src.split(ancien).join(nouveau)
  faits += attendu
  console.log(`  ${V}✓${Z} ${attendu}×  ${G}${court}${Z}`)
}

console.log(`\n${faits} remplacement(s) prêt(s), ${echecs.length} problème(s)`)
if (echecs.length) {
  console.log(`\n${R}${B}RIEN N'A ÉTÉ ÉCRIT.${Z} Corriger les paires ci-dessus d'abord.\n`)
  process.exit(1)
}
if (!APPLIQUER) {
  console.log(`${G}Aperçu seul. Relancer avec --appliquer.${Z}\n`)
  process.exit(0)
}
if (src === avant) { console.log('aucun changement'); process.exit(0) }
writeFileSync(CIBLE, src)
console.log(`${V}${B}écrit${Z} ${CIBLE}\n`)
