-- Trace chaque étape du tunnel devis → réservation → paiement, pour savoir
-- exactement où les visiteurs décrochent (diagnostic "0 conversion" du 2026-09-12 :
-- 128 devis générés en 48j, 0 paiement Stripe, 0 demande de rappel réelle).
-- Insertion en écriture seule via service role (soumise par des visiteurs anonymes).
CREATE TABLE IF NOT EXISTS funnel_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  session_id text NOT NULL,
  step       text NOT NULL,
  page       text,
  meta       jsonb
);

CREATE INDEX IF NOT EXISTS funnel_events_step_idx ON funnel_events (step, created_at);
CREATE INDEX IF NOT EXISTS funnel_events_session_idx ON funnel_events (session_id, created_at);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
-- Aucune policy pour anon/authenticated : seul le service role (server actions) écrit et lit.
