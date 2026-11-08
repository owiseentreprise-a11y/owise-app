-- Estimations : ce que le visiteur a réellement tapé, et par où il est arrivé.
--
-- Décision de l'exploitant, 2026-11-09. Jusqu'ici la table ne gardait que la
-- commune et la zone tarifaire — forme anonyme, écrite sans consentement.
-- L'exploitant a besoin des adresses exactes pour auditer ses prix et
-- comprendre la demande, et a tranché en connaissance de cause après que la
-- contrepartie lui a été exposée (la table cesse d'être anonyme alors qu'elle
-- continue d'être écrite sans consentement ; la page de confidentialité doit
-- le déclarer).
--
-- Les colonnes généralisées existantes NE CHANGENT PAS : `adresse_depart` et
-- `adresse_arrivee` continuent de recevoir « SEN, 60300 Senlis » et restent la
-- source des agrégats de /admin/estimations. Le détail arrive à côté. Un
-- écran, un contrôle ou un export qui lit les anciennes colonnes ne voit
-- aucune différence.

alter table estimations
  add column if not exists adresse_depart_saisie  text,
  add column if not exists adresse_arrivee_saisie text,
  -- La page où la simulation a eu lieu : « / », « /vtc-chantilly », « /en/book ».
  add column if not exists page         text,
  -- Le canal d'arrivée en un mot : direct, google, chatgpt, perplexity, reseaux…
  -- Calculé par `canalDepuisReferent()` de src/lib/origine-visite.ts, côté
  -- serveur, à partir du référent brut. Une seule écriture de la règle.
  add column if not exists canal        text,
  -- Le référent brut, tel que le navigateur l'a donné, pour pouvoir revenir
  -- sur un canal mal classé sans avoir à rejouer la visite.
  add column if not exists referent     text,
  add column if not exists utm_source   text,
  add column if not exists utm_campaign text;

-- Lecture courante de l'écran : les dernières estimations, et le comptage par
-- canal sur une période.
create index if not exists estimations_canal_date_idx
  on estimations (canal, created_at desc);
