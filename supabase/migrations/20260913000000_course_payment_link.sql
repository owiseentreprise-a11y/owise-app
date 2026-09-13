-- Lien de paiement Stripe généré à la demande pour une course (réservations
-- prises par téléphone/WhatsApp), envoyable par email ou WhatsApp depuis
-- /admin/courses/[id]. passager_email complète passager_prenom/nom/tel déjà
-- en place, pour pouvoir envoyer par email même sans compte client créé.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS stripe_payment_link text,
  ADD COLUMN IF NOT EXISTS passager_email text;
