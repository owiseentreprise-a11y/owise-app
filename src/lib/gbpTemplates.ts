// Templates de posts Google Business Profile — rotation automatique 2×/semaine

export type GbpTemplate = {
  id:       string
  summary:  string
  cta:      'BOOK' | 'LEARN_MORE' | 'CALL'
  url:      string
}

const BASE_URL = 'https://www.owise.fr'

export const GBP_TEMPLATES: GbpTemplate[] = [
  {
    id: 'cdg-tarif',
    summary:
      '✈️ VTC Aéroport CDG — Tarif fixe garanti dès 45€\n\n' +
      'Votre vol décolle tôt le matin ? Nous assurons vos transferts vers Roissy-Charles-de-Gaulle 24h/24, 7j/7.\n\n' +
      '• Berline ou Van jusqu\'à 7 passagers\n' +
      '• Suivi de vol en temps réel\n' +
      '• Chauffeur en attente si retard\n' +
      '• Paiement sécurisé en ligne\n\n' +
      'Réservez maintenant et recevez votre confirmation instantanément.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'orly-tarif',
    summary:
      '✈️ VTC Aéroport d\'Orly — Ponctualité garantie\n\n' +
      'Transfert professionnel vers Orly depuis toute l\'Île-de-France et l\'Oise.\n\n' +
      '• Tarif fixe, sans supplément trafic\n' +
      '• Berline premium ou Van 7 places\n' +
      '• Chauffeur professionnel en costume\n' +
      '• Prise en charge à domicile ou en entreprise\n\n' +
      'Calculez votre tarif en 30 secondes sur notre site.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'beauvais-tarif',
    summary:
      '✈️ VTC Aéroport de Beauvais — Ryanaïr & Wizz Air\n\n' +
      'Vol low-cost depuis Beauvais-Tillé ? Profitez d\'un transfert confortable depuis Creil, Chantilly, Senlis ou Compiègne.\n\n' +
      '• Départ garanti à l\'heure, même à 4h du matin\n' +
      '• Tarif fixe tout compris\n' +
      '• Pas de RER ni de navette bondée\n\n' +
      'Réservez votre VTC dès maintenant.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'entreprise',
    summary:
      '🏢 Compte Entreprise Owise — Simplifiez vos déplacements professionnels\n\n' +
      'Vos collaborateurs se déplacent régulièrement ? Notre compte entreprise vous offre :\n\n' +
      '• Facturation mensuelle centralisée\n' +
      '• Tableau de bord de suivi des courses\n' +
      '• Tarifs négociés selon volume\n' +
      '• Chauffeurs dédiés et discrets\n\n' +
      'Contactez-nous pour un devis personnalisé.',
    cta: 'LEARN_MORE',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'van-groupe',
    summary:
      '👥 Van 7 places — Idéal pour vos transferts en groupe\n\n' +
      'Séminaire d\'entreprise, sortie en famille, groupe d\'amis ? Notre Van premium transporte jusqu\'à 7 passagers confortablement avec leurs bagages.\n\n' +
      '• Tarif dégressif par personne\n' +
      '• Climatisation, prises USB à bord\n' +
      '• Un seul chauffeur pour tout le groupe\n' +
      '• Disponible 24h/24\n\n' +
      'Calculez votre tarif groupe en ligne.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'reservation-anticipee',
    summary:
      '📅 Conseil : Réservez votre VTC à l\'avance\n\n' +
      'Pour ne jamais rater votre vol ou votre train, pensez à réserver votre chauffeur au moins 24h à l\'avance.\n\n' +
      'Avec Owise :\n' +
      '• Confirmation immédiate par email et SMS\n' +
      '• Modification gratuite jusqu\'à 2h avant\n' +
      '• Annulation sans frais jusqu\'à 24h avant\n' +
      '• Rappel automatique la veille de votre course\n\n' +
      'Serein le jour J. Réservez dès maintenant.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'chantilly-gouvieux',
    summary:
      '🏡 VTC Chantilly & Gouvieux — CDG et Orly en toute sérénité\n\n' +
      'Habitant de Chantilly, Gouvieux ou Lamorlaye ? Owise assure vos transferts aéroport depuis l\'Oise.\n\n' +
      '• Creil → CDG dès 45€\n' +
      '• Chantilly → Orly dès 75€\n' +
      '• Beauvais → tarif sur devis\n' +
      '• Disponible à toute heure\n\n' +
      'Réservez en ligne, payez en ligne.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'nuit-madrugada',
    summary:
      '🌙 VTC de nuit — Disponible 24h/24 et 7j/7\n\n' +
      'Vol à 5h du matin ? Soirée qui se prolonge ? Owise est disponible à toute heure, y compris les nuits et week-ends.\n\n' +
      '• Pas de majoration surprise\n' +
      '• Tarif fixe affiché avant réservation\n' +
      '• Chauffeur professionnel et ponctuel\n' +
      '• Confirmation SMS avant la prise en charge\n\n' +
      'La sécurité d\'un chauffeur fiable, à n\'importe quelle heure.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'versailles',
    summary:
      '👑 VTC Versailles — Transferts aéroport et courses longue distance\n\n' +
      'Owise dessert désormais Versailles et les Yvelines pour vos transferts vers CDG, Orly et Beauvais.\n\n' +
      '• Versailles → CDG dès 65€\n' +
      '• Versailles → Orly dès 55€\n' +
      '• Service de qualité premium\n' +
      '• Chauffeur anglophone disponible\n\n' +
      'Réservez votre VTC depuis Versailles.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'pontoise-cergy',
    summary:
      '📍 Nouveau : Owise dessert Pontoise & Cergy-Pontoise\n\n' +
      'Vous habitez dans le Val-d\'Oise ? Nous assurons vos transferts aéroport depuis Cergy, Pontoise et toutes les communes environnantes.\n\n' +
      '• Pontoise → CDG dès 55€\n' +
      '• Cergy → Orly dès 65€\n' +
      '• Berline ou Van, selon vos besoins\n\n' +
      'Calculez votre tarif en ligne dès maintenant.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'qualite-service',
    summary:
      '⭐ Owise — La qualité qui fait la différence\n\n' +
      'Chaque course Owise, c\'est :\n\n' +
      '• Un chauffeur professionnel, soigneusement sélectionné\n' +
      '• Un véhicule premium récent et climatisé\n' +
      '• Un tarif fixe sans mauvaise surprise\n' +
      '• Un suivi en temps réel depuis l\'application\n' +
      '• Un service client disponible en cas de besoin\n\n' +
      'Parce que vos déplacements méritent le meilleur.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
  {
    id: 'gare-tgv',
    summary:
      '🚄 VTC pour la gare — TGV, Intercités, Eurostar\n\n' +
      'Gare du Nord, Gare de Lyon, Gare Montparnasse… Owise vous dépose à l\'heure pour prendre votre train, sans stress.\n\n' +
      '• Tarif fixe affiché avant réservation\n' +
      '• Suivi de votre train en cas de retard\n' +
      '• Prise en charge à domicile\n' +
      '• Retour depuis la gare aussi disponible\n\n' +
      'Voyagez serein, du départ jusqu\'au quai.',
    cta: 'BOOK',
    url: `${BASE_URL}/reserver`,
  },
]

export function pickTemplate(dateOverride?: Date): GbpTemplate {
  const now  = dateOverride ?? new Date()
  // Semaine ISO × 2 runs/semaine → index cyclique sur le pool
  const weekNumber = Math.floor(now.getTime() / (1000 * 60 * 60 * 24 * 7))
  // Mardi = run 0, Jeudi = run 1
  const dayOfWeek  = now.getUTCDay()
  const runOffset  = dayOfWeek >= 4 ? 1 : 0
  const idx = (weekNumber * 2 + runOffset) % GBP_TEMPLATES.length
  return GBP_TEMPLATES[idx]
}
