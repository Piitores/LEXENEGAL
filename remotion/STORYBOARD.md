# LEXENEGAL — Vidéo promotionnelle (Remotion)

**Format** : 1920 × 1080, 30 i/s, ~84 secondes.
**Composition** : `LexenegalPromo` (`npx remotion studio` pour prévisualiser, `npx remotion render LexenegalPromo` pour rendre).
**Direction artistique** : la charte du site telle quelle — fond blanc / `#F8F9FB`, émeraude `#047857`, or `#D4AF37`, titres Playfair Display, corps Georgia, UI Inter. Les écrans sont rendus par les **composants et feuilles de style réels de l'application** (aucune maquette redessinée) et affichent des **données réelles de la base de production** (art. 45 CPC et ses 3 versions, arrêt n° 67 du 27 novembre 2025, décomptes exacts du corpus).

**Fil rouge narratif** : une seule question de praticien — *« licenciement d'un délégué du personnel »* — traverse la vidéo : la recherche la comprend (S1), le code y répond (S2–S3), la jurisprudence l'illustre (S4), les liens la complètent (S5–S6), l'export la livre (S7), l'IA la synthétise (S8).

**Les 8 fonctionnalités différenciantes retenues**

| # | Fonctionnalité | Pourquoi différenciante |
|---|---|---|
| 1 | Recherche hybride sémantique | Comprend la question, pas seulement les mots-clés (Voyage + pgvector, 24 000+ vecteurs) |
| 2 | Codes consolidés fidèles au JO | 25 codes, 16 770 articles, extraits des Journaux officiels et vérifiés |
| 3 | Comparateur de versions | Historique article par article (1964 → 2001 → 2013), diff mot à mot |
| 4 | 13 000+ décisions de justice | Cour suprême, Conseil constitutionnel, cours d'appel — résumés structurés |
| 5 | Renvois cliquables (legal graph) | Décision → articles cités ; article → décisions citantes ; loi ↔ décret d'application |
| 6 | Doctrine liée article par article | Commentaires rattachés au texte exact qu'ils commentent |
| 7 | Export PDF premium | Document prestige prêt pour le dossier de plaidoirie |
| 8 | Connecteur IA (MCP) | Brancher Claude sur le droit sénégalais : réponses sourcées |

---

## Storyboard scène par scène

Transitions : sauf mention contraire, **fondu croisé 0,5 s** (`@remotion/transitions` `fade()`). Chaque scène de fonctionnalité suit le même gabarit : cartouche d'annonce à gauche (kicker émeraude « 0X — NOM », titre Playfair, sous-texte Inter), écran de l'application dans un cadre navigateur (barre d'URL `www.lexenegal.sn/…`) à droite, caméra Remotion (translation + échelle) qui zoome sur le point démontré.

### S0 — Ouverture (0:00 → 0:05,7 · 170 frames)
- **Visuel** : fond blanc, grille SVG émeraude du Hero (opacité 10 %) qui se dessine. L'emblème (`icon-512.png`) tombe en léger spring, puis « LEXENEGAL » en Playfair 96 px, lettres révélées par balayage.
- **Texte affiché** :
  - `LEXENEGAL` (titre)
  - `La mémoire juridique organisée du Sénégal.` (sous-titre, « mémoire juridique organisée » en dégradé émeraude comme sur le site)
- **Animation** : logo scale 0,8 → 1 (spring damping 12) ; sous-titre fade-up 20 px ; 3 chiffres clés apparaissent en bas en compteur : `25 codes · 13 757 décisions · 201 textes`.
- **Transition sortante** : fondu.

### S1 — 01 · Recherche intelligente (0:05,7 → 0:15,7 · 300 frames)
- **Écran** : le Spotlight réel du Hero (`Hero.css`, classes `spotlight__*`), navbar réelle au-dessus.
- **Texte cartouche** : kicker `01 — RECHERCHE INTELLIGENTE` ; titre `Posez votre question. En français.` ; sous-texte `La recherche sémantique comprend le sens — pas seulement les mots-clés.`
- **Animation** :
  1. (0–2 s) la barre de recherche glisse en place, le curseur clique dedans ;
  2. (2–5 s) frappe au clavier, caractère par caractère : `licenciement d'un délégué du personnel` ;
  3. (5–8 s) le panneau `spotlight__preview` s'ouvre : 4 résultats réels mêlés ⚖️ décisions / 📖 articles (dont l'arrêt n° 67 — Cour suprême · 2025 et l'article L. 214 du Code du travail) apparaissent en cascade (stagger 4 frames) ;
  4. (8–10 s) **zoom** ×1,15 sur le premier résultat, surligné au survol.
- **Transition sortante** : glissement vers la gauche (slide) — on « entre » dans le corpus.

### S2 — 02 · Codes consolidés (0:15,7 → 0:24,7 · 270 frames)
- **Écran** : `CodeNavTree` (le vrai composant) sur le Code de procédure civile réel : 3 parties, Livre II « Des tribunaux régionaux », Titre premier, Section 5, pastilles d'articles 44 → 54-9 avec les **abrogés grisés-barrés** (46, 48–51, 53) et les **notas ambrés** (54-1…), barres de densité.
- **Texte cartouche** : kicker `02 — CODES CONSOLIDÉS` ; titre `Le texte en vigueur. Vérifié au Journal officiel.` ; sous-texte `25 codes · 16 770 articles — chaque alinéa extrait du JO et contrôlé.`
- **Animation** : l'arbre se déploie niveau par niveau (Partie → Livre → Titre → Section, un niveau toutes les 20 frames, révélation par volets Remotion — pas de framer-motion au rendu) ; **zoom** progressif ×1,25 vers la Section 5 ; la pastille `Art. 45` s'allume (état actif réel `is-active`).
- **Badge incrusté** : `Fidèle au JO — 0 fabrication` (pill émeraude).
- **Transition sortante** : fondu rapide, la pastille Art. 45 devient l'en-tête de la scène suivante (raccord narratif).

### S3 — 03 · Comparateur de versions (0:24,7 → 0:33,7 · 270 frames)
- **Écran** : page article réelle (classes `article-header`, `version-info`, `article-actions`, `comparison-panel`, `version-column`) : **Article 45 CPC**, hiérarchie complète en fil d'Ariane (Première partie › Livre II › Titre premier › Section 5).
- **Texte cartouche** : kicker `03 — COMPARATEUR DE VERSIONS` ; titre `Chaque article a une histoire.` ; sous-texte `1964 → 2001 → 2013 : le texte à n'importe quelle date, différences mot à mot.`
- **Animation** :
  1. le curseur clique `Comparer les versions` (ActionButton réel, passe à l'état `active`) ;
  2. le panneau s'ouvre, sélection `Version du 30/07/1964` ;
  3. les **deux colonnes** apparaissent côte à côte ; les passages supprimés se surlignent en rouge barré (`diff-removed`), les ajouts 2013 en vert (`diff-added`) — sur le vrai texte : l'alinéa « Le demandeur qui entend saisir effectivement le tribunal… » (abrogé 2001) et l'ajout « Le greffe tient également un rôle d'attente… » (2013) ;
  4. **zoom** ×1,2 sur l'ajout 2013.
- **Transition sortante** : slide vers le haut.

### S4 — 04 · Jurisprudence (0:33,7 → 0:42,7 · 270 frames)
- **Écran** : page décision réelle (classes `decisionPage`, `certification-badge`, `expert-box`, `tag-elite`, `laws-container`) : **Cour suprême — Arrêt n° 67 du 27 novembre 2025 — Chambre administrative** (CBAO / délégués du personnel, pseudonymisés P. D. T., M. D., A. S. conformément à la charte).
- **Texte cartouche** : kicker `04 — JURISPRUDENCE` ; titre `13 757 décisions. Résumées, indexées, sourcées.` ; sous-texte `Cour suprême, Conseil constitutionnel, cours d'appel — avec synthèse juridique structurée.`
- **Animation** : badge `Source Certifiée : Lexenegal.sn` estampillé (scale 1,3 → 1 + flash or) ; titre de la décision fade-up ; les tags matière/mots-clés (`impartialité de l'administration`, `délégué du personnel`…) tombent en cascade ; **zoom** ×1,18 sur la Synthèse Juridique dont le texte défile lentement.
- **Transition sortante** : fondu.

### S5 — 05 · Renvois cliquables (0:42,7 → 0:51,7 · 270 frames)
- **Écran** : bloc `Références Légales` de la même décision (classes `laws-container`, `law-citation`, `article-link`) puis bascule sur la section `Décisions citant cet article` d'une page article (classes `citing-decisions`, `citing-card`).
- **Texte cartouche** : kicker `05 — TOUT EST RELIÉ` ; titre `De la décision au texte. Du texte à la décision.` ; sous-texte `Articles cités cliquables, décisions citantes, loi ↔ décret d'application : le droit en graphe.`
- **Animation** : le curseur survole `Articles 763 et suivants, 769 et 772 du Code de procédure civile` → l'**aperçu au survol** (ArticleHoverPreview) surgit ; des **fils émeraude animés** (SVG, dash-offset) relient décision ↔ article ↔ décret à l'écran ; contre-champ : la carte `citing-card` de l'arrêt n° 67 sous l'article. **Zoom** léger ×1,1 va-et-vient.
- **Transition sortante** : fondu.

### S6 — 06 · Doctrine (0:51,7 → 0:57,7 · 180 frames)
- **Écran** : panneau doctrine de la page article (classes `doctrine-section`, `doctrine-card`) : commentaires rattachés à l'article affiché.
- **Texte cartouche** : kicker `06 — DOCTRINE` ; titre `Le commentaire, au pied du texte.` ; sous-texte `La doctrine est rattachée à l'article exact qu'elle commente.`
- **Animation** : 2 cartes doctrine glissent depuis la droite (stagger), l'icône 📚 pulse ; **zoom** ×1,12 sur la première carte.
- **Transition sortante** : slide gauche.

### S7 — 07 · Export PDF (0:57,7 → 1:04,7 · 210 frames)
- **Écran** : colonne d'outils réelle de la page décision (ActionButton réels : `Télécharger le PDF`, `Imprimer`, `Copier Référence`, `Mes Annotations`).
- **Texte cartouche** : kicker `07 — EXPORT PDF` ; titre `Prêt pour le dossier de plaidoirie.` ; sous-texte `Un document soigné : en-tête prestige, synthèse, texte intégral certifié.`
- **Animation** : clic sur `Télécharger le PDF` (état `Génération…` réel) → une **page A4 stylisée** (bordures doubles émeraude, en-tête Playfair — le gabarit print réel) se matérialise et pivote légèrement en 3D (rotateY 8°) ; **zoom** sur l'en-tête du PDF.
- **Transition sortante** : fondu vers fond sombre — rupture visuelle avant la scène IA.

### S8 — 08 · Connecteur IA / MCP (1:04,7 → 1:14,7 · 300 frames)
- **Écran** : sur fond `#0B1220` (seule scène sombre — signal « techno »), une fenêtre de chat IA : l'utilisateur demande `Quelles conditions pour licencier un délégué du personnel au Sénégal ?` ; la réponse se compose en streaming avec **3 puces sources** qui s'attachent : `⚖️ CS, arrêt n° 67 du 27 nov. 2025` · `📖 Code du travail` · `📖 Art. 45 CPC` — chacune estampillée `lexenegal.sn`.
- **Texte cartouche** (clair sur sombre) : kicker `08 — CONNECTEUR IA` ; titre `Branchez votre IA sur le droit sénégalais.` ; sous-texte `Serveur MCP officiel : Claude répond avec les vraies sources — 12 outils de recherche juridique.`
- **Animation** : logo Claude ∗ + logo LEXENEGAL reliés par une ligne pulsante ; frappe streaming mot à mot ; les puces sources glissent depuis la réponse vers une pile « Sources vérifiées ». **Zoom** ×1,1 sur les puces.
- **Transition sortante** : le fond sombre s'éclaircit en iris vers le blanc.

### S9 — Appel à l'action (1:14,7 → 1:24 · 280 frames)
- **Visuel** : retour au blanc + grille émeraude, emblème centré.
- **Textes affichés** (séquencés) :
  1. `Le droit sénégalais, enfin organisé.` (Playfair 72 px)
  2. Rappel en 4 pictos-lignes (stagger) : `Codes consolidés · Jurisprudence · Doctrine · IA connectée`
  3. **CTA principal** (bouton émeraude réel, style `navbar__cta`/ActionButton primary) : `Créez votre compte gratuit` ;
  4. **URL en très grand** : `www.lexenegal.sn` (Inter semibold, souligné animé émeraude) ;
  5. mention discrète : `Recherche libre · Compte gratuit pour comparer, annoter, exporter.`
- **Animation** : le bouton CTA pulse deux fois (scale 1 → 1,04) ; l'URL s'écrit avec un soulignement qui se dessine ; fondu final au blanc, l'emblème reste 15 frames seul (mémorisation logo).

---

## Composants de l'application réutilisés

| Élément vidéo | Source réelle |
|---|---|
| Arbre du code (S2) | `src/components/CodeNavTree/CodeNavTree.tsx` + son CSS — composant importé tel quel, données réelles CPC |
| Boutons d'action (S3, S7, S9) | `src/components/ui/ActionButton.tsx` + CSS — importé tel quel |
| Libellés d'articles | `src/lib/articleLabel.ts` (règle « pas de préfixe Article pour le préambule ») |
| Types + formatage de l'arbre | `src/lib/codeTree.ts` (`HierarchyNode`, `formatNodeLabel`, `NODE_KIND`) |
| Barre de recherche (S1) | markup exact du Spotlight + `src/components/Hero/Hero.css` |
| Navbar (S1–S7) | markup exact + `src/components/Navbar/Navbar.css` (réplique statique : le vrai composant importe Supabase/auth) |
| Page article (S3, S5, S6) | classes exactes + `src/pages/Code/ArticlePage.css` |
| Page décision (S4, S5, S7) | classes exactes + `src/pages/Decision/DecisionPage.css` |
| Tokens / global | `src/styles/tokens.css`, `src/styles/global.css` |
| Logos | `public/icon-512.png`, `public/lexenegal_new_logo.svg` |

**Données réelles embarquées** (`remotion/mock/data.ts`, snapshot prod du 15 juillet 2026) : article 45 CPC et ses 3 versions datées, hiérarchie complète du CPC, pastilles 44 → 54-9 avec statuts d'abrogation réels, arrêt n° 67 du 27/11/2025 (référence, matière, mots-clés, résumé, références légales), décomptes du corpus.

**Choix techniques** : les animations de framer-motion internes aux composants sont neutralisées au rendu (override CSS) — tout le mouvement est piloté par `useCurrentFrame()` pour un rendu déterministe image par image ; les `Link` react-router sont satisfaits par un `MemoryRouter`.
