-- Retrait des mesures produites par les essais, pas par des visiteurs.
--
-- Demande de l'exploitant, 2026-11-09 : « supprimer tous les tests que tu as
-- faits sur les analytiques ». Ils faussent les totaux, les trajets les plus
-- demandés, la répartition par véhicule et le tunnel de conversion.
--
-- PRINCIPE : chaque ligne retirée l'est pour un motif NOMMÉ, et seulement
-- quand la signature est celle d'une machine ou d'un essai répété. Les lignes
-- isolées, de jour, sur des trajets variés, sont CONSERVÉES — perdre de la
-- demande réelle coûterait plus cher que d'en garder une de trop.

-- ─────────────────────────────────────────────────────────────────────────
-- 1. estimations — 99 lignes
--
--   A. 09/11 01:11-01:16 — 56 lignes. `test-prix-grille.mjs` a parcouru 46
--      forfaits et 6 trajets au kilomètre : 9 à 12 estimations par minute sur
--      /reserver. Aucun visiteur ne fait ça.
--   B. 08/11 23:59 et 09/11 00:42-00:52 — 5 lignes. Simulations Senlis -> CDG
--      pour vérifier le correctif de la commune.
--   C. 08/11 08:35-08:36 et 13:59-14:02 — 9 lignes. Même trajet chiffré pour
--      berline / van / grand van en quelques secondes : on actionne le
--      sélecteur de véhicule, on ne réserve pas.
--   D. 07/11 00:20-00:21 — 3 lignes. Même triplet, en pleine nuit.
--   E. 06/11 23:53 — 10 lignes en 32 secondes (van 396 EUR / grand van
--      419 EUR alternés) : essai du tarif Grand Van.
--   F. 06/11 — 16 lignes STRICTEMENT identiques (SEN 60300 Senlis ->
--      commune non précisée, berline, 59 EUR, source reservation), par paires
--      à une minute d'intervalle de 11h08 à 21h02 : la boucle de test de la
--      réservation anglaise, mise en ligne ce jour-là.
--
-- CONSERVÉ volontairement :
--   – 08/11 18:18, Chantilly 79 EUR : visiteur réel, vérifié.
--   – 07/11 11:41-11:42 (139 puis 278 EUR, exactement le double) : signature
--     d'un essai d'aller-retour, mais en plein jour et isolé. Dans le doute,
--     on garde.
--   – tout ce qui précède le 06/11 : trajets variés, isolés, plausibles.

delete from estimations where id in (
  select id from (
    select id,
           (created_at at time zone 'Europe/Paris') as t,
           source, prix, adresse_depart, adresse_arrivee
    from estimations
  ) p
  where (t::date = '2026-11-09')                                              -- A + B
     or (t::date = '2026-11-08' and t::time >= '23:00')                       -- B
     or (t::date = '2026-11-08' and t::time between '08:35' and '08:37')      -- C
     or (t::date = '2026-11-08' and t::time between '13:59' and '14:03')      -- C
     or (t::date = '2026-11-07' and t::time between '00:20' and '00:22')      -- D
     or (t::date = '2026-11-06' and t::time between '23:53' and '23:54')      -- E
     or (t::date = '2026-11-06' and source = 'reservation' and prix = 59      -- F
         and adresse_depart = 'SEN, 60300 Senlis'
         and adresse_arrivee = 'commune non précisée')
);

-- ─────────────────────────────────────────────────────────────────────────
-- 2. funnel_events — le tunnel de conversion, pollué par les mêmes essais
--
-- Le repère le plus sûr ici n'est pas l'heure mais la FORME du trafic :
--   – 09/11 01h : 52 évènements pour UNE SEULE visite. Un visiteur ne charge
--     pas /reserver 52 fois en cinq minutes.
--   – 08/11 14h : 21 évènements pour 19 visites DISTINCTES en une heure.
--     Chaque navigateur piloté ouvre une session neuve : c'est la signature
--     inverse, et tout aussi reconnaissable.
--
-- On retire les fenêtres correspondant aux essais ci-dessus, pour que le
-- tunnel et les estimations racontent la même histoire.

delete from funnel_events where id in (
  select id from (
    select id, (created_at at time zone 'Europe/Paris') as t from funnel_events
  ) p
  where (t::date = '2026-11-09')                                         -- balayage + simulations
     or (t::date = '2026-11-08' and t::time >= '23:00')                  -- essais du soir
     or (t::date = '2026-11-08' and t::time between '13:30' and '15:00') -- diagnostics « commune »
     or (t::date = '2026-11-08' and t::time between '08:30' and '08:40') -- triplet de véhicules
     or (t::date = '2026-11-07' and t::time between '00:15' and '00:25')
     or (t::date = '2026-11-06' and t::time >= '23:45')
);

-- ─────────────────────────────────────────────────────────────────────────
-- NON TOUCHÉ, et dit à l'exploitant :
--   – `courses` et `devis` : aucune ligne d'essai sur 21 jours, vérifié.
--   – facture `OW-TEST-202609-003` : essai de septembre, hors analytique.
--     Supprimer une facture est une autre décision, elle n'est pas prise ici.
--   – les 49 estimations d'avant le 2026-10-22 qui contiennent encore une
--     adresse de rue complète : question de confidentialité, pas de mesure.
