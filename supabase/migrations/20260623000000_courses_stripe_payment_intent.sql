-- ============================================================
-- Owise — Traçabilité du paiement Stripe sur les courses
-- Créé : 2026-06-23
-- À appliquer via : Supabase Dashboard > SQL Editor
--
-- Contexte : Stripe est passé en mode live ce soir. Aucune colonne ne
-- garde l'identifiant du paiement (payment_intent) sur la course créée
-- par le webhook — impossible de rembourser un client depuis l'admin
-- sans chercher la charge à la main dans Stripe par date/montant/email.
-- ============================================================

ALTER TABLE courses ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;
