-- Projet « Tarification v2 » — étape 2 : les tables du nouveau calcul.
--
-- Autorisé par l'exploitant le 2026-11-21 : « tu peux créer une nouvelle table,
-- mais il faut vraiment qu'on fasse la distinction entre les tarifs d'aujourd'hui
-- et [les nouveaux] … on va garder les deux … avec possibilité d'activer ou
-- désactiver l'une ou l'autre ».
--
-- RÈGLES (c:\websitebuilding\TARIFICATION-V2.md) :
--  · tables NEUVES seulement, préfixe v2_ ; AUCUNE table existante n'est
--    modifiée (tarifs, parametres, grilles_tarifaires, zones restent intactes) ;
--  · RLS activée sans aucune politique : seule la clé de service (pages
--    d'administration, après requireAdminClient) peut lire et écrire —
--    comme `tarifs` et `parametres`.
--
-- La tarification ACTUELLE reste celle du site. `v2_reglages.tarification_en_service`
-- vaut 'actuelle' et AUCUNE page publique ne le lit encore : le brancher est
-- l'étape 5, décision séparée de l'exploitant.

-- 1. La grille unique : une ligne par véhicule.
create table public.v2_grille_vehicules (
  vehicule        text primary key
                  check (vehicule in ('berline', 'berline_premium', 'van', 'grand_van')),
  prise_en_charge numeric not null check (prise_en_charge >= 0),
  prix_km         numeric not null check (prix_km >= 0),
  prix_heure      numeric not null check (prix_heure >= 0),
  minimum         numeric not null check (minimum >= 0),
  updated_at      timestamptz not null default now()
);
comment on table public.v2_grille_vehicules is
  'Tarification v2 (EN ESSAI, pas en service) : la grille unique, une ligne par véhicule. Modifier une ligne change le prix de tous les trajets de ce véhicule.';

-- 2. Les bases d'où partent les chauffeurs.
create table public.v2_bases (
  nom         text primary key,
  adresse     text not null,
  km_inclus   numeric not null check (km_inclus >= 0),
  min_inclus  numeric not null check (min_inclus >= 0),
  active      boolean not null default true,
  ordre       smallint not null default 0,
  updated_at  timestamptz not null default now()
);
comment on table public.v2_bases is
  'Tarification v2 (EN ESSAI) : bases des chauffeurs. L''approche jusqu''au client est incluse jusqu''à km_inclus / min_inclus ; au-delà elle est facturée.';

-- 3. Quelle tarification est en service. Une seule ligne.
create table public.v2_reglages (
  id                      smallint primary key default 1 check (id = 1),
  tarification_en_service text not null default 'actuelle'
                          check (tarification_en_service in ('actuelle', 'v2')),
  updated_at              timestamptz not null default now()
);
comment on column public.v2_reglages.tarification_en_service is
  'actuelle = les prix du site viennent de tarifs/grilles_tarifaires (en service). v2 = nouvelle grille. NON LU par le site tant que l''étape 5 n''est pas décidée.';

-- 4. Les distances des courses passées, mesurées une fois par Google (durée
--    normale), pour recalculer leur prix v2 à chaque réglage sans rappeler Google.
create table public.v2_mesures_courses (
  course_id    uuid primary key references public.courses(id) on delete cascade,
  trajet_km    numeric not null,
  trajet_min   numeric not null,
  retour_km    numeric not null,
  retour_min   numeric not null,
  approches    jsonb   not null,   -- { "<nom de base>": { "km": n, "min": n } | null }
  mise_de_cote text,               -- raison si la course est écartée des comparaisons
  mesure_le    timestamptz not null default now()
);
comment on table public.v2_mesures_courses is
  'Tarification v2 : distances Google des courses terminées (lecture seule de courses). Donnée dérivée, supprimée avec la course.';

alter table public.v2_grille_vehicules enable row level security;
alter table public.v2_bases            enable row level security;
alter table public.v2_reglages         enable row level security;
alter table public.v2_mesures_courses  enable row level security;

-- Valeurs de départ : le journal du 2026-11-18 et du 2026-11-21
-- (= GRILLE_DE_DEPART de src/lib/tarification-v2/grille.ts).
insert into public.v2_grille_vehicules (vehicule, prise_en_charge, prix_km, prix_heure, minimum) values
  ('berline',         0, 0.40, 25,   59),
  ('berline_premium', 0, 0.52, 32.5, 77),
  ('van',             0, 0.60, 37.5, 89),
  ('grand_van',       0, 0.72, 45,   107);

insert into public.v2_bases (nom, adresse, km_inclus, min_inclus, active, ordre) values
  ('Roissy-CDG',     'Aéroport Paris-Charles de Gaulle, France', 35, 35, true, 1),
  ('Paris Châtelet', 'Châtelet, 75001 Paris, France',            30, 30, true, 2);

insert into public.v2_reglages (id, tarification_en_service) values (1, 'actuelle');
