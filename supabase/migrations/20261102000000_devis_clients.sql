-- Les devis commerciaux, ceux qu'on adresse a un client avant la course.
--
-- POURQUOI CETTE TABLE EXISTE
--
-- Owise savait faire deux choses, et pas celle du milieu :
--
--   `devis`    les demandes envoyees depuis le formulaire du site. UNE course,
--              un prix, des relances automatiques. C'est un suivi de prospects.
--   `factures` le document numerote remis apres la prestation, dont les lignes
--              viennent exclusivement des `courses` rattachees.
--
-- Entre les deux, rien. Le 2026-11-02, un devis de huit transferts pour une
-- cliente a du etre compose dans un fichier HTML pose sur le disque de
-- l'exploitant : introuvable depuis un telephone, perdu si la machine lache,
-- et a ressaisir entierement course par course en cas d'accord.
--
-- LES LIGNES SONT EN JSONB, PAS DANS UNE TABLE FILLE
--
-- Un devis se lit et s'ecrit toujours en entier : on ne cherche jamais « les
-- lignes a 99 EUR de novembre ». Une table fille imposerait une jointure, une
-- colonne de rang a maintenir et des suppressions en cascade, pour aucun
-- usage reel. `blog_posts` stocke deja ses paragraphes et sa FAQ ainsi.
--
-- Forme d'une ligne :
--   { "heure": "10h15", "depart": "...", "arrivee": "...",
--     "vehicule": "1 van", "passagers": 4, "prix": 99, "observations": "" }

CREATE TABLE IF NOT EXISTS devis_clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- DEV-202611-0001. Meme forme que les factures, serie distincte.
  numero          text NOT NULL UNIQUE,

  -- Le nom suffit : une societe sans nom de contact n'existe pas, l'inverse
  -- si. Le devis du 2026-11-02 est parti sans societe, et c'etait regulier :
  -- les coordonnees d'entreprise ne sont obligatoires que sur la facture.
  client_nom      text NOT NULL,
  client_societe  text,
  client_email    text,
  client_tel      text,
  client_adresse  text,

  date_prestation date,
  date_validite   date,

  statut          text NOT NULL DEFAULT 'brouillon',

  lignes          jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Recalcule a chaque enregistrement depuis `lignes`. Stocke quand meme :
  -- la liste doit pouvoir s'afficher sans ouvrir chaque devis.
  total_ht        numeric NOT NULL DEFAULT 0,

  -- Les conditions d'attente, en jetons plutot qu'en phrase : le document les
  -- redige, la base ne porte que les deux nombres qui changent d'un client a
  -- l'autre. NULL sur `attente_tarif_heure` = pas de clause d'attente.
  attente_offerte_min   integer,
  attente_tarif_heure   numeric,

  notes           text,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Un devis accepte devient des courses et une facture ; un devis refuse ou
-- expire reste, parce qu'un historique de ce qu'on a propose a de la valeur.
ALTER TABLE devis_clients DROP CONSTRAINT IF EXISTS devis_clients_statut_valide;
ALTER TABLE devis_clients ADD CONSTRAINT devis_clients_statut_valide
  CHECK (statut IN ('brouillon', 'envoye', 'accepte', 'refuse', 'expire'));

-- La liste s'affiche du plus recent au plus ancien, et le filtre par statut
-- est le seul autre acces prevu.
CREATE INDEX IF NOT EXISTS devis_clients_recents_idx
  ON devis_clients (created_at DESC);
CREATE INDEX IF NOT EXISTS devis_clients_statut_idx
  ON devis_clients (statut, created_at DESC);

-- Aucun visiteur ne doit lire un devis : il porte le nom, le telephone et
-- l'e-mail d'un client. Seul le service d'administration y accede, par la cle
-- de service, qui ne passe pas par RLS. Aucune regle n'est donc declaree :
-- `anon` et `authenticated` ne voient rien.
ALTER TABLE devis_clients ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE  devis_clients IS
  'Devis commerciaux multi-lignes adresses a un client. Distinct de `devis` (demandes du site) et de `factures` (document d''apres-course).';
COMMENT ON COLUMN devis_clients.lignes IS
  'Prestations du devis, dans l''ordre d''affichage. Chaque entree : heure, depart, arrivee, vehicule, passagers, prix, observations.';
COMMENT ON COLUMN devis_clients.total_ht IS
  'Somme des prix des lignes. Recalculee a chaque enregistrement, jamais saisie.';
COMMENT ON COLUMN devis_clients.attente_tarif_heure IS
  'Tarif horaire d''attente au-dela de la franchise. NULL = aucune clause d''attente sur ce devis.';
