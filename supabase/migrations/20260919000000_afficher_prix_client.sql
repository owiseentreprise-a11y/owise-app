-- Confidentialité des prix côté passager.
--
-- Un collaborateur qui réserve pour le compte de son entreprise ne doit pas
-- voir le montant : c'est une information commerciale entre Owise et
-- l'entreprise. Un particulier, lui, paie lui-même et doit le voir.
--
-- NULL = on applique la règle par défaut selon le type de compte :
--   entreprise  -> prix masqué
--   particulier -> prix affiché
-- true / false = choix explicite qui l'emporte sur la règle.
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS afficher_prix boolean;

COMMENT ON COLUMN clients.afficher_prix IS
  'Affichage du prix dans les emails passager (confirmation, reçu). NULL = défaut selon type_compte : masqué pour entreprise, affiché pour particulier.';
