-- ============================================================================
-- Owise — Correction du statut de paiement des courses déjà encaissées
-- Créé : 2026-10-17
--
-- ⚠ CE FICHIER N'EST PAS À APPLIQUER AVEC LA MIGRATION PRÉCÉDENTE.
--
-- Il était l'étape 5 de `20261017000000_fiabilite_paiements.sql`. Il en a été
-- retiré le 2026-10-17 sur consigne explicite : « Ne pas modifier les statuts
-- des quatre courses historiques. »
--
-- La séparation a un bénéfice au-delà de la consigne : sans cet UPDATE, la
-- migration 20261017000000 devient PUREMENT ADDITIVE. Elle ne modifie plus
-- une seule ligne de `courses`, ce qui rend son retour arrière trivial — il
-- n'y a rien à restaurer, seulement un index et une contrainte à retirer.
--
-- QUAND L'APPLIQUER. Après le déploiement du nouveau webhook, et seulement si
-- vous décidez que les quatre courses encaissées doivent refléter leur
-- paiement. Deux raisons de le vouloir :
--   1. l'écran d'administration affiche « en attente » sur une course payée,
--      et un exploitant peut réclamer un paiement déjà reçu ;
--   2. la facturation mensuelle se protège du double débit avec ce champ.
--      (La barrière ajoutée au Sprint 2 — écarter toute course portant un
--      identifiant de paiement Stripe — protège déjà sans cet UPDATE.)
--
-- CE QU'IL FAIT, exactement. Factuel, pas une supposition : ces courses
-- portent un identifiant de paiement Stripe, donc l'argent est encaissé.
-- Les courses déjà 'remboursee' sont exclues, leur statut est plus précis.
--
-- Attendu au 2026-10-17 : 4 lignes — #D54590, #27BCE8, #821EE9, #68FFA3.
-- Vérifier ce nombre AVANT d'exécuter :
--     SELECT count(*) FROM courses
--      WHERE stripe_payment_intent_id IS NOT NULL
--        AND paiement_statut IS DISTINCT FROM 'paye'
--        AND paiement_statut IS DISTINCT FROM 'remboursee';
--
-- RETOUR ARRIÈRE. Les anciennes valeurs sont connues et toutes identiques
-- ('en_attente') ; elles sont relevées dans le rapport
-- audit-owise/20-SPRINT2-MIGRATION.md, section « empreinte avant migration ».
--     UPDATE courses SET paiement_statut = 'en_attente'
--      WHERE id IN (<les quatre identifiants>);
-- ============================================================================

UPDATE courses
   SET paiement_statut = 'paye'
 WHERE stripe_payment_intent_id IS NOT NULL
   AND paiement_statut IS DISTINCT FROM 'paye'
   AND paiement_statut IS DISTINCT FROM 'remboursee';
