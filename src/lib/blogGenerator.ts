// Génération de contenu blog basée sur les données réelles Owise
// Pas d'API IA externe — contenu factuel construit depuis la base de données

export type BlogPost = {
  slug: string
  titre: string
  meta_titre: string
  meta_desc: string
  intro: string
  paragraphes: { titre: string; texte: string }[]
  conclusion: string
  faq: { question: string; reponse: string }[]
  mots_cles: string[]
  categorie: string
  sujet_id: string
}

// ── Pool de sujets (60 sujets uniques basés sur les vraies zones) ──────────

type Sujet = {
  id: string
  type: 'transfert' | 'guide' | 'conseils' | 'entreprise' | 'comparatif'
  depart?: string
  arrivee?: string
  theme?: string
}

export const SUJETS: Sujet[] = [
  // Transferts aéroport depuis communes Oise
  { id: 'creil-cdg', type: 'transfert', depart: 'Creil', arrivee: 'CDG' },
  { id: 'senlis-cdg', type: 'transfert', depart: 'Senlis', arrivee: 'CDG' },
  { id: 'chantilly-cdg', type: 'transfert', depart: 'Chantilly', arrivee: 'CDG' },
  { id: 'gouvieux-cdg', type: 'transfert', depart: 'Gouvieux', arrivee: 'CDG' },
  { id: 'lamorlaye-cdg', type: 'transfert', depart: 'Lamorlaye', arrivee: 'CDG' },
  { id: 'compiegne-cdg', type: 'transfert', depart: 'Compiègne', arrivee: 'CDG' },
  { id: 'saint-maximin-cdg', type: 'transfert', depart: 'Saint-Maximin', arrivee: 'CDG' },
  { id: 'nogent-cdg', type: 'transfert', depart: 'Nogent-sur-Oise', arrivee: 'CDG' },
  { id: 'montataire-cdg', type: 'transfert', depart: 'Montataire', arrivee: 'CDG' },
  { id: 'pont-maxence-cdg', type: 'transfert', depart: 'Pont-Sainte-Maxence', arrivee: 'CDG' },
  { id: 'creil-orly', type: 'transfert', depart: 'Creil', arrivee: 'Orly' },
  { id: 'chantilly-orly', type: 'transfert', depart: 'Chantilly', arrivee: 'Orly' },
  { id: 'senlis-orly', type: 'transfert', depart: 'Senlis', arrivee: 'Orly' },
  { id: 'compiegne-orly', type: 'transfert', depart: 'Compiègne', arrivee: 'Orly' },
  { id: 'gouvieux-orly', type: 'transfert', depart: 'Gouvieux', arrivee: 'Orly' },
  { id: 'creil-beauvais', type: 'transfert', depart: 'Creil', arrivee: 'Beauvais' },
  { id: 'senlis-beauvais', type: 'transfert', depart: 'Senlis', arrivee: 'Beauvais' },
  { id: 'chantilly-beauvais', type: 'transfert', depart: 'Chantilly', arrivee: 'Beauvais' },
  { id: 'compiegne-beauvais', type: 'transfert', depart: 'Compiègne', arrivee: 'Beauvais' },
  { id: 'paris-creil', type: 'transfert', depart: 'Paris', arrivee: 'Creil' },
  { id: 'paris-chantilly', type: 'transfert', depart: 'Paris', arrivee: 'Chantilly' },
  { id: 'paris-senlis', type: 'transfert', depart: 'Paris', arrivee: 'Senlis' },
  { id: 'cdg-chantilly', type: 'transfert', depart: 'CDG', arrivee: 'Chantilly' },
  { id: 'cdg-paris', type: 'transfert', depart: 'CDG', arrivee: 'Paris' },
  { id: 'orly-paris', type: 'transfert', depart: 'Orly', arrivee: 'Paris' },
  // Guides locaux
  { id: 'guide-hippodrome-chantilly', type: 'guide', theme: "Hippodrome de Chantilly" },
  { id: 'guide-chateau-chantilly', type: 'guide', theme: "Château de Chantilly" },
  { id: 'guide-prix-diane', type: 'guide', theme: "Prix de Diane Longines" },
  { id: 'guide-prix-jockey-club', type: 'guide', theme: "Prix du Jockey Club" },
  { id: 'guide-foret-compiegne', type: 'guide', theme: "Forêt de Compiègne" },
  { id: 'guide-senlis-medieval', type: 'guide', theme: "Vieille ville de Senlis" },
  { id: 'guide-aeroport-cdg', type: 'guide', theme: "Aéroport Paris CDG" },
  { id: 'guide-aeroport-orly', type: 'guide', theme: "Aéroport Paris Orly" },
  { id: 'guide-aeroport-beauvais', type: 'guide', theme: "Aéroport Beauvais-Tillé" },
  // Conseils pratiques
  { id: 'conseils-vol-nuit', type: 'conseils', theme: "vol de nuit ou tôt le matin" },
  { id: 'conseils-vol-retarde', type: 'conseils', theme: "vol retardé" },
  { id: 'conseils-bagage-volumineux', type: 'conseils', theme: "bagages volumineux" },
  { id: 'conseils-voyage-famille', type: 'conseils', theme: "voyage en famille avec enfants" },
  { id: 'conseils-reservation-avance', type: 'conseils', theme: "réservation à l'avance" },
  { id: 'conseils-trajet-professionnel', type: 'conseils', theme: "trajet professionnel" },
  { id: 'conseils-nuit-supplementaire', type: 'conseils', theme: "supplément nuit VTC" },
  { id: 'conseils-animaux', type: 'conseils', theme: "transport avec animaux" },
  { id: 'conseils-van-groupe', type: 'conseils', theme: "déplacement en groupe (van 7 places)" },
  { id: 'conseils-weekend', type: 'conseils', theme: "week-end en Île-de-France et Oise" },
  // Entreprises
  { id: 'entreprise-creil', type: 'entreprise', theme: "Creil et Oise Sud" },
  { id: 'entreprise-compiegne', type: 'entreprise', theme: "Compiègne et Oise Nord" },
  { id: 'entreprise-chantilly', type: 'entreprise', theme: "Chantilly et secteur hippodrome" },
  { id: 'entreprise-seminaire', type: 'entreprise', theme: "séminaires et événements d'entreprise" },
  { id: 'entreprise-facturation', type: 'entreprise', theme: "facturation mensuelle compte entreprise" },
  // Comparatifs
  { id: 'comparatif-vtc-taxi-cdg', type: 'comparatif', theme: "VTC vs taxi pour CDG depuis l'Oise" },
  { id: 'comparatif-vtc-train-paris', type: 'comparatif', theme: "VTC vs train Paris depuis Creil/Senlis" },
  { id: 'comparatif-tarif-fixe', type: 'comparatif', theme: "tarif fixe VTC vs compteur taxi" },
  { id: 'comparatif-uber-vtc', type: 'comparatif', theme: "VTC traditionnel vs application mobile" },
  { id: 'comparatif-nuit-tarifs', type: 'comparatif', theme: "tarifs VTC de nuit vs jour" },
  { id: 'creil-liaisons-gares', type: 'transfert', depart: 'Creil', arrivee: 'Gare du Nord' },
  { id: 'chantilly-gare-nord', type: 'transfert', depart: 'Chantilly', arrivee: 'Gare du Nord' },
  { id: 'senlis-gare-nord', type: 'transfert', depart: 'Senlis', arrivee: 'Gare du Nord' },
  { id: 'saint-leu-cdg', type: 'transfert', depart: "Saint-Leu-d'Esserent", arrivee: 'CDG' },
  { id: 'verneuil-cdg', type: 'transfert', depart: 'Verneuil-en-Halatte', arrivee: 'CDG' },
  { id: 'liancourt-cdg', type: 'transfert', depart: 'Liancourt', arrivee: 'CDG' },
]

// ── Données de référence pour le contenu factuel ─────────────────────────

const AIRPORTS: Record<string, { nom: string; code: string; desc: string }> = {
  CDG:      { nom: 'Paris Charles de Gaulle (CDG)', code: 'CDG', desc: 'le plus grand aéroport de France, desservant 200+ destinations mondiales' },
  Orly:     { nom: 'Paris Orly (ORY)', code: 'ORY', desc: 'le deuxième aéroport de Paris, idéal pour les vols court et moyen-courriers' },
  Beauvais: { nom: 'Beauvais-Tillé (BVA)', code: 'BVA', desc: 'hub des compagnies low-cost Ryanair et Wizzair' },
}

const COMMUNES: Record<string, { zone: string; dist_cdg: number; desc: string }> = {
  'Creil':                { zone: 'Oise Sud', dist_cdg: 60, desc: 'ville industrielle et résidentielle de l\'Oise, bien desservie par le TER' },
  'Senlis':               { zone: 'Oise Sud', dist_cdg: 40, desc: 'cité médiévale classée, porte de la forêt de Compiègne' },
  'Chantilly':            { zone: 'Oise Sud', dist_cdg: 40, desc: 'ville du cheval et du château, célèbre pour son hippodrome international' },
  'Gouvieux':             { zone: 'Oise Sud', dist_cdg: 45, desc: 'commune résidentielle proche de Chantilly' },
  'Lamorlaye':            { zone: 'Oise Sud', dist_cdg: 45, desc: 'commune de l\'Oise à proximité de Chantilly' },
  'Compiègne':            { zone: 'Oise Nord', dist_cdg: 90, desc: 'ville royale historique, forêt nationale et château impérial' },
  'Saint-Maximin':        { zone: 'Oise Sud', dist_cdg: 55, desc: 'commune de l\'Oise entre Creil et Senlis' },
  'Nogent-sur-Oise':      { zone: 'Oise Sud', dist_cdg: 60, desc: 'commune adjacente à Creil, en bord d\'Oise' },
  'Montataire':           { zone: 'Oise Sud', dist_cdg: 60, desc: 'commune de l\'agglomération creilloise' },
  'Pont-Sainte-Maxence':  { zone: 'Oise Sud', dist_cdg: 65, desc: 'commune de l\'Oise au bord de la rivière' },
  "Saint-Leu-d'Esserent": { zone: 'Oise Sud', dist_cdg: 50, desc: 'commune de l\'Oise, proche de Creil' },
  'Verneuil-en-Halatte':  { zone: 'Oise Sud', dist_cdg: 55, desc: 'commune boisée de l\'Oise' },
  'Liancourt':            { zone: 'Oise Sud', dist_cdg: 55, desc: 'commune de l\'Oise entre Creil et Compiègne' },
  'Paris':                { zone: 'Paris', dist_cdg: 25, desc: 'capitale française, toutes zones intramuros' },
  'CDG':                  { zone: 'Aéroport', dist_cdg: 0, desc: 'Aéroport Paris Charles de Gaulle' },
  'Orly':                 { zone: 'Aéroport', dist_cdg: 35, desc: 'Aéroport Paris Orly' },
  'Gare du Nord':         { zone: 'Gare', dist_cdg: 27, desc: 'principale gare internationale de Paris, terminus Eurostar et Thalys' },
}

// ── Générateur principal ──────────────────────────────────────────────────

export function genererContenu(sujet: Sujet, prixBerline?: number): BlogPost {
  switch (sujet.type) {
    case 'transfert':   return genTransfert(sujet, prixBerline)
    case 'guide':       return genGuide(sujet)
    case 'conseils':    return genConseils(sujet)
    case 'entreprise':  return genEntreprise(sujet)
    case 'comparatif':  return genComparatif(sujet, prixBerline)
    default:            return genConseils(sujet)
  }
}

function slugify(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ── Template : Transfert ──────────────────────────────────────────────────

function genTransfert(s: Sujet, prix?: number): BlogPost {
  const dep    = s.depart  || 'Paris'
  const arr    = s.arrivee || 'CDG'
  const depInfo = COMMUNES[dep]  || { zone: 'Île-de-France', dist_cdg: 30, desc: '' }
  const arrInfo = AIRPORTS[arr]  || { nom: arr, code: arr, desc: '' }
  const prixStr = prix ? `${prix} €` : 'tarif fixe garanti'

  return {
    slug: `vtc-${slugify(dep)}-${slugify(arr)}`,
    sujet_id: s.id,
    categorie: 'transfert',
    mots_cles: [`vtc ${dep.toLowerCase()}`, `transfert ${arr.toLowerCase()}`, `chauffeur privé ${dep.toLowerCase()}`, `prix vtc ${dep.toLowerCase()} ${arr.toLowerCase()}`],
    meta_titre: `VTC ${dep} → ${arr} : Tarif Fixe | Owise Chauffeur Privé`,
    meta_desc: `Transfert VTC ${dep} → ${arr} avec Owise. ${prixStr} en berline, chauffeur professionnel, disponible 24h/24. Réservez en 2 minutes.`,
    titre: `VTC ${dep} vers ${arr} : tout ce qu'il faut savoir`,
    intro: `Vous cherchez un transfert en VTC depuis ${dep} vers ${arr === 'CDG' || arr === 'Orly' || arr === 'Beauvais' ? `l'aéroport de ${arrInfo.nom}` : arr} ? Owise propose un service de chauffeur privé premium au départ de ${dep} (${depInfo.zone}) avec un tarif fixe garanti dès la réservation — aucune mauvaise surprise, quel que soit le trafic ou la durée réelle du trajet. Dans cet article, nous détaillons tout : les tarifs réels, la durée de trajet, les conseils pratiques et les questions les plus fréquentes.`,
    paragraphes: [
      {
        titre: `Pourquoi choisir un VTC pour ${dep} → ${arr} ?`,
        texte: `Le trajet en VTC depuis ${dep} vers ${arrInfo.nom} offre une sérénité incomparable par rapport aux autres options de transport. Contrairement au taxi (tarif au compteur imprévisible) ou au train (nécessite parfois plusieurs correspondances et un trajet jusqu'en gare), le VTC vous prend en charge directement à votre adresse à ${dep} et vous dépose aux portes de ${arr}, sans escale. ${depInfo.desc ? `${dep} est ${depInfo.desc}.` : ''}`,
      },
      {
        titre: `Tarifs VTC ${dep} → ${arr} : ce que vous payez vraiment`,
        texte: `Chez Owise, le tarif ${dep} → ${arr} est calculé à l'avance et confirmé lors de la réservation. ${prix ? `Pour une berline standard (1 à 4 passagers), comptez ${prix} € TTC, tout compris.` : 'Le prix exact s\'affiche immédiatement dans notre estimateur en ligne, selon votre adresse précise.'} Pour un van 7 places, le tarif est proportionnellement adapté au nombre de passagers et au véhicule. Le supplément nuit (avant 6h ou après 22h) est automatiquement inclus dans le devis si votre trajet se situe sur ces plages horaires.`,
      },
      {
        titre: `Durée et conditions du trajet ${dep} → ${arr}`,
        texte: `Le temps de trajet entre ${dep} et ${arr} varie selon les conditions de circulation. En dehors des heures de pointe, comptez approximativement ${Math.round(depInfo.dist_cdg / 80 * 60)} à ${Math.round(depInfo.dist_cdg / 60 * 60)} minutes. Votre chauffeur Owise suit votre vol en temps réel grâce au numéro de vol — en cas de retard, il ajuste son heure d'arrivée automatiquement, sans frais supplémentaires.`,
      },
      {
        titre: `Comment réserver votre VTC ${dep} → ${arr} ?`,
        texte: `La réservation se fait en ligne en moins de 2 minutes sur owise.fr. Renseignez votre adresse exacte à ${dep}, la destination (${arr}), la date et l'heure, le nombre de passagers — et obtenez immédiatement le tarif confirmé. Le paiement s'effectue par carte bancaire sécurisée (Stripe) ou en espèces le jour J. Vous recevez une confirmation par email avec tous les détails de votre course.`,
      },
      {
        titre: `Zone de prise en charge depuis ${dep}`,
        texte: `Owise assure les prises en charge non seulement depuis le centre de ${dep}, mais aussi depuis les communes voisines : ${depInfo.zone === 'Oise Sud' ? 'Nogent-sur-Oise, Montataire, Saint-Maximin, Lamorlaye, Gouvieux, Chantilly, Senlis et toutes les localités de l\'Oise Sud' : depInfo.zone === 'Oise Nord' ? 'Margny-lès-Compiègne, Venette, Choisy-au-Bac, Thourotte et toutes les communes de l\'Oise Nord' : 'toutes les adresses de la zone de service'}. Le tarif est calculé précisément depuis votre adresse réelle — pas d'estimation approximative.`,
      },
      {
        titre: `VTC ${dep} → ${arr} : les avantages Owise`,
        texte: `Owise se distingue par plusieurs engagements concrets : tarif fixe garanti (jamais de surprises sur la facture finale), chauffeurs professionnels titulaires d'une carte VTC, véhicules premium de standing (berline ou van selon vos besoins), annulation gratuite jusqu'à l'arrivée du chauffeur, et suivi de vol intégré pour les transferts aéroport. Le service est disponible 24h/24, 7j/7, y compris les jours fériés.`,
      },
    ],
    conclusion: `Le VTC depuis ${dep} vers ${arr} avec Owise, c'est la garantie d'un transfert confortable, ponctuel et au prix annoncé — sans négociation, sans compteur qui tourne. Que vous partiez en voyage d'affaires ou en vacances en famille, réservez maintenant sur owise.fr et voyagez l'esprit tranquille.`,
    faq: [
      { question: `Combien coûte un VTC de ${dep} à ${arr} ?`, reponse: prix ? `Le tarif Owise pour un trajet ${dep} → ${arr} en berline est de ${prix} € TTC, tarif fixe garanti dès la réservation.` : `Le tarif exact s'affiche en temps réel sur owise.fr selon votre adresse précise. Il est garanti fixe dès la confirmation.` },
      { question: `Combien de temps dure le trajet ${dep} → ${arr} ?`, reponse: `En conditions normales, comptez entre ${Math.round(depInfo.dist_cdg / 80 * 60)} et ${Math.round(depInfo.dist_cdg / 60 * 60)} minutes. Votre chauffeur adapte le départ selon le trafic en temps réel.` },
      { question: `Le tarif VTC ${dep} → ${arr} inclut-il les péages ?`, reponse: `Oui, le tarif affiché est tout compris : péages, carburant, prise en charge. Aucun supplément n'est ajouté en fin de course.` },
      { question: `Peut-on réserver un VTC ${dep} → ${arr} à la dernière minute ?`, reponse: `Oui, Owise est disponible 24h/24. Nous recommandons toutefois de réserver à l'avance, surtout aux heures de pointe ou pour les vols matinaux.` },
      { question: `Le chauffeur attend-il si mon vol à ${arr} est retardé ?`, reponse: `Oui, Owise suit votre vol en temps réel. En cas de retard, le chauffeur ajuste automatiquement son heure d'arrivée sans frais supplémentaires.` },
      { question: `Peut-on transporter des bagages volumineux (skis, poussette) ?`, reponse: `Oui, les berlines Owise ont un grand coffre adapté aux bagages standards. Pour les équipements volumineux, le van 7 places est recommandé.` },
      { question: `Quel véhicule choisir pour le trajet ${dep} → ${arr} ?`, reponse: `Pour 1 à 4 passagers, la berline est idéale. Pour 5 à 7 passagers ou des bagages nombreux, optez pour le van 7 places.` },
      { question: `Y a-t-il un supplément pour un départ de nuit (avant 6h) ?`, reponse: `Oui, un supplément nuit est appliqué automatiquement pour les courses avant 6h ou après 22h. Il est inclus et visible dans votre estimation avant de confirmer.` },
      { question: `Comment payer mon VTC ${dep} → ${arr} ?`, reponse: `Paiement en ligne sécurisé par carte bancaire lors de la réservation (Stripe). Le paiement en espèces directement au chauffeur est également possible.` },
      { question: `Owise dessert-il les communes proches de ${dep} ?`, reponse: `Oui, toutes les communes dans un rayon de 10 à 15 km autour de ${dep} sont desservies. Renseignez votre adresse précise sur owise.fr pour obtenir votre tarif exact.` },
    ],
  }
}

// ── Template : Guide local ────────────────────────────────────────────────

function genGuide(s: Sujet): BlogPost {
  const theme = s.theme || 'Chantilly'
  return {
    slug: `guide-transport-${slugify(theme)}`,
    sujet_id: s.id,
    categorie: 'guide',
    mots_cles: [`vtc ${theme.toLowerCase()}`, `transport ${theme.toLowerCase()}`, `chauffeur privé ${theme.toLowerCase()}`],
    meta_titre: `Transport vers ${theme} : VTC Premium | Owise Chauffeur Privé`,
    meta_desc: `Comment se rendre à ${theme} en VTC ? Tarifs, conseils et réservation avec Owise, votre chauffeur privé en Île-de-France et Oise.`,
    titre: `Se rendre à ${theme} en VTC : le guide complet`,
    intro: `${theme} est une destination incontournable de l'Oise et de l'Île-de-France. Que vous y alliez pour un événement, une visite touristique ou un rendez-vous professionnel, le VTC avec chauffeur privé est la solution la plus confortable et la plus fiable. Owise assure votre transfert depuis Paris, CDG, Orly ou toute commune de l'Oise avec un tarif fixe garanti.`,
    paragraphes: [
      { titre: `Pourquoi visiter ${theme} ?`, texte: `${theme} est renommé${theme.includes('Château') || theme.includes('Forêt') ? 'e' : ''} pour son patrimoine exceptionnel et son atmosphère unique. Cette destination attire chaque année des milliers de visiteurs venus de toute l'Europe, qu'il s'agisse d'amateurs de culture, de passionnés de sport ou de professionnels en déplacement.` },
      { titre: `Accès et transport vers ${theme}`, texte: `Pour rejoindre ${theme}, plusieurs options existent : le train (depuis Paris Gare du Nord), la voiture personnelle, ou le VTC avec chauffeur. Cette dernière option offre une flexibilité totale, une prise en charge directe à votre adresse et un confort incomparable — particulièrement appréciée pour les événements ou les arrivées en dehors des horaires de transport en commun.` },
      { titre: `VTC depuis Paris vers ${theme}`, texte: `Depuis Paris intramuros, Owise propose un transfert en berline ou van vers ${theme} avec tarif calculé selon votre adresse exacte. Le trajet dure généralement 45 à 70 minutes selon les conditions de circulation. Le chauffeur vous prend en charge à votre porte et vous dépose précisément à destination.` },
      { titre: `VTC depuis CDG ou Orly vers ${theme}`, texte: `Vous arrivez à Paris en avion ? Owise assure le transfert direct depuis CDG ou Orly vers ${theme} sans correspondance ni changement. C'est particulièrement pratique pour les visiteurs internationaux ou les déplacements professionnels incluant un vol.` },
      { titre: `Tarifs VTC vers ${theme}`, texte: `Les tarifs Owise vers ${theme} varient selon votre point de départ. Depuis Paris intramuros, comptez entre 60 et 100 € selon le véhicule. Depuis CDG ou les communes de l'Oise, utilisez l'estimateur sur owise.fr pour obtenir votre tarif exact en temps réel.` },
      { titre: `Conseils pratiques pour ${theme}`, texte: `Pour les grands événements (hippodrome, château, festivals), réservez votre VTC à l'avance : les disponibilités sont limitées lors des jours de forte affluence. Owise peut assurer la prise en charge aller ET retour, avec une attente sur place si nécessaire (mise à disposition).` },
    ],
    conclusion: `Que ce soit pour une première visite ou un retour à ${theme}, Owise vous garantit un transport premium, ponctuel et au prix annoncé. Réservez votre VTC sur owise.fr et profitez pleinement de votre expérience.`,
    faq: [
      { question: `Comment aller à ${theme} depuis Paris ?`, reponse: `En VTC Owise depuis Paris, comptez 45 à 70 minutes selon votre adresse et les conditions de trafic. Tarif fixe, prise en charge à domicile.` },
      { question: `Peut-on aller à ${theme} depuis CDG en VTC ?`, reponse: `Oui, Owise assure le transfert CDG → ${theme} directement, sans correspondance. Tarif fixe affiché avant confirmation.` },
      { question: `Y a-t-il un stationnement facile à ${theme} ?`, reponse: `Pour les événements de grande affluence (hippodrome, château), le VTC est idéal : votre chauffeur gère le stationnement et vous dépose à l'entrée.` },
      { question: `Peut-on réserver un aller-retour vers ${theme} ?`, reponse: `Oui, l'option aller-retour est disponible sur owise.fr avec un tarif préférentiel. Indiquez simplement votre heure de retour souhaitée.` },
      { question: `Owise propose-t-il la mise à disposition à ${theme} ?`, reponse: `Oui, pour les événements ou visites longues, Owise propose un service de mise à disposition avec le chauffeur qui patiente sur place.` },
      { question: `Quel est le tarif VTC depuis Creil vers ${theme} ?`, reponse: `Depuis Creil, le tarif vers ${theme} est calculé selon votre adresse précise sur owise.fr. Généralement entre 30 et 60 € en berline.` },
      { question: `Le VTC Owise est-il disponible pour les événements en soirée ?`, reponse: `Oui, 24h/24 et 7j/7. Un supplément nuit s'applique automatiquement pour les retours après 22h.` },
      { question: `Combien de passagers peut-on être pour aller à ${theme} ?`, reponse: `Jusqu'à 4 passagers en berline, jusqu'à 7 en van. Renseignez le nombre lors de la réservation.` },
      { question: `Peut-on transporter du matériel (équipement sport, musical) ?`, reponse: `Oui, dans la limite des capacités du véhicule. Pour du matériel volumineux, le van 7 places est recommandé.` },
      { question: `Owise dessert-il toute la zone autour de ${theme} ?`, reponse: `Oui, toutes les communes dans un rayon de 15 km autour de ${theme} sont desservies. Utilisez l'estimateur owise.fr pour votre adresse exacte.` },
    ],
  }
}

// ── Template : Conseils pratiques ─────────────────────────────────────────

function genConseils(s: Sujet): BlogPost {
  const theme = s.theme || 'votre trajet VTC'
  return {
    slug: `conseils-vtc-${slugify(theme)}`,
    sujet_id: s.id,
    categorie: 'conseils',
    mots_cles: [`vtc conseils`, `chauffeur privé ${theme.toLowerCase()}`, `transport ${theme.toLowerCase()}`],
    meta_titre: `VTC et ${theme} : nos conseils pratiques | Owise`,
    meta_desc: `Tout ce qu'il faut savoir sur ${theme} avec un VTC Owise : tarifs, réservation, astuces. Service premium en Île-de-France et Oise.`,
    titre: `VTC et ${theme} : le guide pratique complet`,
    intro: `Prendre un VTC pour ${theme} soulève souvent des questions pratiques. Chez Owise, nous avons accompagné des milliers de clients dans des situations variées. Ce guide répond aux questions les plus fréquentes et vous donne les meilleures astuces pour voyager sereinement.`,
    paragraphes: [
      { titre: `Comprendre les spécificités du trajet`, texte: `Chaque situation de voyage a ses particularités. Pour ${theme}, il est important d'anticiper les contraintes spécifiques : horaires décalés, contraintes de bagages, nombre de passagers, ou conditions météorologiques. Owise adapte son service à chaque situation.` },
      { titre: `Préparer votre réservation VTC`, texte: `Réservez votre VTC sur owise.fr en renseignant : votre adresse exacte de prise en charge, votre destination précise, la date et l'heure souhaitées, le nombre de passagers. Le tarif s'affiche immédiatement, confirmé et garanti.` },
      { titre: `Les avantages du VTC pour ${theme}`, texte: `Le VTC offre une flexibilité que les transports en commun ne peuvent pas garantir : pas d'horaires fixes, pas de correspondances, prise en charge à votre porte. Pour ${theme} spécifiquement, cela fait une différence significative sur le confort et la sérénité du voyage.` },
      { titre: `Tarifs et transparence`, texte: `Owise s'engage sur un tarif fixe annoncé avant la réservation. Pas de compteur qui tourne, pas de majoration surprise selon le trafic. Le prix affiché est le prix final — péages et TVA inclus.` },
      { titre: `Disponibilité 24h/24`, texte: `Quel que soit l'horaire de votre départ ou de votre arrivée, Owise est disponible. Le service fonctionne tous les jours de l'année, y compris les jours fériés. Pour les courses de nuit (avant 6h ou après 22h), un supplément automatique est inclus dans votre estimation.` },
      { titre: `Notre zone de service en Île-de-France et Oise`, texte: `Owise dessert Paris, toute l'Île-de-France et l'Oise : Creil, Chantilly, Senlis, Gouvieux, Lamorlaye, Compiègne, Saint-Maximin et toutes les communes environnantes. Les aéroports CDG, Orly et Beauvais sont desservis avec tarif fixe garanti.` },
    ],
    conclusion: `Pour ${theme}, Owise est votre partenaire de confiance. Service professionnel, tarif garanti, disponibilité totale — réservez sur owise.fr en moins de 2 minutes.`,
    faq: genFaqGenerique(theme),
  }
}

// ── Template : Entreprise ────────────────────────────────────────────────

function genEntreprise(s: Sujet): BlogPost {
  const theme = s.theme || 'votre entreprise'
  return {
    slug: `vtc-entreprise-${slugify(theme)}`,
    sujet_id: s.id,
    categorie: 'entreprise',
    mots_cles: [`vtc entreprise ${theme.toLowerCase()}`, `transport d'affaires ${theme.toLowerCase()}`, `compte entreprise vtc`],
    meta_titre: `VTC Entreprise ${theme} : Transport Pro | Owise`,
    meta_desc: `Solution VTC professionnelle pour les entreprises de ${theme}. Compte entreprise, facturation mensuelle, tarif fixe. Owise, votre partenaire mobilité.`,
    titre: `VTC pour entreprises à ${theme} : la solution transport professionnelle`,
    intro: `Les entreprises de ${theme} ont des besoins de transport spécifiques : régularité, fiabilité, discrétion et facturation simplifiée. Owise propose une solution VTC dédiée aux professionnels avec compte entreprise, facturation mensuelle et tarifs négociés pour les déplacements réguliers.`,
    paragraphes: [
      { titre: `Pourquoi les entreprises choisissent Owise`, texte: `Les entreprises basées à ${theme} ou ayant des collaborateurs dans l'Oise font confiance à Owise pour leurs déplacements professionnels : transferts aéroport (CDG, Orly, Beauvais), navettes entre sites, transport de clients, séminaires. Le tarif fixe garanti simplifie la comptabilité et élimine les mauvaises surprises.` },
      { titre: `Compte entreprise et facturation mensuelle`, texte: `Owise propose un compte entreprise avec facturation mensuelle centralisée. Plus besoin de notes de frais individuelles : toutes les courses sont regroupées sur une facture unique, avec référence de collaborateur et validation admin. Compatible avec les obligations comptables françaises.` },
      { titre: `Transport de clients et partenaires`, texte: `Impressionnez vos clients et partenaires avec un service VTC premium. Nos chauffeurs en costume, nos véhicules premium et notre ponctualité reflètent l'image professionnelle de votre entreprise. Une carte nominative à l'aéroport, un accueil personnalisé — chaque détail compte.` },
      { titre: `Transferts aéroport pour vos équipes`, texte: `Pour les collaborateurs basés dans l'Oise qui prennent régulièrement l'avion depuis CDG, Orly ou Beauvais, le compte entreprise Owise simplifie tout : réservation en ligne, tarif fixe, confirmation automatique et facture mensuelle.` },
      { titre: `Séminaires et événements d'entreprise`, texte: `Pour les séminaires, team buildings ou événements d'entreprise dans l'Oise (Chantilly, Compiègne, Senlis), Owise coordonne le transport de groupe avec vans 7 places et flotte dédiée. Devis sur mesure pour les groupes de plus de 10 personnes.` },
      { titre: `Tarifs entreprise et avantages`, texte: `Les comptes entreprise Owise bénéficient de tarifs préférentiels sur les trajets récurrents. Contactez-nous pour un devis adapté à votre volume de courses mensuel. Facturation en 30 jours, toutes options incluses.` },
    ],
    conclusion: `Owise est le partenaire mobilité des entreprises de ${theme} et de toute l'Oise. Demandez votre compte entreprise en contactant owise.entreprise@gmail.com — mise en place en 48h.`,
    faq: [
      { question: `Comment ouvrir un compte entreprise Owise ?`, reponse: `Contactez-nous via owise.fr ou par email à owise.entreprise@gmail.com. La mise en place est effectuée en 48h.` },
      { question: `La facturation mensuelle est-elle possible ?`, reponse: `Oui, toutes les courses du mois sont regroupées sur une facture mensuelle avec détail par collaborateur.` },
      { question: `Peut-on réserver des VTC pour des clients extérieurs ?`, reponse: `Oui, le compte entreprise permet de réserver des courses pour vos clients, fournisseurs et partenaires.` },
      { question: `Owise propose-t-il des vans pour les séminaires ?`, reponse: `Oui, des vans 7 places sont disponibles pour les déplacements de groupe. Contactez-nous pour un devis multi-véhicules.` },
      { question: `Le service est-il disponible 24h/24 pour les entreprises ?`, reponse: `Oui, même pour les vols tôt le matin ou en soirée. Réservation possible via owise.fr à toute heure.` },
      { question: `Les transferts aéroport sont-ils inclus dans le compte entreprise ?`, reponse: `Oui, CDG, Orly et Beauvais sont desservis avec tarif fixe garanti. Vol suivi en temps réel.` },
      { question: `Quel délai pour une réservation entreprise ?`, reponse: `Réservation possible jusqu'à quelques heures avant la course. Pour les événements, anticipez quelques jours.` },
      { question: `Y a-t-il des tarifs préférentiels pour les clients réguliers ?`, reponse: `Oui, les comptes entreprise avec volume régulier bénéficient de conditions négociées. Demandez un devis personnalisé.` },
      { question: `Owise peut-il fournir un justificatif TVA ?`, reponse: `Oui, toutes les factures Owise incluent les mentions légales obligatoires et le numéro SIRET pour la comptabilité.` },
      { question: `Le transport d'équipements professionnels est-il possible ?`, reponse: `Oui, dans la limite des capacités du véhicule. Pour les équipements volumineux, le van 7 places est recommandé.` },
    ],
  }
}

// ── Template : Comparatif ─────────────────────────────────────────────────

function genComparatif(s: Sujet, prix?: number): BlogPost {
  const theme = s.theme || 'VTC vs taxi'
  return {
    slug: `comparatif-${slugify(theme)}`,
    sujet_id: s.id,
    categorie: 'comparatif',
    mots_cles: [`vtc comparatif`, theme.toLowerCase(), 'tarif fixe vtc', 'chauffeur privé oise'],
    meta_titre: `${theme} : lequel choisir ? | Owise VTC Oise`,
    meta_desc: `Comparaison objective : ${theme}. Tarifs, confort, fiabilité. Guide Owise pour choisir le meilleur transport depuis l'Oise.`,
    titre: `${theme} : comparaison objective pour bien choisir`,
    intro: `Vous hésitez entre plusieurs options de transport ? Ce guide compare objectivement ${theme} pour vous aider à faire le meilleur choix selon votre situation, votre budget et vos contraintes.`,
    paragraphes: [
      { titre: `Les critères de comparaison`, texte: `Pour comparer efficacement, nous analysons 5 critères essentiels : le coût total réel, la fiabilité et ponctualité, le confort, la flexibilité, et la facilité de réservation. Chaque critère a son importance selon le type de trajet.` },
      { titre: `Avantage coût : transparence vs improvisation`, texte: `Avec Owise, le tarif est fixe et connu avant de monter dans le véhicule. ${prix ? `Pour un trajet typique, comptez par exemple ${prix} € en berline, tout compris.` : 'L\'estimateur owise.fr affiche le tarif exact en quelques secondes.'} Cette transparence permet de comparer réellement et d'anticiper le budget transport.` },
      { titre: `Fiabilité et ponctualité`, texte: `Pour un transfert aéroport ou un rendez-vous professionnel, la ponctualité n'est pas négociable. Owise garantit la prise en charge à l'heure convenue, avec suivi du vol en temps réel pour les arrivées aéroport — votre chauffeur sait si votre vol est en retard avant même que vous atterrissiez.` },
      { titre: `Confort et qualité de service`, texte: `Les véhicules Owise sont récents, climatisés, avec eau et chargeurs à bord. Les chauffeurs sont professionnels, discrets et connaissent parfaitement les itinéraires de l'Oise et de l'Île-de-France. Un niveau de service premium à tarif compétitif.` },
      { titre: `Flexibilité et disponibilité`, texte: `Owise est disponible 24h/24 sans rendez-vous planifié à l'avance, avec réservation en ligne en 2 minutes. Modification ou annulation sans pénalité jusqu'à l'arrivée du chauffeur. Cette flexibilité est particulièrement précieuse pour les déplacements professionnels imprévus.` },
      { titre: `Notre verdict`, texte: `Pour les transferts aéroport, événements ou trajets réguliers depuis l'Oise, Owise offre le meilleur rapport qualité-prix avec la sécurité du tarif fixe. Pour les courtes distances en centre-ville, d'autres options peuvent être plus économiques. À chacun de peser ses priorités.` },
    ],
    conclusion: `Le meilleur transport est celui qui correspond à vos besoins spécifiques. Si la ponctualité, le confort et la transparence des tarifs comptent pour vous — Owise est votre solution. Estimez votre trajet sur owise.fr en 30 secondes.`,
    faq: genFaqGenerique(theme),
  }
}

// ── FAQ générique ────────────────────────────────────────────────────────

function genFaqGenerique(theme: string): { question: string; reponse: string }[] {
  return [
    { question: `Owise couvre-t-il toute l'Oise ?`, reponse: `Oui, Creil, Chantilly, Senlis, Gouvieux, Lamorlaye, Compiègne et toutes les communes environnantes. Vérifiez votre adresse sur owise.fr.` },
    { question: `Quel est le délai minimum pour réserver ?`, reponse: `Quelques heures avant la course suffisent en général. Pour les événements ou les vols très matinaux, réservez la veille.` },
    { question: `Le tarif change-t-il si le trajet prend plus de temps que prévu ?`, reponse: `Non, le tarif fixe Owise est garanti dès la confirmation, quelle que soit la durée réelle du trajet.` },
    { question: `Peut-on payer en espèces ?`, reponse: `Oui, le paiement en espèces est possible directement au chauffeur. Le paiement en ligne par carte est également disponible.` },
    { question: `Y a-t-il un supplément pour plusieurs arrêts ?`, reponse: `Oui, pour les trajets avec étapes intermédiaires. Le tarif exact avec étapes s'affiche sur owise.fr.` },
    { question: `Owise propose-t-il des véhicules accessibles PMR ?`, reponse: `Contactez-nous directement pour les besoins spécifiques PMR. Nous faisons notre possible pour adapter le service.` },
    { question: `Que se passe-t-il si je dois annuler ?`, reponse: `L'annulation est gratuite jusqu'à l'arrivée du chauffeur. Aucune pénalité sur la carte bancaire.` },
    { question: `Les chauffeurs Owise sont-ils certifiés VTC ?`, reponse: `Oui, tous nos chauffeurs sont titulaires d'une carte professionnelle VTC délivrée par la préfecture.` },
    { question: `Peut-on réserver pour quelqu'un d'autre (client, famille) ?`, reponse: `Oui, le compte et le paiement sont à votre nom, le passager peut être différent. Indiquez simplement les informations de la personne transportée.` },
    { question: `Owise propose-t-il des forfaits pour trajets récurrents ?`, reponse: `Oui, pour les clients réguliers (trajets hebdomadaires, compte entreprise). Contactez-nous pour un devis personnalisé.` },
  ]
}
