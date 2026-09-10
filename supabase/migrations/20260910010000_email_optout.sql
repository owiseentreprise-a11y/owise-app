-- Table de désinscription aux emails marketing (relances devis)
CREATE TABLE IF NOT EXISTS email_optout (
  email      text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
