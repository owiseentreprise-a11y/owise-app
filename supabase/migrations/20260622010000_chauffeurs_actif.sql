-- ============================================================
-- Owise — Colonne actif sur chauffeurs (parité avec sous_traitants.actif)
-- Créé : 2026-06-22
-- À appliquer via : Supabase Dashboard > SQL Editor
--
-- Contexte : desactiverChauffeurAction ne touchait que statut/disponible,
-- des champs que le chauffeur peut re-modifier lui-même depuis son app
-- (toggle disponibilité). Résultat : un admin qui "désactive" un chauffeur
-- n'avait aucune garantie que ça reste vrai. actif est un flag distinct,
-- contrôlé uniquement par l'admin, qui décide de l'éligibilité à de
-- nouvelles courses — exactement le rôle que joue déjà sous_traitants.actif.
-- ============================================================

ALTER TABLE chauffeurs ADD COLUMN IF NOT EXISTS actif BOOLEAN NOT NULL DEFAULT true;
