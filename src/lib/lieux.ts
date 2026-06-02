export type LieuSuggestion = {
  label: string
  sublabel: string
  isLieu: true
}

export const LIEUX_CONNUS = [
  // Aéroports
  { label: 'Aéroport Paris-Charles de Gaulle (CDG)', sublabel: 'Terminal 1, 2, 3 · 95700 Roissy-en-France', keywords: ['cdg', 'roissy', 'charles de gaulle', 'charles degaulle', 'aeroport cdg', 'aéroport cdg', 'aeroport paris', 'aéroport paris', 'charles'] },
  { label: 'Aéroport de Paris-Orly (ORY)', sublabel: 'Terminal 1, 2, 3, 4 · 94390 Orly', keywords: ['orly', 'ory', 'aeroport orly', 'aéroport orly'] },
  { label: 'Aéroport Paris-Beauvais Tillé (BVA)', sublabel: '60550 Tillé (Beauvais)', keywords: ['beauvais', 'bva', 'tillé', 'tille', 'aeroport beauvais'] },
  { label: 'Aéroport Paris-Le Bourget', sublabel: '93350 Le Bourget', keywords: ['le bourget', 'bourget', 'aeroport bourget'] },
  // Gares Paris
  { label: 'Gare du Nord', sublabel: '18 Rue de Dunkerque, 75010 Paris', keywords: ['gare du nord', 'nord', 'eurostar', 'thalys', 'gare nord'] },
  { label: 'Gare de Lyon', sublabel: 'Place Louis Armand, 75012 Paris', keywords: ['gare de lyon', 'gare lyon', 'lyon'] },
  { label: 'Gare Montparnasse', sublabel: 'Place Raoul Dautry, 75015 Paris', keywords: ['montparnasse', 'gare montparnasse'] },
  { label: 'Gare Saint-Lazare', sublabel: 'Place du Havre, 75009 Paris', keywords: ['saint lazare', 'saint-lazare', 'lazare', 'gare saint'] },
  { label: "Gare de l'Est", sublabel: 'Place du 11 Novembre 1918, 75010 Paris', keywords: ["gare de l'est", 'gare est', "l'est", 'est'] },
  { label: "Gare d'Austerlitz", sublabel: "55 Quai d'Austerlitz, 75013 Paris", keywords: ['austerlitz', "gare d'austerlitz"] },
  { label: 'Gare de Bercy', sublabel: '48 Boulevard de Bercy, 75012 Paris', keywords: ['bercy', 'gare bercy'] },
  { label: 'Gare Massy-TGV', sublabel: 'Massy, 91300', keywords: ['massy', 'massy tgv'] },
  { label: 'Gare de Versailles-Chantiers', sublabel: 'Versailles, 78000', keywords: ['versailles chantiers', 'versailles tgv'] },
  // Autres lieux
  { label: 'Disneyland Paris', sublabel: 'Allée de la Belle au Bois Dormant, 77700 Chessy', keywords: ['disneyland', 'disney', 'chessy'] },
  { label: 'Stade de France', sublabel: 'ZAC du Cornillon Nord, 93216 Saint-Denis', keywords: ['stade de france', 'stade france'] },
  { label: 'Palais des Congrès de Paris', sublabel: '2 Place de la Porte Maillot, 75017 Paris', keywords: ['palais des congres', 'palais des congrès', 'porte maillot', 'congres', 'congrès'] },
  { label: 'Paris Expo Porte de Versailles', sublabel: '1 Place de la Porte de Versailles, 75015 Paris', keywords: ['porte de versailles', 'expo versailles', 'parc des expositions'] },
  { label: 'Parc des Expositions de Villepinte', sublabel: 'Z.A. Paris Nord 2, 93420 Villepinte', keywords: ['villepinte', 'parc villepinte', 'nord villepinte'] },
  { label: 'Tour Eiffel', sublabel: 'Champ de Mars, 75007 Paris', keywords: ['tour eiffel', 'eiffel', 'champ de mars'] },
  { label: 'Louvre', sublabel: 'Rue de Rivoli, 75001 Paris', keywords: ['louvre', 'musee du louvre', 'musée du louvre'] },
  { label: 'La Défense', sublabel: 'Puteaux / Courbevoie, 92800', keywords: ['la defense', 'la défense', 'defense', 'défense', 'cnit', 'grande arche'] },
]

export function searchLieux(q: string): LieuSuggestion[] {
  const lower = q.toLowerCase().trim()
  if (lower.length < 2) return []
  return LIEUX_CONNUS
    .filter(l => l.keywords.some(k => k.includes(lower) || lower.includes(k)))
    .map(l => ({ label: l.label, sublabel: l.sublabel, isLieu: true as const }))
    .slice(0, 3)
}
