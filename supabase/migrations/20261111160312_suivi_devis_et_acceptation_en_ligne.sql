-- Le client accepte son devis lui-même, depuis un lien privé.
--
-- Appliquée en base le 2026-11-11 ; ce fichier la met dans l'historique du
-- dépôt, pour que le banc d'essai et toute base repartant de zéro la jouent
-- comme les autres. Nom et horodatage repris à l'identique de la base.
--
-- Ce que chaque colonne porte :
--   envoye_le / envoye_a  — la preuve que le devis est parti, et à qui ;
--   jeton                 — le lien privé /devis/<jeton>, créé à l'envoi ;
--   vu_le                 — première ouverture par le client ;
--   accepte_le            — son clic : l'acceptation lui appartient ;
--   carte_requise         — exigée par défaut ; levée sur un habitué ;
--   stripe_session_id     — la retenue de carte correspondante.

alter table public.devis_clients
  add column if not exists envoye_le         timestamptz,
  add column if not exists envoye_a          text,
  add column if not exists jeton             text,
  add column if not exists vu_le             timestamptz,
  add column if not exists accepte_le        timestamptz,
  add column if not exists carte_requise     boolean not null default true,
  add column if not exists stripe_session_id text;

-- Index PARTIEL : deux devis sans jeton ne doivent pas se gêner, mais deux
-- devis ne peuvent jamais partager un lien.
create unique index if not exists devis_clients_jeton_unique
  on public.devis_clients (jeton)
  where jeton is not null;
