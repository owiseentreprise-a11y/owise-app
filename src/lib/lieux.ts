export type LieuSuggestion = {
  label:  string
  sublabel: string
  isLieu: true
  lat?:   number
  lng?:   number
  codePostal?: string
}

export const LIEUX_CONNUS: Array<{
  label: string
  sublabel: string
  keywords: string[]
  lat?: number
  lng?: number
  codePostal: string
}> = [
  // Aéroports
  { label: 'Aéroport Paris-Charles de Gaulle (CDG)', sublabel: 'Terminal 1, 2, 3 · 95700 Roissy-en-France', keywords: ['cdg', 'roissy', 'charles de gaulle', 'charles degaulle', 'aeroport cdg', 'aéroport cdg', 'aeroport paris', 'aéroport paris', 'charles'], lat: 49.0097, lng: 2.5479, codePostal: '95700' },
  { label: 'Aéroport de Paris-Orly (ORY)', sublabel: 'Terminal 1, 2, 3, 4 · 94390 Orly', keywords: ['orly', 'ory', 'aeroport orly', 'aéroport orly'], lat: 48.7233, lng: 2.3794, codePostal: '94390' },
  { label: 'Aéroport Paris-Beauvais Tillé (BVA)', sublabel: '60550 Tillé (Beauvais)', keywords: ['beauvais', 'bva', 'tillé', 'tille', 'aeroport beauvais'], lat: 49.4543, lng: 2.1128, codePostal: '60550' },
  { label: 'Aéroport Paris-Le Bourget', sublabel: '93350 Le Bourget', keywords: ['le bourget', 'bourget', 'aeroport bourget'], lat: 48.9717, lng: 2.4408, codePostal: '93350' },
  // Gares Paris
  { label: 'Gare du Nord', sublabel: '18 Rue de Dunkerque, 75010 Paris', keywords: ['gare du nord', 'nord', 'eurostar', 'thalys', 'gare nord'], lat: 48.8809, lng: 2.3553, codePostal: '75010' },
  { label: 'Gare de Lyon', sublabel: 'Place Louis Armand, 75012 Paris', keywords: ['gare de lyon', 'gare lyon', 'lyon'], lat: 48.8448, lng: 2.3735, codePostal: '75012' },
  { label: 'Gare Montparnasse', sublabel: 'Place Raoul Dautry, 75015 Paris', keywords: ['montparnasse', 'gare montparnasse'], lat: 48.8409, lng: 2.3202, codePostal: '75015' },
  { label: 'Gare Saint-Lazare', sublabel: 'Place du Havre, 75009 Paris', keywords: ['saint lazare', 'saint-lazare', 'lazare', 'gare saint'], lat: 48.8760, lng: 2.3250, codePostal: '75009' },
  { label: "Gare de l'Est", sublabel: 'Place du 11 Novembre 1918, 75010 Paris', keywords: ["gare de l'est", 'gare est', "l'est", 'est'], lat: 48.8768, lng: 2.3588, codePostal: '75010' },
  { label: "Gare d'Austerlitz", sublabel: "55 Quai d'Austerlitz, 75013 Paris", keywords: ['austerlitz', "gare d'austerlitz"], lat: 48.8433, lng: 2.3653, codePostal: '75013' },
  { label: 'Gare de Bercy', sublabel: '48 Boulevard de Bercy, 75012 Paris', keywords: ['bercy', 'gare bercy'], lat: 48.8399, lng: 2.3827, codePostal: '75012' },
  { label: 'Gare Massy-TGV', sublabel: 'Massy, 91300', keywords: ['massy', 'massy tgv'], lat: 48.7255, lng: 2.2710, codePostal: '91300' },
  { label: 'Gare de Versailles-Chantiers', sublabel: 'Versailles, 78000', keywords: ['versailles chantiers', 'versailles tgv'], lat: 48.7983, lng: 2.1289, codePostal: '78000' },
  // Autres lieux
  { label: 'Disneyland Paris', sublabel: 'Allée de la Belle au Bois Dormant, 77700 Chessy', keywords: ['disneyland', 'disney', 'chessy'], lat: 48.8722, lng: 2.7760, codePostal: '77700' },
  { label: 'Stade de France', sublabel: 'ZAC du Cornillon Nord, 93216 Saint-Denis', keywords: ['stade de france', 'stade france'], lat: 48.9244, lng: 2.3601, codePostal: '93216' },
  { label: 'Palais des Congrès de Paris', sublabel: '2 Place de la Porte Maillot, 75017 Paris', keywords: ['palais des congres', 'palais des congrès', 'porte maillot', 'congres', 'congrès'], lat: 48.8789, lng: 2.2833, codePostal: '75017' },
  { label: 'Paris Expo Porte de Versailles', sublabel: '1 Place de la Porte de Versailles, 75015 Paris', keywords: ['porte de versailles', 'expo versailles', 'parc des expositions'], lat: 48.8316, lng: 2.2882, codePostal: '75015' },
  { label: 'Parc des Expositions de Villepinte', sublabel: 'Z.A. Paris Nord 2, 93420 Villepinte', keywords: ['villepinte', 'parc villepinte', 'nord villepinte'], lat: 48.9696, lng: 2.5139, codePostal: '93420' },
  { label: 'Tour Eiffel', sublabel: 'Champ de Mars, 75007 Paris', keywords: ['tour eiffel', 'eiffel', 'champ de mars'], lat: 48.8584, lng: 2.2945, codePostal: '75007' },
  { label: 'Louvre', sublabel: 'Rue de Rivoli, 75001 Paris', keywords: ['louvre', 'musee du louvre', 'musée du louvre'], lat: 48.8606, lng: 2.3376, codePostal: '75001' },
  { label: 'La Défense', sublabel: 'Puteaux / Courbevoie, 92800', keywords: ['la defense', 'la défense', 'defense', 'défense', 'cnit', 'grande arche'], lat: 48.8924, lng: 2.2364, codePostal: '92800' },
]

export function searchLieux(q: string): LieuSuggestion[] {
  const lower = q.toLowerCase().trim()
  if (lower.length < 2) return []
  return LIEUX_CONNUS
    .filter(l => l.keywords.some(k => k.includes(lower) || lower.includes(k)))
    .map(l => ({ label: l.label, sublabel: l.sublabel, isLieu: true as const, lat: l.lat, lng: l.lng, codePostal: l.codePostal }))
    .slice(0, 3)
}
