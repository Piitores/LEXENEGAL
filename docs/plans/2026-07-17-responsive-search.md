# Refonte responsive /search — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (ou subagent-driven-development) to implement this plan task-by-task.

**Goal:** Panneau de filtres replié par défaut (onglet vertical desktop / bottom sheet mobile) et page de résultats /search pleinement responsive, sans dégrader le desktop.

**Architecture:** Un seul JSX de filtres dans `SearchPage.tsx`, piloté par un état `filtersOpen` (défaut `false`). Les media queries de `SearchPage.css` font basculer le même panneau entre deux comportements : desktop ≥ 1024px = colonne dans le flex qui pousse les résultats + onglet vertical fixe quand replié ; mobile < 1024px = panneau fixed plein écran glissé depuis le bas. Aucun changement de logique de recherche.

**Tech Stack:** React 18 + Vite + TypeScript, CSS vanilla (tokens dans `src/styles/tokens.css`), framer-motion déjà présent (ne pas en ajouter).

**Design validé :** `docs/plans/2026-07-17-responsive-search-design.md`

**Contexte repo :**
- Repo : `/Users/pitores/Downloads/Test code 28-11/landing-page-Lexenegal` (branche `main`, push → Vercel)
- `git status` montre du bruit `node_modules/` : ne JAMAIS `git add -A` ; ajouter uniquement les fichiers cibles.
- Vérification type/build : `npm run build` (fait `tsc && vite build`). Tests : `npm run test` (vitest).
- Pas de test unitaire pertinent pour du layout CSS : la vérification est `npm run build` + contrôle visuel navigateur (Task 5).
- `.resultsGrid` est déjà en une colonne (flex column) : ne pas y toucher.

---

### Task 1: TSX — état `filtersOpen` + éléments UI du panneau

**Files:**
- Modify: `src/pages/Search/SearchPage.tsx`

**Step 1 : Ajouter l'état et les compteurs**

Après le bloc `openSections` / `expandedJuridictions` (~ligne 95), ajouter :

```tsx
// Panneau de filtres replié par défaut (mobile ET desktop, style Lexis 360)
const [filtersOpen, setFiltersOpen] = useState(false);
```

Après les états de filtres (`datePreset`, `customYearStart`, `customYearEnd`, ~ligne 106), ajouter :

```tsx
// Nombre de filtres actifs (pastille sur l'onglet « Filtres »)
const activeFilterCount =
    selectedMatiere.length + selectedChambre.length + selectedJuridiction.length +
    ((datePreset || customYearStart || customYearEnd) ? 1 : 0);
```

**Step 2 : Factoriser le compteur de l'onglet actif (DRY)**

Juste avant le `return (` du composant, ajouter :

```tsx
// Compteur affiché pour l'onglet actif (toolbar + bouton « Voir les X résultats »)
const currentTabCount = activeTab === 'tout'
    ? totalHits + articleResults.length + doctrineResults.length
    : activeTab === 'decisions' ? totalHits
    : activeTab === 'articles' ? articleResults.length
    : doctrineResults.length;
```

Puis dans `.resultsCount` (~ligne 883), remplacer l'expression ternaire inline par `{currentTabCount}` :

```tsx
<div className="resultsCount">
    <span className="count-number">{currentTabCount}</span> résultats
</div>
```

**Step 3 : Onglet vertical desktop + classes du panneau**

Remplacer `<aside className="searchSidebar ghost-sidebar">` (~ligne 636) par :

```tsx
{/* Onglet vertical « Filtres » (desktop, panneau replié) */}
{!filtersOpen && (
    <button
        className="filtersTab"
        onClick={() => setFiltersOpen(true)}
        aria-expanded={false}
        aria-controls="search-filters"
    >
        <span className="filtersTab__label">Filtres</span>
        {activeFilterCount > 0 && <span className="filtersTab__badge">{activeFilterCount}</span>}
    </button>
)}

<aside id="search-filters" className={`searchSidebar ghost-sidebar ${filtersOpen ? 'is-open' : ''}`}>
```

**Step 4 : En-tête du panneau — bouton fermer**

Dans `.sidebarTop`, envelopper « Effacer tout » et ajouter la croix. Remplacer le bloc existant par :

```tsx
<div className="sidebarTop">
    <h2 className="sidebarTitle">Filtres</h2>
    <div className="sidebarTopActions">
        {(selectedMatiere.length > 0 || selectedChambre.length > 0 || selectedJuridiction.length > 0 || datePreset) && (
            <motion.button
                onClick={clearFilters}
                className="clearFiltersBtn"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
            >
                Effacer tout
            </motion.button>
        )}
        <button className="filtersClose" onClick={() => setFiltersOpen(false)} aria-label="Fermer les filtres">✕</button>
    </div>
</div>
```

**Step 5 : Pied du panneau — « Voir les X résultats » (mobile)**

Juste avant `</aside>` (après le dernier `FilterAccordion` Matières), ajouter :

```tsx
<div className="filtersApplyBar">
    <button className="filtersApplyBtn" onClick={() => setFiltersOpen(false)}>
        Voir les {currentTabCount} résultats
    </button>
</div>
```

**Step 6 : Bouton « Filtres (n) » dans la toolbar (mobile)**

Restructurer `.resultsToolbar` (~ligne 881) :

```tsx
<div className="resultsToolbar">
    <div className="resultsCount">
        <span className="count-number">{currentTabCount}</span> résultats
    </div>
    <div className="toolbarActions">
        <button className="filtersToggle" onClick={() => setFiltersOpen(true)}>
            Filtres{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
        </button>
        {activeTab === 'decisions' && (
            <select
                className="sortSelect"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value as any)}
            >
                <option value="relevance">Pertinence</option>
                <option value="date_desc">Plus récent</option>
                <option value="date_asc">Plus ancien</option>
            </select>
        )}
    </div>
</div>
```

(Supprimer l'ancien wrapper `.sortControls` devenu inutile.)

**Step 7 : autoFocus conditionnel**

Sur `.searchInput` (~ligne 786) : remplacer `autoFocus` par `autoFocus={!queryParam}` — on arrive souvent sur /search avec une requête déjà posée ; sur mobile l'autofocus ouvrirait le clavier par-dessus les résultats.

**Step 8 : Vérifier la compilation**

Run: `npm run build`
Expected: `tsc` passe sans erreur, build Vite OK.

**Step 9 : Commit**

```bash
git add src/pages/Search/SearchPage.tsx
git commit -m "feat(search): panneau de filtres repliable (état + UI), compteur factorisé"
```

---

### Task 2: CSS desktop — replié par défaut, onglet vertical, résultats centrés

**Files:**
- Modify: `src/pages/Search/SearchPage.css`

**Step 1 : Sidebar repliée par défaut**

Remplacer le bloc `.ghost-sidebar` (~ligne 82) par :

```css
/* Panneau replié par défaut (style Lexis 360) ; .is-open l'ouvre */
.ghost-sidebar {
    width: 0;
    padding: 0;
    overflow: hidden;
    flex-shrink: 0;
    height: calc(100vh - 80px);
    position: sticky;
    top: 80px;
    background: transparent;
}

.ghost-sidebar.is-open {
    width: 300px;
    padding: 2rem 1.5rem;
    overflow-y: auto;
}
```

(Pas de transition de largeur sur desktop : le contenu de 280px se reformaterait pendant l'animation ; ouverture instantanée = propre et robuste.)

**Step 2 : Onglet vertical + boutons**

Ajouter après le bloc `.clearFiltersBtn` :

```css
/* Onglet vertical « Filtres » collé au bord gauche (desktop replié) */
.filtersTab {
    position: fixed;
    left: 0;
    top: 140px;
    z-index: 50;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 14px 8px;
    background: var(--color-accent, #047857);
    color: #fff;
    border: none;
    border-radius: 0 8px 8px 0;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.filtersTab:hover {
    background: var(--color-accent-dark, #065F46);
}

.filtersTab__label {
    writing-mode: vertical-rl;
    transform: rotate(180deg);
    font-size: 0.8rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.filtersTab__badge {
    min-width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #fff;
    color: var(--color-accent, #047857);
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 700;
}

.sidebarTopActions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
}

.filtersClose {
    background: none;
    border: none;
    cursor: pointer;
    color: var(--color-text-secondary, #6B7280);
    font-size: 1rem;
    line-height: 1;
    padding: 4px;
}

.filtersClose:hover {
    color: var(--color-text, #111827);
}

/* Boutons mobile : masqués sur desktop */
.filtersToggle {
    display: none;
}

.filtersApplyBar {
    display: none;
}

.toolbarActions {
    display: flex;
    align-items: center;
    gap: 1rem;
}
```

**Step 3 : Largeur de lecture des résultats**

Dans `.resultsArea` (~ligne 300), remplacer `max-width: 1000px` par `max-width: 860px` (largeur de lecture confortable, filtres repliés par défaut).

**Step 4 : Vérifier**

Run: `npm run build`
Expected: OK.

**Step 5 : Commit**

```bash
git add src/pages/Search/SearchPage.css
git commit -m "feat(search): desktop — filtres repliés par défaut, onglet vertical, lecture 860px"
```

---

### Task 3: CSS mobile — bottom sheet plein écran

**Files:**
- Modify: `src/pages/Search/SearchPage.css`

**Step 1 : Bloc `@media (max-width: 1023px)`**

Ajouter en fin de fichier :

```css
/* ============================================
   MOBILE / TABLETTE (< 1024px) — panneau de
   filtres en bottom sheet plein écran
   ============================================ */
@media (max-width: 1023px) {
    .filtersTab {
        display: none;
    }

    .filtersToggle {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        background: #fff;
        border: 1px solid var(--color-border, #E5E7EB);
        border-radius: 8px;
        padding: 0.45rem 0.9rem;
        font-size: 0.85rem;
        font-weight: 600;
        color: var(--color-text, #111827);
        cursor: pointer;
    }

    .ghost-sidebar {
        position: fixed;
        inset: 0;
        top: 0;
        width: 100%;
        height: 100dvh;
        padding: 1.25rem 1.25rem 0;
        background: #fff;
        z-index: 1200;
        transform: translateY(100%);
        transition: transform 0.3s ease;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .ghost-sidebar.is-open {
        transform: translateY(0);
        /* réaffirme les valeurs mobile face au .is-open desktop */
        width: 100%;
        padding: 1.25rem 1.25rem 0;
    }

    /* Verrouille le scroll de la page derrière le panneau */
    body:has(.ghost-sidebar.is-open) {
        overflow: hidden;
    }

    .filtersApplyBar {
        display: block;
        position: sticky;
        bottom: 0;
        margin-top: auto;
        padding: 0.75rem 0 calc(0.75rem + env(safe-area-inset-bottom));
        background: linear-gradient(to top, #fff 70%, rgba(255, 255, 255, 0));
    }

    .filtersApplyBtn {
        width: 100%;
        padding: 0.85rem;
        border: none;
        border-radius: 10px;
        background: var(--color-accent, #047857);
        color: #fff;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
    }
}
```

**Step 2 : Vérifier le z-index navbar**

Lire `src/components/Navbar/Navbar.css` : si la navbar a un z-index ≥ 1200, monter celui de `.ghost-sidebar` au-dessus (le panneau plein écran doit recouvrir la navbar).

**Step 3 : Vérifier + Commit**

Run: `npm run build` → OK.

```bash
git add src/pages/Search/SearchPage.css
git commit -m "feat(search): mobile — filtres en bottom sheet plein écran avec « Voir les X résultats »"
```

---

### Task 4: CSS mobile — résultats, onglets, toolbar, en-tête

**Files:**
- Modify: `src/pages/Search/SearchPage.css`
- Lire d'abord : `src/components/Navbar/Navbar.css` (hauteur réelle de la navbar sous 1160px, la page utilise `padding-top: 80px`)

**Step 1 : Bloc `@media (max-width: 768px)`**

Ajouter en fin de fichier (ajuster le `padding-top` selon la hauteur navbar constatée à l'étape précédente) :

```css
/* ============================================
   MOBILE (< 768px) — résultats et en-tête
   ============================================ */
@media (max-width: 768px) {
    .resultsArea {
        padding: 1.25rem 1rem;
    }

    .searchInput {
        font-size: 1.15rem;
        padding: 0.75rem 0;
        margin-bottom: 1rem;
    }

    .searchTabs {
        overflow-x: auto;
        scrollbar-width: none;
    }

    .searchTabs::-webkit-scrollbar {
        display: none;
    }

    .searchTab {
        padding: 0.55rem 0.7rem;
        font-size: 0.88rem;
        white-space: nowrap;
        flex-shrink: 0;
    }

    .resultsToolbar {
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 1.25rem;
    }

    .cardHeader {
        flex-wrap: wrap;
        gap: 0.4rem;
    }

    .cardTitle {
        font-size: 1rem;
    }

    .cardSnippet {
        font-size: 0.9rem;
        -webkit-line-clamp: 3;
        line-clamp: 3;
    }

    .best-match {
        padding: 12px 14px;
    }
}
```

**Step 2 : Vérifier + Commit**

Run: `npm run build` → OK.

```bash
git add src/pages/Search/SearchPage.css
git commit -m "feat(search): mobile — onglets scrollables, cartes et en-tête compacts"
```

---

### Task 5: Vérification visuelle + régression + livraison

**Step 1 : Régression tests**

Run: `npm run test`
Expected: même état que sur `main` avant le chantier (vérifier qu'aucun test existant ne casse).

**Step 2 : Contrôle visuel navigateur (dev server)**

Run: `npm run dev` puis ouvrir `http://localhost:5173/search?q=licenciement` et vérifier :

- **Desktop 1440px** : filtres repliés → onglet vertical « Filtres » au bord gauche ; résultats centrés ~860px ; clic onglet → panneau 300px pousse les résultats ; ✕ referme ; filtre coché → pastille sur l'onglet.
- **Mobile 390px** : pas d'onglet vertical ; bouton « Filtres » dans la toolbar → panneau plein écran depuis le bas ; scroll de fond verrouillé ; « Voir les X résultats » referme ; onglets et pilules scrollent horizontalement sans déborder ; cartes lisibles ; pas de scroll horizontal parasite (vérifier `document.documentElement.scrollWidth === window.innerWidth`).
- **Tablette 768px** : comportement mobile, rien de cassé entre 768 et 1024.

**Step 3 : Corrections éventuelles + commit**

Corriger ce que le contrôle visuel révèle, committer.

**Step 4 : Livraison**

```bash
git push origin main
```

Vercel déploie automatiquement. Vérifier la prod sur mobile une fois déployée.
