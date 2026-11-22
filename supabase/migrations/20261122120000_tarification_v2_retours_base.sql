-- Projet « Tarification v2 » — règle du « circuit réel » (décision de
-- l'exploitant, 2026-11-22) : le prix compte base → client + trajet +
-- arrivée → base. Il faut donc mesurer le RETOUR DU CHAUFFEUR À SA BASE.
--
-- Une colonne ajoutée aux deux tables de mesures du projet (tables v2_
-- créées pour lui, jamais lues par le site). Aucune table de la
-- tarification actuelle n'est touchée.
--
-- v2_bases.km_inclus / min_inclus ne servent plus (la règle paie le circuit
-- complet) : laissées en place, sans effet, plutôt qu'une suppression de
-- colonne. Le code ne les lit plus.

alter table public.v2_mesures_courses add column if not exists retours_base jsonb;
alter table public.v2_trajets_types   add column if not exists retours_base jsonb;

comment on column public.v2_mesures_courses.retours_base is
  'De l''arrivée à chaque base : { "<base>": { "km": n, "min": n } | null }. Règle du circuit réel (2026-11-22).';
comment on column public.v2_trajets_types.retours_base is
  'De l''arrivée à chaque base : { "<base>": { "km": n, "min": n } | null }. Règle du circuit réel (2026-11-22).';
comment on column public.v2_bases.km_inclus is 'NON UTILISÉ depuis le 2026-11-22 (règle du circuit réel).';
comment on column public.v2_bases.min_inclus is 'NON UTILISÉ depuis le 2026-11-22 (règle du circuit réel).';
