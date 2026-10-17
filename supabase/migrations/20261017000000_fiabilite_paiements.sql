-- ============================================================================
-- Owise — Sprint 2 : fiabilité des paiements
-- Créé : 2026-10-17
-- À appliquer via : Supabase Dashboard > SQL Editor
--
-- CONTRÔLE PRÉALABLE OBLIGATOIRE, depuis owise-app :
--     npx tsx scripts/verif-avant-migration-paiements.mts
-- Il doit afficher « MIGRATIONS APPLICABLES ». Lancé le 2026-10-17 à 12:41 :
-- 0 doublon d'identifiant de paiement, 0 chaîne vide, 0 valeur de
-- paiement_statut hors liste, les deux tables neuves absentes.
--
-- CETTE MIGRATION EST PUREMENT ADDITIVE. Elle cree deux tables neuves, un
-- index et une contrainte. Elle ne modifie, ne supprime ni ne deplace AUCUNE
-- ligne : ni dans courses, ni dans factures, ni ailleurs.
--
-- L'etape 5 d'origine (passer les quatre courses encaissees a 'paye') en a ete
-- RETIREE le 2026-10-17 sur consigne : « Ne pas modifier les statuts des
-- quatre courses historiques. » Elle vit desormais dans
-- 20261017000100_backfill_paiement_statut.sql, a appliquer separement et plus
-- tard. Consequence utile : le retour arriere de cette migration-ci n'a rien a
-- restaurer.
--
-- POURQUOI. Trois incidents réels :
--   2026-10-07  deux clients ont payé 89 € chacun ; l'écriture de la course a
--               été refusée par l'enum type_vehicule, l'erreur n'était que
--               journalisée. Aucune course, aucune alerte, aucun client prévenu.
--   2026-10-08  après correction, les événements ont été RENVOYÉS À LA MAIN
--               depuis Stripe pour récupérer les réservations. Chaque renvoi a
--               recréé une course et une facture : deux courses et deux
--               factures pour le même paiement, chez deux clients.
--   en continu  les courses encaissées affichent « en attente », parce que le
--               webhook n'écrit jamais paiement_statut. Or la facturation
--               mensuelle s'appuie sur cette colonne pour ne pas refacturer.
--
-- La protection écrite en octobre (lire la course avant de l'insérer) est une
-- lecture suivie d'une écriture : deux traitements simultanés la franchissent
-- tous les deux. Ici, la garantie passe dans la base.
-- ============================================================================


-- ── 1. Journal des événements Stripe ────────────────────────────────────────
--
-- La clé primaire EST l'identifiant d'événement Stripe. Un même événement
-- renvoyé — à la main depuis le tableau de bord, ou par une nouvelle tentative
-- de Stripe — est refusé par la base, pas par une lecture préalable. C'est ce
-- qui rend le renvoi manuel du 8 octobre sans danger.
--
-- Le payload complet est conservé : c'est la seule copie du trajet quand la
-- course n'a pas pu être créée, et il rend l'événement rejouable.
CREATE TABLE IF NOT EXISTS stripe_events (
  id          text        PRIMARY KEY,
  type        text        NOT NULL,
  payload     jsonb       NOT NULL,
  recu_le     timestamptz NOT NULL DEFAULT now(),
  traite_le   timestamptz,
  statut      text        NOT NULL DEFAULT 'recu'
              CHECK (statut IN ('recu', 'traite', 'echec', 'ignore')),
  tentatives  integer     NOT NULL DEFAULT 0,
  erreur      text,
  course_id   uuid,
  facture_id  uuid
);

CREATE INDEX IF NOT EXISTS stripe_events_statut_idx ON stripe_events (statut, recu_le DESC);
CREATE INDEX IF NOT EXISTS stripe_events_type_idx   ON stripe_events (type, recu_le DESC);

ALTER TABLE stripe_events ENABLE ROW LEVEL SECURITY;
-- Aucune policy : seul le service role écrit et lit. Le payload contient des
-- données personnelles (nom, e-mail, téléphone, adresses) — il ne doit jamais
-- être lisible par la clé publique.


-- ── 2. Incidents de paiement ────────────────────────────────────────────────
--
-- Un e-mail n'a qu'une seule chance : alerterEchecReservation() sort
-- silencieusement si RESEND_API_KEY manque, et les journaux Vercel ne gardent
-- qu'une heure. Un incident écrit ici est encore là demain.
CREATE TABLE IF NOT EXISTS incidents_paiement (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  type        text        NOT NULL,
  gravite     text        NOT NULL CHECK (gravite IN ('critique', 'elevee', 'info')),
  reference   text,
  detail      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  resolu_le   timestamptz,
  resolu_par  text
);

CREATE INDEX IF NOT EXISTS incidents_paiement_ouverts_idx
  ON incidents_paiement (gravite, created_at DESC) WHERE resolu_le IS NULL;

-- Un même incident ne doit pas s'empiler à chaque passage de la réconciliation
-- quotidienne : une seule ligne ouverte par (type, référence).
CREATE UNIQUE INDEX IF NOT EXISTS incidents_paiement_unique_ouvert
  ON incidents_paiement (type, reference) WHERE resolu_le IS NULL;

ALTER TABLE incidents_paiement ENABLE ROW LEVEL SECURITY;
-- Aucune policy : service role uniquement.


-- ── 3. Un paiement Stripe ne peut porter qu'une seule course ────────────────
--
-- C'est la correction du doublon du 8 octobre. L'index est PARTIEL : les 26
-- courses sans identifiant de paiement (prises par téléphone, converties d'un
-- devis) ne sont pas concernées — sans la clause WHERE, elles collisionneraient
-- toutes sur NULL dans certaines versions de Postgres, et surtout l'intention
-- serait fausse.
--
-- Vérifié avant application : 4 identifiants distincts, 0 doublon.
CREATE UNIQUE INDEX IF NOT EXISTS courses_stripe_pi_unique
  ON courses (stripe_payment_intent_id)
  WHERE stripe_payment_intent_id IS NOT NULL;


-- ── 4. Les valeurs que paiement_statut peut prendre ─────────────────────────
--
-- 'en_attente' est CONSERVÉE : c'est la valeur par défaut de la colonne, et
-- l'exclure ferait échouer toute insertion de course qui ne précise pas le
-- statut de paiement — c'est-à-dire la plupart. Elle signifie « rien
-- d'enregistré », pas « paiement attendu ».
--
-- 'echoue' et 'contestee' n'existent pas encore en base : elles sont ajoutées
-- maintenant pour que le code puisse les écrire sans nouvelle migration.
ALTER TABLE courses DROP CONSTRAINT IF EXISTS courses_paiement_statut_valide;
ALTER TABLE courses ADD  CONSTRAINT courses_paiement_statut_valide
  CHECK (paiement_statut IS NULL OR paiement_statut IN (
    'en_attente',   -- défaut : rien d'enregistré
    'a_percevoir',  -- à encaisser à bord
    'paye',         -- encaissé, quel que soit le moyen
    'echoue',       -- tentative de paiement refusée
    'remboursee',   -- remboursé, total ou partiel
    'contestee'     -- litige ouvert chez Stripe
  ));


-- ── 6. Vérification immédiate, dans la même session ─────────────────────────
--
-- À lire dans le résultat du SQL Editor avant de refermer l'onglet.
DO $$
DECLARE
  n_payees   integer;
  n_doublons integer;
BEGIN
  SELECT count(*) INTO n_payees
    FROM courses WHERE stripe_payment_intent_id IS NOT NULL AND paiement_statut = 'paye';

  SELECT count(*) INTO n_doublons FROM (
    SELECT stripe_payment_intent_id FROM courses
     WHERE stripe_payment_intent_id IS NOT NULL
     GROUP BY stripe_payment_intent_id HAVING count(*) > 1
  ) d;

  RAISE NOTICE 'courses encaissees marquees payees : %  (0 attendu : le backfill est un fichier separe)', n_payees;
  RAISE NOTICE 'identifiants de paiement en double  : %  (0 attendu)', n_doublons;

  IF n_doublons > 0 THEN
    RAISE EXCEPTION 'doublon de paiement détecté après migration — à examiner';
  END IF;
END $$;
