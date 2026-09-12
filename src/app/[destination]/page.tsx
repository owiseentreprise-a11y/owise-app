import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase/admin'
import VitrineBody from '@/components/VitrineBody'
import '../vitrine.css'

// Communes qui ont leur propre page destination → liens cliquables dans la grille zones
const NOM_VERS_SLUG: Record<string, string> = {
  'Chantilly':              'vtc-chantilly',
  'Gouvieux':               'vtc-gouvieux',
  'Lamorlaye':              'vtc-lamorlaye',
  'Senlis':                 'vtc-senlis',
  'Creil':                  'vtc-creil',
  'Pontoise':               'vtc-pontoise',
  'Cergy':                  'vtc-pontoise',
  'Versailles':             'vtc-versailles',
  'Coye-la-Forêt':          'vtc-coye-la-foret',
  'Orry-la-Ville':          'vtc-orry-la-ville',
  'La Chapelle-en-Serval':  'vtc-la-chapelle-en-serval',
  'Boran-sur-Oise':         'vtc-boran-sur-oise',
  'Précy-sur-Oise':         'vtc-precy-sur-oise',
  'Luzarches':              'vtc-luzarches',
  'Clermont':               'vtc-clermont',
  'Liancourt':              'vtc-liancourt',
  'Rantigny':               'vtc-liancourt',
  'Cauffry':                'vtc-liancourt',
  'Chambly':                'vtc-chambly',
  'Bornel':                 'vtc-chambly',
  'Balagny-sur-Thérain':    'vtc-chambly',
  'Méru':                   'vtc-meru',
  'Noailles':               'vtc-meru',
  'Verberie':               'vtc-verberie',
  'Longueil-Sainte-Marie':  'vtc-verberie',
  'Noyon':                  'vtc-noyon',
}

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
    metaTitle: 'VTC Aéroport CDG dès 65€ — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC vers CDG depuis Paris et IDF. Tarif fixe dès 65€, suivi de vol en temps réel, chauffeur dans le hall. Disponible 24h/24. Réservez en 30 secondes.',
    keywords: ['vtc cdg','transfert aéroport cdg','chauffeur privé charles de gaulle','vtc roissy','taxi cdg paris'],
    h1: 'VTC Aéroport Charles de Gaulle (CDG)',
    intro: 'Votre transfert vers l\'aéroport Paris-CDG avec un chauffeur professionnel. Tarif fixe garanti, suivi de vol en temps réel, prise en charge dans le hall d\'arrivée.',
    prix: 'dès 65€',
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
    metaTitle: 'VTC Creil & Oise Sud → CDG, Orly, Paris dès 69€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Creil, Senlis, Gouvieux, Chantilly, Lamorlaye et toute l\'Oise Sud. Tarif fixe dès 69€ vers CDG, Orly et Paris. Disponible 24h/24.',
    keywords: [
      'vtc creil','vtc senlis','vtc gouvieux','vtc saint-maximin','vtc lamorlaye',
      'vtc chantilly cdg','vtc nogent-sur-oise','chauffeur privé creil cdg',
      'vtc oise cdg','vtc creil orly','taxi creil aéroport','chauffeur privé oise',
      'vtc montataire','vtc saint-leu-esserent','vtc pont-sainte-maxence',
      'vtc verneuil-en-halatte','vtc liancourt','vtc rantigny',
    ],
    h1: 'VTC Creil, Senlis, Gouvieux & Oise Sud',
    intro: 'Votre chauffeur VTC depuis Creil et toutes les communes de l\'Oise Sud dans un rayon de 10 km : Senlis, Gouvieux, Saint-Maximin, Lamorlaye, Chantilly, Nogent-sur-Oise, Montataire, Saint-Leu-d\'Esserent, Verneuil-en-Halatte, Liancourt et bien d\'autres. Tarif fixe garanti vers CDG, Orly, Beauvais et Paris. Disponible 24h/24.',
    prix: 'dès 69€ vers CDG',
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
      { q: 'Quel est le tarif depuis Creil vers CDG ?', a: 'Le forfait Creil → CDG est de 69€ en berline, prix fixe garanti. Depuis Chantilly, comptez 59€. Obtenez votre prix exact depuis votre adresse avec notre estimateur.' },
      { q: 'Desservez-vous Senlis, Gouvieux et Saint-Maximin ?', a: 'Oui. Nous couvrons toutes les communes dans un rayon de 10 km autour de Creil : Senlis, Gouvieux, Saint-Maximin, Lamorlaye, Chantilly, Nogent-sur-Oise, Montataire, Verneuil-en-Halatte, Saint-Leu-d\'Esserent, Liancourt, Rantigny, Fleurines et plus encore.' },
      { q: 'Puis-je réserver tôt le matin depuis l\'Oise ?', a: 'Absolument. Nous sommes disponibles 24h/24, 7j/7. Pour les départs avant 6h, le supplément nuit (+20%) s\'applique automatiquement et est inclus dans votre estimation.' },
      { q: 'Quel est le prix depuis Lamorlaye ou Gouvieux vers CDG ?', a: 'Depuis Lamorlaye ou Gouvieux (secteur Chantilly), le forfait CDG est de 59€ en berline, prix fixe garanti. C\'est le même tarif que depuis Chantilly, ces communes étant dans la même zone.' },
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
      { q: 'Quel est le tarif depuis Compiègne vers CDG ?', a: 'Owise est l\'une des rares plateformes à proposer un tarif fixe garanti depuis Compiègne vers CDG — le prix est calculé à l\'avance, confirmé à la réservation, et ne varie pas en cas de retard ou de bouchon. Prise en charge à domicile, chauffeur professionnel disponible 24h/24. Estimez votre course sur owise.fr.' },
      { q: 'Desservez-vous Margny-lès-Compiègne et Venette ?', a: 'Oui. Toutes les communes dans un rayon de 10 km autour de Compiègne sont couvertes : Margny, Venette, Clairoix, Thourotte, Choisy-au-Bac, Lacroix-Saint-Ouen et bien d\'autres.' },
      { q: 'Combien de temps pour aller de Compiègne à CDG ?', a: 'Environ 70 à 90 minutes selon les conditions de circulation. Le matin très tôt (avant 6h), le trajet est plus rapide, autour de 65-70 minutes.' },
      { q: 'Pouvez-vous partir très tôt le matin depuis Compiègne ?', a: 'Absolument, nous sommes disponibles 24h/24. Pour les départs avant 6h, le supplément nuit (+20%) s\'applique et est intégré dans l\'estimation affichée.' },
      { q: 'Quel est le prix Compiègne → Orly ?', a: 'Le forfait Compiègne → Orly est d\'environ 140€ en berline. Orly étant plus au sud, le trajet est un peu plus long que vers CDG.' },
    ],
  },
  'vtc-senlis': {
    slug: 'vtc-senlis',
    title: 'VTC Senlis & Environs',
    metaTitle: 'VTC Senlis → CDG, Orly, Paris dès 65€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Senlis, Aumont-en-Halatte, Fleurines et environs vers CDG, Orly et Paris. Tarif fixe dès 65€, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc senlis','chauffeur privé senlis cdg','vtc senlis aéroport',
      'taxi senlis paris','vtc aumont-en-halatte','vtc fleurines',
      'vtc vineuil-saint-firmin','chauffeur senlis','vtc senlis orly',
      'vtc avilly-saint-léonard','vtc pontarmé',
    ],
    h1: 'VTC Senlis & Environs',
    intro: 'Chauffeur VTC depuis Senlis et ses communes voisines : Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Avilly-Saint-Léonard, Pontarmé, Chamant, Courteuil et toutes les localités dans un rayon de 10 km. Tarif fixe vers CDG, Orly et Paris.',
    prix: 'dès 65€ vers CDG',
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
      { q: 'Quel est le tarif depuis Senlis vers CDG ?', a: 'Owise propose un tarif fixe garanti, calculé à l\'avance selon votre adresse — pas de compteur, pas de mauvaise surprise à l\'arrivée. Le prix est confirmé dès la réservation et reste le même quelle que soit la circulation. Obtenez votre estimation personnalisée en 30 secondes sur owise.fr.' },
      { q: 'Combien de temps pour aller de Senlis à l\'aéroport CDG ?', a: 'Environ 45 à 60 minutes depuis Senlis centre. Tôt le matin (avant 6h), comptez 40 à 45 minutes sans circulation.' },
      { q: 'Desservez-vous Aumont-en-Halatte et Fleurines ?', a: 'Oui. Toutes les communes autour de Senlis sont couvertes : Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Avilly-Saint-Léonard, Pontarmé, Chamant et leurs alentours.' },
      { q: 'Peut-on réserver un VTC Senlis depuis le Château ?', a: 'Oui. Nous intervenons pour les événements au Château Royal de Senlis, les séminaires et les sorties touristiques. Réservation possible à l\'avance ou le jour même.' },
      { q: 'Quel est le prix Senlis → Paris ?', a: 'Le trajet Senlis → Paris intramuros est d\'environ 80 à 90€ en berline. Utilisez notre estimateur pour un prix exact depuis votre adresse.' },
    ],
  },
  'vtc-gouvieux': {
    slug: 'vtc-gouvieux',
    title: 'VTC Gouvieux, Lamorlaye & Chantilly',
    metaTitle: 'VTC Gouvieux, Lamorlaye, Coye-la-Forêt → CDG dès 59€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Gouvieux, Lamorlaye, Coye-la-Forêt et environs de Chantilly. Tarif fixe dès 59€ vers CDG, Orly, Paris. Disponible 24h/24, 7j/7.',
    keywords: [
      'vtc gouvieux','vtc lamorlaye','vtc coye-la-forêt','vtc orry-la-ville',
      'chauffeur privé gouvieux cdg','vtc gouvieux aéroport',
      'taxi gouvieux paris','vtc lamorlaye cdg','vtc saint-leu-esserent',
      'vtc précy-sur-oise','chauffeur privé lamorlaye',
    ],
    h1: 'VTC Gouvieux, Lamorlaye & Chantilly Sud',
    intro: 'Votre chauffeur VTC depuis Gouvieux, Lamorlaye, Coye-la-Forêt, Orry-la-Ville, Saint-Leu-d\'Esserent, Précy-sur-Oise et toutes les communes du secteur Chantilly Sud. Tarif fixe garanti vers CDG, Orly et Paris. Disponible 24h/24, 7j/7.',
    prix: 'dès 59€ vers CDG',
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
      { q: 'Quel est le tarif depuis Gouvieux ou Lamorlaye vers CDG ?', a: 'Le forfait Gouvieux → CDG est de 59€ en berline, prix fixe garanti. Depuis Lamorlaye ou Coye-la-Forêt, le tarif est identique : 59€ depuis tout le secteur Chantilly Sud.' },
      { q: 'Desservez-vous Coye-la-Forêt et Orry-la-Ville ?', a: 'Oui. Toutes les communes du secteur sont couvertes : Coye-la-Forêt, Orry-la-Ville, Précy-sur-Oise, Boran-sur-Oise, Luzarches et toutes les localités dans un rayon de 10 km autour de Gouvieux.' },
      { q: 'Pouvez-vous me prendre à Lamorlaye tôt le matin ?', a: 'Oui, 24h/24, 7j/7. Pour les départs avant 6h, le supplément nuit (+20%) est intégré dans le prix affiché par notre estimateur.' },
      { q: 'Quel est le prix depuis Gouvieux vers Paris ?', a: 'Le trajet Gouvieux → Paris intramuros est calculé selon votre adresse exacte, environ 80 à 90€ en berline. Utilisez notre estimateur pour un prix instantané.' },
      { q: 'Desservez-vous l\'Hippodrome de Chantilly depuis Gouvieux ?', a: 'Oui. Nous assurons les transferts pour l\'Hippodrome, le Château de Chantilly et les événements privés du secteur. Réservez à l\'avance pour les grands événements (Prix de Diane, etc.).' },
    ],
  },
  'vtc-chantilly': {
    slug: 'vtc-chantilly',
    title: 'VTC Chantilly — Aéroport & Paris',
    metaTitle: 'VTC Chantilly → CDG, Orly, Paris dès 59€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Chantilly vers CDG, Orly et Paris. Tarif fixe dès 59€, véhicule premium, disponible 24h/24. Château de Chantilly, hippodrome, événements.',
    keywords: ['vtc chantilly','chauffeur privé chantilly','vtc chantilly cdg','taxi chantilly aéroport','vtc chantilly paris'],
    h1: 'VTC Chantilly — Chauffeur Privé',
    intro: 'Chauffeur VTC depuis Chantilly et ses environs vers CDG, Orly, Paris et toute l\'Île-de-France. Idéal pour le Château de Chantilly, l\'hippodrome, les hôtels de luxe et les événements.',
    prix: 'dès 59€ vers CDG',
    duree: '40–55 min vers CDG',
    faq: [
      { q: 'Quel est le prix d\'un VTC Chantilly → CDG ?', a: 'Le forfait Chantilly → CDG est de 59€ en berline, prix fixe garanti. Obtenez votre estimation exacte avec notre calculateur en ligne.' },
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
    metaTitle: 'VTC Lamorlaye, Coye-la-Forêt → CDG, Paris dès 59€ | Owise',
    metaDesc: 'Chauffeur VTC depuis Lamorlaye, Coye-la-Forêt, Orry-la-Ville et la forêt de Chantilly vers CDG, Orly et Paris. Tarif fixe dès 59€, disponible 24h/24.',
    keywords: [
      'vtc lamorlaye','chauffeur privé lamorlaye cdg','vtc lamorlaye aéroport',
      'taxi lamorlaye paris','vtc coye-la-forêt','vtc orry-la-ville',
      'chauffeur lamorlaye','vtc lamorlaye orly','chauffeur privé lamorlaye',
      'vtc 60260 cdg','vtc lamorlaye chantilly','taxi lamorlaye cdg',
    ],
    h1: 'VTC Lamorlaye, Coye-la-Forêt & Forêt de Chantilly',
    intro: 'Votre chauffeur VTC depuis Lamorlaye, Coye-la-Forêt, Orry-la-Ville, Luzarches et toutes les communes de la forêt de Chantilly. Tarif fixe garanti vers CDG, Orly, Paris et Beauvais. Service premium, prise en charge à domicile, disponible 24h/24, 7j/7.',
    prix: 'dès 59€ vers CDG',
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
      { q: 'Quel est le tarif depuis Lamorlaye vers CDG ?', a: 'Le forfait Lamorlaye → CDG est de 59€ en berline, prix fixe garanti quelle que soit la circulation. Depuis Coye-la-Forêt, Gouvieux ou Orry-la-Ville, le tarif est identique : 59€.' },
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
      { q: 'Quel est le tarif depuis Pontoise vers CDG ?', a: 'Owise propose un tarif fixe calculé à l\'avance depuis Pontoise, Cergy, Osny et toutes les communes du Val-d\'Oise — le prix est confirmé à la réservation et ne change pas, bouchons ou pas. Chauffeur professionnel, prise en charge à domicile, disponible 24h/24. Estimez votre course sur owise.fr.' },
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
      { q: 'Quel est le tarif depuis Versailles vers CDG ?', a: 'Owise propose un tarif fixe garanti depuis Versailles, Le Chesnay et les Yvelines — calculé à l\'avance selon votre adresse, confirmé dès la réservation. Pas de compteur, pas de surplus en heure de pointe. Idéal pour les visiteurs du Château ou les déplacements professionnels. Estimez sur owise.fr.' },
      { q: 'Proposez-vous des transferts pour le Château de Versailles ?', a: 'Oui. Nous organisons des transferts pour les visiteurs du Château de Versailles, les événements privés dans les jardins et les séminaires d\'entreprise dans la région. Tarif sur devis pour les groupes.' },
      { q: 'Combien de temps pour aller de Versailles à CDG ?', a: 'Environ 40 à 70 minutes selon les conditions de circulation. La route passe par l\'A86 puis l\'A3, ou par le Francilienne. Tôt le matin (avant 6h), comptez 40 à 50 minutes.' },
      { q: 'Desservez-vous les entreprises de Vélizy et Saint-Quentin-en-Yvelines ?', a: 'Oui. Nous proposons des solutions VTC pour les entreprises des technopôles de Vélizy, Saint-Quentin-en-Yvelines et les parcs d\'activités des Yvelines. Compte entreprise disponible avec facturation mensuelle.' },
      { q: 'Puis-je réserver un VTC depuis Versailles vers Paris ?', a: 'Absolument. Le trajet Versailles → Paris est d\'environ 30 à 45 minutes, pour un tarif de 50 à 70€ selon votre destination précise à Paris. Aller-retour possible dès la réservation.' },
    ],
  },
  'vtc-coye-la-foret': {
    slug: 'vtc-coye-la-foret',
    title: 'VTC Coye-la-Forêt & Forêt de Chantilly',
    metaTitle: 'VTC Coye-la-Forêt → CDG, Paris dès 65€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Coye-la-Forêt, Lamorlaye, Orry-la-Ville et la Forêt de Chantilly vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc coye-la-foret','chauffeur privé coye-la-forêt cdg','taxi coye la forêt aéroport',
      'vtc forêt de chantilly','vtc 60580 cdg','chauffeur privé coye la forêt paris',
      'vtc coye lamorlaye','taxi coye-la-forêt orly','chauffeur 60580',
    ],
    h1: 'VTC Coye-la-Forêt & Forêt de Chantilly',
    intro: 'Votre chauffeur VTC depuis Coye-la-Forêt, Lamorlaye, Orry-la-Ville, Avilly-Saint-Léonard et toute la Forêt de Chantilly. Transferts vers CDG, Orly, Paris et toute l\'Île-de-France. Tarif fixe garanti, prise en charge à domicile, disponible 24h/24.',
    prix: 'dès 65€ vers CDG',
    duree: '45–55 min vers CDG',
    zones: [
      { nom: 'Coye-la-Forêt', cp: '60580', km: 0 },
      { nom: 'Lamorlaye', cp: '60260', km: 2.5 },
      { nom: 'Orry-la-Ville', cp: '60560', km: 3.5 },
      { nom: 'Avilly-Saint-Léonard', cp: '60300', km: 4.0 },
      { nom: 'Chantilly', cp: '60500', km: 5.5 },
      { nom: 'Gouvieux', cp: '60270', km: 5.8 },
      { nom: 'Asnières-sur-Oise', cp: '95270', km: 6.5 },
      { nom: 'Boran-sur-Oise', cp: '60820', km: 7.0 },
      { nom: 'Luzarches', cp: '95270', km: 7.5 },
      { nom: 'Thiers-sur-Thève', cp: '60520', km: 8.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Coye-la-Forêt vers CDG ?', a: 'Chez Owise, le prix est fixe et calculé à l\'avance — vous savez exactement ce que vous payez avant de monter dans le véhicule. Votre chauffeur vous prend en charge à domicile, suivi de vol inclus, disponible 24h/24. Estimez votre tarif personnalisé en 30 secondes sur owise.fr.' },
      { q: 'Combien de temps pour aller de Coye-la-Forêt à CDG ?', a: 'Environ 45 à 55 minutes selon les conditions de circulation. Via l\'A1 depuis la Forêt de Chantilly, le trajet est direct. Tôt le matin (avant 6h), comptez 40 à 45 minutes.' },
      { q: 'Desservez-vous Lamorlaye et Orry-la-Ville depuis Coye-la-Forêt ?', a: 'Oui. Nous couvrons toutes les communes autour de Coye-la-Forêt : Lamorlaye, Orry-la-Ville, Avilly-Saint-Léonard, Chantilly, Gouvieux, Boran-sur-Oise, Luzarches et leurs environs.' },
      { q: 'Proposez-vous des courses vers Paris depuis la Forêt de Chantilly ?', a: 'Absolument. Depuis Coye-la-Forêt, Paris (porte Maillot, gare du Nord, etc.) est à environ 55 à 70 minutes pour un tarif de 80 à 100€. Idéal pour les déplacements professionnels depuis la région de Chantilly.' },
      { q: 'Puis-je réserver un VTC depuis Coye-la-Forêt vers Orly ?', a: 'Oui. Le forfait Coye-la-Forêt → Orly est d\'environ 100 à 120€ en berline. Tous les aéroports parisiens sont desservis : CDG, Orly et Beauvais-Tillé.' },
    ],
  },
  'vtc-orry-la-ville': {
    slug: 'vtc-orry-la-ville',
    title: 'VTC Orry-la-Ville & Région de Chantilly',
    metaTitle: 'VTC Orry-la-Ville → CDG, Paris dès 60€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Orry-la-Ville, La Chapelle-en-Serval, Coye-la-Forêt vers CDG, Orly et Paris. Entre Chantilly et Roissy, tarif fixe garanti, disponible 24h/24.',
    keywords: [
      'vtc orry-la-ville','chauffeur privé orry la ville cdg','taxi orry-la-ville aéroport',
      'vtc 60560 cdg','chauffeur privé chantilly orry','vtc orry la ville paris',
      'taxi orry-la-ville orly','vtc orry la chapelle serval','chauffeur 60560',
    ],
    h1: 'VTC Orry-la-Ville & Environs',
    intro: 'Votre chauffeur VTC depuis Orry-la-Ville, La Chapelle-en-Serval, Mortefontaine, Coye-la-Forêt et les communes situées entre Chantilly et l\'aéroport CDG. Transferts vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 60€ vers CDG',
    duree: '35–50 min vers CDG',
    zones: [
      { nom: 'Orry-la-Ville', cp: '60560', km: 0 },
      { nom: 'La Chapelle-en-Serval', cp: '60520', km: 3.5 },
      { nom: 'Coye-la-Forêt', cp: '60580', km: 3.5 },
      { nom: 'Mortefontaine', cp: '60128', km: 3.8 },
      { nom: 'Lamorlaye', cp: '60260', km: 4.0 },
      { nom: 'Avilly-Saint-Léonard', cp: '60300', km: 4.5 },
      { nom: 'Survilliers', cp: '95470', km: 6.5 },
      { nom: 'Luzarches', cp: '95270', km: 7.5 },
      { nom: 'Chantilly', cp: '60500', km: 7.5 },
      { nom: 'Senlis', cp: '60300', km: 10.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Orry-la-Ville vers CDG ?', a: 'Orry-la-Ville est l\'une des communes les mieux placées pour rejoindre CDG — moins de 35 minutes via l\'A1. Owise propose un tarif fixe calculé à l\'avance, sans compteur : le prix affiché est celui que vous payez, point. Estimez votre course en 30 secondes sur owise.fr.' },
      { q: 'Combien de temps pour aller d\'Orry-la-Ville à CDG ?', a: 'Environ 35 à 50 minutes via l\'A1. Orry-la-Ville est idéalement situé entre Chantilly et l\'aéroport CDG. Tôt le matin, comptez 30 à 35 minutes.' },
      { q: 'Desservez-vous La Chapelle-en-Serval depuis Orry-la-Ville ?', a: 'Oui. Nous couvrons toutes les communes autour d\'Orry-la-Ville : La Chapelle-en-Serval, Mortefontaine, Coye-la-Forêt, Lamorlaye, Avilly-Saint-Léonard, Survilliers, Luzarches et Chantilly.' },
      { q: 'Proposez-vous des transferts vers Paris depuis Orry-la-Ville ?', a: 'Absolument. Depuis Orry-la-Ville, Paris est à environ 50 à 65 minutes pour un tarif de 80 à 100€. Votre chauffeur vous prend en charge directement à votre adresse, 24h/24.' },
      { q: 'Couvrez-vous Mortefontaine et Avilly-Saint-Léonard ?', a: 'Oui. Mortefontaine, Avilly-Saint-Léonard, Thiers-sur-Thève, Pontarmé et toutes les communes entre Senlis et Roissy sont desservies avec le même niveau de service premium.' },
    ],
  },
  'vtc-la-chapelle-en-serval': {
    slug: 'vtc-la-chapelle-en-serval',
    title: 'VTC La Chapelle-en-Serval & Mortefontaine',
    metaTitle: 'VTC La Chapelle-en-Serval → CDG dès 60€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis La Chapelle-en-Serval, Mortefontaine, Plailly vers CDG, Orly et Paris. Proche de l\'A1, trajet rapide vers Roissy. Tarif fixe garanti, disponible 24h/24.',
    keywords: [
      'vtc la chapelle en serval','chauffeur privé chapelle-en-serval cdg','taxi chapelle serval aéroport',
      'vtc mortefontaine cdg','vtc 60520 cdg','chauffeur privé plailly cdg',
      'vtc chapelle serval paris','taxi la chapelle en serval','chauffeur 60520 orly',
    ],
    h1: 'VTC La Chapelle-en-Serval & Mortefontaine',
    intro: 'Votre chauffeur VTC depuis La Chapelle-en-Serval, Mortefontaine, Plailly, Orry-la-Ville et les communes proches de l\'A1 entre Chantilly et CDG. Accès direct à l\'autoroute A1 — l\'un des trajets les plus rapides vers Roissy depuis l\'Oise. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 60€ vers CDG',
    duree: '30–40 min vers CDG',
    zones: [
      { nom: 'La Chapelle-en-Serval', cp: '60520', km: 0 },
      { nom: 'Mortefontaine', cp: '60128', km: 3.0 },
      { nom: 'Orry-la-Ville', cp: '60560', km: 4.0 },
      { nom: 'Survilliers', cp: '95470', km: 4.5 },
      { nom: 'Plailly', cp: '60128', km: 5.5 },
      { nom: 'Thiers-sur-Thève', cp: '60520', km: 6.0 },
      { nom: 'Pontarmé', cp: '60520', km: 6.5 },
      { nom: 'Ermenonville', cp: '60950', km: 8.0 },
      { nom: 'Chaumontel', cp: '95270', km: 8.0 },
      { nom: 'Senlis', cp: '60300', km: 10.5 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis La Chapelle-en-Serval vers CDG ?', a: 'La Chapelle-en-Serval est à moins de 30 minutes de CDG via l\'A1 — l\'un des trajets les plus courts de toute l\'Oise. Owise garantit un tarif fixe calculé à l\'avance selon votre adresse : le chauffeur vient vous chercher chez vous, le prix ne change pas en cas de bouchon. Estimez votre course sur owise.fr.' },
      { q: 'La Chapelle-en-Serval est-elle proche de CDG ?', a: 'Oui, c\'est l\'une des communes les plus proches de CDG dans l\'Oise. Via l\'A1 (accès Survilliers ou Louvres), La Chapelle-en-Serval est à seulement 30 à 40 minutes de l\'aéroport — bien moins que depuis Paris.' },
      { q: 'Combien de temps pour aller de La Chapelle-en-Serval à CDG ?', a: 'Environ 30 à 40 minutes en conditions normales. Tôt le matin (avant 6h), le trajet descend à 25 minutes. L\'accès à l\'A1 depuis La Chapelle-en-Serval est direct, sans traverser aucune zone urbaine dense.' },
      { q: 'Desservez-vous Mortefontaine et Plailly ?', a: 'Oui. Nous couvrons La Chapelle-en-Serval et ses environs : Mortefontaine, Plailly, Orry-la-Ville, Thiers-sur-Thève, Pontarmé, Ermenonville et Survilliers. Même tarif depuis chacune de ces communes.' },
      { q: 'Proposez-vous des courses vers Paris depuis La Chapelle-en-Serval ?', a: 'Absolument. Depuis La Chapelle-en-Serval, Paris (porte de la Chapelle, gare du Nord) est à environ 40 à 55 minutes pour un tarif de 75 à 95€. Service disponible 24h/24, 7j/7.' },
    ],
  },
  'vtc-boran-sur-oise': {
    slug: 'vtc-boran-sur-oise',
    title: 'VTC Boran-sur-Oise & Vallée de l\'Oise',
    metaTitle: 'VTC Boran-sur-Oise → CDG, Paris dès 80€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Boran-sur-Oise, Précy-sur-Oise, Le Mesnil-en-Thelle vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc boran-sur-oise','chauffeur privé boran sur oise cdg','taxi boran oise aéroport',
      'vtc 60820 cdg','vtc vallée de l\'oise','vtc precy-sur-oise cdg',
      'chauffeur privé boran oise paris','taxi boran sur oise orly','vtc gouvieux boran',
    ],
    h1: 'VTC Boran-sur-Oise & Vallée de l\'Oise',
    intro: 'Votre chauffeur VTC depuis Boran-sur-Oise, Précy-sur-Oise, Le Mesnil-en-Thelle, Chambly et toutes les communes de la Vallée de l\'Oise entre Creil et Pontoise. Transferts vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 80€ vers CDG',
    duree: '50–65 min vers CDG',
    zones: [
      { nom: 'Boran-sur-Oise', cp: '60820', km: 0 },
      { nom: 'Précy-sur-Oise', cp: '60460', km: 3.5 },
      { nom: 'Le Mesnil-en-Thelle', cp: '60530', km: 4.5 },
      { nom: 'Crouy-en-Thelle', cp: '60530', km: 5.0 },
      { nom: 'Coye-la-Forêt', cp: '60580', km: 7.0 },
      { nom: 'Gouvieux', cp: '60270', km: 7.5 },
      { nom: 'Saint-Leu-d\'Esserent', cp: '60340', km: 8.0 },
      { nom: 'Chambly', cp: '60230', km: 7.0 },
      { nom: 'Chantilly', cp: '60500', km: 9.0 },
      { nom: 'Lamorlaye', cp: '60260', km: 9.5 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Boran-sur-Oise vers CDG ?', a: 'Owise garantit un tarif fixe confirmé avant le départ — pas de compteur, pas de surplus pour les bouchons. Votre chauffeur vient vous chercher à Boran-sur-Oise, suivi de vol en temps réel inclus si vous rentrez d\'un voyage. Obtenez votre prix exact en 30 secondes sur owise.fr.' },
      { q: 'Combien de temps pour aller de Boran-sur-Oise à CDG ?', a: 'Environ 50 à 65 minutes selon les conditions de circulation. Via l\'A1 (accès par Gouvieux ou Survilliers), le trajet est direct. Tôt le matin (avant 6h), comptez 45 à 50 minutes.' },
      { q: 'Desservez-vous Précy-sur-Oise et Le Mesnil-en-Thelle ?', a: 'Oui. Nous couvrons toutes les communes autour de Boran-sur-Oise : Précy-sur-Oise, Le Mesnil-en-Thelle, Crouy-en-Thelle, Coye-la-Forêt, Gouvieux, Saint-Leu-d\'Esserent et Chambly.' },
      { q: 'Proposez-vous des transferts vers Paris depuis Boran-sur-Oise ?', a: 'Absolument. Depuis Boran-sur-Oise, Paris est à environ 60 à 75 minutes pour un tarif de 95 à 115€ selon votre destination précise. Prise en charge directement à votre adresse, disponible 24h/24.' },
      { q: 'Couvrez-vous les communes de la Vallée de l\'Oise entre Creil et Pontoise ?', a: 'Oui. Nous desservons toute la Vallée de l\'Oise : Boran-sur-Oise, Précy-sur-Oise, Le Mesnil-en-Thelle, Chambly et les communes des deux rives de l\'Oise jusqu\'à Pontoise et Creil.' },
    ],
  },
  'vtc-precy-sur-oise': {
    slug: 'vtc-precy-sur-oise',
    title: 'VTC Précy-sur-Oise & Oise Nord',
    metaTitle: 'VTC Précy-sur-Oise → CDG, Paris dès 85€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Précy-sur-Oise, Boran-sur-Oise, Crouy-en-Thelle vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc precy-sur-oise','chauffeur privé précy sur oise cdg','taxi précy oise aéroport',
      'vtc 60460 cdg','chauffeur privé oise nord cdg','vtc precy oise paris',
      'taxi précy-sur-oise orly','vtc boran precy oise','chauffeur 60460',
    ],
    h1: 'VTC Précy-sur-Oise & Oise Nord',
    intro: 'Votre chauffeur VTC depuis Précy-sur-Oise, Boran-sur-Oise, Villeneuve-sur-Verberie, Le Mesnil-en-Thelle et les communes de l\'Oise Nord entre Creil et la Vallée de l\'Oise. Transferts vers CDG, Orly, Paris et toute l\'Île-de-France. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 85€ vers CDG',
    duree: '50–65 min vers CDG',
    zones: [
      { nom: 'Précy-sur-Oise', cp: '60460', km: 0 },
      { nom: 'Boran-sur-Oise', cp: '60820', km: 3.5 },
      { nom: 'Villeneuve-sur-Verberie', cp: '60410', km: 4.5 },
      { nom: 'Bury', cp: '60250', km: 5.0 },
      { nom: 'Le Mesnil-en-Thelle', cp: '60530', km: 5.5 },
      { nom: 'Crouy-en-Thelle', cp: '60530', km: 6.5 },
      { nom: 'Gouvieux', cp: '60270', km: 7.5 },
      { nom: 'Saint-Leu-d\'Esserent', cp: '60340', km: 7.8 },
      { nom: 'Creil', cp: '60100', km: 8.5 },
      { nom: 'Chantilly', cp: '60500', km: 12.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Précy-sur-Oise vers CDG ?', a: 'Owise calcule un tarif fixe à l\'avance selon votre adresse exacte : le prix est bloqué dès la réservation, même si vous annulez et reréservez. Prise en charge à domicile, chauffeur professionnel, disponible dès 4h du matin pour les vols matinaux. Estimez votre course sur owise.fr.' },
      { q: 'Combien de temps pour aller de Précy-sur-Oise à CDG ?', a: 'Environ 50 à 65 minutes selon les conditions de circulation. Le trajet passe par l\'A1 via Gouvieux ou Survilliers. Tôt le matin (avant 6h), comptez 45 à 50 minutes.' },
      { q: 'Desservez-vous Boran-sur-Oise et Le Mesnil-en-Thelle depuis Précy ?', a: 'Oui. Nous couvrons toutes les communes autour de Précy-sur-Oise : Boran-sur-Oise, Villeneuve-sur-Verberie, Bury, Le Mesnil-en-Thelle, Crouy-en-Thelle, Gouvieux et Saint-Leu-d\'Esserent.' },
      { q: 'Proposez-vous des courses vers Creil depuis Précy-sur-Oise ?', a: 'Oui. Nous effectuons tous types de transferts locaux : Précy-sur-Oise → gare de Creil, Creil → CDG et toutes destinations depuis Précy. Le tarif local est calculé au kilomètre depuis votre adresse.' },
      { q: 'Proposez-vous un service vers Orly depuis Précy-sur-Oise ?', a: 'Oui. Le forfait Précy-sur-Oise → Orly est d\'environ 110 à 130€ en berline. Le trajet prend environ 70 à 90 minutes. Tous les aéroports parisiens sont desservis depuis l\'Oise Nord.' },
    ],
  },
  'vtc-luzarches': {
    slug: 'vtc-luzarches',
    title: 'VTC Luzarches & Pays de France',
    metaTitle: 'VTC Luzarches → CDG, Paris dès 65€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Luzarches, Asnières-sur-Oise, Chaumontel et le Pays de France vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc luzarches','chauffeur privé luzarches cdg','taxi luzarches aéroport',
      'vtc 95270 cdg','vtc pays de france','chauffeur privé luzarches paris',
      'vtc asnieres-sur-oise','taxi luzarches orly','vtc val-d\'oise chantilly cdg',
    ],
    h1: 'VTC Luzarches & Pays de France',
    intro: 'Votre chauffeur VTC depuis Luzarches, Asnières-sur-Oise, Chaumontel, Bellefontaine et les communes du Pays de France (Val-d\'Oise 95). Idéalement situé entre Chantilly et l\'aéroport CDG. Transferts vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 65€ vers CDG',
    duree: '35–50 min vers CDG',
    zones: [
      { nom: 'Luzarches', cp: '95270', km: 0 },
      { nom: 'Plessis-Luzarches', cp: '95270', km: 2.0 },
      { nom: 'Asnières-sur-Oise', cp: '95270', km: 2.5 },
      { nom: 'Bellefontaine', cp: '95270', km: 3.5 },
      { nom: 'Chaumontel', cp: '95270', km: 4.5 },
      { nom: 'Lamorlaye', cp: '60260', km: 5.0 },
      { nom: 'Coye-la-Forêt', cp: '60580', km: 5.5 },
      { nom: 'Orry-la-Ville', cp: '60560', km: 7.0 },
      { nom: 'La Chapelle-en-Serval', cp: '60520', km: 8.5 },
      { nom: 'Chantilly', cp: '60500', km: 9.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Luzarches vers CDG ?', a: 'Luzarches est parfaitement placée entre Chantilly et l\'aéroport CDG. Owise propose un tarif fixe calculé selon votre adresse, confirmé avant le départ — le même prix qu\'il pleuve, qu\'il y ait des bouchons ou un retard. Chauffeur professionnel, prise en charge à domicile. Estimez sur owise.fr.' },
      { q: 'Combien de temps pour aller de Luzarches à CDG ?', a: 'Environ 35 à 50 minutes via l\'A1. Depuis Luzarches, l\'accès à l\'autoroute se fait par Survilliers ou Louvres. Tôt le matin (avant 6h), le trajet descend à 30 à 35 minutes.' },
      { q: 'Desservez-vous Asnières-sur-Oise et Chaumontel ?', a: 'Oui. Nous couvrons toutes les communes du Pays de France : Luzarches, Asnières-sur-Oise, Chaumontel, Bellefontaine, Plessis-Luzarches, ainsi que Lamorlaye et Coye-la-Forêt dans l\'Oise.' },
      { q: 'Proposez-vous des transferts vers Paris depuis Luzarches ?', a: 'Absolument. Depuis Luzarches, Paris (gare du Nord, Châtelet, La Défense) est à environ 50 à 65 minutes pour un tarif de 80 à 100€. Prise en charge directement à votre adresse, 24h/24.' },
      { q: 'Couvrez-vous les communes du Pays de France entre Chantilly et CDG ?', a: 'Oui. Nous desservons tout le Pays de France (Val-d\'Oise 95) : Luzarches, Asnières-sur-Oise, Chaumontel, Bellefontaine, Maffliers, et les communes limitrophes de l\'Oise comme Lamorlaye, Coye-la-Forêt et Orry-la-Ville.' },
    ],
  },
  'vtc-clermont': {
    slug: 'vtc-clermont',
    title: 'VTC Clermont-de-l\'Oise & Clermontois',
    metaTitle: 'VTC Clermont → CDG, Paris dès 105€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Clermont-de-l\'Oise, Agnetz, Breuil-le-Vert et le Clermontois vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc clermont oise','chauffeur privé clermont 60','vtc clermont cdg',
      'taxi clermont-de-l\'oise aéroport','vtc 60600 cdg','vtc clermontois',
      'chauffeur privé agnetz breuil','vtc clermont paris','vtc oise nord cdg',
    ],
    h1: 'VTC Clermont-de-l\'Oise & Clermontois',
    intro: 'Votre chauffeur VTC depuis Clermont-de-l\'Oise et les communes du Clermontois (Oise 60) : Agnetz, Lamécourt, Breuil-le-Vert, Breuil-le-Sec, Étouy et les villages voisins. Transferts vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 105€ vers CDG',
    duree: '65–80 min vers CDG',
    zones: [
      { nom: 'Clermont', cp: '60600', km: 0 },
      { nom: 'Agnetz', cp: '60600', km: 2.5 },
      { nom: 'Lamécourt', cp: '60600', km: 3.0 },
      { nom: 'Breuil-le-Vert', cp: '60840', km: 4.5 },
      { nom: 'Breuil-le-Sec', cp: '60840', km: 5.0 },
      { nom: 'Étouy', cp: '60600', km: 6.0 },
      { nom: 'Liancourt', cp: '60140', km: 9.0 },
      { nom: 'Rantigny', cp: '60290', km: 12.0 },
      { nom: 'Cauffry', cp: '60290', km: 13.0 },
      { nom: 'Creil', cp: '60100', km: 16.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Clermont vers CDG ?', a: 'Owise propose un tarif fixe depuis Clermont-de-l\'Oise — le prix est bloqué dès la réservation, que vous partiez à 4h du matin ou en plein rush. Votre chauffeur vient chez vous, sans stress de stationnement ni de navette. Estimez votre course sur owise.fr.' },
      { q: 'Combien de temps pour aller de Clermont à CDG ?', a: 'Environ 65 à 80 minutes via l\'A16 puis l\'A1. Tôt le matin (avant 6h), comptez 55 à 65 minutes sans trafic. Depuis Clermont, l\'accès à l\'autoroute se fait par Breuil-le-Vert ou Laigneville.' },
      { q: 'Desservez-vous Agnetz, Breuil-le-Vert et Breuil-le-Sec ?', a: 'Oui. Nous couvrons toutes les communes du Clermontois : Agnetz, Breuil-le-Vert, Breuil-le-Sec, Étouy, Lamécourt, Rantigny et Cauffry. Prise en charge directement à votre adresse, disponible 24h/24.' },
      { q: 'Proposez-vous des courses vers Creil depuis Clermont ?', a: 'Oui. Nous effectuons tous les transferts locaux : Clermont → gare de Creil, Clermont → Liancourt, Creil → CDG. Le tarif local est calculé au kilomètre depuis votre adresse.' },
      { q: 'Proposez-vous un service vers Orly depuis Clermont ?', a: 'Oui. Le forfait Clermont → Orly est d\'environ 130 à 150€ en berline. Le trajet prend environ 85 à 100 minutes. Tous les aéroports parisiens (CDG, Orly, Beauvais) sont desservis depuis l\'Oise Nord.' },
    ],
  },
  'vtc-liancourt': {
    slug: 'vtc-liancourt',
    title: 'VTC Liancourt, Rantigny & Cauffry',
    metaTitle: 'VTC Liancourt → CDG, Paris dès 100€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Liancourt, Rantigny, Cauffry et Laigneville vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc liancourt','chauffeur privé liancourt 60','vtc rantigny cdg',
      'taxi cauffry aéroport','vtc 60140 cdg','vtc liancourt orly',
      'chauffeur privé laigneville creil','vtc monchy-saint-éloi',
      'vtc cauffry rantigny cdg',
    ],
    h1: 'VTC Liancourt, Rantigny & Cauffry',
    intro: 'Votre chauffeur VTC depuis Liancourt et les communes voisines : Rantigny, Cauffry, Laigneville, Monchy-Saint-Éloi, Cires-lès-Mello et Mello. Entre Creil et Clermont, transferts vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 100€ vers CDG',
    duree: '60–75 min vers CDG',
    zones: [
      { nom: 'Liancourt', cp: '60140', km: 0 },
      { nom: 'Rantigny', cp: '60290', km: 2.0 },
      { nom: 'Cauffry', cp: '60290', km: 3.0 },
      { nom: 'Laigneville', cp: '60290', km: 4.0 },
      { nom: 'Monchy-Saint-Éloi', cp: '60290', km: 5.0 },
      { nom: 'Cires-lès-Mello', cp: '60660', km: 6.0 },
      { nom: 'Mello', cp: '60660', km: 7.0 },
      { nom: 'Saint-Maximin', cp: '60740', km: 10.0 },
      { nom: 'Creil', cp: '60100', km: 10.0 },
      { nom: 'Clermont', cp: '60600', km: 10.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Liancourt vers CDG ?', a: 'Owise couvre Liancourt, Rantigny, Cauffry et toutes les communes voisines avec un tarif fixe calculé à l\'avance — le prix confirmé à la réservation ne changera pas, même en cas de retard de vol ou de bouchon sur l\'A1. Prise en charge à domicile, disponible dès 4h du matin. Estimez sur owise.fr.' },
      { q: 'Combien de temps pour aller de Liancourt à CDG ?', a: 'Environ 60 à 75 minutes via l\'A1 depuis Creil. Tôt le matin (avant 6h), comptez 50 à 60 minutes. Depuis Liancourt, l\'accès à l\'autoroute se fait par Creil ou Laigneville.' },
      { q: 'Desservez-vous Rantigny, Cauffry et Laigneville ?', a: 'Oui. Nous couvrons Liancourt et toutes les communes voisines : Rantigny, Cauffry, Laigneville, Monchy-Saint-Éloi, Cires-lès-Mello et Mello. Prise en charge directement à votre adresse, disponible 24h/24.' },
      { q: 'Proposez-vous des courses vers Creil depuis Liancourt ?', a: 'Oui. Nous effectuons tous les transferts locaux : Liancourt → gare de Creil, Liancourt → Clermont, et toutes destinations depuis Liancourt. Le tarif local est calculé au kilomètre depuis votre adresse.' },
      { q: 'Proposez-vous un service vers Paris depuis Liancourt ?', a: 'Oui. Depuis Liancourt, Paris (gare du Nord, Châtelet, La Défense) est à environ 70 à 90 minutes pour un tarif de 110 à 130€. Prise en charge directement à votre adresse, disponible 24h/24, 7j/7.' },
    ],
  },

  // ── PAGES DE TRAJETS SPÉCIFIQUES (Ville → Aéroport) ──────────────────────
  // Prix vérifiés sur /admin/tarifs le 08/09/2026

  'vtc-chantilly-cdg': {
    slug: 'vtc-chantilly-cdg',
    title: 'VTC Chantilly → CDG',
    metaTitle: 'VTC Chantilly CDG — Tarif Fixe 59€ | Owise',
    metaDesc: 'VTC de Chantilly à l\'aéroport CDG. Tarif fixe 59€, suivi de vol inclus, prise en charge à domicile. Chauffeur professionnel disponible 24h/24. Réservez en ligne.',
    keywords: ['vtc chantilly cdg','taxi chantilly aéroport cdg','chauffeur chantilly charles de gaulle','vtc chantilly roissy','chantilly cdg prix','vtc gouvieux cdg','chauffeur privé chantilly cdg 59'],
    h1: 'VTC Chantilly → CDG — Tarif Fixe 59€',
    intro: 'Votre transfert VTC depuis Chantilly (et Gouvieux, Lamorlaye, Coye-la-Forêt) jusqu\'à l\'aéroport Charles de Gaulle. Tarif fixe 59€ garanti en berline, chauffeur professionnel, suivi de vol en temps réel. Prise en charge à votre domicile, disponible 24h/24.',
    prix: '59€ vers CDG',
    duree: '40–55 min',
    faq: [
      { q: 'Quel est le tarif exact d\'un VTC de Chantilly à CDG ?', a: 'Le tarif fixe garanti est de 59€ en berline depuis Chantilly et Gouvieux. Ce prix est confirmé avant le départ, ne varie pas selon la circulation et inclut la prise en charge à domicile ainsi que le suivi de vol.' },
      { q: 'Combien de temps prend le trajet Chantilly → CDG ?', a: 'Environ 40 à 55 minutes selon les conditions de circulation, via l\'A1 ou la N16. Tôt le matin (avant 6h), comptez 35 à 40 minutes. Votre chauffeur calcule l\'heure de départ au plus juste pour respecter votre embarquement.' },
      { q: 'Mon chauffeur attend-il si mon vol est retardé à CDG ?', a: 'Oui. Owise suit votre vol en temps réel. En cas de retard, votre chauffeur ajuste automatiquement son heure d\'arrivée sans frais supplémentaires. Vous n\'avez rien à faire.' },
      { q: 'Le tarif 59€ couvre-t-il aussi Gouvieux et Lamorlaye ?', a: 'Oui. Le tarif de 59€ vers CDG couvre Chantilly, Gouvieux, Lamorlaye et toutes les communes dans un rayon de 5 km autour de Chantilly. Prise en charge directement à votre adresse.' },
      { q: 'Peut-on réserver un VTC Chantilly–CDG la veille ou à la dernière minute ?', a: 'Oui, la réservation est possible à l\'avance (jours ou semaines) ou le jour même. Pour les départs tôt le matin, une réservation la veille est recommandée pour garantir la disponibilité.' },
    ],
  },

  'vtc-creil-cdg': {
    slug: 'vtc-creil-cdg',
    title: 'VTC Creil → CDG',
    metaTitle: 'VTC Creil CDG — Tarif Fixe 65€ | Chauffeur Privé | Owise',
    metaDesc: 'VTC de Creil à l\'aéroport CDG. Tarif fixe 65€, suivi de vol, prise en charge à domicile. Chauffeur professionnel disponible 24h/24 depuis Creil et l\'Oise Sud.',
    keywords: ['vtc creil cdg','taxi creil aéroport','chauffeur creil charles de gaulle','vtc creil roissy','creil cdg prix','vtc nogent oise cdg','chauffeur privé creil cdg 65'],
    h1: 'VTC Creil → CDG — Tarif Fixe 65€',
    intro: 'Votre transfert VTC depuis Creil et l\'Oise Sud (Nogent-sur-Oise, Montataire, Saint-Maximin, Laigneville) jusqu\'à l\'aéroport Charles de Gaulle. Tarif fixe 65€ garanti en berline, chauffeur habilité, suivi de vol inclus. Disponible 24h/24.',
    prix: '65€ vers CDG',
    duree: '40–55 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Creil à CDG ?', a: 'Le tarif fixe est de 65€ en berline depuis Creil, Nogent-sur-Oise ou Montataire. Prix garanti à la réservation, sans compteur — aucune mauvaise surprise en cas de bouchon ou de retard de vol.' },
      { q: 'Combien de temps met-on de Creil à CDG ?', a: 'Environ 40 à 55 minutes via l\'A1 depuis Creil. Tôt le matin (avant 6h), le trajet prend 35 à 40 minutes. Votre chauffeur part à l\'heure calculée pour respecter votre vol.' },
      { q: 'Le tarif 65€ inclut-il Nogent-sur-Oise et Montataire ?', a: 'Oui. Creil, Nogent-sur-Oise et Montataire sont dans la même zone tarifaire. Le forfait de 65€ vers CDG couvre toutes ces communes et leurs alentours immédiats.' },
      { q: 'Owise suit-il les vols retardés depuis CDG ?', a: 'Oui, le suivi de vol en temps réel est inclus dans chaque course. En cas de retard, votre chauffeur ajuste son heure d\'arrivée automatiquement — vous attendez le moins longtemps possible à l\'aéroport.' },
      { q: 'Comment se fait la prise en charge à CDG pour un retour ?', a: 'À l\'arrivée à CDG, votre chauffeur vous attend dans le hall des arrivées avec une pancarte à votre nom, au terminal indiqué dans votre confirmation de réservation.' },
    ],
  },

  'vtc-senlis-cdg': {
    slug: 'vtc-senlis-cdg',
    title: 'VTC Senlis → CDG',
    metaTitle: 'VTC Senlis CDG — Tarif Fixe Garanti | Chauffeur Privé | Owise',
    metaDesc: 'VTC de Senlis à l\'aéroport CDG. Tarif fixe garanti, suivi de vol, prise en charge à domicile depuis Senlis et environs (Aumont, Fleurines). Disponible 24h/24.',
    keywords: ['vtc senlis cdg','taxi senlis aéroport','chauffeur senlis charles de gaulle','vtc senlis roissy','senlis cdg prix','vtc aumont halatte cdg','chauffeur privé senlis aéroport'],
    h1: 'VTC Senlis → CDG — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Senlis et ses environs (Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Courteuil) jusqu\'à l\'aéroport Charles de Gaulle. Tarif fixe garanti, chauffeur professionnel, suivi de vol en temps réel. Disponible 24h/24.',
    prix: 'dès 69€ vers CDG',
    duree: '45–60 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Senlis à CDG ?', a: 'Le tarif fixe est calculé selon votre adresse précise à Senlis ou dans ses environs. Owise garantit le prix affiché à la réservation — sans compteur, sans surprise. Estimez votre course en 30 secondes sur owise.fr.' },
      { q: 'Combien de temps prend le trajet Senlis → CDG ?', a: 'Environ 45 à 60 minutes depuis Senlis, via l\'A1 (sortie Survilliers ou Roissy). Tôt le matin, comptez 40 à 45 minutes. Senlis est bien desservi par l\'A1 — l\'un des accès les plus rapides vers CDG depuis l\'Oise.' },
      { q: 'Le tarif couvre-t-il Aumont-en-Halatte et Fleurines ?', a: 'Oui. Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Courteuil, Chamant, Pontarmé et toutes les communes dans un rayon de 10 km autour de Senlis sont couvertes. Prise en charge à domicile.' },
      { q: 'Y a-t-il un supplément pour un départ nocturne depuis Senlis ?', a: 'Oui, un supplément de 20% s\'applique pour les départs entre 20h et 6h (supplément nuit), ainsi que les dimanches et jours fériés. Ce supplément est toujours inclus dans l\'estimation affichée sur owise.fr — aucune surprise.' },
      { q: 'Peut-on réserver depuis la gare de Senlis ou le musée de la Chasse ?', a: 'Oui, la prise en charge peut se faire à n\'importe quelle adresse à Senlis — domicile, hôtel, restaurant, site touristique. Il vous suffit de renseigner l\'adresse exacte lors de la réservation.' },
    ],
  },

  'vtc-compiegne-cdg': {
    slug: 'vtc-compiegne-cdg',
    title: 'VTC Compiègne → CDG',
    metaTitle: 'VTC Compiègne CDG — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Compiègne à l\'aéroport CDG. Tarif fixe garanti, prise en charge à domicile depuis Compiègne et Oise Nord. Chauffeur professionnel disponible 24h/24.',
    keywords: ['vtc compiègne cdg','taxi compiègne aéroport','chauffeur compiègne charles de gaulle','vtc compiègne roissy','compiègne cdg prix','vtc margny compiègne cdg','chauffeur privé compiègne aéroport'],
    h1: 'VTC Compiègne → CDG — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Compiègne et l\'Oise Nord (Margny-lès-Compiègne, Venette, Lacroix-Saint-Ouen, Thourotte) jusqu\'à l\'aéroport Charles de Gaulle. Tarif fixe garanti, chauffeur professionnel, suivi de vol inclus. Disponible 24h/24.',
    prix: 'dès 100€ vers CDG',
    duree: '70–90 min',
    faq: [
      { q: 'Quel est le tarif d\'un VTC de Compiègne à CDG ?', a: 'Depuis Compiègne, le tarif vers CDG est calculé à l\'avance et garanti. Owise est l\'une des rares plateformes à proposer un forfait fixe depuis Compiègne — le prix ne change pas selon la circulation. Estimez votre course sur owise.fr.' },
      { q: 'Combien de temps prend le trajet Compiègne → CDG ?', a: 'Environ 70 à 90 minutes via l\'A1. Tôt le matin (avant 6h), comptez 65 à 75 minutes. Depuis Compiègne, l\'accès à l\'A1 se fait par Verberie ou Lacroix-Saint-Ouen.' },
      { q: 'Y a-t-il des alternatives moins chères depuis Compiègne pour aller à CDG ?', a: 'Les bus et navettes collectifs existent mais ont des horaires fixes et des trajets avec arrêts multiples. Le VTC Owise depuis Compiègne offre la prise en charge directe à domicile, à l\'heure voulue, sans correspondance — avec un chauffeur dédié.' },
      { q: 'Le service couvre-t-il Margny-lès-Compiègne et Venette ?', a: 'Oui. Toutes les communes de l\'agglomération de Compiègne sont couvertes : Margny-lès-Compiègne, Venette, Clairoix, Thourotte, Choisy-au-Bac, Lacroix-Saint-Ouen et leurs environs.' },
      { q: 'Peut-on réserver un VTC Compiègne–CDG pour plusieurs personnes ?', a: 'Oui. Owise propose des berlines (jusqu\'à 4 passagers) et des vans 7 places pour les groupes. Réservez le véhicule adapté à votre groupe sur owise.fr.' },
    ],
  },

  'vtc-chantilly-orly': {
    slug: 'vtc-chantilly-orly',
    title: 'VTC Chantilly → Orly',
    metaTitle: 'VTC Chantilly Orly — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Chantilly à l\'aéroport d\'Orly. Tarif fixe garanti, prise en charge à domicile depuis Chantilly et Gouvieux. Chauffeur professionnel disponible 24h/24.',
    keywords: ['vtc chantilly orly','taxi chantilly aéroport orly','chauffeur chantilly orly','chantilly orly prix','vtc gouvieux orly','chauffeur privé chantilly orly','transfert chantilly orly'],
    h1: 'VTC Chantilly → Orly — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Chantilly et Gouvieux jusqu\'à l\'aéroport d\'Orly (ORY). Tarif fixe garanti, chauffeur professionnel, suivi de vol en temps réel. Trajet plus long qu\'à CDG mais entièrement sécurisé — prise en charge à domicile, disponible 24h/24.',
    prix: 'dès 139€ vers Orly',
    duree: '60–80 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Chantilly à Orly ?', a: 'Le tarif depuis Chantilly vers l\'aéroport d\'Orly est de 139€ en berline, prix fixe garanti. Orly est situé au sud de Paris — le trajet depuis Chantilly est plus long qu\'à CDG (environ 60 à 80 minutes), ce qui explique le tarif. Le prix est confirmé avant le départ et ne change pas.' },
      { q: 'Combien de temps prend le trajet Chantilly → Orly ?', a: 'Environ 60 à 80 minutes selon la circulation, en traversant ou en contournant Paris. Tôt le matin (avant 6h), le trajet peut descendre à 55 minutes via la francilienne.' },
      { q: 'Est-il possible d\'aller à Orly depuis Chantilly par l\'A86 ?', a: 'Oui. Selon l\'heure et les conditions de circulation, votre chauffeur choisit l\'itinéraire optimal : A1 + A86, Francilienne, ou via Paris. L\'objectif est toujours d\'arriver à temps pour votre vol.' },
      { q: 'CDG est-il moins cher depuis Chantilly ?', a: 'Oui. CDG est à 59€ depuis Chantilly contre 139€ pour Orly, car CDG est situé directement sur l\'axe Chantilly–Paris, à seulement 40 minutes. Si vous avez le choix de l\'aéroport, CDG est logistiquement et financièrement plus avantageux depuis Chantilly.' },
      { q: 'Proposez-vous aussi le retour Orly → Chantilly ?', a: 'Oui. Le tarif est identique dans les deux sens : 139€ depuis ou vers Orly. Votre chauffeur vous attend dans le hall des arrivées à Orly avec une pancarte à votre nom, au terminal précisé dans votre confirmation.' },
    ],
  },

  'vtc-creil-orly': {
    slug: 'vtc-creil-orly',
    title: 'VTC Creil → Orly',
    metaTitle: 'VTC Creil Orly — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Creil à l\'aéroport d\'Orly. Tarif fixe garanti, prise en charge à domicile depuis Creil et l\'Oise Sud. Chauffeur professionnel disponible 24h/24.',
    keywords: ['vtc creil orly','taxi creil aéroport orly','chauffeur creil orly','creil orly prix','vtc oise orly','chauffeur privé creil orly','transfert creil orly'],
    h1: 'VTC Creil → Orly — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Creil (et Nogent-sur-Oise, Montataire) jusqu\'à l\'aéroport d\'Orly. Tarif fixe garanti en berline, chauffeur habilité, suivi de vol inclus. Prise en charge à votre domicile, disponible 24h/24.',
    prix: 'dès 145€ vers Orly',
    duree: '65–85 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Creil à Orly ?', a: 'Le tarif fixe est de 145€ en berline depuis Creil, Nogent-sur-Oise ou Montataire. Le trajet traverse ou contourne Paris (Orly est au sud) — c\'est la raison de ce tarif. Le prix est garanti à la réservation et ne varie pas.' },
      { q: 'Combien de temps prend le trajet Creil → Orly ?', a: 'Environ 65 à 85 minutes selon la circulation. Tôt le matin (avant 6h), comptez 60 minutes via la Francilienne ou l\'A86. Votre chauffeur choisit l\'itinéraire le plus rapide selon les conditions du moment.' },
      { q: 'Quel aéroport est plus économique depuis Creil : CDG ou Orly ?', a: 'CDG est plus proche et moins cher (65€ contre 145€ pour Orly). Si votre vol vous laisse le choix de l\'aéroport, CDG est nettement plus avantageux depuis Creil — 40 minutes de trajet contre plus d\'une heure pour Orly.' },
      { q: 'Le service couvre-t-il Nogent-sur-Oise et Montataire pour aller à Orly ?', a: 'Oui. La prise en charge est possible depuis Creil, Nogent-sur-Oise, Montataire, Saint-Maximin et toutes les communes voisines. Le tarif varie légèrement selon votre adresse exacte.' },
      { q: 'Proposez-vous le retour Orly → Creil ?', a: 'Oui. Le tarif est identique dans les deux sens. Votre chauffeur vous attend dans le hall des arrivées d\'Orly avec une pancarte nominative, en suivant votre vol en temps réel pour s\'adapter aux retards éventuels.' },
    ],
  },

  'vtc-senlis-orly': {
    slug: 'vtc-senlis-orly',
    title: 'VTC Senlis → Orly',
    metaTitle: 'VTC Senlis Orly — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Senlis à l\'aéroport d\'Orly. Tarif fixe garanti, prise en charge à domicile depuis Senlis et environs. Chauffeur professionnel disponible 24h/24.',
    keywords: ['vtc senlis orly','taxi senlis aéroport orly','chauffeur senlis orly','senlis orly prix','vtc aumont halatte orly','chauffeur privé senlis orly','transfert senlis orly'],
    h1: 'VTC Senlis → Orly — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Senlis et ses environs (Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin) jusqu\'à l\'aéroport d\'Orly. Tarif fixe garanti en berline, chauffeur professionnel, suivi de vol inclus. Disponible 24h/24.',
    prix: 'dès 149€ vers Orly',
    duree: '70–90 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Senlis à Orly ?', a: 'Depuis Senlis, le tarif vers Orly est calculé à l\'avance et garanti. Orly est situé au sud de Paris — le trajet traverse ou contourne Paris, ce qui explique le tarif plus élevé que vers CDG. Estimez votre course sur owise.fr.' },
      { q: 'Combien de temps prend le trajet Senlis → Orly ?', a: 'Environ 70 à 90 minutes selon la circulation. Tôt le matin (avant 6h), comptez 60 à 70 minutes via la Francilienne ou l\'A86. Votre chauffeur sélectionne l\'itinéraire optimal selon les conditions en temps réel.' },
      { q: 'Quel aéroport choisir depuis Senlis : CDG ou Orly ?', a: 'Si votre vol vous laisse le choix, CDG est nettement plus avantageux depuis Senlis — il est situé directement sur l\'axe Senlis-Paris, à 45-60 minutes, contre 70-90 minutes pour Orly et un tarif plus bas. Owise dessert les deux aéroports 24h/24.' },
      { q: 'Le tarif couvre-t-il Aumont-en-Halatte et Fleurines ?', a: 'Oui. Aumont-en-Halatte, Fleurines, Vineuil-Saint-Firmin, Courteuil et toutes les communes proches de Senlis sont couvertes. Le tarif varie légèrement selon votre adresse précise — estimez en 30 secondes sur owise.fr.' },
      { q: 'Proposez-vous le retour Orly → Senlis ?', a: 'Oui. Le tarif est identique dans les deux sens. Votre chauffeur vous attend dans le hall des arrivées d\'Orly avec une pancarte à votre nom, en suivant votre vol en temps réel pour s\'adapter à tout retard.' },
    ],
  },

  'vtc-compiegne-orly': {
    slug: 'vtc-compiegne-orly',
    title: 'VTC Compiègne → Orly',
    metaTitle: 'VTC Compiègne Orly — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Compiègne à l\'aéroport d\'Orly. Tarif fixe garanti, prise en charge à domicile depuis Compiègne et l\'Oise Nord. Chauffeur professionnel disponible 24h/24.',
    keywords: ['vtc compiègne orly','taxi compiègne aéroport orly','chauffeur compiègne orly','compiègne orly prix','vtc margny compiègne orly','chauffeur privé compiègne orly','transfert compiègne orly'],
    h1: 'VTC Compiègne → Orly — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Compiègne (et Margny-lès-Compiègne, Venette, Lacroix-Saint-Ouen) jusqu\'à l\'aéroport d\'Orly. Tarif fixe garanti, chauffeur professionnel, suivi de vol inclus. Disponible 24h/24.',
    prix: 'dès 165€ vers Orly',
    duree: '80–100 min',
    faq: [
      { q: 'Quel est le tarif d\'un VTC de Compiègne à Orly ?', a: 'Depuis Compiègne, le tarif vers Orly est calculé à l\'avance et garanti. Orly est situé au sud de Paris — le trajet depuis Compiègne traverse ou contourne Paris, ce qui représente environ 80 à 100 minutes. Le prix est confirmé avant le départ, sans surprise.' },
      { q: 'Combien de temps prend le trajet Compiègne → Orly ?', a: 'Environ 80 à 100 minutes selon la circulation. Tôt le matin (avant 6h), comptez 70 à 80 minutes. L\'itinéraire passe par l\'A1 puis l\'A86 ou la Francilienne selon les conditions. Votre chauffeur optimise en temps réel.' },
      { q: 'CDG est-il moins cher depuis Compiègne qu\'Orly ?', a: 'Oui. CDG est situé directement sur l\'axe Compiègne–Paris via l\'A1, ce qui le rend plus proche et moins coûteux. Si votre vol vous laisse le choix de l\'aéroport, CDG est logistiquement plus avantageux depuis Compiègne — environ 70 à 90 minutes et un tarif inférieur.' },
      { q: 'Le service couvre-t-il Margny-lès-Compiègne et Venette ?', a: 'Oui. Toutes les communes de l\'agglomération compiégnoise sont couvertes : Margny-lès-Compiègne, Venette, Clairoix, Thourotte, Choisy-au-Bac, Lacroix-Saint-Ouen. Le tarif est calculé depuis votre adresse exacte.' },
      { q: 'Proposez-vous le retour Orly → Compiègne ?', a: 'Oui. Le tarif est identique dans les deux sens. Votre chauffeur vous attend dans le hall des arrivées d\'Orly avec une pancarte à votre nom, en suivant votre vol en temps réel pour s\'adapter aux retards.' },
    ],
  },

  'vtc-chantilly-beauvais': {
    slug: 'vtc-chantilly-beauvais',
    title: 'VTC Chantilly → Beauvais',
    metaTitle: 'VTC Chantilly Beauvais — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Chantilly à l\'aéroport de Beauvais-Tillé. Tarif fixe garanti, prise en charge à domicile depuis Chantilly et Gouvieux. Disponible 24h/24.',
    keywords: ['vtc chantilly beauvais','taxi chantilly aéroport beauvais','chauffeur chantilly beauvais tillé','chantilly beauvais prix','vtc gouvieux beauvais','chauffeur privé chantilly beauvais','transfert chantilly ryanair'],
    h1: 'VTC Chantilly → Beauvais-Tillé — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Chantilly et Gouvieux jusqu\'à l\'aéroport de Beauvais-Tillé (BVA), principal hub Ryanair en Île-de-France. Tarif fixe garanti, chauffeur professionnel, prise en charge à domicile. Disponible 24h/24.',
    prix: 'dès 65€ vers Beauvais',
    duree: '40–55 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Chantilly à l\'aéroport de Beauvais ?', a: 'Le tarif fixe depuis Chantilly vers l\'aéroport de Beauvais-Tillé est estimé dès 65€ en berline. Le prix exact dépend de votre adresse précise et est confirmé avant le départ — sans compteur, sans surprise.' },
      { q: 'Combien de temps prend le trajet Chantilly → Beauvais ?', a: 'Environ 40 à 55 minutes via la N31 ou la D1016. Tôt le matin (avant 6h), comptez 35 à 40 minutes. Beauvais est situé à l\'ouest de Chantilly — le trajet est plus direct que vers CDG ou Orly, sans traverser Paris.' },
      { q: 'Y a-t-il un bus direct Chantilly–Beauvais pour l\'aéroport ?', a: 'Aucune navette directe Chantilly–Beauvais n\'existe. Les navettes Ryanair partent de Paris Beauvais ou de quelques gares RER — avec des horaires contraints et du temps de rabattement. Le VTC Owise part de votre domicile à l\'heure de votre choix, sans correspondance.' },
      { q: 'Le tarif couvre-t-il aussi Gouvieux et Lamorlaye ?', a: 'Oui. La prise en charge est possible depuis Chantilly, Gouvieux, Lamorlaye, Coye-la-Forêt et les communes voisines. Le tarif final est calculé selon votre adresse exacte lors de la réservation.' },
      { q: 'Proposez-vous le retour Beauvais → Chantilly ?', a: 'Oui. Le tarif retour est identique. Votre chauffeur vous attend à l\'aéroport de Beauvais-Tillé avec une pancarte nominative. Pour les vols Ryanair avec des horaires tardifs ou matinaux, Owise est disponible 24h/24.' },
    ],
  },

  'vtc-chambly': {
    slug: 'vtc-chambly',
    title: 'VTC Chambly & Oise Sud-Ouest',
    metaTitle: 'VTC Chambly → CDG, Orly, Paris dès 55€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Chambly, Bornel, Balagny-sur-Thérain et Neuilly-en-Thelle vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc chambly','vtc chambly cdg','chauffeur privé chambly 60230',
      'taxi chambly aéroport','vtc bornel cdg','vtc balagny-sur-thérain',
      'vtc neuilly-en-thelle cdg','chauffeur privé oise sud cdg',
      'vtc chambly orly','transfert chambly aéroport',
    ],
    h1: 'VTC Chambly, Bornel & Oise Sud-Ouest',
    intro: 'Votre chauffeur VTC depuis Chambly et les communes voisines : Bornel, Balagny-sur-Thérain, Neuilly-en-Thelle, Hénonville, Monneville. Chambly se trouve à seulement 38 km de CDG — l\'un des accès les plus directs de l\'Oise vers l\'aéroport. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 55€ vers CDG',
    duree: '30–45 min vers CDG',
    zones: [
      { nom: 'Chambly', cp: '60230', km: 0 },
      { nom: 'Bornel', cp: '60540', km: 4.2 },
      { nom: 'Balagny-sur-Thérain', cp: '60250', km: 6.5 },
      { nom: 'Neuilly-en-Thelle', cp: '60530', km: 7.0 },
      { nom: 'Saint-Crépin-Ibouvillers', cp: '60149', km: 8.5 },
      { nom: 'Hénonville', cp: '60119', km: 9.0 },
      { nom: 'Monneville', cp: '60240', km: 9.5 },
      { nom: 'Persan', cp: '95340', km: 7.0 },
      { nom: 'Creil', cp: '60100', km: 15.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Chambly vers CDG ?', a: 'Chambly est à seulement 38 km de CDG — l\'un des trajets les plus courts depuis l\'Oise. Le forfait Owise depuis Chambly vers CDG est estimé dès 55€ en berline, prix fixe garanti. Le tarif exact depuis votre adresse s\'obtient en quelques secondes sur owise.fr.' },
      { q: 'Combien de temps pour aller de Chambly à CDG ?', a: 'Entre 30 et 45 minutes selon la circulation, via la D1001 ou l\'A15. Tôt le matin (avant 6h), le trajet est souvent inférieur à 30 minutes. Chambly offre un accès rapide et direct vers CDG, sans traverser Paris.' },
      { q: 'Desservez-vous Bornel, Balagny et Neuilly-en-Thelle ?', a: 'Oui. Toutes les communes autour de Chambly sont couvertes : Bornel, Balagny-sur-Thérain, Neuilly-en-Thelle, Saint-Crépin-Ibouvillers, Hénonville, Monneville et Persan. Prise en charge directement à votre domicile.' },
      { q: 'Proposez-vous des courses vers Orly depuis Chambly ?', a: 'Oui. Le forfait Chambly → Orly est estimé entre 75 et 90€ en berline. Le trajet prend 50 à 65 minutes selon la circulation. Tous les aéroports parisiens (CDG, Orly, Beauvais) sont desservis.' },
      { q: 'Le service est-il disponible très tôt le matin ?', a: 'Absolument. Owise est disponible 24h/24, 7j/7. Pour les départs avant 6h, le supplément nuit (+20%) est automatiquement inclus dans votre estimation — aucune surprise à la réservation.' },
    ],
  },

  'vtc-meru': {
    slug: 'vtc-meru',
    title: 'VTC Méru & Oise Ouest',
    metaTitle: 'VTC Méru → CDG, Beauvais, Paris dès 80€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Méru, Noailles, Saint-Crépin-Ibouvillers et l\'Oise Ouest vers CDG, Beauvais et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc méru','vtc méru cdg','chauffeur privé méru 60110',
      'taxi méru aéroport','vtc noailles beauvais','vtc méru paris',
      'chauffeur privé oise ouest','vtc méru orly','transfert méru cdg',
      'vtc 60110 aéroport',
    ],
    h1: 'VTC Méru, Noailles & Oise Ouest',
    intro: 'Votre chauffeur VTC depuis Méru et les communes de l\'Oise Ouest : Noailles, Saint-Crépin-Ibouvillers, Bornel, Hénonville, Puiseux-en-Bray. Méru est idéalement situé entre Cergy-Pontoise et Beauvais — 35 km seulement de l\'aéroport Beauvais-Tillé (Ryanair). Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 80€ vers CDG',
    duree: '40–55 min vers CDG',
    zones: [
      { nom: 'Méru', cp: '60110', km: 0 },
      { nom: 'Noailles', cp: '60430', km: 7.0 },
      { nom: 'Saint-Crépin-Ibouvillers', cp: '60149', km: 8.0 },
      { nom: 'Bornel', cp: '60540', km: 9.5 },
      { nom: 'Hénonville', cp: '60119', km: 10.0 },
      { nom: 'Puiseux-en-Bray', cp: '60850', km: 11.0 },
      { nom: 'Labosse', cp: '60590', km: 12.0 },
      { nom: 'Chambly', cp: '60230', km: 14.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Méru vers l\'aéroport de Beauvais ?', a: 'Méru est à seulement 35 km de Beauvais-Tillé, hub Ryanair. Le forfait Owise depuis Méru vers Beauvais est estimé dès 55€ en berline. C\'est l\'un des trajets les plus directs depuis l\'Oise Ouest — aucune correspondance, prise en charge à domicile, disponible 24h/24.' },
      { q: 'Combien de temps pour aller de Méru à CDG ?', a: 'Environ 40 à 55 minutes via la D1001 ou la N184 puis l\'A15. Depuis Méru, CDG est accessible sans traverser Paris. Le matin tôt, comptez 35 à 45 minutes.' },
      { q: 'Desservez-vous Noailles et Saint-Crépin-Ibouvillers ?', a: 'Oui. Toutes les communes de l\'Oise Ouest autour de Méru sont couvertes : Noailles, Saint-Crépin-Ibouvillers, Bornel, Hénonville, Puiseux-en-Bray, Labosse. Prise en charge directement à votre adresse.' },
      { q: 'Proposez-vous des courses vers Orly depuis Méru ?', a: 'Oui. Le forfait Méru → Orly est estimé entre 85 et 100€ en berline. Le trajet prend 55 à 70 minutes. Les trois aéroports parisiens (CDG, Orly, Beauvais) sont desservis depuis Méru.' },
      { q: 'Le VTC est-il la meilleure option depuis Méru pour aller à Beauvais ?', a: 'Pour l\'aéroport de Beauvais-Tillé (Ryanair, Wizzair), le VTC Owise est la solution la plus directe depuis Méru. Aucun bus aéroport ne dessert l\'Oise Ouest — le VTC part de chez vous, sans correspondance, en 30 à 40 minutes.' },
    ],
  },

  'vtc-verberie': {
    slug: 'vtc-verberie',
    title: 'VTC Verberie & Vallée de l\'Oise',
    metaTitle: 'VTC Verberie → CDG, Orly, Paris dès 95€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Verberie, Longueil-Sainte-Marie, Saint-Vaast-de-Longmont et la vallée de l\'Oise vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24.',
    keywords: [
      'vtc verberie','vtc verberie cdg','chauffeur privé verberie 60410',
      'taxi verberie aéroport','vtc longueil-sainte-marie cdg','vtc vallée de l\'oise',
      'chauffeur privé oise nord','vtc verberie paris','transfert verberie cdg',
      'vtc 60410 aéroport',
    ],
    h1: 'VTC Verberie, Longueil-Sainte-Marie & Vallée de l\'Oise',
    intro: 'Votre chauffeur VTC depuis Verberie et les communes de la vallée de l\'Oise entre Senlis et Compiègne : Longueil-Sainte-Marie, Saint-Vaast-de-Longmont, Roberval, Rhuis et Pont-Sainte-Maxence. Tarif fixe garanti vers CDG, Orly et Paris. Disponible 24h/24.',
    prix: 'dès 95€ vers CDG',
    duree: '55–70 min vers CDG',
    zones: [
      { nom: 'Verberie', cp: '60410', km: 0 },
      { nom: 'Longueil-Sainte-Marie', cp: '60126', km: 5.5 },
      { nom: 'Saint-Vaast-de-Longmont', cp: '60410', km: 4.0 },
      { nom: 'Roberval', cp: '60410', km: 3.0 },
      { nom: 'Rhuis', cp: '60410', km: 4.5 },
      { nom: 'Pont-Sainte-Maxence', cp: '60700', km: 6.0 },
      { nom: 'Bétisy-Saint-Pierre', cp: '60319', km: 5.5 },
      { nom: 'Senlis', cp: '60300', km: 18.0 },
      { nom: 'Compiègne', cp: '60200', km: 20.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Verberie vers CDG ?', a: 'Le forfait Owise depuis Verberie vers CDG est estimé dès 95€ en berline, prix fixe garanti. Verberie est à 72 km de CDG via l\'A1 ou la Francilienne. Le tarif exact depuis votre adresse s\'obtient sur owise.fr en quelques secondes.' },
      { q: 'Combien de temps pour aller de Verberie à CDG ?', a: 'Environ 55 à 70 minutes selon la circulation, via la D130 puis l\'A1. Tôt le matin (avant 6h), le trajet descend à 45 à 55 minutes. Le passage par Senlis ou par la Francilienne permet d\'éviter les bouchons parisiens.' },
      { q: 'Desservez-vous Longueil-Sainte-Marie et Pont-Sainte-Maxence ?', a: 'Oui. Longueil-Sainte-Marie, Saint-Vaast-de-Longmont, Roberval, Rhuis, Bétisy-Saint-Pierre et Pont-Sainte-Maxence sont dans notre zone de desserte. Prise en charge directement à votre adresse, 24h/24.' },
      { q: 'Proposez-vous des courses vers Paris depuis Verberie ?', a: 'Oui. Le forfait Verberie → Paris est estimé entre 85 et 100€ en berline. Nous déposons à votre adresse exacte à Paris, que ce soit gare, hôtel ou domicile.' },
      { q: 'Desservez-vous la zone entre Senlis et Compiègne ?', a: 'Oui. Nous couvrons toute la vallée de l\'Oise entre Senlis et Compiègne : Verberie, Longueil-Sainte-Marie, Lacroix-Saint-Ouen, Saint-Vaast-de-Longmont, Roberval et les communes riveraines. Un seul chauffeur pour tout le secteur.' },
    ],
  },

  'vtc-noyon': {
    slug: 'vtc-noyon',
    title: 'VTC Noyon & Oise Nord',
    metaTitle: 'VTC Noyon → CDG, Orly, Paris dès 165€ | Chauffeur Privé | Owise',
    metaDesc: 'Chauffeur VTC depuis Noyon, Ribécourt-Dreslincourt, Sempigny et l\'Oise Nord vers CDG, Orly et Paris. Tarif fixe garanti, disponible 24h/24. Réservation en ligne.',
    keywords: [
      'vtc noyon','vtc noyon cdg','chauffeur privé noyon 60400',
      'taxi noyon aéroport','vtc noyon paris','vtc oise nord cdg',
      'vtc ribécourt dreslincourt','vtc guiscard oise','chauffeur privé noyon',
      'vtc 60400 aéroport cdg',
    ],
    h1: 'VTC Noyon & Oise Nord — Transferts Aéroport',
    intro: 'Votre chauffeur VTC depuis Noyon et les communes du nord de l\'Oise : Ribécourt-Dreslincourt, Sempigny, Pont-l\'Évêque, Guiscard, Salency. Noyon, ancienne cité épiscopale, est à 120 km de CDG — un trajet long en transports en commun, mais confortable et direct en VTC. Tarif fixe garanti, disponible 24h/24.',
    prix: 'dès 165€ vers CDG',
    duree: '80–100 min vers CDG',
    zones: [
      { nom: 'Noyon', cp: '60400', km: 0 },
      { nom: 'Sempigny', cp: '60400', km: 3.5 },
      { nom: 'Pont-l\'Évêque', cp: '60400', km: 5.0 },
      { nom: 'Ribécourt-Dreslincourt', cp: '60170', km: 7.0 },
      { nom: 'Cuts', cp: '60400', km: 6.5 },
      { nom: 'Salency', cp: '60400', km: 5.5 },
      { nom: 'Guiscard', cp: '60640', km: 14.0 },
      { nom: 'Lassigny', cp: '60310', km: 17.0 },
    ],
    faq: [
      { q: 'Quel est le tarif depuis Noyon vers CDG ?', a: 'Le forfait Owise depuis Noyon vers CDG est estimé dès 165€ en berline, prix fixe garanti. Noyon est à 120 km de CDG — un trajet qui nécessiterait plusieurs correspondances en transport en commun. En VTC, vous partez directement de chez vous, sans escale.' },
      { q: 'Combien de temps pour aller de Noyon à CDG ?', a: 'Entre 80 et 100 minutes selon la circulation, via la N32 puis l\'A1. Tôt le matin (avant 6h), sans trafic, le trajet peut se faire en 70 à 80 minutes. Votre chauffeur est ponctuel et calculé pour votre heure de vol.' },
      { q: 'Desservez-vous Ribécourt-Dreslincourt, Sempigny et Guiscard ?', a: 'Oui. Toutes les communes du secteur de Noyon sont couvertes : Ribécourt-Dreslincourt, Sempigny, Pont-l\'Évêque, Cuts, Salency, Guiscard, Lassigny. Prise en charge à domicile, disponible 24h/24.' },
      { q: 'Proposez-vous des courses vers Orly depuis Noyon ?', a: 'Oui. Le forfait Noyon → Orly est estimé entre 190 et 220€ en berline. Le trajet vers Orly, au sud de Paris, est un peu plus long que vers CDG. Nous desservons les trois aéroports parisiens depuis Noyon.' },
      { q: 'Quel est l\'avantage du VTC depuis Noyon par rapport aux transports en commun ?', a: 'Depuis Noyon, rejoindre CDG en transports en commun nécessite Noyon → Compiègne en TER, puis RER B ou navette — avec des horaires limités tôt le matin. En VTC Owise, vous partez de chez vous à l\'heure exacte, sans correspondance, et arrivez directement au terminal.' },
    ],
  },

  'vtc-creil-beauvais': {
    slug: 'vtc-creil-beauvais',
    title: 'VTC Creil → Beauvais',
    metaTitle: 'VTC Creil Beauvais — Tarif Fixe Garanti | Owise',
    metaDesc: 'VTC de Creil à l\'aéroport de Beauvais-Tillé. Tarif fixe garanti, prise en charge à domicile depuis Creil et l\'Oise Sud. Chauffeur professionnel disponible 24h/24.',
    keywords: ['vtc creil beauvais','taxi creil aéroport beauvais','chauffeur creil beauvais tillé','creil beauvais prix','vtc nogent oise beauvais','chauffeur privé creil beauvais','transfert creil ryanair'],
    h1: 'VTC Creil → Beauvais-Tillé — Tarif Fixe Garanti',
    intro: 'Votre transfert VTC depuis Creil (et Nogent-sur-Oise, Montataire, Saint-Maximin) jusqu\'à l\'aéroport de Beauvais-Tillé, hub Ryanair. Tarif fixe garanti, chauffeur habilité, prise en charge à domicile. Disponible 24h/24.',
    prix: 'dès 65€ vers Beauvais',
    duree: '45–60 min',
    faq: [
      { q: 'Quel est le prix d\'un VTC de Creil à l\'aéroport de Beauvais ?', a: 'Le tarif fixe depuis Creil vers l\'aéroport de Beauvais-Tillé est estimé dès 65€ en berline depuis Creil, Nogent-sur-Oise ou Montataire. Le prix exact est confirmé avant le départ selon votre adresse précise.' },
      { q: 'Combien de temps prend le trajet Creil → Beauvais ?', a: 'Environ 45 à 60 minutes selon les conditions, via la N31 ou la D1016. Beauvais est à l\'ouest de Creil — le trajet est direct, sans traverser Paris, ce qui le rend plus prévisible que vers CDG ou Orly.' },
      { q: 'Peut-on aller à Beauvais-Tillé en train depuis Creil ?', a: 'Aucune liaison ferroviaire directe n\'existe entre Creil et Beauvais pour l\'aéroport. Les alternatives (bus Ryanair depuis Paris, RER puis correspondance) nécessitent plusieurs heures de trajet total. Le VTC Owise part directement de votre adresse en 45-60 minutes.' },
      { q: 'Le service couvre-t-il Nogent-sur-Oise et Montataire ?', a: 'Oui. Creil, Nogent-sur-Oise, Montataire, Saint-Maximin, Laigneville et leurs environs sont dans la zone de desserte. Le tarif est calculé depuis votre adresse exacte.' },
      { q: 'Proposez-vous le retour Beauvais → Creil ?', a: 'Oui. Le tarif retour est identique. Pour les vols Ryanair dont les horaires sont souvent très tôt le matin ou tard le soir, Owise est disponible 24h/24 — votre chauffeur sera là, quelle que soit l\'heure d\'arrivée.' },
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
      images: [{ url: `${BASE}/brand_assets/hero-car.webp`, width: 1672, height: 941, alt: dest.title }],
    },
    twitter: {
      card: 'summary_large_image',
      title: dest.metaTitle,
      description: dest.metaDesc,
      images: [`${BASE}/brand_assets/hero-car.webp`],
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
    admin.from('parametres').select('coef_berline_premium,coef_van,supplement_nuit,supplement_weekend,tarif_pec_actif,tarif_frais_pec,supplement_bagages_actif,supplement_bagages_prix,supplement_panneau_actif,supplement_panneau_prix,supplement_animaux_actif,supplement_animaux_prix,supplement_siege_enfant_actif,supplement_siege_enfant_prix').single(),
  ])

  const BASE = 'https://www.owise.fr'

  // Extraire le prix numérique depuis dest.prix (ex: "dès 59€ vers CDG" → "59")
  const prixMatch = dest.prix.match(/(\d+)/)
  const prixNum = prixMatch ? prixMatch[1] : null

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': ['LocalBusiness', 'TaxiService'],
    name: 'Owise — Chauffeur Privé VTC',
    description: dest.metaDesc,
    url: `${BASE}/${dest.slug}`,
    telephone: '+33619106356',
    areaServed: dest.zones && dest.zones.length > 0
      ? dest.zones.map(z => ({ '@type': 'City', name: z.nom, postalCode: z.cp }))
      : [{ '@type': 'City', name: dest.title.replace(/VTC\s+/, '').split(' &')[0] }],
    makesOffer: {
      '@type': 'Offer',
      priceCurrency: 'EUR',
      description: dest.prix,
      name: dest.title,
      ...(prixNum ? { price: prixNum, priceSpecification: { '@type': 'PriceSpecification', price: prixNum, priceCurrency: 'EUR', description: `Tarif fixe ${dest.title}` } } : {}),
    },
    potentialAction: {
      '@type': 'ReserveAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${BASE}/reserver` },
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: '5',
      reviewCount: '5',
      bestRating: '5',
      worstRating: '1',
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

  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: dest.faq.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
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

      <VitrineBody tarifs={tarifs ?? []} zones={zones ?? []} grille={grille ?? []} params={tarifParams} heroTitle={dest.h1} />

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
              {dest.zones.map((z, i) => {
                const lienSlug = NOM_VERS_SLUG[z.nom]
                const hasLink = lienSlug && lienSlug !== dest.slug
                const inner = (
                  <>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: hasLink ? '#C9A84C' : '#0A0A0A' }}>{z.nom}</div>
                      <div style={{ fontSize: 10, color: '#999', marginTop: 1 }}>{z.cp}</div>
                    </div>
                    <div style={{ fontSize: 10, color: '#C9A84C', fontWeight: 600, fontFamily: 'monospace' }}>{z.km === 0 ? 'centre' : `${z.km} km`}</div>
                  </>
                )
                return hasLink
                  ? <Link key={i} href={`/${lienSlug}`} style={{ background: '#F7F7F7', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', textDecoration: 'none', border: '1px solid rgba(201,168,76,.18)' }}>{inner}</Link>
                  : <div key={i} style={{ background: '#F7F7F7', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{inner}</div>
              })}
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

      {/* Avis clients */}
      <section style={{ background: '#09091A', padding: '56px 24px' }}>
        <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A84C', marginBottom: 12 }}>
            Avis clients
          </div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 34, fontWeight: 500, color: '#EDE8DF', margin: '0 0 8px' }}>
            Ils nous font confiance
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 40 }}>
            <span style={{ fontSize: 22, letterSpacing: 2, color: '#C9A84C' }}>★★★★★</span>
            <span style={{ fontSize: 14, color: '#848499' }}>
              <span style={{ color: '#EDE8DF', fontWeight: 600 }}>5 / 5</span>
              {' · '}4 avis Google vérifiés
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', marginBottom: 40 }}>
            {[
              { text: 'Service de transport très professionnel, ponctuel et sérieux. Tout s\'est très bien passé du début à la fin. Je recommande sans hésiter !', auteur: 'Nabila B.' },
              { text: 'Très bonne prestation, chauffeur ponctuel et serviable.', auteur: 'Joëlle P.' },
              { text: 'Excellentes prestations. Ponctualité. À recommander.', auteur: 'Michèle M.' },
              { text: 'Impeccable, un service au top.', auteur: 'Khacim D.' },
            ].map((avis, i) => (
              <div key={i} style={{
                background: '#111128', borderRadius: 12, padding: '22px 24px',
                border: '1px solid rgba(201,168,76,.1)',
                maxWidth: 260, textAlign: 'left', flex: '1 1 220px',
              }}>
                <div style={{ fontSize: 14, color: '#C9A84C', marginBottom: 10, letterSpacing: 1 }}>★★★★★</div>
                <p style={{ fontSize: 13, color: '#EDE8DF', lineHeight: 1.7, margin: '0 0 14px' }}>&ldquo;{avis.text}&rdquo;</p>
                <div style={{ fontSize: 11, color: '#848499' }}>{avis.auteur} · Google</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://g.page/r/CY0-ORyXWwpXEAE/review"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', background: '#C9A84C', color: '#09091A',
                textDecoration: 'none', padding: '12px 28px', borderRadius: 8,
                fontSize: 13, fontWeight: 700,
              }}
            >
              Laisser un avis →
            </a>
            <a
              href="https://www.google.com/maps/search/?api=1&query=Owise+VTC"
              target="_blank" rel="noopener noreferrer"
              style={{
                display: 'inline-block', background: 'transparent', color: '#EDE8DF',
                textDecoration: 'none', padding: '12px 28px', borderRadius: 8,
                fontSize: 13, fontWeight: 500,
                border: '1px solid rgba(237,232,223,.15)',
              }}
            >
              Voir tous les avis
            </a>
          </div>
        </div>
      </section>
    </>
  )
}
