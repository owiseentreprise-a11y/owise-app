-- Migration : ajoute l'option "Siège enfant" au formulaire de devis,
-- sur le même modèle que bagages/panneau/animaux (migration précédente).

ALTER TABLE parametres
  ADD COLUMN IF NOT EXISTS supplement_siege_enfant_actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supplement_siege_enfant_prix  numeric NOT NULL DEFAULT 10;
