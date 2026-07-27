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

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

async function embedQuery(text: string, key: string): Promise<number[]> {
  const r = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      input: [text],
      model: MODEL,
      input_type: "query",
      output_dimension: OUTPUT_DIMENSION,
    }),
  });
  if (!r.ok) throw new Error(`voyage ${r.status}`);
  const j = await r.json();
  return j.data[0].embedding as number[];
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
  return args;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const body = await req.json().catch(() => ({}));
    const { surface, surfaces, query, limit, offset, sort, filters } = body;

    if (typeof query !== "string" || query.trim().length < 2) {
      return json({ error: "bad request" }, 400);
    }

    // Normalise les deux contrats en une seule liste de specs.
    const specs: Array<{ surface: string; limit?: unknown; offset?: unknown; sort?: unknown; filters?: any }> =
      Array.isArray(surfaces) && surfaces.length > 0
        ? surfaces
        : [{ surface, limit, offset, sort, filters }];
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

    // Clé Voyage : variable d'env d'abord, sinon Vault via get_voyage_key (réservé service_role).
    let voyageKey: string | null = Deno.env.get("VOYAGE_API_KEY") ?? null;
    if (!voyageKey) {
      try {
        const { data } = await sb.rpc("get_voyage_key");
        if (typeof data === "string" && data) voyageKey = data;
      } catch (_) {
        /* pas de clé → fallback plus bas */
      }
    }

    // Embedding de requête — UNE SEULE FOIS, quel que soit le nombre de surfaces.
    // Pas de clé / échec → fallback (l'appelant fait du FTS).
    let embedding: number[] | null = null;
    if (voyageKey) {
      try {
        embedding = await embedQuery(query, voyageKey);
      } catch (_) {
        embedding = null;
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
          const { data, error } = await sb.rpc(
            SURFACES[spec.surface],
            buildArgs(spec, query, embeddingLiteral),
          );
          if (error) throw new Error(error.message);
          const results = data ?? [];
          return { surface: spec.surface, ok: true as const, results, total: results.length };
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
      return json({ results: only.results, total: only.total, mode: "hybrid" });
    }

    // Contrat multi : un objet indexé par surface.
    const out: Record<string, unknown> = {};
    for (const r of settled) {
      out[r.surface] = r.ok
        ? { results: r.results, total: r.total }
        : { results: [], total: 0, fallback: true, error: r.error };
    }
    return json({ results: out, mode: "hybrid" });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
