# Règle — recherche hybride (contrat unique)

> Référence stable pour **toute recherche sémantique** du projet (front public, MCP, et tout futur appelant). But : un seul langage, pas de chemins divergents. Même esprit que le noyau `resolve_citation` (une brique, pas trois).

## Principe

La **source de vérité du classement** = les fonctions SQL `search_*_hybrid` (Postgres). Elles fusionnent **FTS + similarité vectorielle** (Reciprocal Rank Fusion) en un seul endroit. Personne ne réimplémente le classement ailleurs.

```
front ─┐                          ┌─ search_doctrine_hybrid
        edge function `search` ───┤  search_articles_hybrid
MCP ───┘ (Node direct, voyage.ts) └─ search_decisions_hybrid
        ↑ même contrat d'embedding         ↑ même RPC SQL = même classement
```

## Contrat d'embedding de requête (NON négociable)

Tout embedding de requête, quel que soit l'appelant :

| Paramètre | Valeur figée |
|---|---|
| Fournisseur / modèle | Voyage AI, `voyage-3-large` |
| `input_type` | `query` (les **documents** du corpus sont embeddés en `document` — cf. `backfill-embeddings.mjs`) |
| `output_dimension` | **1024** |
| Sérialisation | littéral pgvector `"[v1,v2,…]"` passé à `query_embedding` |

Changer le modèle ou la dimension = **réembedder tout le corpus** (`doc_embeddings`) ET aligner les RPC. Ne jamais le faire à moitié.

## Qui produit l'embedding

- **Front (et tout client navigateur)** : **jamais** la clé Voyage côté client. On passe par l'**edge function `search`** (`supabase/functions/search`), seul point serveur qui détient `VOYAGE_API_KEY`. Elle embedde (contrat ci-dessus) puis appelle la `search_*_hybrid` correspondante.
- **MCP** : chemin Node direct (`src/voyage.ts` → `noyauClient` → `search_*_hybrid`). Mêmes paramètres, mêmes RPC.

## Forme de résultat

Enveloppe `{ results, total }`. Métadonnées + lien profond uniquement — **jamais** de contenu gaté (`content_raw`, texte intégral réservé). Les RPC hybrides respectent déjà ça.

## Dégradation gracieuse

Si l'embedding échoue (pas de clé, Voyage indisponible) : l'appelant **retombe sur le FTS** (`search_doctrine` / `search_articles` / `search_decisions_fts`). Une recherche ne doit jamais planter faute d'embedding.

## Ajouter une nouvelle surface

1. Créer `search_<surface>_hybrid(query_text, query_embedding vector, …, result_limit)` qui suit le contrat (FTS + vecteur, RRF, métadonnées only).
2. Embedder le corpus de la surface dans `doc_embeddings` (`source_type='<surface>'`) via `backfill-embeddings.mjs`.
3. Câbler via l'edge function `search` (front) et/ou `noyauClient` (MCP). **Ne pas** brancher un FTS bricolé.

## Analytics

Toute recherche est journalisée via `log_search_event` (table `search_events`), avec `mode='hybrid'|'fts'`. C'est ce qui mesure le gain de l'hybride (taux de 0-résultat avant/après). Cf. vues `v_search_zero_results`, `v_search_top_queries`.

## État de déploiement (2026-06-30)

- RPC `search_*_hybrid` : ✅ en base, utilisées par le MCP.
- `doc_embeddings` : ✅ 24 597 vecteurs, réembed auto quotidien (cf. `auto-reembed`).
- Edge function `search` : ✅ déployée, gère les **3 surfaces** (doctrine, articles, décisions). Clé Voyage lue depuis le **Vault** (`get_voyage_key`, réservé `service_role`) — pas de secret d'edge function à poser.
- Front : ✅ **doctrine + articles + décisions** passent par l'edge function avec **fallback FTS** systématique. `search_decisions_hybrid` a reçu `sort_by` + `result_offset` + pool de candidats élargi (150) ; params en DEFAULT → compat MCP préservée.
- Pagination hybride : bornée par le pool de candidats (~150 fts + 150 vec). Au-delà, la liste se tarit (acceptable : la valeur de l'hybride est dans les premières pages). Le tri par date s'applique **au sein** des candidats pertinents (pas un tri global de tout le corpus).
