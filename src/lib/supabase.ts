import { createClient } from '@supabase/supabase-js';
import { lockAuthBorne } from './authLock';
import { avecDelaiMaximal } from './delaiRequetes';

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
 *
 * ⚠️ `global.fetch` : `fetch` n'a aucun délai par défaut. Une requête qui ne reçoit jamais de
 * réponse laissait une page sur « Chargement du code… » pour toujours (05/10/2026). Les requêtes
 * du client (PostgREST, RPC, auth, fonctions edge) passent donc par un délai maximal ; à
 * l'expiration elles échouent, et la page affiche « Chargement interrompu » avec « Réessayer ».
 * Bornes propres : rafraîchissement de session 60 s, requêtes non idempotentes (inscription, code,
 * courriels, fonctions edge delete-account, admin-delete-user, send-contact-email) 120 s ; seul le
 * stockage est sans borne. Durées (en-têtes : borne totale ; corps : borne d'inactivité) et raisons :
 * `delaiRequetes.ts`. On appelle `fetch` au moment de la requête (et non
 * une référence prise au chargement du module) pour suivre un éventuel remplacement du global.
 */
export const supabase = createClient(url, anonKey, {
    auth: { lock: lockAuthBorne },
    global: { fetch: avecDelaiMaximal((input, init) => fetch(input, init)) },
});
