// Edge function `search` — passerelle de recherche hybride canonique.
// Cf. docs/RECHERCHE-HYBRIDE.md. Embedde la requête (contrat Voyage figé) puis
// appelle la search_*_hybrid SQL. Clé Voyage : env d'abord, sinon Vault
// (get_voyage_key, réservé service_role). Dégradation gracieuse : pas de clé /
// Voyage KO → { fallback:true } et l'appelant retombe sur le FTS.
//
// DEUX CONTRATS D'ENTRÉE :
//   1. Mono-surface (historique, inchangé) :
//      { surface:"articles", query, limit, offset, sort, filters }
//      → { results:[...], total, mode:"hybrid" }
//   2. Multi-surfaces (2026-07-27, perf) :
//      { query, surfaces:[ {surface,limit,offset,sort,filters}, ... ] }
//      → { results:{ articles:{results,total}, ... }, mode:"hybrid" }
//   Le mode 2 n'embedde la requête QU'UNE FOIS et lance les RPC en parallèle.
//   Avant, le front faisait 3 appels séparés = 3 embeddings Voyage identiques,
//   3 préflights CORS et 3 requêtes lourdes concurrentes sur la même instance.
//
// Lots B et C de l'audit de la recherche (27/09/2026) :
//   - articles : `filters.categories` (catégories de laws_and_codes, cf. bases du site et
//     lexenegal-mcp/src/bases.ts) → `category_filter` ; la surface renvoie `categories`
//     quand le filtre a été appliqué (le site s'en sert pour savoir qu'il peut s'y fier) ;
//   - décisions : `total` = count_decisions_fts (total réel borné à `total_plafond`, lancé en
//     parallèle de la recherche) ; `count:false` dans la spec le désactive (le site compte
//     lui-même, en parallèle, pour ne pas dépendre de la version déployée de cette fonction) ;
//   - délai maximal de 2 s sur Voyage → repli FTS de l'appelant ;
//   - cache mémoire des embeddings de requête : pagination, tri et filtres ne rappellent plus
//     Voyage pour le même texte ;
//   - préflight CORS mis en cache (Access-Control-Max-Age : 24 h demandées ; chaque navigateur
//     plafonne, 24 h sur Firefox, 2 h sur Chrome et Edge).
import { createClient } from "jsr:@supabase/supabase-js@2";

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-3-large";
const OUTPUT_DIMENSION = 1024;

// Surfaces autorisées → RPC hybride correspondante (allowlist stricte).
const SURFACES: Record<string, string> = {
  doctrine: "search_doctrine_hybrid",
  articles: "search_articles_hybrid",
  decisions: "search_decisions_hybrid",
};

// Délai maximal accordé à Voyage : au-delà, l'appelant retombe sur le plein texte.
const VOYAGE_DELAI_MS = 2000;

// Plafond du total réel des décisions (count_decisions_fts : un résultat égal au plafond
// signifie « au moins autant »).
const PLAFOND_TOTAL_DECISIONS = 1000;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  // Le navigateur garde la réponse du préflight jusqu'à 24 h (Firefox) ; Chrome et Edge la
  // plafonnent à 2 h. Dans les deux cas, un aller-retour de moins pour les recherches suivantes.
  "Access-Control-Max-Age": "86400",
};

// Cache des embeddings de requête, propre à l'instance (perdu au redémarrage, ce qui est sans
// conséquence) : 200 entrées, 10 minutes. La clé porte le modèle et la dimension, pour qu'un
// changement du contrat d'embedding ne serve jamais un vecteur de l'ancien contrat.
const CACHE_MAX = 200;
const CACHE_TTL_MS = 10 * 60 * 1000;
const cacheEmbeddings = new Map<string, { v: number[]; t: number }>();

function cleCache(text: string): string {
  return `${MODEL}|${OUTPUT_DIMENSION}|${text}`;
}

function lireCache(text: string): number[] | null {
  const k = cleCache(text);
  const e = cacheEmbeddings.get(k);
  if (!e) return null;
  if (Date.now() - e.t > CACHE_TTL_MS) {
    cacheEmbeddings.delete(k);
    return null;
  }
  // Réinsertion : la Map garde l'ordre d'insertion, la plus ancienne sort en premier.
  cacheEmbeddings.delete(k);
  cacheEmbeddings.set(k, e);
  return e.v;
}

function ecrireCache(text: string, v: number[]): void {
  const k = cleCache(text);
  cacheEmbeddings.delete(k);
  cacheEmbeddings.set(k, { v, t: Date.now() });
  while (cacheEmbeddings.size > CACHE_MAX) {
    const plusAncienne = cacheEmbeddings.keys().next().value;
    if (plusAncienne === undefined) break;
    cacheEmbeddings.delete(plusAncienne);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function embedQuery(text: string, key: string): Promise<number[]> {
  // Délai maximal : sans lui, un Voyage lent faisait attendre toute la recherche.
  const ctrl = new AbortController();
  const minuteur = setTimeout(() => ctrl.abort(), VOYAGE_DELAI_MS);
  try {
    const r = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        input: [text],
        model: MODEL,
        input_type: "query",
        output_dimension: OUTPUT_DIMENSION,
      }),
      signal: ctrl.signal,
    });
    if (!r.ok) throw new Error(`voyage ${r.status}`);
    const j = await r.json();
    const v = j?.data?.[0]?.embedding;
    if (!Array.isArray(v) || v.length !== OUTPUT_DIMENSION) throw new Error("voyage: réponse inattendue");
    return v as number[];
  } finally {
    clearTimeout(minuteur);
  }
}

/** Catégories de textes demandées (liste de chaînes non vides), sinon `null`. */
function lireCategories(filters: any): string[] | null {
  const c = filters?.categories;
  if (!Array.isArray(c)) return null;
  const propres = c.filter((x: unknown) => typeof x === "string" && x.trim().length > 0).slice(0, 10);
  return propres.length ? propres : null;
}

/** Construit les arguments de la RPC hybride d'une surface donnée. */
function buildArgs(
  spec: { surface: string; limit?: unknown; offset?: unknown; sort?: unknown; filters?: any },
  query: string,
  embeddingLiteral: string,
): Record<string, unknown> {
  const result_limit = Math.max(1, Math.min(Number(spec.limit) || 20, 50));
  const args: Record<string, unknown> = {
    query_text: query,
    query_embedding: embeddingLiteral,
    result_limit,
  };
  if (spec.surface === "decisions") {
    if (spec.filters) {
      args.matiere_filter = spec.filters.matiere ?? null;
      args.chambre_filter = spec.filters.chambre ?? null;
      args.juridiction_filter = spec.filters.juridiction ?? null;
      args.date_from = spec.filters.date_from ?? null;
      args.date_to = spec.filters.date_to ?? null;
    }
    args.sort_by = typeof spec.sort === "string" ? spec.sort : "relevance";
    args.result_offset = Number(spec.offset) || 0;
  }
  if (spec.surface === "articles" && spec.filters?.code) {
    args.code_slug_filter = spec.filters.code;
  }
  if (spec.surface === "articles") {
    const categories = lireCategories(spec.filters);
    if (categories) args.category_filter = categories;
  }
  return args;
}

type Spec = { surface: string; limit?: unknown; offset?: unknown; sort?: unknown; filters?: any; count?: unknown };

/** Total réel borné des décisions (mêmes filtres que la recherche) ; `null` si le comptage échoue. */
async function compterDecisions(sb: any, spec: Spec, query: string): Promise<number | null> {
  try {
    const f = spec.filters ?? {};
    const { data, error } = await sb.rpc("count_decisions_fts", {
      search_query: query,
      matiere_filter: f.matiere ?? null,
      chambre_filter: f.chambre ?? null,
      juridiction_filter: f.juridiction ?? null,
      date_from: f.date_from ?? null,
      date_to: f.date_to ?? null,
      cap: PLAFOND_TOTAL_DECISIONS,
    });
    if (error || typeof data !== "number") return null;
    return data;
  } catch (_) {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const { surface, surfaces, query, limit, offset, sort, filters, count } = body;

    if (typeof query !== "string" || query.trim().length < 2) {
      return json({ error: "bad request" }, 400);
    }

    // Normalise les deux contrats en une seule liste de specs.
    const specs: Spec[] =
      Array.isArray(surfaces) && surfaces.length > 0
        ? surfaces
        : [{ surface, limit, offset, sort, filters, count }];
    const multi = Array.isArray(surfaces) && surfaces.length > 0;

    // Allowlist stricte : toute surface inconnue invalide la requête entière.
    if (specs.length === 0 || specs.length > 3 || specs.some((s) => !s || !SURFACES[s.surface])) {
      return json({ error: "bad request" }, 400);
    }

    // Client service (passerelle contrôlée) — sert aussi à lire la clé Voyage du Vault.
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Embedding de requête : UNE SEULE FOIS, quel que soit le nombre de surfaces, et pas du
    // tout si ce texte a été embeddé il y a moins de 10 minutes (pagination, tri, filtres).
    // Pas de clé / échec / délai dépassé → fallback (l'appelant fait du FTS).
    let embedding: number[] | null = lireCache(query);
    if (!embedding) {
      // Clé Voyage : variable d'env d'abord, sinon Vault via get_voyage_key (réservé service_role).
      // Lue seulement quand il faut appeler Voyage (pas sur un embedding servi par le cache).
      let voyageKey: string | null = Deno.env.get("VOYAGE_API_KEY") ?? null;
      if (!voyageKey) {
        try {
          const { data } = await sb.rpc("get_voyage_key");
          if (typeof data === "string" && data) voyageKey = data;
        } catch (_) {
          /* pas de clé → fallback plus bas */
        }
      }
      if (voyageKey) {
        try {
          embedding = await embedQuery(query, voyageKey);
          ecrireCache(query, embedding);
        } catch (_) {
          embedding = null;
        }
      }
    }
    if (!embedding) {
      return multi
        ? json({ results: {}, mode: "none", fallback: true })
        : json({ results: [], total: 0, mode: "none", fallback: true });
    }
    const embeddingLiteral = `[${embedding.join(",")}]`;

    // Les RPC partent EN PARALLÈLE. Une surface qui échoue n'abat pas les autres :
    // elle revient en `error` et l'appelant retombe sur le FTS pour ce pilier seul.
    const settled = await Promise.all(
      specs.map(async (spec) => {
        try {
          const args = buildArgs(spec, query, embeddingLiteral);
          // Décisions : total réel compté EN PARALLÈLE de la recherche (la liste par pertinence
          // s'arrête vers 300, le total non).
          const pTotal = spec.surface === "decisions" && spec.count !== false
            ? compterDecisions(sb, spec, query)
            : Promise.resolve(null);
          const [{ data, error }, totalReel] = await Promise.all([sb.rpc(SURFACES[spec.surface], args), pTotal]);
          if (error) throw new Error(error.message);
          const results = data ?? [];
          const extra: Record<string, unknown> = {};
          if (totalReel !== null) extra.total_plafond = PLAFOND_TOTAL_DECISIONS;
          if (Array.isArray(args.category_filter)) extra.categories = args.category_filter;
          return {
            surface: spec.surface,
            ok: true as const,
            results,
            total: totalReel ?? results.length,
            extra,
          };
        } catch (e) {
          return {
            surface: spec.surface,
            ok: false as const,
            error: String((e as Error)?.message ?? e),
          };
        }
      }),
    );

    // Contrat historique : une seule surface → réponse à plat (inchangée).
    if (!multi) {
      const only = settled[0];
      if (!only.ok) return json({ error: only.error }, 500);
      return json({ results: only.results, total: only.total, ...only.extra, mode: "hybrid" });
    }

    // Contrat multi : un objet indexé par surface.
    const out: Record<string, unknown> = {};
    for (const r of settled) {
      out[r.surface] = r.ok
        ? { results: r.results, total: r.total, ...r.extra }
        : { results: [], total: 0, fallback: true, error: r.error };
    }
    return json({ results: out, mode: "hybrid" });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
