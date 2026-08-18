// Génération de contenu blog basée sur les données réelles Owise

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

type Sujet = {
  id: string
  type: 'transfert' | 'guide' | 'conseils' | 'entreprise' | 'comparatif'
  depart?: string
  arrivee?: string
  theme?: string
}

export const SUJETS: Sujet[] = [
  // Transferts aéroport depuis communes Oise
  { id: 'creil-cdg',          type: 'transfert', depart: 'Creil',               arrivee: 'CDG'         },
  { id: 'senlis-cdg',         type: 'transfert', depart: 'Senlis',              arrivee: 'CDG'         },
  { id: 'chantilly-cdg',      type: 'transfert', depart: 'Chantilly',           arrivee: 'CDG'         },
  { id: 'gouvieux-cdg',       type: 'transfert', depart: 'Gouvieux',            arrivee: 'CDG'         },
  { id: 'lamorlaye-cdg',      type: 'transfert', depart: 'Lamorlaye',           arrivee: 'CDG'         },
  { id: 'compiegne-cdg',      type: 'transfert', depart: 'Compiègne',           arrivee: 'CDG'         },
  { id: 'saint-maximin-cdg',  type: 'transfert', depart: 'Saint-Maximin',       arrivee: 'CDG'         },
  { id: 'nogent-cdg',         type: 'transfert', depart: 'Nogent-sur-Oise',     arrivee: 'CDG'         },
  { id: 'montataire-cdg',     type: 'transfert', depart: 'Montataire',          arrivee: 'CDG'         },
  { id: 'pont-maxence-cdg',   type: 'transfert', depart: 'Pont-Sainte-Maxence', arrivee: 'CDG'         },
  { id: 'creil-orly',         type: 'transfert', depart: 'Creil',               arrivee: 'Orly'        },
  { id: 'chantilly-orly',     type: 'transfert', depart: 'Chantilly',           arrivee: 'Orly'        },
  { id: 'senlis-orly',        type: 'transfert', depart: 'Senlis',              arrivee: 'Orly'        },
  { id: 'compiegne-orly',     type: 'transfert', depart: 'Compiègne',           arrivee: 'Orly'        },
  { id: 'gouvieux-orly',      type: 'transfert', depart: 'Gouvieux',            arrivee: 'Orly'        },
  { id: 'creil-beauvais',     type: 'transfert', depart: 'Creil',               arrivee: 'Beauvais'    },
  { id: 'senlis-beauvais',    type: 'transfert', depart: 'Senlis',              arrivee: 'Beauvais'    },
  { id: 'chantilly-beauvais', type: 'transfert', depart: 'Chantilly',           arrivee: 'Beauvais'    },
  { id: 'compiegne-beauvais', type: 'transfert', depart: 'Compiègne',           arrivee: 'Beauvais'    },
  { id: 'paris-creil',        type: 'transfert', depart: 'Paris',               arrivee: 'Creil'       },
  { id: 'paris-chantilly',    type: 'transfert', depart: 'Paris',               arrivee: 'Chantilly'   },
  { id: 'paris-senlis',       type: 'transfert', depart: 'Paris',               arrivee: 'Senlis'      },
  { id: 'cdg-chantilly',      type: 'transfert', depart: 'CDG',                 arrivee: 'Chantilly'   },
  { id: 'cdg-paris',          type: 'transfert', depart: 'CDG',                 arrivee: 'Paris'       },
  { id: 'orly-paris',         type: 'transfert', depart: 'Orly',               arrivee: 'Paris'       },
  // Guides locaux
  { id: 'guide-hippodrome-chantilly', type: 'guide', theme: "Hippodrome de Chantilly"          },
  { id: 'guide-chateau-chantilly',    type: 'guide', theme: "Château de Chantilly"             },
  { id: 'guide-prix-diane',           type: 'guide', theme: "Prix de Diane Longines"           },
  { id: 'guide-prix-jockey-club',     type: 'guide', theme: "Prix du Jockey Club"             },
  { id: 'guide-foret-compiegne',      type: 'guide', theme: "Forêt de Compiègne"              },
  { id: 'guide-senlis-medieval',      type: 'guide', theme: "Vieille ville de Senlis"         },
  { id: 'guide-aeroport-cdg',         type: 'guide', theme: "Aéroport Paris CDG"              },
  { id: 'guide-aeroport-orly',        type: 'guide', theme: "Aéroport Paris Orly"             },
  { id: 'guide-aeroport-beauvais',    type: 'guide', theme: "Aéroport Beauvais-Tillé"         },
  // Conseils pratiques
  { id: 'conseils-vol-nuit',          type: 'conseils', theme: "vol de nuit ou tôt le matin"          },
  { id: 'conseils-vol-retarde',       type: 'conseils', theme: "vol retardé"                          },
  { id: 'conseils-bagage-volumineux', type: 'conseils', theme: "bagages volumineux"                   },
  { id: 'conseils-voyage-famille',    type: 'conseils', theme: "voyage en famille avec enfants"        },
  { id: 'conseils-reservation-avance',type: 'conseils', theme: "réservation à l'avance"              },
  { id: 'conseils-trajet-professionnel', type: 'conseils', theme: "trajet professionnel"              },
  { id: 'conseils-nuit-supplementaire', type: 'conseils', theme: "supplément nuit VTC"               },
  { id: 'conseils-animaux',           type: 'conseils', theme: "transport avec animaux"               },
  { id: 'conseils-van-groupe',        type: 'conseils', theme: "déplacement en groupe (van 7 places)" },
  { id: 'conseils-weekend',           type: 'conseils', theme: "week-end en Île-de-France et Oise"    },
  // Entreprises
  { id: 'entreprise-creil',           type: 'entreprise', theme: "Creil et Oise Sud"                            },
  { id: 'entreprise-compiegne',       type: 'entreprise', theme: "Compiègne et Oise Nord"                       },
  { id: 'entreprise-chantilly',       type: 'entreprise', theme: "Chantilly et secteur hippodrome"              },
  { id: 'entreprise-seminaire',       type: 'entreprise', theme: "séminaires et événements d'entreprise"        },
  { id: 'entreprise-facturation',     type: 'entreprise', theme: "facturation mensuelle compte entreprise"      },
  // Comparatifs
  { id: 'comparatif-vtc-taxi-cdg',    type: 'comparatif', theme: "VTC vs taxi pour CDG depuis l'Oise"          },
  { id: 'comparatif-vtc-train-paris', type: 'comparatif', theme: "VTC vs train Paris depuis Creil/Senlis"      },
  { id: 'comparatif-tarif-fixe',      type: 'comparatif', theme: "tarif fixe VTC vs compteur taxi"             },
  { id: 'comparatif-uber-vtc',        type: 'comparatif', theme: "VTC traditionnel vs application mobile"      },
  { id: 'comparatif-nuit-tarifs',     type: 'comparatif', theme: "tarifs VTC de nuit vs jour"                  },
  { id: 'creil-liaisons-gares',       type: 'transfert', depart: 'Creil',               arrivee: 'Gare du Nord' },
  { id: 'chantilly-gare-nord',        type: 'transfert', depart: 'Chantilly',           arrivee: 'Gare du Nord' },
  { id: 'senlis-gare-nord',           type: 'transfert', depart: 'Senlis',              arrivee: 'Gare du Nord' },
  { id: 'saint-leu-cdg',             type: 'transfert', depart: "Saint-Leu-d'Esserent", arrivee: 'CDG'         },
  { id: 'verneuil-cdg',              type: 'transfert', depart: 'Verneuil-en-Halatte',  arrivee: 'CDG'         },
  { id: 'liancourt-cdg',             type: 'transfert', depart: 'Liancourt',            arrivee: 'CDG'         },
  // Nouvelles destinations 2026
  { id: 'pontoise-cdg',              type: 'transfert', depart: 'Pontoise',   arrivee: 'CDG'   },
  { id: 'pontoise-orly',             type: 'transfert', depart: 'Pontoise',   arrivee: 'Orly'  },
  { id: 'cergy-cdg',                 type: 'transfert', depart: 'Cergy',      arrivee: 'CDG'   },
  { id: 'versailles-cdg',            type: 'transfert', depart: 'Versailles', arrivee: 'CDG'   },
  { id: 'versailles-orly',           type: 'transfert', depart: 'Versailles', arrivee: 'Orly'  },
  { id: 'lamorlaye-orly',            type: 'transfert', depart: 'Lamorlaye', arrivee: 'Orly'  },
  { id: 'lamorlaye-beauvais',        type: 'transfert', depart: 'Lamorlaye', arrivee: 'Beauvais' },
  { id: 'guide-chateau-versailles',  type: 'guide', theme: "Château de Versailles et Domaine Royal" },
  { id: 'guide-pontoise-val-oise',   type: 'guide', theme: "Pontoise et Cergy-Pontoise"             },
  { id: 'entreprise-versailles',     type: 'entreprise', theme: "Versailles et les Yvelines"        },
]

// ── Données de référence ──────────────────────────────────────────────────

const AIRPORTS: Record<string, { nom: string; code: string; desc: string }> = {
  CDG:      { nom: 'Paris Charles de Gaulle (CDG)', code: 'CDG', desc: 'le plus grand aéroport de France, desservant 200+ destinations mondiales' },
  Orly:     { nom: 'Paris Orly (ORY)', code: 'ORY', desc: 'le deuxième aéroport de Paris, idéal pour les vols court et moyen-courriers' },
  Beauvais: { nom: 'Beauvais-Tillé (BVA)', code: 'BVA', desc: 'hub des compagnies low-cost Ryanair et Wizzair' },
}

const COMMUNES: Record<string, { zone: string; dist_cdg: number; desc: string }> = {
  'Creil':                { zone: 'Oise Sud',    dist_cdg: 60, desc: 'ville industrielle et résidentielle de l\'Oise, bien desservie par le TER Picardie' },
  'Senlis':               { zone: 'Oise Sud',    dist_cdg: 40, desc: 'cité médiévale classée, porte de la forêt de Compiègne et de la plaine de France' },
  'Chantilly':            { zone: 'Oise Sud',    dist_cdg: 40, desc: 'ville du cheval et du château, célèbre pour son hippodrome international et son musée Condé' },
  'Gouvieux':             { zone: 'Oise Sud',    dist_cdg: 43, desc: 'commune résidentielle à l\'entrée de la forêt de Chantilly, à deux pas de l\'hippodrome' },
  'Lamorlaye':            { zone: 'Oise Sud',    dist_cdg: 45, desc: 'commune de l\'Oise à proximité directe de Chantilly et de ses centres d\'entraînement équestres' },
  'Compiègne':            { zone: 'Oise Nord',   dist_cdg: 90, desc: 'ville royale historique, connue pour son château impérial et sa vaste forêt nationale' },
  'Saint-Maximin':        { zone: 'Oise Sud',    dist_cdg: 55, desc: 'commune de l\'Oise entre Creil et Senlis, à l\'écart des grands axes' },
  'Nogent-sur-Oise':      { zone: 'Oise Sud',    dist_cdg: 62, desc: 'commune adjacente à Creil, en bord d\'Oise, dans l\'agglomération creilloise' },
  'Montataire':           { zone: 'Oise Sud',    dist_cdg: 62, desc: 'commune de l\'agglomération creilloise, entre Creil et Laigneville' },
  'Pont-Sainte-Maxence':  { zone: 'Oise Sud',    dist_cdg: 65, desc: 'commune de l\'Oise au bord de la rivière, entre Senlis et Compiègne' },
  "Saint-Leu-d'Esserent": { zone: 'Oise Sud',   dist_cdg: 50, desc: 'commune de l\'Oise proche de Creil, connue pour ses carrières de pierre calcaire' },
  'Verneuil-en-Halatte':  { zone: 'Oise Sud',    dist_cdg: 55, desc: 'commune boisée de l\'Oise, proche de Senlis et du Parc Astérix' },
  'Liancourt':            { zone: 'Oise Sud',    dist_cdg: 58, desc: 'commune de l\'Oise entre Creil et Compiègne, ancienne ville thermale' },
  'Paris':                { zone: 'Paris',        dist_cdg: 30, desc: '' },
  'CDG':                  { zone: 'Aéroport',    dist_cdg:  0, desc: 'Aéroport Paris Charles de Gaulle' },
  'Orly':                 { zone: 'Aéroport',    dist_cdg: 35, desc: 'Aéroport Paris Orly' },
  'Gare du Nord':         { zone: 'Gare',        dist_cdg: 27, desc: 'principale gare internationale de Paris, terminus Eurostar et Thalys' },
  'Pontoise':             { zone: 'Val-d\'Oise', dist_cdg: 38, desc: 'préfecture du Val-d\'Oise (95), à la confluence de l\'Oise et de la Viosne' },
  'Cergy':                { zone: 'Val-d\'Oise', dist_cdg: 38, desc: 'ville nouvelle de Cergy-Pontoise, pôle économique du Val-d\'Oise' },
  'Versailles':           { zone: 'Yvelines',    dist_cdg: 55, desc: 'préfecture des Yvelines, célèbre pour son Château Royal classé UNESCO et son domaine de 800 hectares' },
}

// ── Distances réelles par itinéraire (km) ─────────────────────────────────
// Valeurs vérifiées — on évite de tout dériver de dist_cdg qui n'est valable
// que pour les routes vers CDG.

const DISTANCES: Record<string, number> = {
  // Paris ↔ aéroports
  'Paris-CDG': 30,       'CDG-Paris': 30,
  'Paris-Orly': 22,      'Orly-Paris': 22,
  'Paris-Beauvais': 88,  'Beauvais-Paris': 88,
  // Paris ↔ villes Oise
  'Paris-Senlis': 52,    'Senlis-Paris': 52,
  'Paris-Chantilly': 50, 'Chantilly-Paris': 50,
  'Paris-Creil': 62,     'Creil-Paris': 62,
  'Paris-Compiègne': 82, 'Compiègne-Paris': 82,
  'Paris-Gouvieux': 53,  'Gouvieux-Paris': 53,
  // Paris ↔ gares
  'Paris-Gare du Nord': 5, 'Gare du Nord-Paris': 5,
  // Creil
  'Creil-CDG': 60,       'CDG-Creil': 60,
  'Creil-Orly': 92,      'Orly-Creil': 92,
  'Creil-Beauvais': 55,  'Beauvais-Creil': 55,
  'Creil-Gare du Nord': 68,
  // Senlis
  'Senlis-CDG': 40,      'CDG-Senlis': 40,
  'Senlis-Orly': 78,     'Orly-Senlis': 78,
  'Senlis-Beauvais': 74, 'Beauvais-Senlis': 74,
  'Senlis-Gare du Nord': 58,
  // Chantilly
  'Chantilly-CDG': 40,      'CDG-Chantilly': 40,
  'Chantilly-Orly': 75,     'Orly-Chantilly': 75,
  'Chantilly-Beauvais': 65, 'Beauvais-Chantilly': 65,
  'Chantilly-Gare du Nord': 52,
  // Gouvieux
  'Gouvieux-CDG': 43,   'Gouvieux-Orly': 78,
  // Lamorlaye
  'Lamorlaye-CDG': 45,  'Lamorlaye-Orly': 80, 'Lamorlaye-Beauvais': 68,
  // Compiègne
  'Compiègne-CDG': 92,      'CDG-Compiègne': 92,
  'Compiègne-Orly': 112,    'Orly-Compiègne': 112,
  'Compiègne-Beauvais': 80, 'Beauvais-Compiègne': 80,
  // Autres communes Oise
  'Saint-Maximin-CDG': 55,
  'Nogent-sur-Oise-CDG': 62,
  'Montataire-CDG': 62,
  'Pont-Sainte-Maxence-CDG': 65, 'Pont-Sainte-Maxence-Orly': 100,
  "Saint-Leu-d'Esserent-CDG": 50,
  'Verneuil-en-Halatte-CDG': 55,
  'Liancourt-CDG': 58,
  // Val-d'Oise / Yvelines
  'Pontoise-CDG': 38,  'Pontoise-Orly': 58,
  'Cergy-CDG': 38,     'Cergy-Orly': 58,
  'Versailles-CDG': 55, 'Versailles-Orly': 32,
}

function getRouteDist(dep: string, arr: string): number {
  return DISTANCES[`${dep}-${arr}`] ?? DISTANCES[`${arr}-${dep}`] ?? COMMUNES[dep]?.dist_cdg ?? 50
}

// Durée en minutes selon la distance, avec marge trafic réaliste
function getDuration(distKm: number): { min: number; max: number } {
  const min = Math.max(20, Math.round(distKm / 75 * 60))
  const max = Math.round(distKm / 52 * 60)
  return { min, max }
}

// ── Générateur principal ──────────────────────────────────────────────────

export function genererContenu(sujet: Sujet, prixBerline?: number): BlogPost {
  switch (sujet.type) {
    case 'transfert':  return genTransfert(sujet, prixBerline)
    case 'guide':      return genGuide(sujet)
    case 'conseils':   return genConseils(sujet)
    case 'entreprise': return genEntreprise(sujet)
    case 'comparatif': return genComparatif(sujet, prixBerline)
    default:           return genConseils(sujet)
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
  const dep     = s.depart  || 'Paris'
  const arr     = s.arrivee || 'CDG'
  const depInfo = COMMUNES[dep]  || { zone: 'Île-de-France', dist_cdg: 30, desc: '' }
  const arrInfo = AIRPORTS[arr]  || { nom: arr, code: arr, desc: '' }
  const prixStr = prix ? `${prix} €` : 'tarif fixe garanti'

  const isAirport  = arr in AIRPORTS || dep in AIRPORTS
  const isAirportArr = arr in AIRPORTS

  const dist = getRouteDist(dep, arr)
  const dur  = getDuration(dist)

  const descDep = dep !== 'Paris' && depInfo.desc
    ? ` ${dep} est ${depInfo.desc}.`
    : ''

  return {
    slug:      `vtc-${slugify(dep)}-${slugify(arr)}`,
    sujet_id:  s.id,
    categorie: 'transfert',
    mots_cles: [
      `vtc ${dep.toLowerCase()}`,
      `transfert ${arr.toLowerCase()}`,
      `chauffeur privé ${dep.toLowerCase()}`,
      `prix vtc ${dep.toLowerCase()} ${arr.toLowerCase()}`,
    ],
    meta_titre: `VTC ${dep} → ${arr} : Tarif Fixe | Owise Chauffeur Privé`,
    meta_desc:  `Transfert VTC ${dep} → ${arr} avec Owise. ${prixStr} en berline, chauffeur professionnel, disponible 24h/24. Réservez en 2 minutes.`,
    titre:      `VTC ${dep} vers ${arr} : tout ce qu'il faut savoir`,
    intro: `Vous cherchez un transfert depuis ${dep} vers ${isAirportArr ? `l'aéroport ${arrInfo.nom}` : arr} ? Votre chauffeur Owise vous prend en charge directement à votre adresse avec un tarif fixe confirmé dès la réservation — aucune mauvaise surprise, quel que soit le trafic ou l'heure d'arrivée réelle. Cet article détaille les tarifs, la durée de trajet, les conseils pratiques et les questions les plus fréquentes.`,
    paragraphes: [
      {
        titre: `Pourquoi choisir un chauffeur privé pour ${dep} → ${arr} ?`,
        texte: `Confier votre transfert à votre chauffeur Owise, c'est choisir la sérénité face aux aléas du transport en commun et au compteur imprévisible du taxi.${descDep} Depuis votre adresse à ${dep}, votre chauffeur Owise vous prend en charge à l'heure convenue et vous dépose directement à destination — sans correspondance, sans attente en gare, sans chercher un taxi sous la pluie.`,
      },
      {
        titre: `Tarifs VTC ${dep} → ${arr} : ce que vous payez vraiment`,
        texte: `Chez Owise, le tarif ${dep} → ${arr} est calculé à l'avance et confirmé lors de la réservation. ${prix ? `Pour une berline standard (1 à 4 passagers), comptez ${prix} € TTC, tout compris — péages, carburant, prise en charge.` : 'Le prix exact s\'affiche immédiatement dans notre estimateur en ligne, selon votre adresse précise. Aucun supplément ne s\'ajoute en fin de course.'} Pour un van 7 places, le tarif est adapté au nombre de passagers. Le supplément nuit (avant 6h ou après 22h) est automatiquement intégré dans le devis.`,
      },
      {
        titre: `Durée du trajet ${dep} → ${arr}`,
        texte: `En dehors des heures de pointe, comptez entre ${dur.min} et ${dur.max} minutes de trajet. ${isAirport ? (isAirportArr ? `Votre chauffeur Owise suit votre vol en temps réel grâce au numéro de vol fourni à la réservation — en cas de retard, il ajuste son heure de départ sans frais supplémentaires.` : `Pour les arrivées en avion, votre chauffeur Owise suit votre vol en temps réel et adapte l'heure de prise en charge automatiquement.`) : `Votre chauffeur Owise surveille les conditions de circulation en temps réel et choisit le meilleur itinéraire pour garantir la ponctualité.`}`,
      },
      {
        titre: `Comment réserver votre chauffeur Owise pour ${dep} → ${arr} ?`,
        texte: `La réservation se fait en ligne en moins de 2 minutes sur owise.fr. Renseignez votre adresse exacte à ${dep}, la destination (${arr}), la date et l'heure, le nombre de passagers — et obtenez immédiatement le tarif confirmé. Le paiement s'effectue par carte bancaire sécurisée (Stripe) ou en espèces le jour J. Vous recevez une confirmation par email avec le nom et le numéro de votre chauffeur.`,
      },
      {
        titre: `Zone de prise en charge depuis ${dep}`,
        texte: `Votre chauffeur Owise assure les prises en charge non seulement depuis le centre de ${dep}, mais aussi depuis les communes voisines : ${depInfo.zone === 'Oise Sud' ? 'Nogent-sur-Oise, Montataire, Saint-Maximin, Lamorlaye, Gouvieux, Chantilly, Senlis et toutes les localités de l\'Oise Sud' : depInfo.zone === 'Oise Nord' ? 'Margny-lès-Compiègne, Venette, Choisy-au-Bac, Thourotte et toutes les communes de l\'Oise Nord' : depInfo.zone === 'Paris' ? 'tous les arrondissements de Paris intramuros et la proche banlieue' : 'toutes les adresses de la zone de service'}. Le tarif est calculé précisément depuis votre adresse réelle.`,
      },
      {
        titre: `Les engagements de votre chauffeur Owise`,
        texte: `Chaque chauffeur Owise est titulaire d'une carte professionnelle VTC délivrée par la préfecture, conduit un véhicule premium récent et climatisé, et respecte un code de conduite strict : ponctualité, discrétion, aide aux bagages. Le tarif est fixe et garanti dès la confirmation — jamais de négociation, jamais de compteur. Le service est disponible 24h/24, 7j/7, y compris les jours fériés.`,
      },
    ],
    conclusion: `Voyager avec votre chauffeur Owise depuis ${dep} vers ${arr}, c'est la garantie d'un transfert confortable, ponctuel et au prix annoncé — sans surprise, sans stress. Que vous partiez en voyage d'affaires ou en vacances en famille, réservez maintenant sur owise.fr.`,
    faq: [
      { question: `Combien coûte le transfert ${dep} → ${arr} avec Owise ?`, reponse: prix ? `Le tarif Owise pour ${dep} → ${arr} en berline est de ${prix} € TTC, tarif fixe garanti dès la réservation — péages et TVA inclus.` : `Le tarif exact s'affiche en quelques secondes sur owise.fr selon votre adresse précise. Il est garanti fixe dès la confirmation.` },
      { question: `Combien de temps dure le trajet ${dep} → ${arr} ?`, reponse: `En conditions normales, comptez entre ${dur.min} et ${dur.max} minutes. Votre chauffeur Owise adapte l'itinéraire selon le trafic en temps réel.` },
      { question: `Le tarif inclut-il les péages ?`, reponse: `Oui, le tarif affiché est tout compris : péages, carburant, prise en charge. Aucun supplément n'est ajouté en fin de course.` },
      { question: `Peut-on réserver un chauffeur Owise à la dernière minute ?`, reponse: `Oui, votre chauffeur Owise est disponible 24h/24. Nous recommandons toutefois de réserver à l'avance pour les vols matinaux ou les événements.` },
      ...(isAirport ? [{ question: `Que se passe-t-il si mon vol est retardé ?`, reponse: `Votre chauffeur Owise suit votre vol en temps réel. En cas de retard, il ajuste automatiquement son heure d'arrivée — sans frais supplémentaires.` }] : [{ question: `Peut-on réserver un aller-retour ${dep} ↔ ${arr} ?`, reponse: `Oui, l'option aller-retour est disponible sur owise.fr. Votre chauffeur Owise peut également vous attendre sur place si vous avez besoin d'une mise à disposition.` }]),
      { question: `Peut-on transporter des bagages volumineux (skis, poussette) ?`, reponse: `Oui, les berlines Owise ont un grand coffre adapté aux bagages standards. Pour les équipements volumineux, le van 7 places est recommandé.` },
      { question: `Quel véhicule choisir pour le trajet ${dep} → ${arr} ?`, reponse: `Pour 1 à 4 passagers, la berline est idéale. Pour 5 à 7 passagers ou des bagages nombreux, optez pour le van 7 places.` },
      { question: `Y a-t-il un supplément pour un départ de nuit (avant 6h) ?`, reponse: `Oui, un supplément nuit est appliqué automatiquement pour les courses avant 6h ou après 22h. Il est inclus et visible dans votre estimation avant de confirmer.` },
      { question: `Comment payer mon chauffeur Owise ?`, reponse: `Paiement en ligne sécurisé par carte bancaire lors de la réservation (Stripe). Le paiement en espèces directement à votre chauffeur est également possible.` },
      { question: `Votre chauffeur Owise dessert-il les communes proches de ${dep} ?`, reponse: `Oui, toutes les communes dans un rayon de 10 à 15 km autour de ${dep} sont desservies. Renseignez votre adresse précise sur owise.fr pour obtenir votre tarif exact.` },
    ],
  }
}

// ── Template : Guide local ────────────────────────────────────────────────

function genGuide(s: Sujet): BlogPost {
  const theme = s.theme || 'Chantilly'
  return {
    slug:      `guide-transport-${slugify(theme)}`,
    sujet_id:  s.id,
    categorie: 'guide',
    mots_cles: [
      `vtc ${theme.toLowerCase()}`,
      `transport ${theme.toLowerCase()}`,
      `chauffeur privé ${theme.toLowerCase()}`,
    ],
    meta_titre: `Aller à ${theme} en VTC : Guide & Tarifs | Owise`,
    meta_desc:  `Comment rejoindre ${theme} avec votre chauffeur Owise ? Tarifs, conseils et réservation en ligne — service premium Île-de-France et Oise.`,
    titre:      `Se rendre à ${theme} avec votre chauffeur privé : le guide complet`,
    intro:      `${theme} est une destination incontournable de l'Oise et de l'Île-de-France. Que vous y alliez pour un événement, une visite ou un rendez-vous professionnel, votre chauffeur Owise est la solution la plus confortable et la plus fiable. Prise en charge à votre porte, tarif fixe garanti, disponibilité 24h/24 — depuis Paris, CDG, Orly ou toute commune de l'Oise.`,
    paragraphes: [
      {
        titre: `Pourquoi visiter ${theme} ?`,
        texte: `${theme} attire chaque année des milliers de visiteurs : amateurs de patrimoine, passionnés d'équitation, professionnels en déplacement ou familles en week-end. La qualité du cadre exige un transport à la hauteur — votre chauffeur Owise assure cette transition entre votre domicile et la destination sans effort de votre part.`,
      },
      {
        titre: `Accès et transport vers ${theme}`,
        texte: `Pour rejoindre ${theme}, le train depuis Paris Gare du Nord reste une option, mais avec ses contraintes : horaires fixes, bagages encombrants, absence de prise en charge à domicile. Votre chauffeur Owise vous prend en charge directement à votre adresse, à l'heure choisie, et vous dépose précisément à destination — idéal pour les événements en dehors des horaires classiques.`,
      },
      {
        titre: `Depuis Paris vers ${theme} avec votre chauffeur Owise`,
        texte: `Depuis Paris intramuros, votre chauffeur Owise vous conduit en berline ou van vers ${theme}. Le tarif est calculé selon votre adresse exacte et confirmé avant le départ. Le trajet dure en général 45 à 70 minutes selon la circulation — votre chauffeur suit les conditions en temps réel pour choisir le meilleur itinéraire.`,
      },
      {
        titre: `Depuis CDG ou Orly vers ${theme}`,
        texte: `Vous arrivez en avion ? Votre chauffeur Owise vous attend à la sortie bagages avec un panneau à votre nom, puis vous conduit directement vers ${theme} sans correspondance. Le numéro de vol est renseigné à la réservation — si votre vol est en retard, votre chauffeur le sait avant même que vous atterrissiez.`,
      },
      {
        titre: `Tarifs pour rejoindre ${theme}`,
        texte: `Les tarifs Owise vers ${theme} varient selon votre point de départ. Depuis Paris intramuros, comptez entre 60 et 100 € en berline selon l'adresse exacte. Depuis les aéroports ou les communes de l'Oise, l'estimateur sur owise.fr affiche votre tarif exact en quelques secondes — garanti fixe dès la confirmation.`,
      },
      {
        titre: `Conseils pratiques pour votre visite à ${theme}`,
        texte: `Pour les grands événements (hippodrome, château, festivals), réservez votre chauffeur Owise à l'avance : les disponibilités sont réduites lors des journées de forte affluence. Votre chauffeur Owise peut également assurer l'aller ET le retour, avec une mise à disposition sur place si vous avez besoin de souplesse sur l'heure de retour.`,
      },
    ],
    conclusion: `Que ce soit pour une première visite ou un retour à ${theme}, votre chauffeur Owise garantit un transport premium, ponctuel et au prix annoncé. Réservez sur owise.fr et profitez pleinement de votre expérience.`,
    faq: [
      { question: `Comment aller à ${theme} depuis Paris ?`, reponse: `Votre chauffeur Owise vous prend en charge à votre adresse parisienne. Comptez 45 à 70 minutes selon les conditions de trafic. Tarif fixe, confirmation immédiate.` },
      { question: `Peut-on rejoindre ${theme} depuis CDG en chauffeur privé ?`, reponse: `Oui, votre chauffeur Owise assure le transfert CDG → ${theme} directement, avec suivi de vol. Tarif fixe affiché avant confirmation.` },
      { question: `Y a-t-il un stationnement facile à ${theme} ?`, reponse: `Pour les événements de grande affluence, votre chauffeur Owise gère le dépose à l'entrée — vous évitez la recherche de stationnement et les embouteillages.` },
      { question: `Peut-on réserver un aller-retour vers ${theme} ?`, reponse: `Oui, l'option aller-retour est disponible sur owise.fr. Indiquez simplement votre heure de retour souhaitée, votre chauffeur Owise sera présent.` },
      { question: `Votre chauffeur Owise peut-il attendre sur place ?`, reponse: `Oui, pour les événements ou visites longues, votre chauffeur Owise peut se mettre à disposition et vous attendre sur place selon vos besoins.` },
      { question: `Quel est le tarif depuis Creil vers ${theme} ?`, reponse: `Depuis Creil, le tarif est calculé selon votre adresse précise sur owise.fr. Obtenez votre prix exact en quelques secondes, sans engagement.` },
      { question: `Le service est-il disponible pour les événements en soirée ?`, reponse: `Oui, 24h/24 et 7j/7. Un supplément nuit s'applique automatiquement pour les retours après 22h — visible avant confirmation.` },
      { question: `Combien de passagers peut-on être ?`, reponse: `Jusqu'à 4 passagers en berline, jusqu'à 7 en van. Renseignez le nombre lors de la réservation pour le tarif adapté.` },
      { question: `Peut-on transporter du matériel (équipement sport, musical) ?`, reponse: `Oui, dans la limite des capacités du véhicule. Pour du matériel volumineux, le van 7 places est recommandé.` },
      { question: `Votre chauffeur Owise dessert-il toute la zone autour de ${theme} ?`, reponse: `Oui, toutes les communes dans un rayon de 15 km sont desservies. Renseignez votre adresse exacte sur owise.fr.` },
    ],
  }
}

// ── Template : Conseils pratiques ─────────────────────────────────────────

function genConseils(s: Sujet): BlogPost {
  const theme = s.theme || 'votre trajet'
  return {
    slug:      `conseils-vtc-${slugify(theme)}`,
    sujet_id:  s.id,
    categorie: 'conseils',
    mots_cles: [`vtc conseils`, `chauffeur privé ${theme.toLowerCase()}`, `transport ${theme.toLowerCase()}`],
    meta_titre: `Chauffeur privé et ${theme} : nos conseils | Owise`,
    meta_desc:  `Tout ce qu'il faut savoir sur ${theme} avec votre chauffeur Owise : tarifs, réservation, astuces pratiques. Service premium en Île-de-France et Oise.`,
    titre:      `${theme} : le guide pratique pour voyager sereinement`,
    intro:      `Chaque situation de voyage a ses spécificités. Pour ${theme}, votre chauffeur Owise adapte son service à vos contraintes : horaires décalés, bagages particuliers, nombre de passagers, impératifs professionnels. Ce guide répond aux questions les plus fréquentes et vous donne les clés pour organiser votre trajet sans stress.`,
    paragraphes: [
      {
        titre: `Anticiper les contraintes de votre trajet`,
        texte: `Pour ${theme}, il est essentiel d'anticiper les contraintes spécifiques : horaires décalés, volume de bagages, nombre de passagers, conditions météorologiques. Votre chauffeur Owise est briefé à la réservation et adapte son service en conséquence — un avantage que le taxi ou les transports en commun ne peuvent pas offrir.`,
      },
      {
        titre: `Réserver votre chauffeur Owise`,
        texte: `Rendez-vous sur owise.fr et renseignez en quelques secondes : votre adresse exacte de prise en charge, votre destination, la date et l'heure, le nombre de passagers. Le tarif s'affiche immédiatement, confirmé et garanti — aucune négociation, aucune surprise en fin de course.`,
      },
      {
        titre: `Les avantages du chauffeur privé pour ${theme}`,
        texte: `Votre chauffeur Owise offre une flexibilité totale : pas d'horaires imposés, pas de correspondances, prise en charge à votre porte. Pour ${theme} spécifiquement, cela représente un gain de temps et de confort significatif — particulièrement appréciable aux horaires inhabituels ou avec des enfants en bas âge.`,
      },
      {
        titre: `Tarifs transparents et garantis`,
        texte: `Chez Owise, le tarif est fixe dès la confirmation : péages, TVA et prise en charge compris. Pas de compteur qui tourne, pas de majoration surprise selon le trafic. Le prix affiché est le prix final — ce qui simplifie la gestion des notes de frais pour les déplacements professionnels.`,
      },
      {
        titre: `Disponibilité 24h/24`,
        texte: `Votre chauffeur Owise est disponible tous les jours de l'année, y compris les jours fériés et les nuits de week-end. Pour les courses avant 6h ou après 22h, un supplément nuit est automatiquement inclus dans l'estimation — visible avant toute confirmation.`,
      },
      {
        titre: `Notre zone de service`,
        texte: `Votre chauffeur Owise couvre Paris, toute l'Île-de-France et l'Oise : Creil, Chantilly, Senlis, Gouvieux, Lamorlaye, Compiègne, Saint-Maximin et toutes les communes environnantes. Les transferts aéroports CDG, Orly et Beauvais sont assurés avec tarif fixe garanti.`,
      },
    ],
    conclusion: `Pour ${theme}, faites confiance à votre chauffeur Owise : ponctualité garantie, tarif confirmé, service premium disponible 24h/24. Réservez sur owise.fr en moins de 2 minutes.`,
    faq: genFaqGenerique(theme),
  }
}

// ── Template : Entreprise ────────────────────────────────────────────────

function genEntreprise(s: Sujet): BlogPost {
  const theme = s.theme || 'votre entreprise'
  return {
    slug:      `vtc-entreprise-${slugify(theme)}`,
    sujet_id:  s.id,
    categorie: 'entreprise',
    mots_cles: [`vtc entreprise ${theme.toLowerCase()}`, `transport d'affaires ${theme.toLowerCase()}`, `compte entreprise vtc`],
    meta_titre: `Chauffeur Privé Entreprise ${theme} | Owise`,
    meta_desc:  `Solution transport professionnelle pour les entreprises de ${theme}. Compte entreprise, facturation mensuelle, tarif fixe. Votre chauffeur Owise, partenaire mobilité.`,
    titre:      `Transport d'entreprise à ${theme} : la solution chauffeur privé`,
    intro:      `Les entreprises de ${theme} ont des besoins transport spécifiques : régularité, ponctualité, discrétion et facturation simplifiée. Votre chauffeur Owise propose une solution dédiée aux professionnels — compte entreprise, facturation mensuelle centralisée et tarifs négociés pour les déplacements récurrents.`,
    paragraphes: [
      {
        titre: `Pourquoi les entreprises choisissent Owise`,
        texte: `Les entreprises basées à ${theme} ou ayant des collaborateurs dans l'Oise font confiance à votre chauffeur Owise pour leurs déplacements professionnels : transferts aéroport (CDG, Orly, Beauvais), navettes entre sites, transport de clients, séminaires. Le tarif fixe garanti simplifie la comptabilité et élimine les notes de frais imprévisibles.`,
      },
      {
        titre: `Compte entreprise et facturation mensuelle`,
        texte: `Owise propose un compte entreprise avec facturation mensuelle centralisée. Toutes les courses du mois sont regroupées sur une facture unique, avec référence collaborateur et validation admin. Compatible avec les obligations comptables françaises — TVA récupérable, mentions légales complètes.`,
      },
      {
        titre: `Transport de clients et partenaires`,
        texte: `Votre chauffeur Owise représente l'image de votre entreprise : tenue professionnelle, véhicule premium récent, ponctualité irréprochable. Un panneau d'accueil nominatif à l'aéroport, une eau minérale à bord, un trajet silencieux si le client le souhaite — chaque détail compte pour l'impression laissée.`,
      },
      {
        titre: `Transferts aéroport pour vos équipes`,
        texte: `Pour les collaborateurs basés dans l'Oise qui prennent régulièrement l'avion depuis CDG, Orly ou Beauvais, le compte entreprise Owise simplifie tout : réservation en ligne, tarif fixe, confirmation automatique et regroupement sur la facture mensuelle.`,
      },
      {
        titre: `Séminaires et événements d'entreprise`,
        texte: `Pour les séminaires, team buildings ou événements d'entreprise dans l'Oise (Chantilly, Compiègne, Senlis), Owise coordonne le transport de groupe avec vans 7 places et flotte dédiée. Devis sur mesure pour les groupes à partir de 10 personnes.`,
      },
      {
        titre: `Tarifs préférentiels pour les clients réguliers`,
        texte: `Les comptes entreprise avec volume mensuel régulier bénéficient de conditions négociées. Facturation en 30 jours, toutes options incluses. Contactez-nous pour un devis adapté à votre volume de courses.`,
      },
    ],
    conclusion: `Votre chauffeur Owise est le partenaire mobilité des entreprises de ${theme} et de toute l'Oise. Demandez votre compte entreprise en contactant owise.entreprise@gmail.com — mise en place en 48h.`,
    faq: [
      { question: `Comment ouvrir un compte entreprise Owise ?`, reponse: `Contactez-nous via owise.fr ou par email à owise.entreprise@gmail.com. La mise en place est effectuée en 48h.` },
      { question: `La facturation mensuelle est-elle possible ?`, reponse: `Oui, toutes les courses du mois sont regroupées sur une facture mensuelle avec détail par collaborateur.` },
      { question: `Peut-on réserver votre chauffeur Owise pour des clients extérieurs ?`, reponse: `Oui, le compte entreprise permet de réserver des courses pour vos clients, fournisseurs et partenaires.` },
      { question: `Owise propose-t-il des vans pour les séminaires ?`, reponse: `Oui, des vans 7 places sont disponibles pour les déplacements de groupe. Contactez-nous pour un devis multi-véhicules.` },
      { question: `Le service est-il disponible 24h/24 pour les entreprises ?`, reponse: `Oui, même pour les vols tôt le matin ou en soirée. Réservation possible via owise.fr à toute heure.` },
      { question: `Les transferts aéroport sont-ils inclus dans le compte entreprise ?`, reponse: `Oui, CDG, Orly et Beauvais sont desservis avec tarif fixe garanti. Votre chauffeur Owise suit le vol en temps réel.` },
      { question: `Quel délai pour une réservation entreprise ?`, reponse: `Réservation possible jusqu'à quelques heures avant la course. Pour les événements ou les vols matinaux, anticipez la veille.` },
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
    slug:      `comparatif-${slugify(theme)}`,
    sujet_id:  s.id,
    categorie: 'comparatif',
    mots_cles: [`vtc comparatif`, theme.toLowerCase(), 'tarif fixe vtc', 'chauffeur privé oise'],
    meta_titre: `${theme} : lequel choisir ? | Owise VTC Oise`,
    meta_desc:  `Comparaison objective : ${theme}. Tarifs, confort, fiabilité. Le guide Owise pour choisir le meilleur transport depuis l'Oise.`,
    titre:      `${theme} : comparaison objective pour bien choisir`,
    intro:      `Vous hésitez entre plusieurs options de transport ? Ce guide compare honnêtement ${theme} pour vous aider à faire le meilleur choix selon votre situation, votre budget et vos contraintes réelles — sans parti pris.`,
    paragraphes: [
      {
        titre: `Les critères de comparaison`,
        texte: `Pour comparer efficacement, nous analysons cinq critères essentiels : le coût total réel, la fiabilité et ponctualité, le confort à bord, la flexibilité horaire, et la facilité de réservation. Le poids de chaque critère varie selon le type de trajet — un transfert aéroport avec un vol à ne pas rater ne se compare pas à un déplacement local de confort.`,
      },
      {
        titre: `La question du coût : prix affiché vs coût réel`,
        texte: `Avec votre chauffeur Owise, le tarif est fixe et connu avant de monter dans le véhicule. ${prix ? `Pour un trajet typique, comptez par exemple ${prix} € en berline, tout compris.` : 'L\'estimateur owise.fr affiche le tarif exact en quelques secondes, péages et TVA inclus.'} Cette transparence permet une vraie comparaison de budget — sans compteur, sans majoration trafic, sans surprise.`,
      },
      {
        titre: `Fiabilité et ponctualité`,
        texte: `Pour un transfert aéroport ou un rendez-vous professionnel, la ponctualité n'est pas négociable. Votre chauffeur Owise est présent à l'heure confirmée à la réservation. Pour les arrivées en avion, il suit votre vol en temps réel et adapte son heure d'arrivée — sans que vous ayez à le prévenir.`,
      },
      {
        titre: `Confort et qualité de service`,
        texte: `Les véhicules Owise sont récents, climatisés, avec eau et chargeurs à bord. Votre chauffeur Owise est professionnel, discret et connaît parfaitement les itinéraires de l'Oise et de l'Île-de-France. Un niveau de service premium, adapté aux déplacements d'affaires comme aux voyages en famille.`,
      },
      {
        titre: `Flexibilité et disponibilité`,
        texte: `Votre chauffeur Owise est disponible 24h/24 sans contrainte d'horaires, avec réservation en ligne en 2 minutes. Modification ou annulation sans pénalité jusqu'à l'arrivée du chauffeur. Cette flexibilité est particulièrement précieuse pour les déplacements professionnels imprévus ou les retards de vol.`,
      },
      {
        titre: `Notre verdict`,
        texte: `Pour les transferts aéroport, événements ou trajets réguliers depuis l'Oise, votre chauffeur Owise offre le meilleur rapport qualité-prix avec la sécurité du tarif fixe. Pour les courtes distances en centre-ville à l'improviste, d'autres options peuvent être plus réactives. Le bon choix dépend de vos priorités : confort et ponctualité garantis, ou spontanéité pure.`,
      },
    ],
    conclusion: `Le meilleur transport est celui qui correspond à vos besoins. Si la ponctualité, le confort et la transparence des tarifs comptent — votre chauffeur Owise est votre solution. Estimez votre trajet sur owise.fr en 30 secondes, sans engagement.`,
    faq: genFaqGenerique(theme),
  }
}

// ── FAQ générique ────────────────────────────────────────────────────────

function genFaqGenerique(theme: string): { question: string; reponse: string }[] {
  return [
    { question: `Votre chauffeur Owise couvre-t-il toute l'Oise ?`, reponse: `Oui, Creil, Chantilly, Senlis, Gouvieux, Lamorlaye, Compiègne et toutes les communes environnantes. Vérifiez votre adresse sur owise.fr.` },
    { question: `Quel est le délai minimum pour réserver ?`, reponse: `Quelques heures avant la course suffisent en général. Pour les vols matinaux ou les événements, réservez la veille pour garantir la disponibilité.` },
    { question: `Le tarif change-t-il si le trajet prend plus de temps ?`, reponse: `Non, le tarif fixe Owise est garanti dès la confirmation, quelle que soit la durée réelle du trajet.` },
    { question: `Peut-on payer en espèces ?`, reponse: `Oui, le paiement en espèces est possible directement à votre chauffeur. Le paiement en ligne par carte est également disponible à la réservation.` },
    { question: `Y a-t-il un supplément pour plusieurs arrêts ?`, reponse: `Oui, pour les trajets avec étapes intermédiaires. Le tarif exact avec étapes s'affiche sur owise.fr.` },
    { question: `Votre chauffeur Owise propose-t-il des véhicules accessibles PMR ?`, reponse: `Contactez-nous directement pour les besoins spécifiques PMR. Nous faisons notre possible pour adapter le service.` },
    { question: `Que se passe-t-il si je dois annuler ?`, reponse: `L'annulation est gratuite jusqu'à l'arrivée de votre chauffeur Owise. Aucune pénalité sur la carte bancaire.` },
    { question: `Les chauffeurs Owise sont-ils certifiés VTC ?`, reponse: `Oui, tous nos chauffeurs sont titulaires d'une carte professionnelle VTC délivrée par la préfecture.` },
    { question: `Peut-on réserver pour quelqu'un d'autre (client, famille) ?`, reponse: `Oui, le compte et le paiement sont à votre nom, le passager peut être différent. Indiquez simplement les coordonnées de la personne transportée.` },
    { question: `Owise propose-t-il des forfaits pour trajets récurrents ?`, reponse: `Oui, pour les clients réguliers et les comptes entreprise. Contactez-nous à owise.entreprise@gmail.com pour un devis personnalisé.` },
  ]
}
