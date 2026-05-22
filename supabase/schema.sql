-- ================================================================
-- OWISE — Schéma Supabase
-- À coller dans : Supabase → SQL Editor → New Query → Run
-- ================================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ── Types ENUM ────────────────────────────────────────────────

create type role_utilisateur as enum ('admin', 'client', 'chauffeur');
create type statut_course as enum ('en_attente', 'acceptee', 'en_route', 'prise_en_charge', 'terminee', 'annulee');
create type type_vehicule as enum ('berline', 'berline_premium', 'van_7', 'grand_van_8');
create type statut_chauffeur as enum ('disponible', 'en_course', 'hors_ligne');
create type type_contrat as enum ('salarie', 'sous_traitant');
create type statut_facture as enum ('en_attente', 'payee', 'retard');
create type type_document as enum ('carte_vtc', 'assurance_rc', 'visite_medicale', 'permis');
create type statut_document as enum ('valide', 'bientot_expire', 'expire');

-- ── Table: profiles (extension de auth.users) ─────────────────

create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  role role_utilisateur not null default 'client',
  nom text not null default '',
  prenom text not null default '',
  telephone text,
  created_at timestamptz default now()
);

-- ── Table: chauffeurs ─────────────────────────────────────────

create table chauffeurs (
  id uuid references profiles(id) on delete cascade primary key,
  statut statut_chauffeur not null default 'hors_ligne',
  type_contrat type_contrat not null default 'sous_traitant',
  note_moyenne numeric(3,2) default 5.0,
  nb_courses integer default 0,
  vehicule_marque text,
  vehicule_modele text,
  vehicule_immatriculation text,
  type_vehicule type_vehicule default 'berline',
  created_at timestamptz default now()
);

-- ── Table: clients ────────────────────────────────────────────

create table clients (
  id uuid references profiles(id) on delete cascade primary key,
  type_compte text not null default 'particulier', -- particulier | entreprise
  entreprise_nom text,
  adresse_facturation text,
  created_at timestamptz default now()
);

-- ── Table: courses ────────────────────────────────────────────

create table courses (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id) on delete set null,
  chauffeur_id uuid references chauffeurs(id) on delete set null,
  statut statut_course not null default 'en_attente',
  adresse_depart text not null,
  adresse_arrivee text not null,
  date_prevue timestamptz not null,
  date_debut timestamptz,
  date_fin timestamptz,
  prix_estime numeric(10,2),
  prix_final numeric(10,2),
  type_vehicule type_vehicule default 'berline',
  nb_passagers integer default 1,
  notes text,
  created_at timestamptz default now()
);

-- ── Table: factures ───────────────────────────────────────────

create table factures (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references clients(id) on delete set null,
  numero text unique not null,
  statut statut_facture not null default 'en_attente',
  montant_ht numeric(10,2) not null,
  montant_ttc numeric(10,2) not null,
  date_emission timestamptz default now(),
  date_echeance timestamptz,
  created_at timestamptz default now()
);

-- ── Table: documents_chauffeur ────────────────────────────────

create table documents_chauffeur (
  id uuid default uuid_generate_v4() primary key,
  chauffeur_id uuid references chauffeurs(id) on delete cascade,
  type type_document not null,
  date_expiration date not null,
  statut statut_document not null default 'valide',
  created_at timestamptz default now()
);

-- ================================================================
-- ROW LEVEL SECURITY (RLS)
-- ================================================================

alter table profiles enable row level security;
alter table chauffeurs enable row level security;
alter table clients enable row level security;
alter table courses enable row level security;
alter table factures enable row level security;
alter table documents_chauffeur enable row level security;

-- Profiles : chacun voit le sien, admin voit tout
create policy "Profil visible par son propriétaire" on profiles
  for select using (auth.uid() = id);
create policy "Admin voit tous les profils" on profiles
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );

-- Courses : admin voit tout, chauffeur voit les siennes, client voit les siennes
create policy "Admin gère toutes les courses" on courses
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Chauffeur voit ses courses" on courses
  for select using (
    chauffeur_id in (select id from chauffeurs where id = auth.uid())
  );
create policy "Chauffeur met à jour le statut" on courses
  for update using (
    chauffeur_id in (select id from chauffeurs where id = auth.uid())
  );
create policy "Client voit ses courses" on courses
  for select using (
    client_id in (select id from clients where id = auth.uid())
  );

-- Chauffeurs : admin gère tout, chauffeur voit/modifie son profil
create policy "Admin gère les chauffeurs" on chauffeurs
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Chauffeur voit son profil" on chauffeurs
  for select using (id = auth.uid());
create policy "Chauffeur modifie son statut" on chauffeurs
  for update using (id = auth.uid());

-- Documents : admin + chauffeur concerné
create policy "Admin gère les documents" on documents_chauffeur
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Chauffeur voit ses documents" on documents_chauffeur
  for select using (chauffeur_id = auth.uid());

-- Factures : admin gère tout, client voit les siennes
create policy "Admin gère les factures" on factures
  for all using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
create policy "Client voit ses factures" on factures
  for select using (
    client_id in (select id from clients where id = auth.uid())
  );

-- ================================================================
-- FONCTION : créer le profil automatiquement à l'inscription
-- ================================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, role, nom, prenom)
  values (
    new.id,
    coalesce((new.raw_user_meta_data->>'role')::role_utilisateur, 'client'),
    coalesce(new.raw_user_meta_data->>'nom', ''),
    coalesce(new.raw_user_meta_data->>'prenom', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ================================================================
-- DONNÉES DE TEST (optionnel — à commenter en production)
-- ================================================================

-- Admin : à créer via Supabase Auth > Users (email: admin@owise.fr, mdp: Admin2026!)
-- Puis coller son UUID ici :
-- update profiles set role = 'admin', nom = 'Admin', prenom = 'Owise'
-- where id = 'COLLER-UUID-ICI';
