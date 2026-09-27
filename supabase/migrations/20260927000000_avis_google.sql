-- Nombre et note des avis Google, pour que le site cesse de les annoncer en dur.
--
-- Les pages declaraient « 5 avis » dans leurs donnees structurees alors que la
-- fiche Google en portait 7, notes 5,0. Un chiffre ecrit dans le code se perime
-- sans que personne ne s'en apercoive ; ici il a une seule source, et la tache
-- /api/cron/gbp-post peut la rafraichir.
--
-- Valeurs de depart : relevees sur l'API Google Business le 2026-09-27.

ALTER TABLE parametres
  ADD COLUMN IF NOT EXISTS avis_nombre integer,
  ADD COLUMN IF NOT EXISTS avis_note   numeric(2,1);

UPDATE parametres
   SET avis_nombre = COALESCE(avis_nombre, 7),
       avis_note   = COALESCE(avis_note, 5.0);

COMMENT ON COLUMN parametres.avis_nombre IS
  'Nombre d''avis sur la fiche Google Business. Source unique pour le balisage aggregateRating du site.';
COMMENT ON COLUMN parametres.avis_note IS
  'Note moyenne de la fiche Google Business, sur 5.';
