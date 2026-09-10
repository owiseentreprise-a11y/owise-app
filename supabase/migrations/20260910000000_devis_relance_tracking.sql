-- Migration : tracking des relances email sur les devis non-convertis
-- Séquence automatique J+1 / J+4 / J+7

ALTER TABLE devis
  ADD COLUMN IF NOT EXISTS relance_j1_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relance_j4_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS relance_j7_sent boolean NOT NULL DEFAULT false;
