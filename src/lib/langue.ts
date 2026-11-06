/**
 * Les textes du tunnel de réservation, en français et en anglais.
 *
 * POURQUOI CE FICHIER EXISTE, ET POURQUOI IL EST SEUL.
 * Un visiteur anglophone qui arrivait sur /reserver lisait « Adresse de
 * départ · Votre trajet · Réserver » et repartait. Owise avait déjà encaissé
 * des clients étrangers venus en direct et par ChatGPT ; ils butaient sur la
 * dernière marche.
 *
 * La tentation était de dupliquer `ReserverClient.tsx` en anglais. Ce projet
 * a déjà payé ce prix-là : trois implémentations divergentes du calcul de
 * prix ont coexisté plusieurs sessions, avec des coefficients différents
 * selon le fichier. Une copie anglaise du tunnel de paiement produirait le
 * même défaut, mais sur le prix annoncé à un étranger — invisible, puisque
 * les deux pages s'afficheraient normalement.
 *
 * Donc : **un seul composant, un seul calcul de prix, deux dictionnaires.**
 * Ce fichier ne porte que de l'affichage. Aucun montant, aucune règle, aucune
 * décision n'y vit.
 *
 * Le type `Dictionnaire` est ce qui rend l'opération sûre : une clé mal
 * orthographiée dans le composant est refusée par `tsc`, pas découverte par
 * un visiteur.
 *
 * NOTE SUR LES MONTANTS. Les prix restent écrits par `formaterMontant()` de
 * `src/lib/montant.ts`, y compris en anglais — donc « 59,00 € » et non
 * « €59.00 ». C'est volontaire : écrire les montants autrement ici créerait
 * une DEUXIÈME écriture de la règle de format, à côté de la bonne, ce que la
 * règle du projet interdit explicitement. Si l'écriture anglaise devient
 * nécessaire, elle s'ajoute dans `montant.ts` avec un paramètre de langue,
 * jamais ici.
 */

export type Langue = 'fr' | 'en'

/** La page jumelle, pour les hreflang et le sélecteur de langue. */
export const JUMEAU_RESERVATION: Record<Langue, string> = {
  fr: '/reserver',
  en: '/en/book',
}

const TEXTES = {
  // ── Chrome de la page ────────────────────────────────────────────────
  sceau:                  { fr: 'Votre réservation se scelle…',        en: 'Securing your booking…' },
  marque_sous_titre:      { fr: 'Chauffeur privé VTC',                 en: 'Private chauffeur service' },
  etape_trajet:           { fr: 'Trajet',                              en: 'Trip' },
  etape_paiement:         { fr: 'Paiement',                            en: 'Payment' },
  navigateur_titre:       { fr: 'Navigateur intégré détecté.',         en: 'In-app browser detected.' },
  navigateur_texte:       { fr: 'Pour finaliser votre paiement en sécurité, ouvrez cette page dans votre navigateur.',
                            en: 'To complete your payment securely, please open this page in your browser.' },
  navigateur_lien:        { fr: 'Ouvrir dans Chrome / Safari',         en: 'Open in Chrome / Safari' },
  autre_langue:           { fr: 'English',                             en: 'Français' },

  // ── Titre de l'étape 1 ───────────────────────────────────────────────
  surtitre:               { fr: 'Réservation en ligne',                en: 'Online booking' },
  titre:                  { fr: 'Réservez votre course',               en: 'Book your ride' },
  sous_titre:             { fr: 'Service VTC premium · Paris & Île-de-France',
                            en: 'Premium chauffeur service · Paris & Île-de-France' },
  avis_suffixe:           { fr: 'avis Google vérifiés',                en: 'verified Google reviews' },

  // ── Itinéraire ───────────────────────────────────────────────────────
  itineraire:             { fr: 'Itinéraire',                          en: 'Route' },
  adresse_depart:         { fr: 'Adresse de départ',                   en: 'Pick-up address' },
  adresse_depart_exemple: { fr: '15 Rue de la Paix, 75001 Paris',      en: '15 Rue de la Paix, 75001 Paris' },
  adresse_arrivee:        { fr: 'Adresse d’arrivée',                   en: 'Drop-off address' },
  adresse_arrivee_exemple:{ fr: 'Aéroport CDG, Terminal 2, 95700 Roissy',
                            en: 'CDG Airport, Terminal 2, 95700 Roissy' },
  tarif_calcule_km:       { fr: 'Tarif calculé au km',                 en: 'Priced per kilometre' },
  tarif_au_km:            { fr: 'Tarif au km',                         en: 'Per-kilometre rate' },
  selectionnez_liste:     { fr: 'Sélectionnez dans la liste',          en: 'Select from the list' },
  etape_intermediaire:    { fr: 'Adresse de l’étape',                  en: 'Stop-over address' },
  retirer_arret:          { fr: 'Retirer cet arrêt',                   en: 'Remove this stop' },
  date_prise_en_charge:   { fr: 'Date de prise en charge',             en: 'Pick-up date and time' },
  date:                   { fr: 'Date',                                en: 'Date' },
  heure:                  { fr: 'Heure',                               en: 'Time' },
  ajouter_arret:          { fr: '+ Ajouter un arrêt en chemin',        en: '+ Add a stop along the way' },
  continuer:              { fr: 'Continuer',                           en: 'Continue' },
  question_avant:         { fr: 'Une question avant de réserver ?',    en: 'A question before you book?' },

  // ── Aller-retour ─────────────────────────────────────────────────────
  ajouter_retour:         { fr: 'Ajouter un retour',                   en: 'Add a return trip' },
  aller_retour_titre:     { fr: 'Économisez avec un trajet retour inclus',
                            en: 'Save with a return leg included' },
  aller_retour_detail:    { fr: 'Prix aller × 2 — même tarif garanti',
                            en: 'Outbound price × 2 — same rate guaranteed' },
  date_retour:            { fr: 'Date du retour',                      en: 'Return date and time' },
  adresse_retour:         { fr: 'Adresse d’arrivée du retour',         en: 'Return drop-off address' },
  adresse_retour_exemple: { fr: 'Votre adresse de retour',             en: 'Your return address' },
  adresses_inversees:     { fr: '(adresses inversées)',                en: '(addresses reversed)' },
  adresse_retour_autre:   { fr: '(adresse de retour différente)',      en: '(different return address)' },

  // ── Vol et train ─────────────────────────────────────────────────────
  infos_vol:              { fr: '✈ Informations de vol',               en: '✈ Flight details' },
  infos_train:            { fr: '🚄 Informations train',               en: '🚄 Train details' },
  numero_vol:             { fr: 'N° de vol',                           en: 'Flight no.' },
  numero_train:           { fr: 'N° de train',                         en: 'Train no.' },
  ou_provenance:          { fr: 'ou provenance',                       en: 'or origin' },
  vol_exemple:            { fr: 'AF1234, ou Reykjavik',                en: 'AF1234, or Reykjavik' },
  train_exemple:          { fr: 'TGV 6423, ou Lyon',                   en: 'TGV 6423, or Lyon' },
  heure_arrivee:          { fr: 'Heure d’arrivée',                     en: 'Arrival time' },
  /* « Heure d'arrivée du vol » / « ...du train » : la phrase ENTIÈRE, et non
     des morceaux recollés. Le code assemblait « Heure » + « d'arrivée » +
     « du » + « vol » ; en anglais, cet ordre n'existe pas. Une phrase
     recomposée de bouts traduits séparément ne tombe juste que par chance. */
  heure_arrivee_vol:      { fr: 'Heure d’arrivée du vol',               en: 'Flight arrival time' },
  heure_arrivee_train:    { fr: 'Heure d’arrivée du train',             en: 'Train arrival time' },
  heure_depart_vol:       { fr: 'Heure de départ du vol',               en: 'Flight departure time' },
  heure_depart_train:     { fr: 'Heure de départ du train',             en: 'Train departure time' },
  terminal:               { fr: 'Terminal',                            en: 'Terminal' },
  voie_quai:              { fr: 'Voie / Quai',                         en: 'Platform' },
  terminal_exemple:       { fr: '2E, T1…',                             en: '2E, T1…' },
  voie_exemple:           { fr: 'Voie 6…',                             en: 'Platform 6…' },

  // ── Véhicule et passagers ────────────────────────────────────────────
  vehicule_passagers:     { fr: 'Véhicule & passagers',                en: 'Vehicle & passengers' },
  nombre_passagers:       { fr: 'Nombre de passagers',                 en: 'Number of passengers' },
  demandez_devis:         { fr: 'Demandez un devis',                   en: 'Request a quote' },
  plus_de_7_avant:        { fr: 'Plus de 7 passagers ?',               en: 'More than 7 passengers?' },
  plus_de_7_apres:        { fr: '— nous verifions la disponibilite avant toute reservation.',
                            en: '— we confirm availability before any booking.' },
  tarif_fixe_garanti:     { fr: 'Tarif fixe garanti',                  en: 'Fixed price guaranteed' },
  confirmation_immediate: { fr: 'Confirmation immédiate',              en: 'Immediate confirmation' },
  ou_sur:                 { fr: 'ou sur',                              en: 'or on' },
  prix_estime:            { fr: 'Prix estimé',                         en: 'Estimated price' },
  prix_aller_retour:      { fr: 'Prix aller-retour',                   en: 'Round-trip price' },
  calcul_itineraire:      { fr: 'Calcul de l’itinéraire…',             en: 'Calculating the route…' },
  forfait_zone:           { fr: 'Forfait zone',                        en: 'Fixed zone rate' },
  populaire:              { fr: 'Populaire',                           en: 'Popular' },
  /* « 1–3 passagers » : le nombre vient de la gamme, jamais d'ici. */
  passagers_suffixe:      { fr: 'passagers',                           en: 'passengers' },

  // ── Étape 2 : coordonnées et paiement ────────────────────────────────
  modifier_trajet:        { fr: 'Modifier le trajet',                  en: 'Change the journey' },
  vos_informations:       { fr: 'Vos informations',                    en: 'Your details' },
  preferez_telephone:     { fr: 'Vous préférez réserver par téléphone ?',  en: 'Would you rather book by phone?' },
  distance:               { fr: 'Distance',                            en: 'Distance' },
  total:                  { fr: 'Total',                               en: 'Total' },
  total_aller_retour:     { fr: 'Total aller-retour',                  en: 'Round-trip total' },
  code_parrain:           { fr: 'Code parrain',                        en: 'Referral code' },
  code_parrain_option:    { fr: '(optionnel — -10%)',                  en: '(optional — 10% off)' },
  payer:                  { fr: 'Payer',                               en: 'Pay' },
  paiement_securise_court:{ fr: 'Paiement sécurisé',                   en: 'secure payment' },
  recapitulatif:          { fr: 'Récapitulatif',                       en: 'Summary' },
  trajet:                 { fr: 'Trajet',                              en: 'Journey' },
  aller_retour_mention:   { fr: 'aller-retour',                       en: 'return trip' },
  date_et_heure:          { fr: 'Date & heure',                        en: 'Date & time' },
  recap_vide:             { fr: 'Renseignez votre trajet pour voir le récapitulatif',
                            en: 'Enter your journey to see the summary' },
  prix:                   { fr: 'Prix',                                en: 'Price' },
  /* Le véhicule garde son NOM français (« Berline », « Van 7 places ») :
     c'est celui que porteront la confirmation, la facture et l'écran de
     l'exploitant. Un client anglophone qui réserve un « Sedan » et reçoit
     une confirmation pour une « Berline » ne sait plus ce qu'il a commandé.
     Seul le mot « passager » se traduit. */
  passager:               { fr: 'passager',                            en: 'passenger' },
  passagers:              { fr: 'passagers',                           en: 'passengers' },
  paiement_securise:      { fr: 'Paiement sécurisé par Stripe · SSL/TLS · Aucune donnée bancaire stockée',
                            en: 'Secure payment by Stripe · SSL/TLS · No card details stored' },
  depart:                 { fr: 'Départ',                              en: 'Pick-up' },
  arrivee:                { fr: 'Arrivée',                             en: 'Drop-off' },
  vehicule:              { fr: 'Véhicule',                             en: 'Vehicle' },
  prenom:                 { fr: 'Prénom',                               en: 'First name' },
  nom:                    { fr: 'Nom',                                  en: 'Last name' },
  telephone:              { fr: 'Téléphone',                            en: 'Phone' },
  email:                  { fr: 'E-mail',                               en: 'Email' },
  email_confirmation:     { fr: 'Un email de confirmation vous sera envoyé après le paiement.',
                            en: 'A confirmation email will be sent to you after payment.' },
  /* « Comment nous avez-vous connus ? ». Les `value` des options restent
     EN FRANÇAIS dans le code : c'est ce qui part en base, et vos
     statistiques d'origine se scinderaient en deux vocabulaires si un
     anglophone enregistrait « Word of mouth » là où un francophone
     enregistre « Bouche-à-oreille ». Seul l'AFFICHAGE est traduit. */
  comment_connus:         { fr: 'Comment nous avez-vous connus ?',      en: 'How did you hear about us?' },
  optionnel:              { fr: '(optionnel)',                         en: '(optional)' },
  src_google:             { fr: 'Recherche Google',                    en: 'Google search' },
  src_assistant:          { fr: 'ChatGPT ou un autre assistant',       en: 'ChatGPT or another assistant' },
  src_hotel:              { fr: 'Recommandation d’un hôtel ou d’un château', en: 'Recommended by a hotel or château' },
  src_bouche:             { fr: 'Bouche-à-oreille',                      en: 'Word of mouth' },
  src_reseaux:            { fr: 'Réseaux sociaux',                      en: 'Social media' },
  src_deja_client:        { fr: 'Je suis déjà client',                   en: 'I am already a customer' },
  src_autre:              { fr: 'Autre',                               en: 'Other' },
  adresse_arret_exemple:  { fr: 'Adresse de l’arrêt',                   en: 'Stop address' },
  prefere_pas_repondre:   { fr: 'Je préfère ne pas répondre',          en: 'I’d rather not say' },

  // ── Bloc « parcours et questions » ───────────────────────────────
  /* Les questions elles-mêmes ne sont PAS ici : elles vivent dans
     `ParcoursEtQuestions.tsx`, avec leur réponse, dans une seule liste à
     deux colonnes. Seuls les titres du bloc sont ici. */
  parcours_surtitre:      { fr: 'Réservation en ligne',                en: 'Online booking' },
  parcours_titre:         { fr: 'Comment se passe votre réservation',  en: 'How your booking works' },
  parcours_sous_titre:    { fr: 'Trois étapes, et le prix connu dès la première.',
                            en: 'Three steps, and the price known from the first.' },
  questions_surtitre:     { fr: 'Avant de réserver',                   en: 'Before you book' },
  questions_titre:        { fr: 'Les questions qu’on nous pose',       en: 'The questions we are asked' },
  /* Le lien pointe vers les mentions légales FRANÇAISES, et c'est voulu :
     c'est le texte qui fait foi. On traduit la phrase qui y mène, pas le
     document. */
  conditions_phrase:      { fr: 'Les conditions de transport, d’annulation et de remboursement figurent dans nos',
                            en: 'Our terms of carriage, cancellation and refund are set out in our' },
  mentions_legales:       { fr: 'mentions légales',                     en: 'legal notice' },

  // ── Bloc des forfaits de référence ───────────────────────────────────
  /* Les MONTANTS ne sont pas ici : ils sont lus dans `grilles_tarifaires`
     par la page serveur. Ce bloc ne porte que la phrase autour. */
  tarifs_surtitre:        { fr: 'Tarifs fixes garantis',               en: 'Guaranteed fixed rates' },
  tarifs_titre:           { fr: 'Nos forfaits les plus demandés',      en: 'Our most requested fixed fares' },
  tarifs_texte:           { fr: 'Prix TTC par véhicule, pour une berline, péages et accueil compris. Le montant est fixé à la réservation et ne bouge pas, quels que soient le trafic ou l’attente à l’aéroport. Saisissez vos adresses ci-dessus pour le tarif exact de votre trajet.',
                            en: 'Prices include VAT and are for a sedan, tolls and meet-and-greet included. The amount is fixed when you book and does not move, whatever the traffic or the wait at the airport. Enter your addresses above for the exact fare for your journey.' },
  /* Traduction fidèle : la règle des étapes (son montant fixe et les
     kilomètres du détour) vit dans le calcul de prix, pas ici. On ne cite
     aucun chiffre dans ce texte, en français comme en anglais. */
  note_arrets:            { fr: 'Un arrêt en chemin ajoute les kilomètres du détour et des frais fixes. Les trajets hors forfait sont calculés à la distance réelle, annoncée avant paiement.',
                            en: 'A stop along the way adds the extra distance and a fixed charge. Journeys outside the fixed fares are priced on the actual distance, shown before payment.' },

  // ── E-mail de confirmation au client ────────────────────────────────
  /* SEUL l'e-mail du CLIENT est traduit. Ceux de l'exploitant et du
     chauffeur restent en français : ils les lisent en français, et deux
     versions d'un message interne, c'est deux endroits où se tromper. */
  mail_titre_simple:      { fr: 'Votre course est confirmée',          en: 'Your ride is confirmed' },
  mail_titre_ar:          { fr: 'Votre aller-retour est confirmé',     en: 'Your return trip is confirmed' },
  mail_bonjour:           { fr: 'voici le récapitulatif de votre réservation.',
                            en: 'here is the summary of your booking.' },
  mail_salutation:        { fr: 'Bonjour',                             en: 'Hello' },
  mail_chauffeur_a_venir: { fr: 'Votre chauffeur vous sera communiqué avant la prise en charge.',
                            en: 'We will tell you who your chauffeur is before pick-up.' },
  mail_question:          { fr: 'Pour toute question :',               en: 'Any questions:' },
  mail_sujet_simple:      { fr: 'Confirmation de course',              en: 'Booking confirmed' },
  mail_sujet_ar:          { fr: 'Confirmation aller-retour',           en: 'Return trip confirmed' },
  mail_sujet_a:           { fr: 'à',                                   en: 'at' },
  mail_sujet_et:          { fr: 'et',                                  en: 'and' },
  reference:              { fr: 'Référence',                           en: 'Reference' },
  tarif_estime:           { fr: 'Tarif estimé',                        en: 'Estimated fare' },
  /* Capitalisé, parce que c'est un LIBELLÉ de tableau, à côté de
     « Reference », « Vehicle », « Pick-up ». La clé `passagers`, elle, sert
     au milieu d'une phrase (« 2 passengers ») et reste en minuscule. */
  passagers_libelle:      { fr: 'Passagers',                           en: 'Passengers' },
  /* Le pied de page des e-mails. « VTC » est un terme réglementaire
     français qu'un lecteur anglophone ne comprend pas. */
  pied_email:             { fr: 'OWISE · Service VTC · Paris &amp; Île-de-France',
                            en: 'OWISE · Private chauffeur service · Paris &amp; Île-de-France' },
  arret:                  { fr: 'Arrêt',                               en: 'Stop' },
  trajet_aller:           { fr: 'Trajet aller',                        en: 'Outbound journey' },
  trajet_retour:          { fr: 'Trajet retour',                       en: 'Return journey' },

  // ── Descriptions des véhicules ───────────────────────────────────────
  veh_berline_desc:       { fr: 'Berline récente, intérieur soigné',   en: 'Recent sedan, immaculate interior' },
  veh_premium_desc:       { fr: 'Berline haut de gamme',               en: 'Top-of-the-range sedan' },
  veh_van_desc:           { fr: 'Van récent, 7 places assises',        en: 'Recent van, 7 seats' },

  // ── Bandeau cookies ─────────────────────────────────────────────────
  /* Le bandeau est global : il s'affiche sur toutes les pages, donc aussi
     sur les pages anglaises. Il déduit sa langue du chemin (/en/…) — sinon
     un anglophone se voit demander son consentement avec des boutons
     « Refuser / Accepter ». Le lien « en savoir plus » reste vers la page
     légale française : c'est le texte qui fait foi. */
  cookies_texte:          { fr: 'Les cookies nécessaires au fonctionnement du site sont toujours actifs. Les cookies de mesure d’audience (Google Analytics, PostHog, Meta Pixel) ne sont déposés qu’après votre acceptation : tant que vous n’avez pas répondu, aucune mesure n’est effectuée.',
                            en: 'Cookies needed to run the site are always on. Analytics cookies (Google Analytics, PostHog, Meta Pixel) are only set once you accept: until you answer, nothing is measured.' },
  cookies_en_savoir:      { fr: 'En savoir plus',                      en: 'Learn more' },
  cookies_refuser:        { fr: 'Refuser',                             en: 'Decline' },
  cookies_accepter:       { fr: 'Accepter',                            en: 'Accept' },

  // ── Parrainage ───────────────────────────────────────────────────────
  verifier:               { fr: 'Vérifier',                           en: 'Check' },
  code_valide:            { fr: '✓ Code valide — -10% appliqué !',     en: '✓ Valid code — 10% off applied!' },
  code_invalide:          { fr: 'Code invalide ou expiré',             en: 'Invalid or expired code' },

  // ── Messages d'erreur montrés au visiteur ────────────────────────────
  /* Ces libellés doublent, en anglais, les messages que `validationReservation.ts`
     rend en français. Ce module-là reste la seule AUTORITÉ : c'est lui qui
     refuse un paiement, et `/admin/funnel` groupe ses messages français.
     Ici on ne fait que les afficher dans la langue du visiteur. */
  err_depart_requis:      { fr: 'Adresse de départ requise.',          en: 'Pick-up address required.' },
  err_arrivee_requise:    { fr: 'Adresse d’arrivée requise.',          en: 'Drop-off address required.' },
  err_date_requise:       { fr: 'Date et heure requises.',             en: 'Date and time required.' },
  err_date_invalide:      { fr: 'Date et heure invalides.',            en: 'Invalid date or time.' },
  err_date_passee:        { fr: 'Cette date est déjà passée. Merci de choisir un horaire à venir.',
                            en: 'That time has already passed. Please choose a future time.' },
  err_date_futur:         { fr: 'La date de prise en charge doit être dans le futur.',
                            en: 'The pick-up time must be in the future.' },
  err_date_courte:        { fr: 'Date invalide.',                      en: 'Invalid date.' },
  err_date_lointaine:     { fr: 'Date trop lointaine (max 2 ans).',    en: 'Too far ahead (2 years maximum).' },
  err_depart_liste:       { fr: 'Sélectionnez une adresse de départ dans la liste.',
                            en: 'Please pick a departure address from the list.' },
  err_arrivee_liste:      { fr: 'Sélectionnez une adresse d’arrivée dans la liste.',
                            en: 'Please pick a destination address from the list.' },
  err_prix:               { fr: 'Prix non calculé — vérifiez les adresses.',
                            en: 'Price not calculated — please check the addresses.' },
  err_tarification:       { fr: 'Erreur de tarification.',             en: 'Pricing error.' },
  err_paiement:           { fr: 'Erreur de paiement',                  en: 'Payment error' },
  err_nom:                { fr: 'Merci d’indiquer votre nom.',         en: 'Please give your last name.' },
  err_prenom:             { fr: 'Merci d’indiquer votre prénom.',      en: 'Please give your first name.' },
  err_email:              { fr: 'Cette adresse e-mail semble incomplète.',
                            en: 'This email address looks incomplete.' },
  err_telephone:          { fr: 'Merci d’indiquer un téléphone joignable, avec l’indicatif du pays — par exemple +33 6 12 34 56 78 ou +1 623 300 5065. Votre chauffeur en a besoin le jour du trajet.',
                            en: 'Please give a reachable phone number with its country code — for example +33 6 12 34 56 78 or +1 623 300 5065. Your chauffeur needs it on the day.' },
  err_vol_numero:         { fr: 'Merci d’indiquer votre numéro de vol ou de train — ou, à défaut, votre ville de provenance. Votre chauffeur suit votre arrivée et vous attend en cas de retard.',
                            en: 'Please give your flight or train number — or, failing that, the city you are coming from. Your chauffeur tracks your arrival and waits if you are delayed.' },
  err_vol_heure:          { fr: 'Merci d’indiquer l’heure d’arrivée de votre vol ou de votre train.',
                            en: 'Please give the arrival time of your flight or train.' },
} as const satisfies Record<string, Record<Langue, string>>

export type CleTexte = keyof typeof TEXTES

/** Un dictionnaire résolu : `L.titre` est une chaîne, et `tsc` refuse une clé inconnue. */
export type Dictionnaire = { readonly [K in CleTexte]: string }

const CACHE = new Map<Langue, Dictionnaire>()

/**
 * Le dictionnaire d'une langue. Mémoïsé : le composant le lit à chaque
 * rendu, et reconstruire 70 entrées à chaque frappe de l'utilisateur serait
 * du gaspillage pour rien.
 */
export function textes(langue: Langue): Dictionnaire {
  const dejaLa = CACHE.get(langue)
  if (dejaLa) return dejaLa
  const d = Object.fromEntries(
    (Object.keys(TEXTES) as CleTexte[]).map(k => [k, TEXTES[k][langue]]),
  ) as Dictionnaire
  CACHE.set(langue, d)
  return d
}

/**
 * Traduit en anglais un message rendu par `validationReservation.ts`.
 *
 * Ce module reste volontairement français : c'est lui qui refuse un paiement
 * côté serveur, et `/admin/funnel` groupe ses messages tels quels — les
 * changer renommerait des lignes d'historique. On traduit donc à l'affichage,
 * par correspondance exacte. Une correspondance manquante rend le message
 * d'origine : le visiteur lit du français, ce qui est moins grave qu'un écran
 * muet.
 */
const PAR_MESSAGE_FR: ReadonlyMap<string, CleTexte> = new Map(
  (Object.keys(TEXTES) as CleTexte[])
    .filter(k => k.startsWith('err_'))
    .map(k => [TEXTES[k].fr, k]),
)

export function messageDansLaLangue(messageFr: string, langue: Langue): string {
  if (langue === 'fr') return messageFr
  const cle = PAR_MESSAGE_FR.get(messageFr.trim())
  return cle ? TEXTES[cle].en : messageFr
}

/** Les messages français que `messageDansLaLangue` sait traduire — pour les tests. */
export function messagesTraduisibles(): string[] {
  return [...PAR_MESSAGE_FR.keys()]
}
