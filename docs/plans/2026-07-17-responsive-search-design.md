# Refonte responsive — page de résultats /search (phase 1)

**Date** : 2026-07-17 · **Validé par le propriétaire** (chat du 2026-07-17)

## Contexte

L'usage principal au Sénégal est mobile, mais le desktop reste essentiel : aucun des
deux ne doit être dégradé. La page `/search` (résultats + sidebar de filtres) n'a
aujourd'hui **aucune media query** : sur mobile, la sidebar de 280px écrase les
résultats. Inspiration UX : LexisNexis Lexis 360 (panneau « FILTRES » replié en
onglet vertical, bandeau « +500 documents », résultats pleine largeur).

## Balayage macro (cohérence inter-pages)

État des lieux responsive de l'app (2026-07-17) :

- **Points de rupture existants** (hétérogènes) : dominants = 768px (×24), 640px
  (×12), 480px (×8), 1024px (×7) ; navbar passe en burger à **1160px**.
  → On standardise la phase 1 sur **1024 / 768 / 640** (déjà majoritaires).
- **Tokens** : `src/styles/tokens.css` est la source unique couleurs/typo/espacements
  → toute la refonte passe par ces variables.
- **Pages sans aucune media query** : `Search` (cible de cette phase) et
  `CodeNavTree.css` (sidebar des pages codes) → CodeNavTree = **phase 2**.
- Home, Decision, Code, Doctrine, Codes, Communautaire ont déjà des media queries ;
  leur qualité mobile sera auditée en phase 2.

## Design validé

### 1. Panneau de filtres — replié par défaut partout

Un seul JSX de filtres (Période, Juridictions, Matières), état `filtersOpen`
(défaut `false`), deux comportements par media query :

- **Desktop (≥ 1024px)** : replié = onglet vertical « Filtres » collé au bord
  gauche (style Lexis 360), avec pastille du nombre de filtres actifs. Ouvert =
  panneau ~300px qui **pousse** les résultats (pas d'overlay).
- **Mobile (< 1024px)** : bouton « Filtres (n) » dans la barre d'outils. Ouvert =
  panneau plein écran glissé depuis le bas (bottom sheet) avec bouton collant
  « Voir les X résultats » qui referme.

### 2. Page de résultats refondue (façon Lexis « +500 documents »)

- Bandeau de tête compact : barre de recherche + compteur « X documents ».
- Onglets (Tout / Jurisprudence / Codes & articles / Doctrine) : conservés,
  scrollables horizontalement sur mobile.
- Pilules de matières : conservées, scrollables horizontalement sur mobile.
- Cartes de résultats : une colonne pleine largeur sur mobile, résumés tronqués
  proprement, métadonnées sur une ligne.
- Desktop filtres repliés : résultats centrés, largeur max ~860px.

### 3. Hors périmètre phase 1

- Pas de « Sauvegarder cette recherche », pas de graphique de répartition.
- Pas de refonte accueil / autres pages → **phase 2 = audit global mobile**
  (page décision, pages codes + CodeNavTree, doctrine, navbar).

### 4. Vérification

Test local navigateur (viewport 390px mobile + desktop 1440px), puis push → Vercel.
