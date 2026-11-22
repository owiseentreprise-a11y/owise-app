-- Projet « Tarification v2 » — zone d'action d'une base (décision de
-- l'exploitant, 2026-11-22 : « on va mettre quand même un rayon de 10 km »
-- pour la base de Chantilly).
--
-- zone_km = la base n'est proposée que si le client PART ou ARRIVE à moins de
-- zone_km (distance routière depuis / jusqu'à la base). NULL = aucune limite.
-- Ce n'est PAS un nombre de km offerts : le circuit réel reste payé en entier.
-- Table v2_ du projet ; aucune table de la tarification actuelle touchée.

alter table public.v2_bases add column if not exists zone_km numeric check (zone_km is null or zone_km >= 0);
comment on column public.v2_bases.zone_km is
  'Zone d''action : la base ne sert que si le départ ou l''arrivée est à moins de zone_km (route). NULL = sans limite. Décision du 2026-11-22.';
update public.v2_bases set zone_km = 10 where nom = 'Chantilly';
