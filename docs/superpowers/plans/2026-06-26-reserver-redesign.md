# Redesign /reserver — panneau récapitulatif sombre Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un panneau récapitulatif sombre (trajet, prix en or, sécurité du paiement) à côté du formulaire existant sur `/reserver`, visible en permanence sur desktop et en barre compacte sur mobile, sans toucher à la logique de calcul de prix ni au flux de paiement.

**Architecture:** Un nouveau composant présentationnel `ReservationSummary` (aucun state interne, aucun appel réseau) reçoit en props les valeurs déjà calculées par `ReserverClient.tsx`. Le conteneur principal passe d'une colonne unique (max-width 580px) à une disposition deux colonnes en CSS flexbox (desktop), qui se replie en pile verticale sur mobile via une media query.

**Tech Stack:** Next.js App Router, React (client component), styles inline + une balise `<style>` locale déjà présente dans le fichier (pas de nouveau fichier CSS).

---

## Repère : référence spec

Voir `docs/superpowers/specs/2026-06-26-reserver-redesign-design.md` pour le contexte complet (pourquoi ce changement, ce qui ne change pas).

**Correction par rapport à la spec** : la page `/reserver` n'a actuellement qu'un seul texte de sécurité ("Paiement sécurisé par Stripe · SSL/TLS · Aucune donnée bancaire stockée", ligne 1072) — pas de badge "Annulation gratuite" séparé sur cette page (ça n'existe que sur la page d'accueil). Le panneau reprend donc uniquement ce texte existant, sans inventer de nouvelle promesse non décidée.

---

### Task 1: Créer le composant `ReservationSummary`

**Files:**
- Create: `src/app/reserver/ReservationSummary.tsx`

- [ ] **Step 1: Écrire le composant**

```tsx
'use client'

type ReservationSummaryProps = {
  departLabel: string
  arriveeLabel: string
  dateOnly: string
  timeOnly: string
  vehiculeLabel: string
  passagers: number
  prix: number | null
  allerRetour: boolean
}

function formatDateFr(dateOnly: string): string {
  if (!dateOnly) return ''
  const d = new Date(`${dateOnly}T00:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

export default function ReservationSummary({
  departLabel, arriveeLabel, dateOnly, timeOnly, vehiculeLabel, passagers, prix, allerRetour,
}: ReservationSummaryProps) {
  const hasTrajet = departLabel.length > 2 && arriveeLabel.length > 2
  const dateAffichee = formatDateFr(dateOnly)

  return (
    <div style={{
      background: '#09091A',
      borderRadius: 16,
      padding: '28px 24px',
      color: '#EDE8DF',
      position: 'sticky',
      top: 24,
      fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    }}>
      <div style={{
        fontFamily: 'var(--font-cormorant, Georgia), serif',
        fontSize: 18, fontWeight: 600, letterSpacing: '.08em',
        color: '#EDE8DF', marginBottom: 20,
      }}>
        Récapitulatif
      </div>

      {hasTrajet ? (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 8 }}>Trajet</div>
          <div style={{ fontSize: 13, color: '#EDE8DF', lineHeight: 1.6 }}>
            {departLabel.split(',')[0]}
            <div style={{ color: '#C9A84C', fontSize: 11, margin: '2px 0' }}>↓{allerRetour ? ' aller-retour' : ''}</div>
            {arriveeLabel.split(',')[0]}
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'rgba(237,232,223,.5)', marginBottom: 18 }}>
          Renseignez votre trajet pour voir le récapitulatif
        </div>
      )}

      {dateAffichee && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 6 }}>Date &amp; heure</div>
          <div style={{ fontSize: 13, color: '#EDE8DF' }}>{dateAffichee} · {timeOnly}</div>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 6 }}>Véhicule</div>
        <div style={{ fontSize: 13, color: '#EDE8DF' }}>{vehiculeLabel} · {passagers} passager{passagers > 1 ? 's' : ''}</div>
      </div>

      <div style={{ borderTop: '1px solid rgba(201,168,76,.2)', paddingTop: 18, marginBottom: 18 }}>
        <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 6 }}>Prix</div>
        <div style={{ fontFamily: 'var(--font-jetbrains, monospace)', fontSize: 32, fontWeight: 700, color: '#C9A84C' }}>
          {prix !== null ? `${Math.round(prix)} €` : '—'}
        </div>
      </div>

      <div style={{ fontSize: 10.5, color: 'rgba(237,232,223,.5)', lineHeight: 1.6 }}>
        Paiement sécurisé par Stripe · SSL/TLS · Aucune donnée bancaire stockée
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur (le composant n'est pas encore utilisé nulle part, donc aucun risque de régression à ce stade).

- [ ] **Step 3: Commit**

```bash
git add src/app/reserver/ReservationSummary.tsx
git commit -m "feat(reserver): composant ReservationSummary (présentationnel, pas encore intégré)"
```

---

### Task 2: Intégrer le panneau dans la disposition deux colonnes (desktop)

**Files:**
- Modify: `src/app/reserver/ReserverClient.tsx:537` (ouverture du conteneur)
- Modify: `src/app/reserver/ReserverClient.tsx:1076` (fermeture du conteneur)

- [ ] **Step 1: Ajouter l'import en haut du fichier**

À la suite des imports existants (après la ligne `import { fbInitCheckout, fbLead, fbViewContent } from '@/lib/pixel'`) :

```tsx
import ReservationSummary from './ReservationSummary'
import { VEHICULE_NOM } from '@/lib/calcPrix'
```

Note : `VEHICULE_NOM` est peut-être déjà importé plus haut dans le fichier (vérifier avant d'ajouter une deuxième fois — si déjà présent dans l'import existant de `@/lib/calcPrix`, ne pas dupliquer la ligne).

- [ ] **Step 2: Remplacer l'ouverture du conteneur (ligne 537)**

Remplacer :
```tsx
      <div style={{ maxWidth: 580, margin: '0 auto', padding: '40px 20px 100px' }}>

        {/* ── STEP 1 ── */}
```

Par :
```tsx
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 20px 100px', display: 'flex', gap: 32, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 480px', minWidth: 0 }}>

        {/* ── STEP 1 ── */}
```

- [ ] **Step 3: Remplacer la fermeture du conteneur (ligne 1076, juste avant la fermeture du wrapper principal)**

Remplacer :
```tsx
        )}
      </div>
    </div>
  )
```

Par :
```tsx
        )}
        </div>

        <div style={{ flex: '1 1 320px', minWidth: 280, maxWidth: 360 }}>
          <ReservationSummary
            departLabel={depart.label}
            arriveeLabel={arrivee.label}
            dateOnly={dateOnly}
            timeOnly={timeOnly}
            vehiculeLabel={VEHICULE_NOM[vehicule] ?? vehicule}
            passagers={passagers}
            prix={prixFinal}
            allerRetour={allerRetour}
          />
        </div>
      </div>
    </div>
  )
```

- [ ] **Step 4: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur. Si `VEHICULE_NOM` était déjà importé, une erreur "duplicate import" apparaîtra — dans ce cas retirer la ligne ajoutée en Step 1 pour `VEHICULE_NOM` (garder seulement celle pour `ReservationSummary`).

- [ ] **Step 5: Test visuel local**

```bash
NODE_TLS_REJECT_UNAUTHORIZED=0 npx next dev -p 3010
```

Ouvrir `http://localhost:3010/reserver?depart=Tour%20Eiffel&arrivee=A%C3%A9roport%20CDG&date=2026-07-01&time=14:00&pax=1` dans un navigateur ou via Puppeteer, et vérifier :
- Le panneau sombre apparaît à droite du formulaire sur desktop (largeur > 1024px).
- Le prix affiché dans le panneau correspond au prix affiché dans le formulaire existant (même valeur).
- Aucune régression visuelle sur le formulaire de gauche (toujours utilisable, mêmes champs).

- [ ] **Step 6: Commit**

```bash
git add src/app/reserver/ReserverClient.tsx
git commit -m "feat(reserver): intègre ReservationSummary en disposition deux colonnes"
```

---

### Task 3: Comportement mobile (panneau en barre compacte)

**Files:**
- Modify: `src/app/reserver/ReserverClient.tsx` (bloc `<style>` existant, vers la ligne 479-495)
- Modify: `src/app/reserver/ReservationSummary.tsx`

- [ ] **Step 1: Ajouter une media query dans le bloc `<style>` existant**

Dans le bloc `<style>{\`...\`}</style>` (juste après la ligne `.res-time:focus { ... }`), ajouter :

```css
@media (max-width: 1024px) {
  .reservation-summary-panel {
    position: static !important;
    margin-bottom: 24px;
  }
  .reservation-summary-detail { display: none !important; }
}
```

- [ ] **Step 2: Ajouter les classes correspondantes dans `ReservationSummary.tsx`**

Dans le `div` racine du composant (celui avec `background: '#09091A'`), ajouter `className="reservation-summary-panel"` :

```tsx
    <div className="reservation-summary-panel" style={{
      background: '#09091A',
      borderRadius: 16,
      padding: '28px 24px',
      color: '#EDE8DF',
      position: 'sticky',
      top: 24,
      fontFamily: 'var(--font-dm-sans), DM Sans, sans-serif',
    }}>
```

Envelopper les blocs "Trajet" (non sélectionné), "Date & heure" et "Véhicule" — c'est-à-dire les trois `div` avec `marginBottom: 18` qui suivent le titre "Récapitulatif" et précèdent le bloc "Prix" — dans un conteneur avec `className="reservation-summary-detail"`, pour qu'ils se masquent sur mobile et que seuls le titre, le trajet résumé et le prix restent visibles. Concrètement, remplacer la séquence des trois blocs (Trajet / Date & heure / Véhicule) par :

```tsx
      <div className="reservation-summary-detail">
        {hasTrajet ? (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 8 }}>Trajet</div>
            <div style={{ fontSize: 13, color: '#EDE8DF', lineHeight: 1.6 }}>
              {departLabel.split(',')[0]}
              <div style={{ color: '#C9A84C', fontSize: 11, margin: '2px 0' }}>↓{allerRetour ? ' aller-retour' : ''}</div>
              {arriveeLabel.split(',')[0]}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: 'rgba(237,232,223,.5)', marginBottom: 18 }}>
            Renseignez votre trajet pour voir le récapitulatif
          </div>
        )}

        {dateAffichee && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 6 }}>Date &amp; heure</div>
            <div style={{ fontSize: 13, color: '#EDE8DF' }}>{dateAffichee} · {timeOnly}</div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 9, letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(237,232,223,.5)', marginBottom: 6 }}>Véhicule</div>
          <div style={{ fontSize: 13, color: '#EDE8DF' }}>{vehiculeLabel} · {passagers} passager{passagers > 1 ? 's' : ''}</div>
        </div>
      </div>
```

(Le bloc "Prix" et le texte de sécurité Stripe restent hors de `reservation-summary-detail`, donc toujours visibles sur mobile.)

- [ ] **Step 3: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 4: Test visuel mobile**

Avec le serveur de dev toujours lancé (Task 2, Step 5), utiliser Puppeteer avec un viewport mobile (390×844) sur la même URL, vérifier :
- Le panneau sombre apparaît en haut, pleine largeur, pas à côté du formulaire.
- Seuls le titre, le trajet, et le prix sont visibles (pas la date/véhicule en détail).
- Le formulaire reste utilisable en dessous.

- [ ] **Step 5: Commit**

```bash
git add src/app/reserver/ReserverClient.tsx src/app/reserver/ReservationSummary.tsx
git commit -m "feat(reserver): panneau récapitulatif compact sur mobile"
```

---

### Task 4: Agrandir les cartes véhicules

**Files:**
- Modify: `src/app/reserver/ReserverClient.tsx:828-838`

- [ ] **Step 1: Agrandir la zone image**

Remplacer (ligne 828-838) :
```tsx
                      <div style={{
                        width: 110, minWidth: 110, height: 72,
                        background: 'linear-gradient(135deg, #f0ede8 0%, #e8e4de 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                      }}>
                        <img
                          src={v.image} alt={v.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                        />
                      </div>
```

Par :
```tsx
                      <div style={{
                        width: 150, minWidth: 150, height: 96,
                        background: 'linear-gradient(135deg, #f0ede8 0%, #e8e4de 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', flexShrink: 0,
                      }}>
                        <img
                          src={v.image} alt={v.label}
                          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
                        />
                      </div>
```

- [ ] **Step 2: Vérifier la compilation**

Run: `npx tsc --noEmit`
Expected: aucune erreur.

- [ ] **Step 3: Test visuel**

Capturer une nouvelle screenshot de la section "Véhicule & passagers" (desktop) et vérifier que les 3 cartes restent bien alignées et lisibles, sans débordement ni texte tronqué.

- [ ] **Step 4: Commit**

```bash
git add src/app/reserver/ReserverClient.tsx
git commit -m "feat(reserver): agrandit les images véhicules dans les cartes de sélection"
```

---

### Task 5: Vérification complète du flux (non-régression)

**Files:** aucun fichier modifié — vérification uniquement.

- [ ] **Step 1: Build complet**

Run: `npx tsc --noEmit && npx next build`
Expected: build réussi, aucune erreur.

- [ ] **Step 2: Re-tester le flux de réservation de bout en bout en local**

Reprendre le script de test utilisé précédemment dans le projet (réservation complète avec carte de test Stripe 4242 4242 4242 4242, webhook signé manuellement comme fait plus tôt dans cette session) pour confirmer que :
- Le prix affiché dans le panneau récapitulatif correspond exactement au prix facturé par Stripe.
- La création de la course en base (`mode_paiement`, `stripe_payment_intent_id`, `prix_estime`) fonctionne toujours.
- Les emails de confirmation partent toujours (vérifiable via l'API Resend comme fait précédemment).

Nettoyer les données de test créées immédiatement après (course, facture, compte client) — convention déjà établie dans ce projet.

- [ ] **Step 3: Capture finale desktop + mobile**

Prendre une capture d'écran finale de `/reserver` en desktop (≥1024px) et mobile (390px) pour archivage dans `temporary screenshots/`.

---

### Task 6: Déploiement

**Files:** aucun nouveau fichier.

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Vérifier CI**

```bash
curl -k -s "https://api.github.com/repos/owiseentreprise-a11y/owise-app/actions/runs?per_page=1"
```
Expected: `"conclusion":"success"` pour le dernier commit poussé.

- [ ] **Step 3: Vérifier le déploiement Vercel**

Utiliser `mcp__plugin_vercel_vercel__get_deployment` (idOrUrl: `www.owise.fr`) et confirmer `"readyState":"READY"` pour le bon commit SHA.

- [ ] **Step 4: Vérification finale en production**

Charger `https://www.owise.fr/reserver` en navigateur réel et confirmer visuellement que le panneau récapitulatif apparaît correctement, en conditions réelles (pas seulement en local).
