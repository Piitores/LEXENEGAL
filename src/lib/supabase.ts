import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL || '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Client Supabase UNIQUE de l'application.
 * Évite les multiples instances GoTrueClient et les sessions incohérentes.
 * Tous les modules DOIVENT importer ce client (jamais `createClient` ailleurs).
 */
export const supabase = createClient(url, anonKey);
