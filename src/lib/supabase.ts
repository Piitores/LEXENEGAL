import { createClient } from '@supabase/supabase-js';
import { lockAuthBorne } from './authLock';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Client Supabase UNIQUE de l'application.
 * Évite les multiples instances GoTrueClient et les sessions incohérentes.
 * Tous les modules DOIVENT importer ce client (jamais `createClient` ailleurs).
 *
 * ⚠️ `auth.lock` : le verrou d'authentification par défaut de supabase-js attend
 * INDÉFINIMENT (`acquireTimeout = -1`). Comme il est partagé par tous les onglets
 * de l'origine, un onglet gelé qui le détient fige toute nouvelle page — écran de
 * chargement perpétuel, sans erreur ni requête réseau (incident du 2026-08-04 sur
 * /admin). On borne donc l'attente ; le détail est dans `authLock.ts`.
 */
export const supabase = createClient(url, anonKey, {
    auth: { lock: lockAuthBorne },
});
