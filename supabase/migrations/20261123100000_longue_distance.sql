-- Longue distance (décision de l'exploitant du 2026-11-23).
-- Au-delà de parametres.seuil_longue_distance_km, chaque km se paie
-- tarifs.prix_km_longue_distance (aller + retour à vide). Calcul :
-- calculerPrixKm, src/lib/calcPrix.ts. Colonnes VIDES à la création :
-- la règle est coupée tant que l'exploitant ne les remplit pas (/admin/tarifs).
alter table public.tarifs add column if not exists prix_km_longue_distance numeric
  check (prix_km_longue_distance is null or prix_km_longue_distance > 0);
comment on column public.tarifs.prix_km_longue_distance is
  'Longue distance : € du km au-delà de parametres.seuil_longue_distance_km. Vide = pas de règle pour ce véhicule. (2026-11-23)';
alter table public.parametres add column if not exists seuil_longue_distance_km numeric not null default 0
  check (seuil_longue_distance_km >= 0);
comment on column public.parametres.seuil_longue_distance_km is
  'Longue distance : au-delà de ce nombre de km, tarifs.prix_km_longue_distance s''applique. 0 = règle coupée. (2026-11-23)';
