-- Clics vers le téléphone, le WhatsApp et l'e-mail d'Owise (2026-11-22).
-- Demande de l'exploitant : savoir d'où viennent les prospects qui appellent.
-- Mesure d'audience anonyme : ni nom, ni numéro, ni IP, ni identifiant de
-- visiteur ; lieux en zone + commune seulement. Voir src/lib/contact-clic.ts.
-- Écrite par la route /api/contacts-clics (clé de service), lue par
-- /admin/contacts. Fermée au public : RLS activée, aucune politique.
create table public.contacts_clics (
  id                  uuid primary key default gen_random_uuid(),
  created_at          timestamptz not null default now(),
  type                text not null check (type in ('telephone', 'whatsapp', 'email')),
  emplacement         text,
  page                text not null,
  premiere_page       text,
  parcours            text[] not null default '{}',
  secondes_avant_clic integer,
  derniere_estimation jsonb,
  canal               text,
  referent            text,
  utm_source          text,
  utm_campaign        text,
  appareil            text check (appareil in ('mobile', 'tablette', 'ordinateur')),
  langue              text,
  largeur_ecran       integer
);
create index contacts_clics_created_at on public.contacts_clics (created_at desc);
alter table public.contacts_clics enable row level security;
comment on table public.contacts_clics is
  'Clics vers le téléphone / WhatsApp / e-mail d''Owise depuis les pages publiques. Mesure anonyme (2026-11-22).';
