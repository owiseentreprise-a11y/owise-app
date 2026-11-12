-- La mise à disposition : un chauffeur réservé à l'heure, sans destination.
--
-- POURQUOI CETTE COLONNE
--
-- Mesure Search Console du 2026-11-12 : la recherche « private chauffeur in
-- paris for a full day, how much » montre owise.fr 29 fois en huit semaines,
-- en position 9,4 — page 1 — et récolte ZÉRO clic. Les gens demandent le
-- prix, et le site n'avait aucune page pour y répondre : une seule phrase,
-- en bas de /en/private-chauffeur-paris, disait d'écrire un e-mail.
--
-- POURQUOI DANS `tarifs` ET PAS DANS `parametres`
--
-- `tarifs` porte déjà une ligne par véhicule, avec sa prise en charge et son
-- prix au kilomètre. Le tarif horaire est de la même nature : il appartient
-- au véhicule. Le mettre ici lui donne automatiquement sa place sur la carte
-- du véhicule dans /admin/tarifs, à côté des deux autres, au lieu d'un
-- réglage isolé que personne ne retrouverait.
--
-- NULLABLE, ET C'EST VOULU. Un véhicule sans tarif horaire s'affiche
-- « sur devis » plutôt qu'à un prix inventé. Ne jamais remplacer ce NULL par
-- une valeur de repli dans le code : le silence est l'information.

alter table public.tarifs
  add column if not exists prix_heure numeric;

comment on column public.tarifs.prix_heure is
  'Tarif de mise à disposition, en euros par heure entamée. NULL = sur devis.';

-- Les quatre prix donnés par l'exploitant le 2026-11-12, le dernier le
-- lendemain. On vise par le nom exact de `gamme.ts` (`nomTarif`), seule
-- source des noms de véhicule.
update public.tarifs set prix_heure = 60 where vehicule = 'Berline';
update public.tarifs set prix_heure = 70 where vehicule = 'Berline Premium';
update public.tarifs set prix_heure = 70 where vehicule = 'Van 7 places';
update public.tarifs set prix_heure = 80 where vehicule = 'Grand Van 8 places';
