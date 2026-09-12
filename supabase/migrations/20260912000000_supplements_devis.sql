-- Migration : rend activables/désactivables et éditables depuis /admin/tarifs
-- les 3 options supplémentaires du formulaire de devis (bagages, panneau
-- nominatif, animal de compagnie), auparavant codées en dur dans le front.

ALTER TABLE parametres
  ADD COLUMN IF NOT EXISTS supplement_bagages_actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supplement_bagages_prix  numeric NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS supplement_panneau_actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supplement_panneau_prix  numeric NOT NULL DEFAULT 8,
  ADD COLUMN IF NOT EXISTS supplement_animaux_actif boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS supplement_animaux_prix  numeric NOT NULL DEFAULT 15;
