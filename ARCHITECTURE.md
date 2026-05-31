# Owise App Architecture

## Objectif
Documenter l’architecture actuelle de l’application `owise-app`, en particulier la structure Supabase, les rôles, les routes API, le middleware et le schéma de permissions.

## Stack technique
- Framework : Next.js (App Router)
- Langage : TypeScript
- Authentification : Supabase Auth
- Backend SQL : Supabase / PostgreSQL
- API server-side : Supabase service-role et SSR Supabase client
- Déploiement : Vercel

## Structure Supabase

### Tables principales
Le schéma de base est défini dans `src/lib/types.ts` :
- `profiles`
- `chauffeurs`
- `clients`
- `courses`
- `factures`
- `documents_chauffeur`

### Types métier
- `RoleUtilisateur` : `admin`, `client`, `chauffeur`
- `StatutCourse` : `en_attente`, `acceptee`, `en_route`, `prise_en_charge`, `terminee`, `annulee`
- `StatutChauffeur` : `disponible`, `en_course`, `hors_ligne`
- `TypeContrat` : `salarie`, `sous_traitant`
- `TypeVehicule` : `berline`, `berline_premium`, `van_7`, `grand_van_8`
- `StatutFacture` : `en_attente`, `payee`, `retard`
- `TypeDocument` : `carte_vtc`, `assurance_rc`, `visite_medicale`, `permis`
- `StatutDocument` : `valide`, `bientot_expire`, `expire`

### Fonctionnalités Supabase
- Les rôles sont stockés dans `user.app_metadata.role`
- Le projet utilise un client service-role côté serveur pour les opérations protégées (`src/lib/supabase/admin.ts`)
- Un RPC personnalisé `find_user_by_email` est utilisé dans le webhook Stripe pour retrouver ou créer un utilisateur

## Rôles et accès

### Rôles déclarés
- `admin`
- `chauffeur`
- `client`

### Rôles opérationnels
- `collaborateur` apparaît comme alias de `client` dans la redirection de connexion
- Le rôle est utilisé pour orienter le chemin et protéger les sections métier

### Accès par rôle
- `admin` : accès à `/admin/*`
- `chauffeur` : accès à `/chauffeur/*`
- `client` / `collaborateur` : accès à `/espace-client/*`

## Routes API

### API disponibles
- `GET /api/cron/rappels`
  - Génère et envoie des rappels de course aux clients et chauffeurs
  - Protégé par `CRON_SECRET`
  - Utilise `src/lib/supabase/admin.ts` pour accéder au service-role Supabase

- `POST /api/stripe/webhook`
  - Reçoit les webhooks Stripe
  - Vérifie la signature avec `STRIPE_WEBHOOK_SECRET`
  - Met à jour les factures ou crée une réservation publique
  - Utilise `src/lib/supabase/admin.ts` pour l’accès sécurisé à la base

### Points d’intégration
- `src/lib/stripe.ts` fournit l’objet Stripe
- `src/lib/email.ts` gère l’envoi des notifications
- Le webhook Stripe peut créer des utilisateurs et des courses via Supabase admin

## Middleware et protection des routes

### `src/proxy.ts`
- Gère la protection des sections `/admin`, `/chauffeur`, `/espace-client`
- Redirige les utilisateurs non authentifiés vers `/login`
- Redirige les utilisateurs déjà connectés depuis `/login` vers la section adaptée selon leur rôle
- En cas d’accès non autorisé, renvoie vers `/login`
- Configuration de matcher :
  - `/admin/:path*`
  - `/chauffeur/:path*`
  - `/espace-client/:path*`
  - `/login`

### Protection côté serveur
- `src/lib/supabase/server.ts` crée un client Supabase côté serveur avec gestion des cookies
- `requireAdminClient()` redirige vers `/login` si l’utilisateur connecté n’est pas `admin`
- Ce pattern doit être appliqué sur les pages/admin/server actions sensibles

## Schéma de permissions

### Permissions attendues
- `admin` : droits de lecture/écriture sur les données de l’administration
- `chauffeur` : accès au tableau de bord chauffeur et actions métier des courses
- `client` / `collaborateur` : accès aux parcours client, factures et réservations

### Implémentation actuelle
- Les permissions sont gérées principalement par le rôle stocké dans `user.app_metadata.role`
- Les redirections et la protection de route sont effectuées avant chargement de la page
- Les vérifications serveur existent pour les pages admin via `requireAdminClient()`

### À compléter
- Audit RLS Supabase / policies côté base de données
- Vérifier que chaque type de rôle ne peut pas accéder aux données d’une autre section
- Confirmer la séparation des objets métiers (`courses`, `factures`, `clients`) avec les bonnes règles d’accès

## Fichiers clés
- `owise-app/src/proxy.ts`
- `owise-app/src/lib/supabase/client.ts`
- `owise-app/src/lib/supabase/server.ts`
- `owise-app/src/lib/supabase/admin.ts`
- `owise-app/src/lib/types.ts`
- `owise-app/src/app/api/cron/rappels/route.ts`
- `owise-app/src/app/api/stripe/webhook/route.ts`
