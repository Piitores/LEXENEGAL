# Règle SEO — rendu SSR des textes juridiques

> Référence stable pour **tous les déploiements** (codes, lois, décrets, arrêtés, Actes uniformes OHADA) et pour **tout texte ajouté à l'avenir**. Le code qui applique cette règle : `api/render.js` (`codeSeoMeta`, `buildCodeHead`, `buildCodeBody`).

## Principe

La SPA Vite ne sert qu'une coquille vide au crawler. `api/render.js` injecte, pour chaque page dynamique, un HTML complet (titre + meta + canonical + OG + JSON-LD + contenu visible) que Google indexe, puis React reprend la main.

Pour les pages `/code/:slug`, les balises sont générées **automatiquement** à partir de champs **déjà vérifiés** de `laws_and_codes`. Aucune saisie manuelle n'est requise pour le socle, et **aucune donnée n'est fabriquée**.

## Fidélité au type de texte (NON négociable)

Le libellé s'adapte à `laws_and_codes.category`. C'est le cœur de la règle :

| category | Descripteur affiché | Suffixe « du Sénégal » ? | Juridiction (JSON-LD + keywords) |
|----------|---------------------|--------------------------|----------------------------------|
| `code`   | **texte intégral et version consolidée** | oui, si nom générique (« Code X ») | Sénégal |
| `loi`    | texte intégral | non (le nom porte déjà « Loi n° … ») | Sénégal |
| `decret` | texte intégral | non | Sénégal |
| `arrete` | texte intégral | non | Sénégal |
| `ohada`  | texte intégral | **JAMAIS** | **OHADA** (communautaire, 17 États) |

Règles à retenir :
- **« version consolidée » est réservé aux codes.** Un décret, un arrêté, une loi ou un Acte uniforme est un texte unique → « texte intégral » seulement. Annoncer « version consolidée » sur un décret serait faux.
- **L'OHADA n'est pas du droit sénégalais.** Jamais « du Sénégal » ; juridiction = OHADA ; mots-clés « OHADA », « droit OHADA ».
- **`title` reste l'intitulé officiel exact** (cf. règle de fidélité des titres). Pour l'affichage/SEO court, renseigner `short_title` (ex. `constitution-senegal` → `Constitution du Sénégal`). Le rendu utilise `short_title || title`.

## Champs qui pilotent le rendu

| Champ `laws_and_codes` | Usage SEO | Obligatoire ? |
|---|---|---|
| `title` | intitulé officiel (JSON-LD `name`) | oui |
| `short_title` | nom court affiché (titre, h1, keywords) | recommandé si `title` est un long intitulé « Loi n° … portant … » |
| `category` | pilote tout le libellé (cf. table) | **oui — vérifier à chaque ajout** |
| `reference` | injectée dans description + JSON-LD `legislationIdentifier` (ex. « Loi n° 65-60 du 21 juillet 1965 ») | recommandé |
| `publication_date` | chapô + JSON-LD `datePublished` | recommandé |
| `description` | **bloc de présentation éditorial** rendu tel quel (HTML de confiance) sous le chapô | optionnel |

### Champ `description` = présentation + lois modificatives

C'est l'emplacement prévu pour le contenu rédigé (présentation du texte, historique des modifications, lois modificatives, renvois). **Règle : contenu sourcé et vérifié uniquement.** Ne jamais générer de liste de lois modificatives « de mémoire » — elle doit venir d'une source officielle (JO, Primature) et être vérifiée, comme tout le reste du projet.

## Checklist à chaque nouveau texte publié

1. `category` correcte (détermine le libellé — l'erreur la plus coûteuse).
2. `title` = intitulé officiel exact.
3. `short_title` si le `title` est un long intitulé.
4. `reference` et `publication_date` renseignées si connues.
5. `is_active = true` seulement quand le texte est complet et vérifié (le rendu sert un `noindex` propre tant que ce n'est pas le cas).
6. (Optionnel) `description` : présentation/lois modificatives **sourcées**.
7. Régénérer le sitemap : `npm run sitemap`.

## Résultat (exemples réels)

- `code-penal` → `Code Pénal du Sénégal — texte intégral et version consolidée | Lexenegal`
- `constitution-senegal` → `Constitution du Sénégal — texte intégral et version consolidée | Lexenegal`
- décret → `Décret n° 2006-1249 … — texte intégral | Lexenegal`
- Acte uniforme → `Acte uniforme relatif au droit de l'arbitrage — texte intégral | Lexenegal` (juridiction OHADA, jamais Sénégal)

## Pages pré-rendues

| Route | Type | SSR |
|-------|------|-----|
| `/` (accueil) | `home` | ✅ (H1, intro, liens internes vers les codes) |
| `/codes` | `codes` | ✅ (index groupé par catégorie) |
| `/code/:slug` | `code` | ✅ (cf. règle ci-dessus) |
| `/code/:code/:article` | `article` | ✅ |
| `/decision/:slug` | `decision` | ✅ |

L'accueil et `/codes` font une requête Supabase (liste des codes actifs) mise en cache CDN 24 h (`s-maxage=86400`), donc la fonction ne s'exécute qu'environ une fois par jour.

## Pistes connexes (non encore faites)

- **Redirection non-www → www** : actuellement `307` (temporaire) côté Vercel ; passer en `308` (permanent) dans les réglages domaine.
- **Casse des `reference`** : certaines sont en capitales (ex. code sécurité sociale) — à normaliser pour l'affichage sans altérer la valeur légale.
