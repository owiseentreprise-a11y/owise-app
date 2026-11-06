-- Un prix propre à un véhicule sur un trajet donné, quand on en veut un.
--
-- CE QUI EXISTAIT AVANT, mesuré le 2026-11-07 :
--   · `grilles_tarifaires` ne porte QU'UNE colonne de prix, `prix_berline` ;
--   · le prix Premium et le prix Van en découlent par multiplication
--     (×1,5 et ×1,7, réglables dans `parametres`) ;
--   · le Grand Van 8 places en découle à son tour : prix du Van + 20 €.
--
-- Autrement dit, sur les 127 trajets de la grille, l'exploitant ne pouvait
-- fixer qu'un seul chiffre par trajet. Impossible de dire « Creil → CDG en
-- van coûte exactement 110 € » sans déplacer le van sur les 126 autres.
--
-- CES COLONNES SONT FACULTATIVES, ET C'EST LE CŒUR DE LA CONCEPTION.
-- `null` — la valeur de toutes les lignes au moment de cette migration —
-- signifie « garder le calcul par coefficient », c'est-à-dire exactement le
-- comportement d'hier. Un montant signifie « sur ce trajet, ce véhicule coûte
-- ce prix-là, un point c'est tout ».
--
-- Conséquence voulue : cette migration ne déplace AUCUN prix le jour où elle
-- s'applique. Et l'exploitant ne remplit que les trajets qui comptent pour
-- lui — remplir 3 × 127 cases à la main ne serait jamais fait, et une grille
-- à moitié remplie à la main serait pire qu'un coefficient.
--
-- LE GRAND VAN est le cas qui a motivé tout ceci. Il est « sur devis » parce
-- que sa disponibilité dépend d'un partenaire ET parce que son prix n'est pas
-- chiffré d'avance. Avec `prix_grand_van` renseigné sur un trajet, le second
-- motif disparaît : le client voit un prix ferme, mais passe toujours par une
-- demande, et l'exploitant confirme la disponibilité avant le paiement.
-- Décision de l'exploitant, 2026-11-07. Le premier motif, lui, reste entier.
--
-- RAPPEL QUI A FAILLI COÛTER CHER ICI : ajouter une colonne ne suffit pas.
-- Cinq pages — dont l'accueil et les 38 pages villes — lisaient la grille
-- avec un `select` de trois colonnes nommées à la main. Elles n'auraient
-- jamais vu ces prix, et auraient affiché le tarif par coefficient pendant
-- que /reserver affichait le prix fixé. La liste `COLONNES_GRILLE` de
-- `calcPrix.ts` existe pour que cela ne puisse plus arriver.

alter table grilles_tarifaires
  add column if not exists prix_berline_premium numeric(10,2),
  add column if not exists prix_van             numeric(10,2),
  add column if not exists prix_grand_van       numeric(10,2);

comment on column grilles_tarifaires.prix_berline_premium is
  'Prix ferme de la Berline Premium sur ce trajet. NULL = prix berline × coef_berline_premium.';
comment on column grilles_tarifaires.prix_van is
  'Prix ferme du Van 7 places sur ce trajet. NULL = prix berline × coef_van.';
comment on column grilles_tarifaires.prix_grand_van is
  'Prix ferme du Grand Van 8 places sur ce trajet. NULL = prix van + supplément Grand Van, et le trajet reste « sur devis » sans montant annoncé.';
