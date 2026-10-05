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
 *  - la RÉPONSE (en-têtes) : le serveur répond vite ou pas du tout, borne TOTALE ;
 *  - le CORPS : sa durée croît avec la taille de la réponse et baisse avec le débit du lecteur,
 *    sans limite raisonnable. On borne donc l'INACTIVITÉ (aucun octet reçu pendant N s), jamais
 *    la durée totale : une connexion lente mais vivante va au bout.
 */

/**
 * Délai d'arrivée des en-têtes de la réponse, en ms.
 *
 * Justification : `statement_timeout` = 8 s pour les rôles anon et authenticated (mesuré en base
 * le 05/10/2026, aucune fonction ne le relève) ; aucune requête PostgREST légitime ne dépasse donc
 * 8 s côté base, plus la latence réseau (établissement TLS sur mobile : 1 à 3 s). 15 s laisse
 * presque le double.
 * ⚠️ La borne vaut pour UNE requête. Une page en enchaîne plusieurs (texte, puis article, puis
 * versions…) : une requête bloquée partie après 5 s finit après 20 s. C'est pourquoi le filet de
 * 20 s de la version serveur (lib/versionServeur.ts) ne la retire jamais : il propose « Réessayer ».
 */
export const DELAI_REPONSE_MS = 15_000;

/**
 * Délai d'INACTIVITÉ du corps, en ms : la requête échoue si AUCUN octet n'arrive pendant ce délai.
 * La minuterie repart à chaque morceau reçu.
 *
 * Justification : la plus grosse réponse du site (page de 1 000 articles du Code général des
 * impôts, colonnes de lecture) pèse 2,5 Mo brut, 600 Ko en gzip (mesure du 05/10/2026). Avec une
 * borne TOTALE de 30 s, elle devenait impossible à charger sous 160 kbit/s utiles, même en
 * réessayant, alors que la production l'affichait en 50 s à 120 kbit/s (rapport « react »). Une
 * connexion vivante livre des morceaux en continu ; 20 s sans un octet signale une connexion morte.
 */
export const DELAI_INACTIVITE_CORPS_MS = 20_000;

/** Nom de l'erreur levée à l'expiration, le même que celui d'`AbortSignal.timeout()`. */
export const NOM_ERREUR_DELAI = 'TimeoutError';

/**
 * Mention portée par le message de toute erreur de délai. supabase-js ne garde parfois que le
 * MESSAGE de l'erreur d'origine (authentification : AuthRetryableFetchError, sans nom ni cause) :
 * c'est par elle que `estDelaiDepasse` la reconnaît.
 */
export const MENTION_DELAI = 'délai maximal dépassé';

export interface DelaisRequete {
    reponseMs: number;
    inactiviteCorpsMs: number;
}

const DELAIS_PAR_DEFAUT: DelaisRequete = { reponseMs: DELAI_REPONSE_MS, inactiviteCorpsMs: DELAI_INACTIVITE_CORPS_MS };

/** Fonctions edge NON idempotentes : la couper côté client ne l'arrête pas côté serveur. */
const FONCTIONS_NON_IDEMPOTENTES = /\/functions\/v1\/(delete-account|admin-delete-user|send-contact-email)(?:[/?#]|$)/;

/**
 * Requêtes exemptées de délai :
 *  - `/storage/v1/` : envoi de fichiers, durée légitime sans borne avec la taille de l'envoi (le
 *    site n'en envoie aucun aujourd'hui ; l'exemption évite qu'un futur envoi soit coupé) ;
 *  - `/auth/v1/token` : supabase-js RELANCE un rafraîchissement coupé avec le MÊME refresh_token.
 *    Si le serveur l'a déjà consommé (plus de 10 s avant la relance), il répond « already used »,
 *    erreur non réessayable, et supabase-js EFFACE la session : le membre est déconnecté pour une
 *    simple lenteur (rapport « react » du 05/10/2026). Un code PKCE est lui aussi à usage unique ;
 *  - les fonctions edge non idempotentes (delete-account, admin-delete-user, send-contact-email) :
 *    le serveur continue après une coupure côté client. delete-account, en particulier, n'a
 *    aucune borne côté serveur (client service-role, suppression en cascade) : l'écran affichait
 *    « Échec de la suppression » pendant que le compte était supprimé.
 * Tout le reste (PostgREST, RPC, fonction edge `search`…) est en lecture et peut être relancé.
 */
export function estExempteDeDelai(url: string): boolean {
    return url.includes('/storage/v1/') || url.includes('/auth/v1/token') || FONCTIONS_NON_IDEMPOTENTES.test(url);
}

function urlDe(input: RequestInfo | URL): string {
    if (typeof input === 'string') return input;
    if (input instanceof URL) return input.href;
    return (input as Request).url ?? String(input);
}

function erreurDelai(phase: 'reponse' | 'corps', ms: number): Error {
    const message = phase === 'reponse'
        ? `Aucune réponse du serveur après ${Math.round(ms / 1000)} s (${MENTION_DELAI})`
        : `Réponse du serveur interrompue : rien reçu pendant ${Math.round(ms / 1000)} s (${MENTION_DELAI})`;
    // DOMException comme AbortSignal.timeout() ; repli sur Error là où elle n'existe pas.
    if (typeof DOMException === 'function') return new DOMException(message, NOM_ERREUR_DELAI);
    const e = new Error(message);
    e.name = NOM_ERREUR_DELAI;
    return e;
}

/**
 * Remplace le corps de `reponse` par un flux qui relaie les mêmes octets et échoue avec
 * `expirer()` si aucun morceau n'arrive pendant `ms`. La minuterie repart à chaque morceau.
 */
function avecInactiviteBornee(reponse: Response, ms: number, expirer: () => Error): Response {
    const source = reponse.body;
    // Sans corps (204, HEAD…) ou sans flux : rien à attendre, donc rien à borner.
    if (!source || typeof ReadableStream === 'undefined') return reponse;

    const lecteur = source.getReader();
    let minuterie: ReturnType<typeof setTimeout> | undefined;
    let fini = false;
    let sortie: ReadableStreamDefaultController<Uint8Array> | null = null;
    const arreter = () => { fini = true; clearTimeout(minuterie); };
    /** (Re)lance la minuterie d'inactivité : à la réception des en-têtes, puis à chaque morceau. */
    const relancer = () => {
        clearTimeout(minuterie);
        minuterie = setTimeout(() => {
            if (fini) return;
            arreter();
            const e = expirer();
            sortie?.error(e);
            lecteur.cancel(e).catch(() => { /* source déjà annulée par le signal */ });
        }, ms);
    };

    const flux = new ReadableStream<Uint8Array>({
        start(controleur) {
            sortie = controleur;
            relancer();
        },
        async pull(controleur) {
            try {
                const { done, value } = await lecteur.read();
                if (fini) return;
                if (done) { arreter(); controleur.close(); return; }
                relancer();
                controleur.enqueue(value);
            } catch (e) {
                if (fini) return;
                arreter();
                controleur.error(e);
            }
        },
        cancel(raison) {
            arreter();
            return lecteur.cancel(raison);
        },
    });

    let enveloppe: Response;
    try {
        enveloppe = new Response(flux, { status: reponse.status, statusText: reponse.statusText, headers: reponse.headers });
    } catch {
        // Statut que le constructeur refuse (hors 200-599) : réponse d'origine, sans borne du corps.
        arreter();
        lecteur.releaseLock();
        return reponse;
    }
    // `url` et `redirected` ne passent pas par le constructeur : on les recopie.
    try {
        Object.defineProperty(enveloppe, 'url', { value: reponse.url });
        Object.defineProperty(enveloppe, 'redirected', { value: reponse.redirected });
    } catch { /* sans conséquence : supabase-js ne les lit pas */ }
    return enveloppe;
}

/**
 * Enveloppe `fetchDeBase` d'un délai maximal.
 *
 * - Un signal déjà fourni par l'appelant (`.abortSignal()` de PostgREST, `signal` des fonctions
 *   edge) est RESPECTÉ : son annulation est relayée telle quelle, avec son motif.
 * - En-têtes : borne TOTALE (DELAI_REPONSE_MS). À l'expiration, la promesse est rejetée avec une
 *   erreur `TimeoutError` explicite, quel que soit le navigateur (certains rejettent un
 *   `AbortError` générique au lieu du motif).
 * - Corps : borne d'INACTIVITÉ (DELAI_INACTIVITE_CORPS_MS), minuterie relancée à chaque morceau
 *   reçu et arrêtée à la fin de la lecture. Le corps est relayé par un flux qui échoue avec la
 *   même erreur `TimeoutError` ; la requête sous-jacente est annulée.
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
            return motifDelai;
        };

        // Signal de l'appelant : relayé, jamais remplacé.
        const signalAppelant = init?.signal
            ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined);
        if (signalAppelant) {
            if (signalAppelant.aborted) controleur.abort(signalAppelant.reason);
            else signalAppelant.addEventListener('abort', () => controleur.abort(signalAppelant.reason), { once: true });
        }

        const minuterie = setTimeout(expirer('reponse', delais.reponseMs), delais.reponseMs);
        return fetchDeBase(input, { ...init, signal: controleur.signal }).then(
            (reponse) => {
                clearTimeout(minuterie);
                return avecInactiviteBornee(reponse, delais.inactiviteCorpsMs, expirer('corps', delais.inactiviteCorpsMs));
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
 * Formes rencontrées :
 *  - PostgREST : `{ message: 'TimeoutError: …' }` ;
 *  - fonctions edge : FunctionsFetchError, motif d'origine dans `context` ;
 *  - authentification : AuthRetryableFetchError, qui ne garde QUE le message d'origine (ni nom,
 *    ni cause) : reconnue par la mention « délai maximal dépassé » (MENTION_DELAI) ;
 *  - `AbortError` générique de navigateurs plus anciens, accepté puisque le site n'annule jamais
 *    lui-même une requête.
 */
export function estDelaiDepasse(erreur: unknown): boolean {
    const parties: unknown[] = [];
    let e: any = erreur;
    for (let i = 0; e && i < 3; i++) {
        parties.push(e.name, e.message);
        e = e.context ?? e.cause;
    }
    return parties.some((p) => typeof p === 'string'
        && (/\b(TimeoutError|AbortError)\b/.test(p) || p.includes(MENTION_DELAI)));
}
