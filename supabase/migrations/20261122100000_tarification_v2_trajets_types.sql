-- Projet « Tarification v2 » — le banc de trajets types.
--
-- Autorisé par l'exploitant le 2026-11-21 (« ok » à : « le banc de trajets a
-- besoin d'une nouvelle table dans la base, à part, préfixée v2_ »). Demande :
-- « faire des simulations sur la tarification v2 … toutes les destinations …
-- des tests réalistes », plutôt que les seules courses passées.
--
-- Une ligne = un trajet représentatif (commune d'une page ville → aéroport ou
-- Paris), mesuré UNE fois par Google. Les prix ne sont PAS stockés : le prix
-- actuel et le prix v2 sont recalculés à l'affichage, avec les tarifs du
-- moment — un tarif modifié dans /admin/tarifs ou dans la grille v2 se voit
-- aussitôt.
--
-- Table NEUVE, aucune table existante modifiée. RLS sans politique (clé de
-- service seulement), comme les autres tables v2_.

create table public.v2_trajets_types (
  id           uuid primary key default gen_random_uuid(),
  groupe       text not null,          -- destination : 'Roissy-CDG', 'Orly', 'Beauvais', 'Paris'
  ordre        smallint not null default 0,
  depart       text not null,          -- libellé tel qu'un client le saisirait
  arrivee      text not null,
  depart_cp    text not null,          -- code postal rendu par Google (détection de zone du site)
  arrivee_cp   text not null,
  distance_km  numeric not null,       -- distance routière du site (lib/geo.ts), pour le prix au km actuel
  trajet_km    numeric not null,       -- mesures v2 : durée NORMALE, sans heure de départ
  trajet_min   numeric not null,
  retour_km    numeric not null,
  retour_min   numeric not null,
  approches    jsonb   not null,       -- { "<base>": { "km": n, "min": n } | null }
  mesure_le    timestamptz not null default now(),
  unique (depart, arrivee)
);
comment on table public.v2_trajets_types is
  'Tarification v2 (EN ESSAI) : trajets représentatifs de toutes les destinations, mesurés une fois par Google ; prix recalculés à l''affichage.';

alter table public.v2_trajets_types enable row level security;
