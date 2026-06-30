// Edge function `search` — passerelle de recherche hybride canonique.
// Cf. docs/RECHERCHE-HYBRIDE.md. Seul point serveur détenant VOYAGE_API_KEY :
// embedde la requête (contrat Voyage figé) puis appelle la search_*_hybrid SQL.
// Dégradation gracieuse : si pas de clé / Voyage KO → { fallback:true }, et
// l'appelant retombe sur le FTS. Une recherche ne plante jamais ici.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const { surface, query, limit, filters } = await req.json().catch(() => ({}));
    const rpcName = SURFACES[surface];
    if (!rpcName || typeof query !== "string" || query.trim().length < 2) {
      return json({ error: "bad request" }, 400);
    }
    const result_limit = Math.max(1, Math.min(Number(limit) || 20, 50));

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

    // Embedding de requête. Pas de clé / échec → fallback (l'appelant fait du FTS).
    let embedding: number[] | null = null;
    if (voyageKey) {
      try {
        embedding = await embedQuery(query, voyageKey);
      } catch (_) {
        embedding = null;
      }
    }
    if (!embedding) return json({ results: [], total: 0, mode: "none", fallback: true });
    const args: Record<string, unknown> = {
      query_text: query,
      query_embedding: `[${embedding.join(",")}]`,
      result_limit,
    };
    if (surface === "decisions" && filters) {
      args.matiere_filter = filters.matiere ?? null;
      args.chambre_filter = filters.chambre ?? null;
      args.juridiction_filter = filters.juridiction ?? null;
      args.date_from = filters.date_from ?? null;
      args.date_to = filters.date_to ?? null;
    }
    if (surface === "articles" && filters?.code) args.code_slug_filter = filters.code;

    const { data, error } = await sb.rpc(rpcName, args);
    if (error) throw new Error(error.message);
    const results = data ?? [];
    return json({ results, total: results.length, mode: "hybrid" });
  } catch (e) {
    return json({ error: String((e as Error)?.message ?? e) }, 500);
  }
});
