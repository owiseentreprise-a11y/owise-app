-- La contrainte de `paiement_statut` refusait « autorise » et « libere ».
--
-- DÉFAUT TROUVÉ LE 2026-11-08, EN EXÉCUTANT VRAIMENT LA CHAÎNE.
--
-- `courses.paiement_statut` est une colonne `text`, et je m'en étais assuré
-- en lisant `information_schema.columns`. Ce que je n'avais PAS regardé :
-- elle porte une contrainte CHECK qui limite ses valeurs à six —
-- en_attente, a_percevoir, paye, echoue, remboursee, contestee.
--
-- Le blocage de carte du Grand Van écrit « autorise », et sa libération
-- écrit « libere ». Les deux étaient donc REFUSÉS par la base.
--
-- CE QUE CELA AURAIT DONNÉ EN PRODUCTION, à la première réservation
-- 8 places : la carte du client retenue chez Stripe, le webhook en erreur
-- 500, AUCUNE course créée, et rien pour le signaler à l'exploitant. C'est
-- mot pour mot l'incident des réservations perdues du 2026-10-07 — deux
-- clients payés sans course.
--
-- Aucun contrôle statique ne pouvait le voir : le code est juste, les types
-- concordent, tout compile. Il a fallu faire tourner le webhook pour de vrai
-- dans l'environnement isolé. C'est la raison d'être de ce banc d'essai, et
-- la démonstration qu'une lecture attentive ne remplace pas une exécution.
--
-- Les six valeurs d'origine sont conservées telles quelles : on élargit, on
-- ne remplace pas. Une course déjà en base garde son statut.

alter table courses drop constraint if exists courses_paiement_statut_valide;

alter table courses add constraint courses_paiement_statut_valide
  check (
    paiement_statut is null
    or paiement_statut = any (array[
      'en_attente',   -- créée, rien encaissé
      'a_percevoir',  -- à encaisser à bord
      'paye',         -- encaissé
      'echoue',       -- le paiement a échoué
      'remboursee',   -- remboursé après encaissement
      'contestee',    -- contestation bancaire
      'autorise',     -- carte RETENUE, pas débitée — en attente de validation
      'libere'        -- retenue levée : le client n'a rien payé
    ])
  );

comment on constraint courses_paiement_statut_valide on courses is
  'autorise = carte retenue sans debit (Grand Van en attente de validation) ; libere = retenue levee, client non debite.';
