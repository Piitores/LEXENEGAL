import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

// Suppression self-service : l'utilisateur connecté supprime SON propre compte.
// Le cascade DB (profiles.id -> auth.users ON DELETE CASCADE) efface profiles puis
// favorites/folders/saved_searches/user_annotations (et folder_decisions via folders).
// Le journal d'audit (audit_log, sans FK) est effacé explicitement (RGPD).
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const authHeader = req.headers.get('Authorization') ?? '';

  // 1) Identifier l'appelant via son JWT.
  const caller = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: uErr } = await caller.auth.getUser();
  if (uErr || !user) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(url, service);

  // 2) Effacer le journal d'audit de l'utilisateur (non couvert par le cascade).
  await admin.from('audit_log').delete().eq('user_id', user.id);

  // 3) Supprimer le compte auth -> cascade sur toutes les données personnelles.
  const { error: dErr } = await admin.auth.admin.deleteUser(user.id);
  if (dErr) return json({ error: dErr.message }, 500);

  return json({ success: true });
});
