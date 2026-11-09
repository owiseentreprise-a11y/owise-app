-- Le Grand Van 8 places reçoit sa propre ligne de tarif.
--
-- Signalé par l'exploitant le 2026-11-09 : dans /admin/tarifs, « Tarifs de
-- base par véhicule » ne montrait que trois cartes. Le 8 places n'y était pas,
-- et son prix n'était réglable NULLE PART : il dérivait de celui du Van 7
-- places (+ 0,10 € du kilomètre) écrit en dur dans `calcPrix.ts`.
--
-- LES VALEURS NE SONT PAS CHOISIES : ce sont celles qui s'appliquaient déjà.
--   prise en charge  49,00 €   = celle du Van 7 places (le supplément de 20 €
--                                ne porte que sur les FORFAITS, pas sur le km)
--   prix au km        1,65 €   = 1,55 € du van + 0,10 € de surcoût
-- Aucun client ne verra le moindre changement de prix tant que l'exploitant
-- n'aura pas modifié la carte lui-même. Vérifié par
-- `scripts/test-tarif-grand-van.mts`, qui compare les deux états sur dix
-- distances, détours d'étape compris.
--
-- ORDRE SANS IMPORTANCE. Le code sait se passer de cette ligne : sans elle,
-- `tarifPourVehicule()` se rabat sur celle du van, surcoût compris, et le prix
-- est rigoureusement le même. Sans ce repli, la recherche échouerait et le
-- calcul retomberait sur 15 € + 2 €/km — soit MOINS cher que le van 7 places,
-- le défaut corrigé le 2026-11-03.
--
-- `where not exists` : relancer ce fichier ne crée pas de doublon et n'écrase
-- aucun réglage que l'exploitant aurait déjà saisi.

insert into tarifs (vehicule, prise_en_charge, prix_km)
select 'Grand Van 8 places', 49.00, 1.65
where not exists (select 1 from tarifs where vehicule = 'Grand Van 8 places');
