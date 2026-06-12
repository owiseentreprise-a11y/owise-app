-- ============================================================
-- Owise — Suivi estimations anonymes
-- Créé : 2026-06-12
-- À appliquer via : Supabase Dashboard > SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS estimations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  adresse_depart   TEXT        NOT NULL,
  adresse_arrivee  TEXT        NOT NULL,
  vehicule         TEXT,
  prix             NUMERIC,
  source           TEXT        NOT NULL DEFAULT 'vitrine',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index pour les requêtes admin (ordre chronologique, filtres par source)
CREATE INDEX IF NOT EXISTS estimations_created_at_idx ON estimations (created_at DESC);
CREATE INDEX IF NOT EXISTS estimations_source_idx     ON estimations (source);

-- RLS : insert ouvert à tous (tracking anonyme), lecture réservée au service_role (bypass RLS)
ALTER TABLE estimations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "estimations_public_insert" ON estimations
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);
