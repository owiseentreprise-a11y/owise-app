-- Le kilomètre au-delà du forfait d'une mise à disposition.
--
-- POURQUOI UNE COLONNE SÉPARÉE DE `prix_km`
--
-- `prix_km` est le tarif d'un TRANSFERT : on paie la distance, c'est le
-- service. `prix_km_sup` est une PÉNALITÉ de dépassement sur une prestation
-- vendue à l'heure. Les deux n'ont ni la même nature ni le même montant, et
-- le marché parisien les sépare franchement : 1,25 €/km en transfert contre
-- 2,00 €/km au-delà du forfait, parfois 2,75 € ou 4,25 € en haut de gamme.
--
-- C'est volontaire et c'est sain : à ce prix, un client qui roule beaucoup a
-- intérêt à réserver un transfert. Les deux offres cessent de se concurrencer.
--
-- LES VALEURS, validées par l'exploitant le 2026-11-13 après étude du marché
-- (Blacklane, Chabé, VTChal, chauffeurs-vtc.fr, VTC Paris 75). Elles se
-- modifient ensuite depuis /admin/tarifs, comme tous les autres tarifs.
--
-- NULLABLE : un véhicule sans ce prix n'affiche aucune limite chiffrée.
-- Ne pas lui donner de valeur de repli dans le code — le silence est
-- l'information, comme pour `prix_heure`.

alter table public.tarifs
  add column if not exists prix_km_sup numeric;

comment on column public.tarifs.prix_km_sup is
  'Mise à disposition : prix du kilomètre au-delà du forfait inclus, en euros. NULL = non facturé.';

update public.tarifs set prix_km_sup = 2.00 where vehicule = 'Berline';
update public.tarifs set prix_km_sup = 2.50 where vehicule = 'Berline Premium';
update public.tarifs set prix_km_sup = 2.50 where vehicule = 'Van 7 places';
update public.tarifs set prix_km_sup = 3.00 where vehicule = 'Grand Van 8 places';
