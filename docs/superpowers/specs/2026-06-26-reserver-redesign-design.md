# Redesign de `/reserver` — panneau récapitulatif sombre permanent

## Contexte

`/reserver` (et `/paiement/merci`) ont été migrées vers un thème clair crème (`#F8F6F1`) le 2 juin 2026, par décision délibérée pour rester cohérentes avec la vitrine — ce n'est pas une incohérence à corriger, c'est la base actuelle.

Problème réel identifié : la page actuelle est fonctionnellement correcte mais visuellement plate — fond crème uniforme, petites photos de véhicules génériques, badges de confiance dispersés en bas de carte. Rien ne rappelle fortement l'identité de marque (sombre/or) pendant le parcours de réservation, le moment le plus important du tunnel.

Référence de cohérence trouvée dans le code existant : tous les emails transactionnels (`src/lib/email.ts`, fonction `base()`) utilisent déjà un modèle hybride — bandeau de marque sombre + corps clair — appliqué de façon strictement cohérente sur les 17 templates. Ce projet reprend ce même principe pour `/reserver`.

## Objectif

Rendre `/reserver` plus séduisante et plus intuitive, en renforçant la présence de la marque (sombre/or) tout au long du parcours, sans toucher à la logique fonctionnelle déjà testée ce soir (calcul de prix, création de session Stripe, webhook, validation des champs).

## Design retenu

### Desktop (≥ 1024px)
Disposition deux colonnes :
- **Colonne gauche (~62%)** : le formulaire existant (`ReserverClient.tsx`), inchangé fonctionnellement — adresses, date/heure, sélection véhicule/passagers, étape paiement. Les images véhicules (`public/brand_assets/vehicle-*.png`) sont déjà utilisées dans le code actuel — seul l'affichage change : cartes agrandies pour leur donner plus d'impact visuel, sans changer les fichiers image eux-mêmes.
- **Colonne droite (~38%), panneau sombre fixe (`#09091A`)** : nouveau composant de récapitulatif, présentationnel uniquement (aucune nouvelle logique de prix). Affiche en temps réel :
  - Trajet (départ → arrivée, libellés courts)
  - Date / heure
  - Véhicule choisi + nombre de passagers
  - **Prix, en grand, en or (`#C9A84C`)** — se met à jour à chaque changement de sélection
  - Badges de confiance existants (paiement sécurisé, annulation gratuite) déplacés ici depuis le bas du formulaire actuel — pas dupliqués.
- Le panneau reste visible et persiste à l'étape paiement (étape 2 du flux existant), pas seulement à l'étape trajet.

### Mobile (< 1024px)
Le panneau sombre devient une **barre compacte fixée en haut** du formulaire (pas sur le côté) : trajet abrégé + prix uniquement, sans les détails secondaires (véhicule, badges) pour économiser l'espace. Le formulaire complet reste en pleine largeur en dessous.

### Ce qui ne change pas
- `calcPrix.ts` (détection de zone, calcul du prix, majorations) — aucune modification.
- `createReservationCheckout` (création de session Stripe) — aucune modification.
- Validation des champs, autocomplete d'adresse (`searchAddresses`, `searchLieux`) — aucune modification.
- Le header logo existant en haut de page — conservé tel quel, hors scope de ce changement.

## Composants

- **Nouveau** : `ReservationSummary` (présentationnel, props = état déjà calculé par `ReserverClient.tsx` — départ, arrivée, date, heure, véhicule, passagers, prix). Pas de state interne, pas d'appel réseau.
- **Modifié** : `ReserverClient.tsx` — restructuration du JSX en deux colonnes (desktop) / pile (mobile) via CSS, intégration de `ReservationSummary`, agrandissement des cartes véhicules avec les images réelles. Aucune modification de la logique de state/calcul existante.

## Risques et tests

- Risque principal : régression visuelle/fonctionnelle sur un flux déjà vérifié de bout en bout ce soir (réservation → paiement → webhook → email). Mitigation : aucune modification de la logique métier, uniquement du JSX/CSS de présentation ; nouveau test manuel complet du flux après implémentation (Puppeteer, comme fait précédemment dans la session) avant de considérer le travail terminé.
- Responsive : vérifier visuellement le rendu mobile (barre compacte) en plus du desktop avant de livrer.
