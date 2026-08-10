import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import VitrineBody from '@/components/VitrineBody'
import '../vitrine.css'

const DESTINATIONS: Record<string, {
  slug: string
  title: string
  metaTitle: string
  metaDesc: string
  keywords: string[]
  h1: string
  intro: string
  prix: string
  duree: string
  zones?: { nom: string; cp: string; km: number }[]
  faq: { q: string; a: string }[]
}> = {
  'vtc-aeroport-cdg': {
    slug: 'vtc-aeroport-cdg',
    title: 'VTC Aéroport CDG',
    metaTitle: 'VTC Aéroport CDG dès 45€ — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC vers CDG depuis Paris et IDF. Tarif fixe dès 45€, suivi de vol en temps réel, chauffeur dans le hall. Disponible 24h/24. Réservez en 30 secondes.',
    keywords: ['vtc cdg','transfert aéroport cdg','chauffeur privé charles de gaulle','vtc roissy','taxi cdg paris'],
    h1: 'VTC Aéroport Charles de Gaulle (CDG)',
    intro: 'Votre transfert vers l\'aéroport Paris-CDG avec un chauffeur professionnel. Tarif fixe garanti, suivi de vol en temps réel, prise en charge dans le hall d\'arrivée.',
    prix: 'dès 45€',
    duree: '25–55 min selon votre départ',
    faq: [
      { q: 'Combien coûte un VTC de Paris vers CDG ?', a: 'Le tarif est fixe et calculé à l\'avance. Depuis Paris intramuros, comptez entre 55€ et 75€ selon le véhicule. Utilisez notre estimateur pour un prix exact depuis votre adresse.' },
      { q: 'Mon chauffeur attend-il si mon vol est retardé ?', a: 'Oui. Nous suivons votre vol en temps réel. En cas de retard, votre chauffeur ajuste son heure d\'arrivée sans frais supplémentaires.' },
      { q: 'Où est-ce que mon chauffeur m\'attend à CDG ?', a: 'Votre chauffeur vous attend dans le hall des arrivées avec une pancarte à votre nom. Nous précisons le terminal exact dans votre confirmation de réservation.' },
      { q: 'Peut-on réserver un VTC CDG à la dernière minute ?', a: 'Oui, pour les courses immédiates disponibles 24h/24. Nous recommandons de réserver à l\'avance pour garantir la disponibilité, surtout aux heures de pointe.' },
    ],
  },
  'vtc-aeroport-orly': {
    slug: 'vtc-aeroport-orly',
    title: 'VTC Aéroport Orly',
    metaTitle: 'VTC Aéroport Orly dès 50€ — Chauffeur Privé 24h/24 | Owise',
    metaDesc: 'VTC vers Orly depuis Paris et IDF. Tarif fixe dès 50€, chauffeur professionnel, prise en charge au terminal. Disponible 24h/24. Réservation en ligne immédiate.',
    keywords: ['vtc orly','transfert aéroport orly','chauffeur privé orly','taxi orly paris','vtc paris orly'],
    h1: 'VTC Aéroport d\'Orly (ORY)',
    intro: 'Transfert VTC vers Paris-Orly (ORY) dans les meilleures conditions. Chauffeur professionnel, véhicule haut de gamme, tarif fixe sans surprise.',
    prix: 'dès 50€',
    duree: '20–45 min selon votre départ',
    faq: [
      { q: 'Combien coûte un VTC de Paris vers Orly ?', a: 'Depuis Paris intramuros, le tarif est entre 50€ et 70€ selon le véhicule. Le prix est fixe et garanti dès la réservation. Obtenez votre estimation exacte en quelques secondes.' },
      { q: 'Mon chauffeur m\'attend-il à l\'arrivée à Orly ?', a: 'Oui, votre chauffeur vous attend dans le hall des arrivées avec une pancarte nominative. Le terminal (Orly 1, 2, 3 ou 4) est précisé dans votre confirmation.' },
      { q: 'Quelle est la durée du trajet Paris–Orly ?', a: 'Entre 20 et 45 minutes depuis Paris intramuros, selon la zone de départ et la circulation. Le matin tôt ou tard le soir, comptez 20–25 minutes.' },
      { q: 'Desservez-vous Orly depuis l\'Oise ou la banlieue ?', a: 'Oui. Nous desservons Orly depuis toute l\'Île-de-France et l\'Oise. Le tarif varie selon la distance — utilisez notre calculateur pour votre adresse.' },
    ],
  },
  'vtc-creil': {
    slug: 'vtc-creil',
    title: 'VTC Creil & Oise Sud',
    metaTitle: 'VTC Creil & Oise Sud → CDG, Orly, Paris dès 65€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Creil, Senlis, Gouvieux, Chantilly, Lamorlaye et toute l\'Oise Sud. Tarif fixe dès 65€ vers CDG, Orly et Paris. Disponible 24h/24.',
    keywords: [
      'vtc creil','vtc senlis','vtc gouvieux','vtc saint-maximin','vtc lamorlaye',
      'vtc chantilly cdg','vtc nogent-sur-oise','chauffeur privé creil cdg',
      'vtc oise cdg','vtc creil orly','taxi creil aéroport','chauffeur privé oise',
      'vtc montataire','vtc saint-leu-esserent','vtc pont-sainte-maxence',
      'vtc verneuil-en-halatte','vtc liancourt','vtc rantigny',
    ],
    h1: 'VTC Creil, Senlis, Gouvieux & Oise Sud',
    intro: 'Votre chauffeur VTC depuis Creil et toutes les communes de l\'Oise Sud dans un rayon de 10 km : Senlis, Gouvieux, Saint-Maximin, Lamorlaye, Chantilly, Nogent-sur-Oise, Montataire, Saint-Leu-d\'Esserent, Verneuil-en-Halatte, Liancourt et bien d\'autres. Tarif fixe garanti vers CDG, Orly, Beauvais et Paris. Disponible 24h/24.',
    prix: 'dès 65€ vers CDG',
    duree: '35–50 min vers CDG',
    zones: [
      { nom: 'Creil', cp: '60100', km: 0 },
      { nom: 'Nogent-sur-Oise', cp: '60180', km: 2.1 },
      { nom: 'Montataire', cp: '60160', km: 2.9 },
      { nom: 'Saint-Maximin', cp: '60740', km: 3.6 },
      { nom: 'Villers-Saint-Paul', cp: '60870', km: 3.9 },
      { nom: 'Apremont', cp: '60300', km: 4.1 },
      { nom: 'Verneuil-en-Halatte', cp: '60550', km: 5.1 },
      { nom: 'Laigneville', cp: '60290', km: 5.1 },
      { nom: 'Saint-Leu-d\'Esserent', cp: '60340', km: 5.8 },
      { nom: 'Liancourt', cp: '60140', km: 8.0 },
      { nom: 'Gouvieux', cp: '60270', km: 8.4 },
      { nom: 'Chantilly', cp: '60500', km: 8.7 },
      { nom: 'Fleurines', cp: '60700', km: 8.9 },
      { nom: 'Rantigny', cp: '60290', km: 8.9 },
      { nom: 'Senlis', cp: '60300', km: 10.0 },
      { nom: 'Lamorlaye', cp: '60260', km: 11.2 },
      { nom: 'Pont-Sainte-Maxence', cp: '60700', km: 12.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Creil vers CDG ?', a: 'Le forfait Creil → CDG est à partir de 75€ en berline, prix fixe garanti. Depuis Senlis, Gouvieux ou Chantilly, comptez également entre 70€ et 80€. Obtenez votre prix exact avec notre estimateur.' },
      { q: 'Desservez-vous Senlis, Gouvieux et Saint-Maximin ?', a: 'Oui. Nous couvrons toutes les communes dans un rayon de 10 km autour de Creil : Senlis, Gouvieux, Saint-Maximin, Lamorlaye, Chantilly, Nogent-sur-Oise, Montataire, Verneuil-en-Halatte, Saint-Leu-d\'Esserent, Liancourt, Rantigny, Fleurines et plus encore.' },
      { q: 'Puis-je réserver tôt le matin depuis l\'Oise ?', a: 'Absolument. Nous sommes disponibles 24h/24, 7j/7. Pour les départs avant 6h, le supplément nuit (+20%) s\'applique automatiquement et est inclus dans votre estimation.' },
      { q: 'Quel est le prix depuis Lamorlaye ou Gouvieux vers CDG ?', a: 'Depuis Lamorlaye ou Gouvieux, le forfait CDG est d\'environ 75€ en berline. Le prix est identique dans un rayon de 10-12 km autour de Creil — même tarif, même qualité de service.' },
      { q: 'Proposez-vous des courses vers Orly depuis l\'Oise ?', a: 'Oui. Depuis Creil et ses environs, le forfait Orly est d\'environ 100€ en berline. Tous les aéroports parisiens (CDG, Orly, Beauvais) sont desservis depuis toute l\'Oise Sud.' },
      { q: 'Couvrez-vous Pont-Sainte-Maxence et Verneuil-en-Halatte ?', a: 'Oui, ces communes sont dans notre zone de desserte. Pont-Sainte-Maxence, Verneuil-en-Halatte, Liancourt et toutes les localités de l\'Oise Sud sont couvertes avec le même niveau de service premium.' },
    ],
  },
  'vtc-compiegne': {
    slug: 'vtc-compiegne',
    title: 'VTC Compiègne & Oise Nord',
    metaTitle: 'VTC Compiègne → CDG, Orly, Paris dès 100€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Compiègne et l\'Oise Nord : Margny, Venette, Thourotte. Tarif fixe dès 100€ vers CDG, Orly et Paris. Disponible 24h/24. Réservez en ligne.',
    keywords: [
      'vtc compiègne','chauffeur privé compiègne cdg','vtc compiègne orly',
      'taxi compiègne aéroport','vtc margny-lès-compiègne','vtc thourotte',
      'vtc lacroix-saint-ouen','vtc choisy-au-bac','vtc venette',
      'chauffeur privé oise nord cdg','vtc compiègne paris',
    ],
    h1: 'VTC Compiègne & Oise Nord',
    intro: 'Votre chauffeur VTC depuis Compiègne et les communes de l\'Oise Nord : Margny-lès-Compiègne, Venette, Clairoix, Thourotte, Lacroix-Saint-Ouen, Choisy-au-Bac et toutes les localités dans un rayon de 10 km. Tarif fixe garanti vers CDG, Orly et Paris. Disponible 24h/24.',
    prix: 'dès 100€ vers CDG',
    duree: '70–90 min vers CDG',
    zones: [
      { nom: 'Compiègne', cp: '60200', km: 0 },
      { nom: 'Margny-lès-Compiègne', cp: '60280', km: 2.3 },
      { nom: 'Clairoix', cp: '60280', km: 2.9 },
      { nom: 'Venette', cp: '60280', km: 3.1 },
      { nom: 'Bienville', cp: '60280', km: 3.4 },
      { nom: 'Jaux', cp: '60880', km: 4.8 },
      { nom: 'Coudun', cp: '60150', km: 4.8 },
      { nom: 'Choisy-au-Bac', cp: '60750', km: 5.7 },
      { nom: 'Longueil-Annel', cp: '60150', km: 5.8 },
      { nom: 'Lacroix-Saint-Ouen', cp: '60610', km: 7.0 },
      { nom: 'Jonquières', cp: '60680', km: 7.0 },
      { nom: 'Thourotte', cp: '60150', km: 7.9 },
      { nom: 'Vieux-Moulin', cp: '60350', km: 7.9 },
      { nom: 'Le Meux', cp: '60880', km: 8.2 },
      { nom: 'Rethondes', cp: '60153', km: 8.9 },
      { nom: 'Montmacq', cp: '60150', km: 9.6 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Compiègne vers CDG ?', a: 'Le forfait Compiègne → CDG est d\'environ 110€ en berline, prix fixe garanti. Obtenez votre estimation exacte via notre calculateur selon votre adresse précise.' },
      { q: 'Desservez-vous Margny-lès-Compiègne et Venette ?', a: 'Oui. Toutes les communes dans un rayon de 10 km autour de Compiègne sont couvertes : Margny, Venette, Clairoix, Thourotte, Choisy-au-Bac, Lacroix-Saint-Ouen et bien d\'autres.' },
      { q: 'Combien de temps pour aller de Compiègne à CDG ?', a: 'Environ 70 à 90 minutes selon les conditions de circulation. Le matin très tôt (avant 6h), le trajet est plus rapide, autour de 65-70 minutes.' },
      { q: 'Pouvez-vous partir très tôt le matin depuis Compiègne ?', a: 'Absolument, nous sommes disponibles 24h/24. Pour les départs avant 6h, le supplément nuit (+20%) s\'applique et est intégré dans l\'estimation affichée.' },
      { q: 'Quel est le prix Compiègne → Orly ?', a: 'Le forfait Compiègne → Orly est d\'environ 140€ en berline. Orly étant plus au sud, le trajet est un peu plus long que vers CDG.' },
    ],
  },
  'vtc-senlis': {
    slug: 'vtc-senlis',
    title: 'VTC Senlis & Environs',
    metaTitle: 'VTC Senlis → CDG, Orly, Paris dès 70€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Senlis, Aumont-en-Halatte, Fleurines et environs vers CDG, Orly et Paris. Tarif fixe dès 70€, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc senlis','chauffeur privé senlis cdg','vtc senlis aéroport',
      'taxi senlis paris','vtc aumont-en-halatte','vtc fleurines',
      'vtc vineuil-saint-firmin','chauffeur senlis','vtc senlis orly',
      'vtc avilly-saint-léonard','vtc pontarmé',
    ],
    h1: 'VTC Senlis & Environs',
    intro: 'Chauffeur VTC depuis Senlis et ses communes voisines : Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Avilly-Saint-Léonard, Pontarmé, Chamant, Courteuil et toutes les localités dans un rayon de 10 km. Tarif fixe vers CDG, Orly et Paris.',
    prix: 'dès 70€ vers CDG',
    duree: '45–60 min vers CDG',
    zones: [
      { nom: 'Senlis', cp: '60300', km: 0 },
      { nom: 'Courteuil', cp: '60300', km: 3.1 },
      { nom: 'Chamant', cp: '60300', km: 3.4 },
      { nom: 'Aumont-en-Halatte', cp: '60300', km: 3.7 },
      { nom: 'Mont-l\'Évêque', cp: '60300', km: 4.0 },
      { nom: 'Pontarmé', cp: '60520', km: 5.1 },
      { nom: 'Avilly-Saint-Léonard', cp: '60300', km: 5.1 },
      { nom: 'Thiers-sur-Thève', cp: '60520', km: 6.0 },
      { nom: 'Fleurines', cp: '60700', km: 6.1 },
      { nom: 'Apremont', cp: '60300', km: 6.3 },
      { nom: 'Vineuil-Saint-Firmin', cp: '60500', km: 6.5 },
      { nom: 'Barbery', cp: '60810', km: 6.5 },
      { nom: 'Chantilly', cp: '60500', km: 7.9 },
      { nom: 'Verneuil-en-Halatte', cp: '60550', km: 8.1 },
      { nom: 'Orry-la-Ville', cp: '60560', km: 9.3 },
      { nom: 'Saint-Maximin', cp: '60740', km: 9.8 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Senlis vers CDG ?', a: 'Le forfait Senlis → CDG est d\'environ 75€ en berline, prix fixe garanti quelle que soit la durée du trajet.' },
      { q: 'Combien de temps pour aller de Senlis à l\'aéroport CDG ?', a: 'Environ 45 à 60 minutes depuis Senlis centre. Tôt le matin (avant 6h), comptez 40 à 45 minutes sans circulation.' },
      { q: 'Desservez-vous Aumont-en-Halatte et Fleurines ?', a: 'Oui. Toutes les communes autour de Senlis sont couvertes : Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Avilly-Saint-Léonard, Pontarmé, Chamant et leurs alentours.' },
      { q: 'Peut-on réserver un VTC Senlis depuis le Château ?', a: 'Oui. Nous intervenons pour les événements au Château Royal de Senlis, les séminaires et les sorties touristiques. Réservation possible à l\'avance ou le jour même.' },
      { q: 'Quel est le prix Senlis → Paris ?', a: 'Le trajet Senlis → Paris (intramuros) est calculé au kilomètre via OSRM, soit environ 80 à 90€. Utilisez notre estimateur pour un prix exact depuis votre adresse.' },
    ],
  },
  'vtc-gouvieux': {
    slug: 'vtc-gouvieux',
    title: 'VTC Gouvieux, Lamorlaye & Chantilly',
    metaTitle: 'VTC Gouvieux, Lamorlaye, Coye-la-Forêt → CDG dès 70€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Gouvieux, Lamorlaye, Coye-la-Forêt et environs de Chantilly. Tarif fixe dès 70€ vers CDG, Orly, Paris. Disponible 24h/24, 7j/7.',
    keywords: [
      'vtc gouvieux','vtc lamorlaye','vtc coye-la-forêt','vtc orry-la-ville',
      'chauffeur privé gouvieux cdg','vtc gouvieux aéroport',
      'taxi gouvieux paris','vtc lamorlaye cdg','vtc saint-leu-esserent',
      'vtc précy-sur-oise','chauffeur privé lamorlaye',
    ],
    h1: 'VTC Gouvieux, Lamorlaye & Chantilly Sud',
    intro: 'Votre chauffeur VTC depuis Gouvieux, Lamorlaye, Coye-la-Forêt, Orry-la-Ville, Saint-Leu-d\'Esserent, Précy-sur-Oise et toutes les communes du secteur Chantilly Sud. Tarif fixe garanti vers CDG, Orly et Paris. Disponible 24h/24, 7j/7.',
    prix: 'dès 70€ vers CDG',
    duree: '40–55 min vers CDG',
    zones: [
      { nom: 'Gouvieux', cp: '60270', km: 0 },
      { nom: 'Saint-Maximin', cp: '60740', km: 3.1 },
      { nom: 'Chantilly', cp: '60500', km: 3.7 },
      { nom: 'Saint-Leu-d\'Esserent', cp: '60340', km: 4.1 },
      { nom: 'Lamorlaye', cp: '60260', km: 4.5 },
      { nom: 'Villers-sous-Saint-Leu', cp: '60340', km: 5.1 },
      { nom: 'Thiverny', cp: '60160', km: 5.3 },
      { nom: 'Apremont', cp: '60300', km: 6.0 },
      { nom: 'Coye-la-Forêt', cp: '60580', km: 6.2 },
      { nom: 'Précy-sur-Oise', cp: '60460', km: 6.2 },
      { nom: 'Avilly-Saint-Léonard', cp: '60300', km: 6.2 },
      { nom: 'Creil', cp: '60100', km: 6.9 },
      { nom: 'Montataire', cp: '60160', km: 7.2 },
      { nom: 'Boran-sur-Oise', cp: '60820', km: 7.8 },
      { nom: 'Orry-la-Ville', cp: '60560', km: 7.8 },
      { nom: 'Nogent-sur-Oise', cp: '60180', km: 8.7 },
      { nom: 'Luzarches', cp: '95270', km: 9.1 },
      { nom: 'Crouy-en-Thelle', cp: '60530', km: 9.1 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Gouvieux ou Lamorlaye vers CDG ?', a: 'Le forfait Gouvieux/Lamorlaye → CDG est d\'environ 75€ en berline, prix fixe garanti. Le tarif est identique depuis tout le secteur Chantilly Sud.' },
      { q: 'Desservez-vous Coye-la-Forêt et Orry-la-Ville ?', a: 'Oui. Toutes les communes du secteur sont couvertes : Coye-la-Forêt, Orry-la-Ville, Précy-sur-Oise, Boran-sur-Oise, Luzarches et toutes les localités dans un rayon de 10 km autour de Gouvieux.' },
      { q: 'Pouvez-vous me prendre à Lamorlaye tôt le matin ?', a: 'Oui, 24h/24, 7j/7. Pour les départs avant 6h, le supplément nuit (+20%) est intégré dans le prix affiché par notre estimateur.' },
      { q: 'Quel est le prix depuis Gouvieux vers Paris ?', a: 'Le trajet Gouvieux → Paris est calculé via OSRM selon votre adresse exacte, environ 80 à 90€ en berline. Utilisez notre estimateur pour un prix instantané.' },
      { q: 'Desservez-vous l\'Hippodrome de Chantilly depuis Gouvieux ?', a: 'Oui. Nous assurons les transferts pour l\'Hippodrome, le Château de Chantilly et les événements privés du secteur. Réservez à l\'avance pour les grands événements (Prix de Diane, etc.).' },
    ],
  },
  'vtc-chantilly': {
    slug: 'vtc-chantilly',
    title: 'VTC Chantilly — Aéroport & Paris',
    metaTitle: 'VTC Chantilly → CDG, Orly, Paris dès 70€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Chantilly vers CDG, Orly et Paris. Tarif fixe dès 70€, véhicule premium, disponible 24h/24. Château de Chantilly, hippodrome, événements.',
    keywords: ['vtc chantilly','chauffeur privé chantilly','vtc chantilly cdg','taxi chantilly aéroport','vtc chantilly paris'],
    h1: 'VTC Chantilly — Chauffeur Privé',
    intro: 'Chauffeur VTC depuis Chantilly et ses environs vers CDG, Orly, Paris et toute l\'Île-de-France. Idéal pour le Château de Chantilly, l\'hippodrome, les hôtels de luxe et les événements.',
    prix: 'dès 70€ vers CDG',
    duree: '40–55 min vers CDG',
    faq: [
      { q: 'Quel est le prix d\'un VTC Chantilly → CDG ?', a: 'Le forfait Chantilly → CDG est d\'environ 75€ en berline, prix fixe garanti. Obtenez votre estimation exacte avec notre calculateur en ligne.' },
      { q: 'Proposez-vous des transferts pour le Château de Chantilly ?', a: 'Oui. Nous sommes disponibles pour les événements privés, séminaires et visites du Château et du Domaine de Chantilly. Tarif sur devis pour les groupes.' },
      { q: 'Desservez-vous l\'hippodrome de Chantilly ?', a: 'Oui, pour les jours de course et les événements. Réservez à l\'avance, surtout pour le Prix de Diane et le Prix du Jockey Club.' },
      { q: 'Puis-je réserver un aller-retour Chantilly–Paris ?', a: 'Absolument. L\'option aller-retour est disponible dès la réservation avec un tarif préférentiel. Indiquez votre heure de retour souhaitée.' },
    ],
  },
  'vtc-aeroport-beauvais': {
    slug: 'vtc-aeroport-beauvais',
    title: 'VTC Aéroport Beauvais-Tillé',
    metaTitle: 'VTC Aéroport Beauvais-Tillé (BVA) dès 40€ — Tarif Fixe | Owise',
    metaDesc: 'Transfert VTC vers l\'aéroport de Beauvais-Tillé (BVA), hub Ryanair & Wizzair. Depuis Creil, Senlis, Chantilly et toute l\'Oise. Tarif fixe garanti, disponible 24h/24.',
    keywords: [
      'vtc beauvais aéroport','transfert beauvais tillé','chauffeur privé beauvais bva',
      'taxi aéroport beauvais','vtc creil beauvais','vtc beauvais ryanair',
      'vtc oise aéroport beauvais','chauffeur beauvais tillé','vtc beauvais tillé',
      'navette aéroport beauvais','taxi beauvais ryanair','vtc beauvais wizzair',
    ],
    h1: 'VTC Aéroport de Beauvais-Tillé (BVA)',
    intro: 'Votre transfert VTC vers l\'aéroport de Beauvais-Tillé (BVA), hub des compagnies Ryanair et Wizzair. Chauffeur professionnel, tarif fixe garanti, prise en charge à domicile. Desserte depuis toute l\'Oise Sud : Creil, Senlis, Chantilly, Gouvieux, Compiègne et les communes voisines. Disponible 24h/24.',
    prix: 'dès 40€',
    duree: '20–35 min depuis Creil/Senlis',
    faq: [
      { q: 'Quel est le tarif depuis Creil vers l\'aéroport de Beauvais ?', a: 'Le forfait Creil → Beauvais-Tillé est d\'environ 45 à 55€ en berline, prix fixe garanti. Depuis Senlis ou Chantilly, comptez un tarif similaire selon votre adresse exacte. Utilisez notre estimateur pour un prix instantané.' },
      { q: 'Combien de temps pour aller à Beauvais depuis Creil ?', a: 'Environ 20 à 30 minutes depuis Creil. Depuis Senlis, comptez 25 à 35 minutes. Depuis Compiègne, environ 40 à 50 minutes selon votre point de départ et les conditions de circulation.' },
      { q: 'Desservez-vous l\'aéroport de Beauvais depuis Paris ?', a: 'Oui. Depuis Paris intramuros, le trajet vers Beauvais-Tillé est d\'environ 1h15, pour un tarif de 95 à 120€. L\'aéroport est desservi depuis tout l\'IDF et l\'Oise.' },
      { q: 'Mon chauffeur attend-il si mon vol Ryanair est retardé ?', a: 'Oui. Nous suivons tous les vols en temps réel grâce à votre numéro de vol. En cas de retard, votre chauffeur ajuste son heure d\'arrivée automatiquement, sans frais supplémentaires.' },
      { q: 'Où se trouve l\'aéroport de Beauvais-Tillé ?', a: 'L\'aéroport Beauvais-Tillé (code IATA : BVA) est situé à 85 km au nord de Paris, à Tillé (60000), à 5 km du centre de Beauvais. Il est facilement accessible depuis toute l\'Oise en 20 à 40 minutes.' },
    ],
  },
  'vtc-lamorlaye': {
    slug: 'vtc-lamorlaye',
    title: 'VTC Lamorlaye & Coye-la-Forêt',
    metaTitle: 'VTC Lamorlaye, Coye-la-Forêt → CDG, Paris dès 70€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Lamorlaye, Coye-la-Forêt, Orry-la-Ville et la forêt de Chantilly vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    keywords: [
      'vtc lamorlaye','chauffeur privé lamorlaye cdg','vtc lamorlaye aéroport',
      'taxi lamorlaye paris','vtc coye-la-forêt','vtc orry-la-ville',
      'chauffeur lamorlaye','vtc lamorlaye orly','chauffeur privé lamorlaye',
      'vtc 60260 cdg','vtc lamorlaye chantilly','taxi lamorlaye cdg',
    ],
    h1: 'VTC Lamorlaye, Coye-la-Forêt & Forêt de Chantilly',
    intro: 'Votre chauffeur VTC depuis Lamorlaye, Coye-la-Forêt, Orry-la-Ville, Luzarches et toutes les communes de la forêt de Chantilly. Tarif fixe garanti vers CDG, Orly, Paris et Beauvais. Service premium, prise en charge à domicile, disponible 24h/24, 7j/7.',
    prix: 'dès 70€ vers CDG',
    duree: '40–55 min vers CDG',
    zones: [
      { nom: 'Lamorlaye', cp: '60260', km: 0 },
      { nom: 'Coye-la-Forêt', cp: '60580', km: 2.5 },
      { nom: 'Avilly-Saint-Léonard', cp: '60300', km: 4.1 },
      { nom: 'Orry-la-Ville', cp: '60560', km: 3.8 },
      { nom: 'Gouvieux', cp: '60270', km: 4.5 },
      { nom: 'Chantilly', cp: '60500', km: 5.2 },
      { nom: 'Luzarches', cp: '95270', km: 5.0 },
      { nom: 'Boran-sur-Oise', cp: '60820', km: 6.5 },
      { nom: 'Asnières-sur-Oise', cp: '95270', km: 7.0 },
      { nom: 'Le Mesnil-en-Thelle', cp: '60530', km: 7.0 },
      { nom: 'Précy-sur-Oise', cp: '60460', km: 7.5 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Lamorlaye vers CDG ?', a: 'Le forfait Lamorlaye → CDG est d\'environ 75€ en berline, prix fixe garanti quelle que soit la circulation. Depuis Coye-la-Forêt ou Orry-la-Ville, le tarif est similaire.' },
      { q: 'Desservez-vous Coye-la-Forêt et Orry-la-Ville ?', a: 'Oui. Toutes les communes autour de Lamorlaye sont couvertes : Coye-la-Forêt, Orry-la-Ville, Avilly-Saint-Léonard, Gouvieux, Chantilly, Luzarches, Boran-sur-Oise et leurs environs forestiers.' },
      { q: 'Combien de temps pour aller de Lamorlaye à CDG ?', a: 'Environ 40 à 55 minutes selon les conditions de circulation. Tôt le matin (avant 6h), comptez 35 à 40 minutes. Le trajet via l\'A104 est direct.' },
      { q: 'Puis-je réserver depuis un gîte ou une résidence dans la forêt ?', a: 'Absolument. Précisez votre adresse exacte lors de la réservation. Votre chauffeur se rend directement à votre point de prise en charge, même en chemin forestier.' },
      { q: 'Proposez-vous des courses vers Luzarches et le Val-d\'Oise ?', a: 'Oui. Luzarches et les communes limitrophes du Val-d\'Oise (95) sont dans notre zone de desserte. Le tarif est calculé selon la distance exacte via notre estimateur en ligne.' },
    ],
  },
  'vtc-pontoise': {
    slug: 'vtc-pontoise',
    title: 'VTC Pontoise, Cergy & Val-d\'Oise',
    metaTitle: 'VTC Pontoise, Cergy → CDG, Orly, Paris | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Pontoise, Cergy, Saint-Ouen-l\'Aumône et le Val-d\'Oise vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc pontoise','chauffeur privé pontoise cdg','vtc cergy','vtc saint-ouen-laumône',
      'vtc val-d\'oise cdg','taxi pontoise aéroport','vtc pontoise paris',
      'chauffeur privé cergy pontoise','vtc 95 cdg','vtc cergy-pontoise orly',
      'vtc osny','vtc auvers-sur-oise','taxi cergy cdg',
    ],
    h1: 'VTC Pontoise, Cergy & Val-d\'Oise',
    intro: 'Votre chauffeur VTC depuis Pontoise, Cergy, Saint-Ouen-l\'Aumône, Osny, Éragny et toutes les communes du Val-d\'Oise (95). Transferts vers CDG, Orly, Paris et toute l\'Île-de-France. Tarif fixe garanti, prise en charge à domicile, disponible 24h/24.',
    prix: 'dès 55€ vers CDG',
    duree: '30–50 min vers CDG',
    zones: [
      { nom: 'Pontoise', cp: '95300', km: 0 },
      { nom: 'Osny', cp: '95520', km: 2.0 },
      { nom: 'Cergy', cp: '95000', km: 3.5 },
      { nom: 'Éragny', cp: '95610', km: 4.1 },
      { nom: 'Saint-Ouen-l\'Aumône', cp: '95310', km: 5.0 },
      { nom: 'Jouy-le-Moutier', cp: '95280', km: 5.5 },
      { nom: 'Neuville-sur-Oise', cp: '95000', km: 5.8 },
      { nom: 'Vauréal', cp: '95490', km: 6.0 },
      { nom: 'Courdimanche', cp: '95800', km: 6.5 },
      { nom: 'Méry-sur-Oise', cp: '95540', km: 6.8 },
      { nom: 'Auvers-sur-Oise', cp: '95430', km: 7.5 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Pontoise vers CDG ?', a: 'Le forfait Pontoise → CDG est d\'environ 60 à 70€ en berline, prix fixe garanti. Depuis Cergy ou Saint-Ouen-l\'Aumône, le tarif est similaire selon votre adresse exacte.' },
      { q: 'Combien de temps pour aller de Pontoise à CDG ?', a: 'Environ 30 à 50 minutes selon les conditions de circulation. Tôt le matin (avant 6h), comptez 30 à 35 minutes. Via l\'A15, le trajet est direct.' },
      { q: 'Desservez-vous Cergy et ses quartiers ?', a: 'Oui. Nous couvrons toutes les communes de Cergy-Pontoise : Cergy, Pontoise, Osny, Éragny, Jouy-le-Moutier, Vauréal, Courdimanche, Neuville-sur-Oise et leurs alentours.' },
      { q: 'Proposez-vous un service vers Orly depuis le Val-d\'Oise ?', a: 'Oui. Depuis Pontoise ou Cergy, le trajet vers Orly est d\'environ 50 à 70 minutes, pour un tarif de 80 à 100€. Tous les aéroports parisiens sont desservis depuis le Val-d\'Oise.' },
      { q: 'Pouvez-vous me prendre dans ma copropriété à Cergy ?', a: 'Absolument. Votre chauffeur se gare devant votre adresse précise. Pour les grandes copropriétés, précisez le bâtiment ou le numéro d\'interphone dans les commentaires de réservation.' },
    ],
  },
  'vtc-versailles': {
    slug: 'vtc-versailles',
    title: 'VTC Versailles & Yvelines',
    metaTitle: 'VTC Versailles → CDG, Orly, Paris | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Versailles, Le Chesnay et les Yvelines vers CDG, Orly et Paris. Château de Versailles, séminaires, entreprises. Tarif fixe garanti 24h/24.',
    keywords: [
      'vtc versailles','chauffeur privé versailles cdg','vtc versailles aéroport',
      'taxi versailles paris','vtc versailles orly','chauffeur versailles château',
      'vtc 78 cdg','vtc saint-germain-en-laye','vtc le chesnay',
      'chauffeur privé yvelines','vtc versailles entreprise','taxi versailles cdg',
    ],
    h1: 'VTC Versailles & Yvelines',
    intro: 'Votre chauffeur VTC depuis Versailles, Le Chesnay-Rocquencourt, Viroflay, Saint-Cyr-l\'École et les communes des Yvelines (78). Transferts vers CDG, Orly et Paris. Service premium pour les visiteurs du Château de Versailles, les séminaires d\'entreprise et les déplacements professionnels.',
    prix: 'dès 80€ vers CDG',
    duree: '40–70 min vers CDG',
    zones: [
      { nom: 'Versailles', cp: '78000', km: 0 },
      { nom: 'Le Chesnay-Rocquencourt', cp: '78150', km: 2.5 },
      { nom: 'Viroflay', cp: '78220', km: 5.5 },
      { nom: 'Buc', cp: '78530', km: 4.0 },
      { nom: 'Saint-Cyr-l\'École', cp: '78210', km: 4.8 },
      { nom: 'Guyancourt', cp: '78280', km: 5.3 },
      { nom: 'Vélizy-Villacoublay', cp: '78140', km: 6.0 },
      { nom: 'Élancourt', cp: '78990', km: 6.8 },
      { nom: 'Trappes', cp: '78190', km: 7.0 },
      { nom: 'Saint-Quentin-en-Yvelines', cp: '78180', km: 8.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Versailles vers CDG ?', a: 'Le forfait Versailles → CDG est d\'environ 85 à 100€ en berline, prix fixe garanti. Depuis Le Chesnay ou Viroflay, le tarif est similaire selon votre adresse précise. Utilisez notre estimateur pour un prix instantané.' },
      { q: 'Proposez-vous des transferts pour le Château de Versailles ?', a: 'Oui. Nous organisons des transferts pour les visiteurs du Château de Versailles, les événements privés dans les jardins et les séminaires d\'entreprise dans la région. Tarif sur devis pour les groupes.' },
      { q: 'Combien de temps pour aller de Versailles à CDG ?', a: 'Environ 40 à 70 minutes selon les conditions de circulation. La route passe par l\'A86 puis l\'A3, ou par le Francilienne. Tôt le matin (avant 6h), comptez 40 à 50 minutes.' },
      { q: 'Desservez-vous les entreprises de Vélizy et Saint-Quentin-en-Yvelines ?', a: 'Oui. Nous proposons des solutions VTC pour les entreprises des technopôles de Vélizy, Saint-Quentin-en-Yvelines et les parcs d\'activités des Yvelines. Compte entreprise disponible avec facturation mensuelle.' },
      { q: 'Puis-je réserver un VTC depuis Versailles vers Paris ?', a: 'Absolument. Le trajet Versailles → Paris est d\'environ 30 à 45 minutes, pour un tarif de 50 à 70€ selon votre destination précise à Paris. Aller-retour possible dès la réservation.' },
    ],
  },
}

export async function generateMetadata({ params }: { params: Promise<{ destination: string }> }): Promise<Metadata> {
  const { destination } = await params
  const dest = DESTINATIONS[destination]
  if (!dest) return {}
  const BASE = 'https://www.owise.fr'
  return {
    title: dest.metaTitle,
    description: dest.metaDesc,
    keywords: dest.keywords,
    alternates: { canonical: `${BASE}/${dest.slug}` },
    openGraph: {
      title: dest.metaTitle,
      description: dest.metaDesc,
      url: `${BASE}/${dest.slug}`,
      locale: 'fr_FR',
      siteName: 'Owise',
      images: [{ url: `${BASE}/brand_assets/hero-car.jpg`, width: 1672, height: 941, alt: dest.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: dest.metaTitle,
      description: dest.metaDesc,
      images: [`${BASE}/brand_assets/hero-car.jpg`],
    },
  }
}

export function generateStaticParams() {
  return Object.keys(DESTINATIONS).map(slug => ({ destination: slug }))
}

export const revalidate = 3600

export default async function DestinationPage({ params }: { params: Promise<{ destination: string }> }) {
  const { destination } = await params
  const dest = DESTINATIONS[destination]
  if (!dest) notFound()

  const admin = createAdminClient()
  const [{ data: tarifs }, { data: zones }, { data: grille }, { data: tarifParams }] = await Promise.all([
    admin.from('tarifs').select('vehicule,prise_en_charge,prix_km,cdg_fixe,orly_fixe,beauvais_fixe'),
    admin.from('zones').select('id,code,type,prefixes_postaux').neq('code', 'HORS').eq('active', true),
    admin.from('grilles_tarifaires').select('zone_depart_id,zone_arrivee_id,prix_berline'),
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec').single(),
  ])

  const BASE = 'https://www.owise.fr'

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: dest.title,
    description: dest.metaDesc,
    provider: { '@type': 'LocalBusiness', name: 'Owise', url: BASE, telephone: '+33619106356' },
    areaServed: { '@type': 'Country', name: 'FR' },
    offers: { '@type': 'Offer', priceCurrency: 'EUR', description: dest.prix },
    potentialAction: {
      '@type': 'ReserveAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/reserver` },
    },
  }

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: BASE },
      { '@type': 'ListItem', position: 2, name: dest.title, item: `${BASE}/${dest.slug}` },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      {/* Bandeau SEO discret au-dessus du hero */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
        background: 'rgba(9,9,26,0.97)', borderBottom: '1px solid rgba(201,168,76,.15)',
        padding: '8px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(201,168,76,.8)', letterSpacing: '.12em', textTransform: 'uppercase' }}>
            {dest.title}
          </span>
          <span style={{ fontSize: 11, color: 'rgba(237,232,223,.35)' }}>·</span>
          <span style={{ fontSize: 11, color: 'rgba(237,232,223,.5)' }}>{dest.prix} · {dest.duree}</span>
        </div>
        <Link href="/" style={{ fontSize: 11, color: 'rgba(201,168,76,.7)', textDecoration: 'none', letterSpacing: '.08em' }}>
          ← Accueil
        </Link>
      </div>

      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} grille={grille ?? []} params={tarifParams} />

      {/* Section intro SEO */}
      <section style={{ background: '#fff', padding: '60px 24px', maxWidth: 860, margin: '0 auto' }}>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 38, fontWeight: 500, color: '#0A0A0A', marginBottom: 16, lineHeight: 1.1 }}>
          {dest.h1}
        </h2>
        <p style={{ fontSize: 16, color: '#6B6B6B', lineHeight: 1.8, marginBottom: 32, maxWidth: 680 }}>
          {dest.intro}
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 48 }}>
          {[
            { label: 'Prix', value: dest.prix },
            { label: 'Durée estimée', value: dest.duree },
            { label: 'Disponibilité', value: '24h/24 · 7j/7' },
          ].map((stat, i) => (
            <div key={i} style={{ background: '#F7F7F7', borderRadius: 12, padding: '20px 18px' }}>
              <div style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: '#999', marginBottom: 6 }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#0A0A0A' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Grille zones desservies */}
        {dest.zones && dest.zones.length > 0 && (
          <>
            <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0A0A0A', marginBottom: 16 }}>
              Communes desservies
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginBottom: 48 }}>
              {dest.zones.map((z, i) => (
                <div key={i} style={{ background: '#F7F7F7', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#0A0A0A' }}>{z.nom}</div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{z.cp}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#C9A84C', fontWeight: 600, fontFamily: 'monospace' }}>{z.km === 0 ? 'centre' : `${z.km} km`}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* FAQ */}
        <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0A0A0A', marginBottom: 24 }}>
          Questions fréquentes
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dest.faq.map((item, i) => (
            <div key={i} style={{ background: '#F7F7F7', borderRadius: 10, padding: '18px 20px' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#0A0A0A', marginBottom: 6 }}>{item.q}</div>
              <div style={{ fontSize: 13, color: '#6B6B6B', lineHeight: 1.7 }}>{item.a}</div>
            </div>
          ))}
        </div>

        {/* Maillage interne — autres destinations */}
        <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#0A0A0A', marginTop: 48, marginBottom: 20 }}>
          Autres destinations desservies
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {Object.values(DESTINATIONS).filter(d => d.slug !== dest.slug).map(d => (
            <Link key={d.slug} href={`/${d.slug}`} style={{ fontSize: 13, color: '#0A0A0A', background: '#F7F7F7', borderRadius: 8, padding: '10px 16px', textDecoration: 'none', border: '1px solid rgba(0,0,0,.06)' }}>
              {d.title} →
            </Link>
          ))}
        </div>
      </section>
    </>
  )
}
