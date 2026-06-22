-- ============================================================
-- Owise — Index de performance sur les colonnes filtrées en permanence
-- Créé : 2026-06-22
-- À appliquer via : Supabase Dashboard > SQL Editor
--
-- Contexte : aucun index n'était déclaré sur ces colonnes alors qu'elles
-- sont filtrées dans le dashboard admin, le dispatch, le planning, les
-- stats, et les portails client/chauffeur/sous-traitant. Sans impact
-- mesurable aujourd'hui (faible volume), mais devient un goulot
-- d'étranglement classique dès que les courses s'accumulent — autant
-- le faire maintenant que ça ne coûte rien.
-- ============================================================

-- courses : statut filtré en permanence (panier, dispatch, historique...)
CREATE INDEX IF NOT EXISTS courses_statut_idx          ON courses (statut);
CREATE INDEX IF NOT EXISTS courses_client_id_idx       ON courses (client_id);
CREATE INDEX IF NOT EXISTS courses_chauffeur_id_idx    ON courses (chauffeur_id);
CREATE INDEX IF NOT EXISTS courses_sous_traitant_id_idx ON courses (sous_traitant_id);
CREATE INDEX IF NOT EXISTS courses_date_prevue_idx     ON courses (date_prevue);

-- factures : liste par client (espace client + admin)
CREATE INDEX IF NOT EXISTS factures_client_id_idx ON factures (client_id);

-- chauffeurs : liste des chauffeurs d'un sous-traitant (portail ST + admin)
CREATE INDEX IF NOT EXISTS chauffeurs_sous_traitant_id_idx ON chauffeurs (sous_traitant_id);

-- collaborateurs : liste par client (CRM, espace client)
CREATE INDEX IF NOT EXISTS collaborateurs_client_id_idx ON collaborateurs (client_id);

-- factures_sous_traitants : liste par sous-traitant (portail ST)
CREATE INDEX IF NOT EXISTS factures_st_sous_traitant_id_idx ON factures_sous_traitants (sous_traitant_id);
