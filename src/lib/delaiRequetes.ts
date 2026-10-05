/**
 * delaiRequetes - délai maximal des requêtes réseau du client Supabase.
 *
 * Pourquoi ce fichier existe (05/10/2026) : une page restait INDÉFINIMENT sur « Chargement du
 * code… » (Chrome, première ouverture de deux textes ; Brave chez le propriétaire). Les pages
 * mettent bien fin au chargement sur une ERREUR, mais `fetch` n'a aucun délai : une requête qui
 * ne reçoit jamais de réponse (connexion morte réutilisée, proxy qui retient la requête…) laisse
 * la promesse en suspens pour toujours, sans erreur ni message.
 *
 * Ce module enveloppe `fetch` (option `global.fetch` de createClient, cf. supabase.ts) : au-delà
 * du délai, la requête est annulée et ÉCHOUE. supabase-js transforme cet échec en `{ error }`
 * (PostgREST, RPC), en erreur d'authentification « réessayable » (auth) ou en FunctionsFetchError
 * (fonctions edge) : chaque page peut alors afficher « Chargement interrompu » et « Réessayer »
 * au lieu d'une roue sans fin.
 *
 * Deux bornes, parce que les deux phases n'ont pas la même durée légitime :
 *  - la RÉPONSE (en-têtes) : le serveur répond vite ou pas du tout ;
 *  - le CORPS : proportionnel à la taille de la réponse et au débit du lecteur.
 */

/**
 * Délai d'arrivée des en-têtes de la réponse, en ms.
 *
 * Justification : `statement_timeout` = 8 s pour les rôles anon et authenticated (mesuré en base
 * le 05/10/2026, aucune fonction ne le relève) ; aucune requête PostgREST légitime ne dépasse donc
 * 8 s côté base, plus la latence réseau (établissement TLS sur mobile : 1 à 3 s). 15 s laisse
 * presque le double, et reste sous le filet de 20 s d'App.tsx : une requête bloquée finit en
 * « Chargement interrompu » pendant que la version serveur est encore affichée.
 */
export const DELAI_REPONSE_MS = 15_000;

/**
 * Délai de réception du corps, en ms, compté à partir des en-têtes.
 *
 * Justification : la plus grosse réponse du site (page de 1 000 articles du Code général des
 * impôts, colonnes de lecture) pèse 2,5 Mo brut, 600 Ko en gzip, 330 Ko en brotli (mesure du
 * 05/10/2026). En 3G lente (400 kbit/s), 600 Ko demandent environ 12 s : 30 s laissent une
 * marge de 2,5.
 */
export const DELAI_CORPS_MS = 30_000;

/** Nom de l'erreur levée à l'expiration, le même que celui d'`AbortSignal.timeout()`. */
export const NOM_ERREUR_DELAI = 'TimeoutError';

export interface DelaisRequete {
    reponseMs: number;
    corpsMs: number;
}

const DELAIS_PAR_DEFAUT: DelaisRequete = { reponseMs: DELAI_REPONSE_MS, corpsMs: DELAI_CORPS_MS };

/**
 * Requêtes exemptées de délai : le stockage de fichiers (`/storage/v1/`), seul service dont la
 * durée légitime croît sans borne avec la taille de l'envoi. Le site n'en envoie aucun
 * aujourd'hui ; l'exemption évite qu'un futur envoi de fichier soit coupé à 15 s.
 * Tout le reste (PostgREST, RPC, auth, fonctions edge) répond en quelques secondes : les
 * fonctions edge du site (search, delete-account, send-contact-email, admin-delete-user)
 * bornent elles-mêmes leurs appels externes (Voyage : 2 s) et leurs requêtes (8 s).
 */
export function estExempteDeDelai(url: string): boolean {
    return url.includes('/storage/v1/');
}

function urlDe(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return (input as Request).url ?? String(input);
}

function erreurDelai(phase: 'reponse' | 'corps', ms: number): Error {
    const message = phase === 'reponse'
        ? `Aucune réponse du serveur après ${Math.round(ms / 1000)} s (délai maximal dépassé)`
        : `Réponse du serveur incomplète après ${Math.round(ms / 1000)} s (délai maximal dépassé)`;
    // DOMException comme AbortSignal.timeout() ; repli sur Error là où elle n'existe pas.
    if (typeof DOMException === 'function') return new DOMException(message, NOM_ERREUR_DELAI);
    const e = new Error(message);
    e.name = NOM_ERREUR_DELAI;
    return e;
}

/**
 * Enveloppe `fetchDeBase` d'un délai maximal.
 *
 * - Un signal déjà fourni par l'appelant (`.abortSignal()` de PostgREST, `signal` des fonctions
 *   edge) est RESPECTÉ : son annulation est relayée telle quelle, avec son motif.
 * - À l'expiration, la promesse est rejetée avec une erreur `TimeoutError` explicite, quel que
 *   soit le navigateur (certains rejettent un `AbortError` générique au lieu du motif).
 * - Une fois les en-têtes reçus, le second délai court jusqu'à la lecture du corps ; l'annulation
 *   d'une réponse déjà lue est sans effet. La minuterie n'est donc jamais « oubliée » sur une
 *   requête en cours, et ne gêne jamais une requête finie.
 */
export function avecDelaiMaximal(
    fetchDeBase: typeof fetch,
    delais: DelaisRequete = DELAIS_PAR_DEFAUT,
): typeof fetch {
    return (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
        if (estExempteDeDelai(urlDe(input))) return fetchDeBase(input, init);

        const controleur = new AbortController();
        let motifDelai: Error | null = null;
        const expirer = (phase: 'reponse' | 'corps', ms: number) => () => {
            motifDelai = erreurDelai(phase, ms);
            controleur.abort(motifDelai);
        };

        // Signal de l'appelant : relayé, jamais remplacé.
        const signalAppelant = init?.signal
            ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
        if (signalAppelant) {
            if (signalAppelant.aborted) controleur.abort(signalAppelant.reason);
            else signalAppelant.addEventListener('abort', () => controleur.abort(signalAppelant.reason), { once: true });
        }

        let minuterie = setTimeout(expirer('reponse', delais.reponseMs), delais.reponseMs);
        return fetchDeBase(input, { ...init, signal: controleur.signal }).then(
            (reponse) => {
                clearTimeout(minuterie);
                minuterie = setTimeout(expirer('corps', delais.corpsMs), delais.corpsMs);
                return reponse;
            },
            (erreur) => {
                clearTimeout(minuterie);
                throw motifDelai ?? erreur;
            },
        );
    };
}

/**
 * Vrai si l'erreur rendue par supabase-js vient d'un délai dépassé (ou d'une annulation).
 * PostgREST la rend sous la forme `{ message: 'TimeoutError: …' }`, les fonctions edge dans
 * `context`, l'authentification dans `message` ; on accepte aussi l'`AbortError` générique de
 * navigateurs plus anciens, puisque le site n'annule jamais lui-même une requête.
 */
export function estDelaiDepasse(erreur: unknown): boolean {
    const parties: unknown[] = [];
    let e: any = erreur;
    for (let i = 0; e && i < 3; i++) {
        parties.push(e.name, e.message);
        e = e.context ?? e.cause;
    }
    return parties.some((p) => typeof p === 'string' && /\b(TimeoutError|AbortError)\b/.test(p));
}
