# PROJECT_STATE — Owise VTC
**Dernière mise à jour :** 2026-06-07  
**Branche :** main  
**Dernier commit :** `7395e54` feat(sous-traitants): rattachement chauffeurs + facturation complete  
**Déploiement :** Vercel auto-deploy → owise.fr  
**Base de données :** Supabase `fbawdscnczdpjsbvyhfe` (eu-west-3)

---

## 1. ÉTAT GÉNÉRAL

La plateforme est **en production sur owise.fr**, fonctionnelle de bout en bout. Le prototype statique (16 pages HTML) a été remplacé par une application Next.js complète avec authentification, base de données réelle et paiement Stripe (mode test).

**Stack :**
- Frontend/Backend : Next.js App Router (Server Components + Server Actions)
- Base de données : Supabase PostgreSQL + PostGIS + RLS
- Auth : Supabase Auth (JWT, rôles via `app_metadata`)
- Paiement : Stripe (test mode — migration live en attente)
- Emails : Resend (templates HTML)
- Push notifications : Firebase Cloud Messaging
- Temps réel : Supabase Realtime (courses, dispatch)
- Géolocalisation : OSRM (routing open source) + Google Places API
- Déploiement : Vercel (auto-deploy sur push main)

---

## 2. PAGES ET INTERFACES

### Dashboard admin (`/admin`)
- KPIs temps réel : courses du jour, CA, chauffeurs disponibles, courses en attente
- Panier courses sans chauffeur (dispatch inline)
- Auto-refresh toutes les 30s

### Courses (`/admin/courses`)
- Liste filtrée par statut (en attente / en cours / terminées / annulées)
- Recherche par client, adresse, passager libre
- Dispatch rapide depuis la liste
- **Création** (`/admin/courses/nouvelle`) : trajet avec autocomplete, tarif calculé automatiquement (forfait zone ou km), aller-retour, infos vol/train
- **Passager libre** : toggle "Compte client" / "Saisie libre" — permet de créer une course pour un client ponctuel sans compte (nom, prénom, tel stockés sur la course)
- **Fiche course** : timeline statut, assignation chauffeur/ST, prix final, notes, suppression avec confirmation

### Chauffeurs (`/admin/chauffeurs`)
- Liste avec statut temps réel
- Création : email/mdp, identité, véhicule, type contrat (salarié / sous-traitant)
- Si sous-traitant → select société ST pour rattachement immédiat
- Fiche : modifier profil, véhicule, statut, supprimer

### Clients (`/admin/clients`)
- Liste avec badge Entreprise/Particulier, colonne Contact (tel + email)
- Recherche nom/tel/email
- Fiche : historique courses, CA total, collaborateurs (si entreprise), coeff tarifaire, paiement différé, paiement à bord
- Suppression client avec confirmation par saisie du nom (cascade : courses détachées, collaborateurs supprimés, factures supprimées)

### Sous-traitants (`/admin/sous-traitants`)
- Liste avec statut actif/inactif
- Fiche : KPIs (CA, coût, marge, taux), accès portal, informations
- **Chauffeurs rattachés** : liste des chauffeurs de la société avec véhicule, immatriculation, statut
- Mode de facturation : immédiat / hebdomadaire / mensuel
- **Facturation** : génération facture pour la période (hebdo/mensuel), uniquement les courses non encore facturées, détail des courses cliquable dans chaque facture, marquage payée
- Portal sous-traitant : création compte, lien de connexion

### Facturation entreprises (`/admin/facturation`)
- Factures clients entreprises
- Génération PDF, export CSV

### Statistiques (`/admin/stats`)
- Graphiques SVG : CA mensuel, courses par statut, évolution 12 mois
- Métriques chauffeurs, top clients, taux de marge

### Planning (`/admin/planning`)
- Calendrier interactif vue semaine / mois / liste

### Tarification (`/admin/tarifs`)
- Zones géographiques + grille forfaitaire (aéroports, gares, zones)
- Tarifs au km par type véhicule
- Paramètres globaux : suppléments nuit/weekend, frais PEC, coefficients van/premium

### Devis (`/admin/devis`)
- Demandes reçues depuis la vitrine

### Paramètres (`/admin/parametres`)
- Paramètres compte admin

---

### Site vitrine (`/`)
- Hero sombre, sections Services/Véhicules/Processus/Témoignages/Tarifs/Entreprises/FAQ sur fond crème
- Tableau de prix visible sans saisie (zones principales)
- Formulaire de devis en ligne
- Réseaux sociaux : TikTok (@owise857), Facebook (Owise.vtc)
- JSON-LD SEO

### Réservation en ligne (`/reserver`)
- Formulaire complet avec tarif calculé en temps réel
- Paiement Stripe (Stripe Elements)
- Confirmation email automatique

### Espace client (`/espace-client`)
- Historique courses
- Réserver une nouvelle course
- Notation chauffeur après course terminée

### App chauffeur (`/chauffeur`)
- Accepter/refuser les courses
- Suivi de mission (en route → prise en charge → terminée)
- Géolocalisation temps réel
- Notifications push (FCM)

### Portal sous-traitant (`/sous-traitant`)
- Voir les courses assignées
- Accepter/refuser
- Profil et documents

---

## 3. BASE DE DONNÉES — SCHÉMA ACTUEL

| Table | Description |
|-------|-------------|
| `profiles` | Profils utilisateurs (tous rôles) |
| `chauffeurs` | Chauffeurs avec `sous_traitant_id` (nouveau) |
| `clients` | Clients avec `prenom`, `nom`, `email`, `tel` directs |
| `collaborateurs` | Employés d'un client entreprise |
| `sous_traitants` | Sociétés sous-traitantes |
| `courses` | Courses avec `passager_prenom/nom/tel` (nouveau), `facture_st_id` (nouveau) |
| `devis` | Demandes de devis vitrine |
| `factures` | Factures clients entreprises |
| `factures_sous_traitants` | Factures vers les sous-traitants |
| `zones` | Zones géographiques (Z1 Paris, CDG, ORY, etc.) |
| `grilles_tarifaires` | Forfaits zone-à-zone |
| `tarifs` | Prix au km par type véhicule |
| `parametres` | Config globale (suppléments, coefficients) |
| `documents_chauffeur` | Documents VTC/assurance |
| `codes_parrainage` | Codes promo parrainage |
| `credits_parrainage` | Crédits générés |

**Migrations récentes (session 2026-06-07) :**
- `courses.passager_prenom`, `passager_nom`, `passager_tel` — passager sans compte
- `chauffeurs.sous_traitant_id` — rattachement à société ST
- `courses.facture_st_id` — lien course ↔ facture ST

---

## 4. TRAVAIL ACCOMPLI — SESSION 2026-06-07

### Corrections vitrine
- Section Tarifs : fond crème cohérent (était resté en dark admin palette)
- Lien TikTok activé : https://www.tiktok.com/@owise857
- Lien Facebook activé : https://www.facebook.com/Owise.vtc
- JSON-LD `sameAs` mis à jour

### Gestion clients améliorée
- Liste : colonne "Contact" (tel + email directs), grille recalibrée
- Fiche : bouton **Supprimer client** avec confirmation par saisie du nom
- Cascade complète : courses détachées, comptes collaborateurs supprimés, factures supprimées, compte auth supprimé

### Signature sonore Owise (`src/lib/sound.ts`)
- Réécriture complète : synthèse additive (fondamentale + harmoniques)
- Timbre "cloche dorée" sur arpège Ré majeur (D4→F#4→A4)
- 6 sons distincts : `soundNouvelleCourse`, `soundCourseAssignee`, `soundConfirmation`, `soundTerminee`, `soundAlert`, `soundUrgence`
- WAV générés dans `public/sounds/` pour usage mobile natif

### Courses — passager libre
- Nouveau toggle dans le formulaire de création : "Compte client" / "Saisie libre"
- Saisie libre : prénom, nom, téléphone stockés directement sur la course
- Liste courses : badge PONCTUEL + téléphone affiché
- Fiche course : carte passager distincte (bleu) avec bouton Appeler
- Recherche étendue sur nom et tel passager libre

### Courses — suppression
- Bouton "Supprimer cette course" en bas du panneau latéral de la fiche
- Confirmation en 2 clics, message d'erreur si problème DB
- Redirige vers la liste après suppression

### Sous-traitants — rattachement chauffeurs
- Migration : `chauffeurs.sous_traitant_id`
- Formulaire création chauffeur : select société ST visible si type = sous-traitant
- Fiche ST : section "Chauffeurs rattachés" avec nom, véhicule, immatriculation, statut, lien fiche

### Sous-traitants — facturation complète
- Migration : `courses.facture_st_id`
- Génération facture : ne prend que les courses non encore facturées de la période
- Courses liées à leur facture via `facture_st_id` après génération
- Factures affichent le détail des courses cliquables (trajet, date, montant)
- Erreur si aucune course non facturée sur la période

---

## 5. FICHIERS CLÉS MODIFIÉS (session 2026-06-07)

| Fichier | Modification |
|---------|-------------|
| `src/components/VitrineBody.tsx` | Section Tarifs fond crème, liens TikTok/Facebook |
| `src/app/page.tsx` | JSON-LD sameAs TikTok/Facebook |
| `src/app/admin/clients/page.tsx` | Colonne Contact, grille recalibrée |
| `src/app/admin/clients/[id]/page.tsx` | Import DeleteClientButton |
| `src/app/admin/clients/[id]/ClientEditActions.tsx` | Composant DeleteClientButton |
| `src/app/admin/clients/[id]/actions.ts` | Action supprimerClient (cascade) |
| `src/lib/sound.ts` | Réécriture complète — signature sonore Owise |
| `src/app/admin/courses/nouvelle/NouvelleCourseForm.tsx` | Toggle passager libre |
| `src/app/admin/courses/nouvelle/actions.ts` | Champs passager libre + course retour |
| `src/app/admin/courses/page.tsx` | Badge PONCTUEL, recherche passager |
| `src/app/admin/courses/[id]/page.tsx` | Carte passager libre, variables passager |
| `src/app/admin/courses/[id]/CourseActions.tsx` | Zone dangereuse + bouton supprimer |
| `src/app/admin/courses/[id]/actions.ts` | Action supprimerCourse |
| `src/app/admin/chauffeurs/nouveau/page.tsx` | Server component, charge STs |
| `src/app/admin/chauffeurs/nouveau/NouveauChauffeurForm.tsx` | Nouveau — client form avec select ST |
| `src/app/admin/chauffeurs/nouveau/actions.ts` | Enregistre sous_traitant_id |
| `src/app/admin/sous-traitants/[id]/page.tsx` | Section chauffeurs + facturation améliorée |
| `src/app/admin/sous-traitants/actions.ts` | genererFactureSTAction — lier courses |

---

## 6. ÉTAT DE LA PRODUCTION (2026-06-07)

| Donnée | Valeur |
|--------|--------|
| Chauffeurs | 3 |
| Clients | 2 |
| Sous-traitants | 2 |
| Courses | 1 (en attente) |
| Courses terminées | 0 |
| Devis | 0 |
| Factures clients | 0 |
| Factures ST | 0 |

---

## 7. BUGS CONNUS / LIMITATIONS

| # | Description | Sévérité | Statut |
|---|-------------|----------|--------|
| B1 | Stripe en mode **test** — aucun vrai paiement possible | Bloquant pour revenus réels | En attente — migration live à faire |
| B2 | Chauffeurs existants déjà créés **ne sont pas encore rattachés** à une société ST (colonne `sous_traitant_id = NULL`) | Données incomplètes | À faire manuellement depuis les fiches |
| B3 | Factures ST en mode `immediat` ne lient **pas** les courses via `facture_st_id` (la liaison est faite uniquement via `genererFactureSTAction`) | Mineur pour le mode immédiat | À corriger dans `changerStatut` → `terminee` |
| B4 | App chauffeur et espace client : sons WAV dans `public/sounds/` non encore intégrés dans les push notifications natives iOS/Android | Mobile uniquement | À faire lors de la phase mobile |
| B5 | `soundCourseAssignee` et `soundUrgence` déclarés dans `sound.ts` mais pas encore appelés dans `AdminRealtime.tsx` | Mineur | À câbler |

---

## 8. PROCHAINES TÂCHES (par priorité)

### Priorité haute — production
1. **Migration Stripe live** : remplacer `pk_test_*` / `sk_test_*` par les clés live, activer les webhooks sur le domaine owise.fr, tester un vrai paiement end-to-end
2. **Rattacher chauffeurs ST existants** : ouvrir les 3 fiches chauffeurs et affecter la société correspondante
3. **Corriger facture immédiate** : dans `actions.ts changerStatut`, quand `statut = terminee` et `sous_traitant_id` présent + mode `immediat`, mettre à jour `facture_st_id` sur la course avec l'ID de la facture créée

### Priorité moyenne — fonctionnalités
4. **Modifier/éditer une course existante** : aucune page d'édition n'existe, seuls les champs prix/notes/chauffeur/statut sont modifiables depuis la fiche
5. **Câbler les sons** `soundCourseAssignee` et `soundUrgence` dans `AdminRealtime.tsx`
6. **Export PDF facture ST** : actuellement les factures ST n'ont pas de bouton d'impression/export, contrairement aux factures clients
7. **Fiche chauffeur — modifier la société ST** : `ChauffeurEditActions.tsx` ne permet pas encore de changer `sous_traitant_id` depuis la fiche

### Priorité basse — polish
8. **Sons WAV natifs mobile** : copier `public/sounds/` dans les bundles Android (`res/raw/`) et iOS (Xcode bundle) pour les push notifications
9. **Recherche globale** : barre de recherche cross-entités (client + course + chauffeur) depuis le dashboard
10. **Notifications email ST** : quand une course est assignée à un sous-traitant, envoyer un email au contact ST (actuellement seul le chauffeur Owise reçoit un email)

---

## 9. ARCHITECTURE DE SÉCURITÉ

- Toutes les Server Actions admin appellent `requireAdminClient()` en première ligne
- `requireAdminClient()` vérifie `app_metadata.role === 'admin'` via JWT
- Les chauffeurs accèdent à `/chauffeur` via `app_metadata.role === 'chauffeur'`
- Les clients via `app_metadata.role === 'client'`
- Les sous-traitants via `app_metadata.role === 'sous_traitant'`
- RLS Supabase actif sur toutes les tables (lecture/écriture filtrée par rôle)
- Service Role Key uniquement côté serveur (jamais exposée au client)

---

## 10. RÉFÉRENCES EXTERNES

| Service | Usage | Notes |
|---------|-------|-------|
| Supabase | DB + Auth + Realtime | Project ID: `fbawdscnczdpjsbvyhfe` |
| Vercel | Déploiement | Auto-deploy depuis `main` |
| Stripe | Paiements | Mode test — clés live à configurer |
| Firebase | Push notifications (FCM) | Intégré chauffeur + client |
| Resend | Emails transactionnels | Templates HTML complets |
| OSRM | Calcul de distances | API publique (pas de clé) |
| Google Places | Autocomplete adresses | Clé API dans `.env` |
| Google Maps | Carte dispatch | Clé API dans `.env` |
