-- ============================================================
-- Owise VTC — Schéma PostgreSQL (synchronisé depuis production)
-- Dernière mise à jour : 2026-06-02
-- Projet Supabase : fbawdscnczdpjsbvyhfe (eu-west-3)
-- ============================================================

-- ── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ── Types ENUM ──────────────────────────────────────────────
CREATE TYPE role_utilisateur   AS ENUM ('admin', 'client', 'chauffeur');
CREATE TYPE statut_chauffeur   AS ENUM ('disponible', 'en_course', 'hors_ligne');
CREATE TYPE type_contrat       AS ENUM ('salarie', 'sous_traitant');
CREATE TYPE type_vehicule      AS ENUM ('berline', 'berline_premium', 'van_7', 'grand_van_8');
CREATE TYPE statut_course      AS ENUM ('en_attente', 'acceptee', 'en_route', 'prise_en_charge', 'terminee', 'annulee');
CREATE TYPE statut_facture     AS ENUM ('en_attente', 'payee', 'retard');
CREATE TYPE type_document      AS ENUM ('carte_vtc', 'assurance_rc', 'visite_medicale', 'permis');
CREATE TYPE statut_document    AS ENUM ('valide', 'bientot_expire', 'expire');

-- ── profiles ────────────────────────────────────────────────
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        role_utilisateur NOT NULL DEFAULT 'client',
  nom         TEXT NOT NULL DEFAULT '',
  prenom      TEXT NOT NULL DEFAULT '',
  telephone   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── clients ─────────────────────────────────────────────────
CREATE TABLE clients (
  id                  UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES auth.users(id),
  type_compte         TEXT NOT NULL DEFAULT 'particulier',
  entreprise_nom      TEXT,
  adresse_facturation TEXT,
  nom                 TEXT,
  prenom              TEXT,
  email               TEXT,
  tel                 TEXT,
  statut              TEXT DEFAULT 'actif',
  coef_tarifaire      NUMERIC NOT NULL DEFAULT 1.0,
  coefficient         NUMERIC DEFAULT 1.00,
  paiement_differe    BOOLEAN DEFAULT false,
  payer_a_bord        BOOLEAN NOT NULL DEFAULT false,
  facturation_mode    TEXT NOT NULL DEFAULT 'mensuelle'
    CHECK (facturation_mode IN ('mensuelle', 'par_prestation')),
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── chauffeurs ──────────────────────────────────────────────
CREATE TABLE chauffeurs (
  id                       UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  user_id                  UUID REFERENCES auth.users(id),
  statut                   statut_chauffeur NOT NULL DEFAULT 'hors_ligne',
  type_contrat             type_contrat NOT NULL DEFAULT 'sous_traitant',
  note_moyenne             NUMERIC DEFAULT 5.0,
  nb_courses               INTEGER DEFAULT 0,
  vehicule_marque          TEXT,
  vehicule_modele          TEXT,
  vehicule_immatriculation TEXT,
  type_vehicule            type_vehicule DEFAULT 'berline',
  nom                      TEXT,
  prenom                   TEXT,
  email                    TEXT,
  tel                      TEXT,
  photo_url                TEXT,
  disponible               BOOLEAN DEFAULT false,
  lat                      NUMERIC,
  lng                      NUMERIC,
  fcm_token                TEXT,
  created_at               TIMESTAMPTZ DEFAULT now()
);

-- ── collaborateurs ──────────────────────────────────────────
CREATE TABLE collaborateurs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  nom         TEXT DEFAULT '',
  prenom      TEXT DEFAULT '',
  tel         TEXT,
  email       TEXT,
  poste       TEXT,
  adresse     TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── sous_traitants ──────────────────────────────────────────
CREATE TABLE sous_traitants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id),
  nom           TEXT NOT NULL,
  contact_nom   TEXT,
  telephone     TEXT,
  email         TEXT,
  adresse       TEXT,
  siret         TEXT,
  notes         TEXT,
  actif         BOOLEAN NOT NULL DEFAULT true,
  mode_paiement TEXT NOT NULL DEFAULT 'mensuel'
    CHECK (mode_paiement IN ('immediat', 'hebdomadaire', 'mensuel')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── zones ───────────────────────────────────────────────────
CREATE TABLE zones (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT NOT NULL,
  code             TEXT NOT NULL UNIQUE,
  type             TEXT NOT NULL DEFAULT 'zone',
  prefixes_postaux TEXT[] DEFAULT '{}',
  ordre            INTEGER DEFAULT 0,
  actif            BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── grilles_tarifaires ──────────────────────────────────────
CREATE TABLE grilles_tarifaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  zone_depart_id  UUID NOT NULL REFERENCES zones(id),
  zone_arrivee_id UUID NOT NULL REFERENCES zones(id),
  prix_berline    NUMERIC NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── tarifs ──────────────────────────────────────────────────
CREATE TABLE tarifs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicule        TEXT NOT NULL,
  prise_en_charge NUMERIC DEFAULT 0,
  prix_km         NUMERIC DEFAULT 0,
  cdg_fixe        NUMERIC DEFAULT 0,
  orly_fixe       NUMERIC DEFAULT 0,
  beauvais_fixe   NUMERIC DEFAULT 0,
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- ── parametres (singleton) ───────────────────────────────────
CREATE TABLE parametres (
  id                      BOOLEAN PRIMARY KEY DEFAULT true CHECK (id = true),
  societe_nom             TEXT,
  societe_siret           TEXT,
  societe_tva_numero      TEXT,
  societe_naf             TEXT,
  societe_adresse         TEXT,
  societe_code_postal     TEXT,
  societe_ville           TEXT,
  societe_telephone       TEXT,
  societe_email           TEXT,
  facture_prefixe         TEXT DEFAULT 'OW-',
  facture_taux_tva        NUMERIC DEFAULT 20,
  facture_delai_paiement  INTEGER DEFAULT 30,
  facture_mentions        TEXT,
  banque_iban             TEXT,
  banque_bic              TEXT,
  banque_nom              TEXT,
  tarif_frais_pec         NUMERIC DEFAULT 15.00,
  tarif_pec_actif         BOOLEAN DEFAULT true,
  tarif_km_particulier    NUMERIC DEFAULT 2.00,
  tarif_base_particulier  NUMERIC DEFAULT 15.00,
  supplement_nuit         NUMERIC DEFAULT 20.00,
  supplement_weekend      NUMERIC DEFAULT 15.00,
  supplement_ferie        NUMERIC DEFAULT 25.00,
  coef_berline            NUMERIC DEFAULT 1.00,
  coef_berline_premium    NUMERIC DEFAULT 1.25,
  coef_van                NUMERIC DEFAULT 1.50,
  paiement_stripe_actif   BOOLEAN NOT NULL DEFAULT true,
  paiement_cash_actif     BOOLEAN NOT NULL DEFAULT false,
  paiement_cheque_actif   BOOLEAN NOT NULL DEFAULT false,
  paiement_virement_actif BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ── devis ───────────────────────────────────────────────────
CREATE TABLE devis (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom         TEXT,
  tel         TEXT,
  email       TEXT,
  societe     TEXT,
  origin      TEXT,
  destination TEXT,
  date_course TEXT,
  heure       TEXT,
  pax         INTEGER,
  vehicle     TEXT,
  price       NUMERIC,
  supplements TEXT[],
  dest_type   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── factures ────────────────────────────────────────────────
CREATE TABLE factures (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id           UUID REFERENCES clients(id),
  numero              TEXT NOT NULL UNIQUE,
  statut              statut_facture NOT NULL DEFAULT 'en_attente',
  montant_ht          NUMERIC NOT NULL,
  tva                 NUMERIC DEFAULT 0,
  montant_ttc         NUMERIC NOT NULL,
  date_emission       TIMESTAMPTZ DEFAULT now(),
  date_echeance       TIMESTAMPTZ,
  stripe_payment_link TEXT,
  mode_paiement       TEXT,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- ── factures_sous_traitants ─────────────────────────────────
CREATE TABLE factures_sous_traitants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sous_traitant_id UUID NOT NULL REFERENCES sous_traitants(id),
  periode          TEXT NOT NULL,
  montant_ht       NUMERIC NOT NULL DEFAULT 0,
  statut           TEXT NOT NULL DEFAULT 'en_attente'
    CHECK (statut IN ('en_attente', 'payee')),
  date_paiement    TIMESTAMPTZ,
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ── courses ─────────────────────────────────────────────────
CREATE TABLE courses (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id         UUID REFERENCES clients(id),
  chauffeur_id      UUID REFERENCES chauffeurs(id),
  collaborateur_id  UUID REFERENCES collaborateurs(id),
  sous_traitant_id  UUID REFERENCES sous_traitants(id),
  facture_id        UUID REFERENCES factures(id),
  devis_id          UUID REFERENCES devis(id),
  statut            statut_course NOT NULL DEFAULT 'en_attente',
  adresse_depart    TEXT NOT NULL,
  adresse_arrivee   TEXT NOT NULL,
  etapes            JSONB DEFAULT '[]',
  date_prevue       TIMESTAMPTZ NOT NULL,
  date_debut        TIMESTAMPTZ,
  date_fin          TIMESTAMPTZ,
  type_vehicule     type_vehicule DEFAULT 'berline',
  nb_passagers      INTEGER DEFAULT 1,
  prix_estime       NUMERIC,
  prix_final        NUMERIC,
  prix_sous_traitant NUMERIC,
  mode_paiement     TEXT DEFAULT 'cash',
  paiement_statut   TEXT DEFAULT 'en_attente',
  source            TEXT DEFAULT 'manuel',
  ref               TEXT,
  notes             TEXT,
  -- Infos vol / train
  num_vol_train     TEXT,    -- ex: AF1234 ou TGV 6423
  terminal          TEXT,    -- ex: 2E (aéroport) ou Voie 3 (gare)
  heure_arrivee_vol TEXT,    -- HH:MM — heure réelle d'atterrissage / arrivée train
  -- Notation client
  note_client       INTEGER CHECK (note_client >= 1 AND note_client <= 5),
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── documents_chauffeur ─────────────────────────────────────
CREATE TABLE documents_chauffeur (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chauffeur_id     UUID REFERENCES chauffeurs(id),
  type             type_document NOT NULL,
  date_expiration  DATE NOT NULL,
  statut           statut_document NOT NULL DEFAULT 'valide',
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- RLS — résumé des politiques actives en production
-- ============================================================
-- profiles         : RLS activé — admin ALL ; user voit son profil
-- clients          : RLS activé — admin ALL ; client via user_id
--                    /!\ pas de policy chauffeur → contournement createAdminClient()
-- chauffeurs       : RLS activé — admin ALL ; chauffeur voit son compte
-- collaborateurs   : RLS activé — admin ALL ; collab via id ; client via client_id
-- courses          : RLS activé — admin ALL ; chauffeur ses courses ; client ses courses
-- factures         : RLS activé — admin ALL ; client ses factures
-- devis            : RLS activé — admin ALL ; INSERT public (vitrine anonyme)
-- parametres       : RLS activé — admin ALL
-- zones            : RLS activé — lecture publique
-- grilles_tarifaires : RLS activé — lecture publique
-- tarifs           : RLS activé — lecture publique
-- sous_traitants   : RLS activé — admin ALL ; sous-traitant son compte
-- documents_chauffeur : RLS activé — admin ALL ; chauffeur ses docs
-- factures_sous_traitants : RLS activé — admin ALL
-- ============================================================
