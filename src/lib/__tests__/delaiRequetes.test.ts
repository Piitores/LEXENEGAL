import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
    avecDelaiMaximal, estDelaiDepasse, estExempteDeDelai, delaisPour,
    DELAI_REPONSE_MS, DELAI_INACTIVITE_CORPS_MS, NOM_ERREUR_DELAI, MENTION_DELAI,
    DELAI_RAFRAICHISSEMENT_MS, DELAI_NON_IDEMPOTENT_MS,
} from '../delaiRequetes';
import { lockAuthBorne } from '../authLock';

/*
 * Délai maximal des requêtes (incident du 05/10/2026 : « Chargement du code… » sans fin, une
 * requête ne recevant jamais de réponse). Minuteries simulées : on vérifie le comportement, pas
 * la patience.
 */

const URL_REST = 'https://exemple.supabase.co/rest/v1/laws_and_codes?select=*';

/** fetch qui ne répond JAMAIS, sauf annulation par son signal (comme un vrai fetch). */
function fetchMuet() {
    const appels: RequestInit[] = [];
    const f = ((_input: RequestInfo | URL, init?: RequestInit) => {
        appels.push(init ?? {});
        return new Promise<Response>((_ok, ko) => {
            const signal = init?.signal;
            if (!signal) return; // sans signal : attente infinie, c'est le bug
            if (signal.aborted) { ko(signal.reason); return; }
            signal.addEventListener('abort', () => ko(signal.reason));
        });
    }) as typeof fetch;
    return { f, appels };
}

/** Corps relayé par un flux réel (comme un navigateur), annulé par le signal de la requête. */
function reponseEnFlux(signal: AbortSignal, demarrer: (c: ReadableStreamDefaultController<Uint8Array>) => () => void) {
    const corps = new ReadableStream<Uint8Array>({
        start(c) {
            const arreter = demarrer(c);
            signal.addEventListener('abort', () => { arreter(); try { c.error(signal.reason); } catch { /* déjà fermé */ } });
        },
    });
    return new Response(corps, { status: 200, headers: { 'Content-Type': 'application/json' } });
}

/** fetch dont les en-têtes arrivent tout de suite mais dont le corps ne vient jamais. */
function fetchCorpsMuet() {
    return ((_input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(reponseEnFlux(init!.signal!, () => () => {}))) as typeof fetch;
}

/**
 * fetch dont le corps arrive à débit constant : `taille` octets par morceaux de `parSeconde`,
 * un morceau par seconde, puis s'arrête (`arretApres` morceaux) si demandé. JSON valide.
 */
function fetchCorpsADebit(taille: number, parSeconde: number, arretApres = Infinity) {
    const etat = { recus: 0 };
    const f = ((_input: RequestInfo | URL, init?: RequestInit) =>
        Promise.resolve(reponseEnFlux(init!.signal!, (c) => {
            let morceaux = 0;
            const tic = setInterval(() => {
                if (morceaux >= arretApres) return; // connexion morte : plus rien n'arrive
                morceaux++;
                const n = Math.min(parSeconde, taille - etat.recus);
                const debut = etat.recus === 0;
                etat.recus += n;
                const fin = etat.recus >= taille;
                // « [" … "] » : un tableau JSON d'une chaîne de la bonne taille.
                const texte = (debut ? '["' : '') + 'x'.repeat(Math.max(0, n - (debut ? 2 : 0) - (fin ? 2 : 0))) + (fin ? '"]' : '');
                c.enqueue(new TextEncoder().encode(texte));
                if (fin) { clearInterval(tic); c.close(); }
            }, 1000);
            return () => clearInterval(tic);
        }))) as typeof fetch;
    return { f, etat };
}

afterEach(() => {
    vi.useRealTimers();
});

describe('avecDelaiMaximal', () => {
    it('fait ÉCHOUER une requête sans réponse au lieu de la laisser en suspens', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        const p = avecDelaiMaximal(f)(URL_REST);
        const attendu = expect(p).rejects.toMatchObject({ name: NOM_ERREUR_DELAI });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        await attendu;
    });

    it('n’échoue pas avant le délai', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        let fini = false;
        avecDelaiMaximal(f)(URL_REST).catch(() => { fini = true; });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS - 1);
        expect(fini).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(fini).toBe(true);
    });

    it('rend la réponse arrivée à temps, sans l’annuler', async () => {
        vi.useFakeTimers();
        let signalVu: AbortSignal | undefined;
        const f = ((_i: RequestInfo | URL, init?: RequestInit) => {
            signalVu = init?.signal ?? undefined;
            return Promise.resolve(new Response('[]', { status: 200 }));
        }) as typeof fetch;
        const r = await avecDelaiMaximal(f)(URL_REST);
        expect(await r.text()).toBe('[]');
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        expect(signalVu?.aborted).toBe(false);
    });

    it('borne aussi la lecture du CORPS, par son propre délai d’INACTIVITÉ', async () => {
        vi.useFakeTimers();
        const reponse = await avecDelaiMaximal(fetchCorpsMuet())(URL_REST);
        const lecture = reponse.text();
        const attendu = expect(lecture).rejects.toMatchObject({ name: NOM_ERREUR_DELAI });
        // Le délai de réponse ne s'applique plus au corps : rien à 15 s…
        let fini = false;
        lecture.catch(() => { fini = true; });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        expect(fini).toBe(false);
        // … échec après DELAI_INACTIVITE_CORPS_MS sans un octet.
        await vi.advanceTimersByTimeAsync(DELAI_INACTIVITE_CORPS_MS - DELAI_REPONSE_MS);
        await attendu;
    });

    it('connexion LENTE MAIS VIVANTE : 600 Ko à 120 kbit/s (40 s) arrivent en entier (non-régression)', async () => {
        // Rapport « react » du 05/10/2026 : page de 1 000 articles du CGI, 597 933 o en gzip. Avec
        // une borne TOTALE de 30 s, elle était coupée à 480 Ko et ne se chargeait jamais.
        vi.useFakeTimers();
        const TAILLE = 597_933, PAR_SECONDE = 15_000; // 15 Ko/s = 120 kbit/s
        const { f, etat } = fetchCorpsADebit(TAILLE, PAR_SECONDE);
        const reponse = await avecDelaiMaximal(f)(URL_REST);
        const lecture = reponse.json();
        await vi.advanceTimersByTimeAsync(Math.ceil(TAILLE / PAR_SECONDE) * 1000 + 1000);
        const json = await lecture;
        expect(etat.recus).toBe(TAILLE);
        expect(json[0].length).toBe(TAILLE - 4);
    });

    it('connexion qui MEURT en cours de corps : échec DELAI_INACTIVITE_CORPS_MS après le dernier octet', async () => {
        vi.useFakeTimers();
        const { f, etat } = fetchCorpsADebit(600_000, 15_000, 10); // 10 morceaux, puis plus rien
        const reponse = await avecDelaiMaximal(f)(URL_REST);
        let erreur: unknown = null;
        const lecture = reponse.text().catch((e) => { erreur = e; });
        await vi.advanceTimersByTimeAsync(10_000 + DELAI_INACTIVITE_CORPS_MS - 1);
        expect(etat.recus).toBe(150_000);
        expect(erreur).toBeNull();
        await vi.advanceTimersByTimeAsync(1);
        await lecture;
        expect(erreur).toMatchObject({ name: NOM_ERREUR_DELAI });
        expect(estDelaiDepasse({ message: String((erreur as Error).message) })).toBe(true);
    });

    it('une réponse lue jusqu’au bout n’est jamais annulée après coup', async () => {
        vi.useFakeTimers();
        let signalVu: AbortSignal | undefined;
        const f = ((_i: RequestInfo | URL, init?: RequestInit) => {
            signalVu = init!.signal!;
            return Promise.resolve(reponseEnFlux(init!.signal!, (c) => { c.enqueue(new TextEncoder().encode('[1,2]')); c.close(); return () => {}; }));
        }) as typeof fetch;
        const r = await avecDelaiMaximal(f)(URL_REST);
        expect(await r.json()).toEqual([1, 2]);
        await vi.advanceTimersByTimeAsync(DELAI_INACTIVITE_CORPS_MS * 2);
        expect(signalVu?.aborted).toBe(false);
    });

    it('garde statut et en-têtes de la réponse d’origine', async () => {
        const f = (() => Promise.resolve(new Response('{"message":"x"}', { status: 406, statusText: 'Not Acceptable', headers: { 'Content-Range': '0-0/*' } }))) as typeof fetch;
        const r = await avecDelaiMaximal(f)(URL_REST);
        expect(r.status).toBe(406);
        expect(r.ok).toBe(false);
        expect(r.statusText).toBe('Not Acceptable');
        expect(r.headers.get('content-range')).toBe('0-0/*');
        expect(await r.json()).toEqual({ message: 'x' });
    });

    it('réponse sans corps (204) : rendue telle quelle', async () => {
        const f = (() => Promise.resolve(new Response(null, { status: 204 }))) as typeof fetch;
        const r = await avecDelaiMaximal(f)(URL_REST);
        expect(r.status).toBe(204);
        expect(await r.text()).toBe('');
    });

    it('respecte le signal fourni par l’appelant (annulation relayée, motif intact)', async () => {
        const { f } = fetchMuet();
        const controleur = new AbortController();
        const p = avecDelaiMaximal(f)(URL_REST, { signal: controleur.signal });
        const motif = new Error('annulée par l’appelant');
        controleur.abort(motif);
        await expect(p).rejects.toBe(motif);
    });

    it('échoue tout de suite si le signal de l’appelant est déjà annulé', async () => {
        const { f } = fetchMuet();
        const controleur = new AbortController();
        const motif = new Error('déjà annulée');
        controleur.abort(motif);
        await expect(avecDelaiMaximal(f)(URL_REST, { signal: controleur.signal })).rejects.toBe(motif);
    });

    it('conserve les autres options de la requête', async () => {
        const { f, appels } = fetchMuet();
        avecDelaiMaximal(f)(URL_REST, { method: 'POST', body: '{}', headers: { apikey: 'x' } }).catch(() => {});
        expect(appels[0]).toMatchObject({ method: 'POST', body: '{}', headers: { apikey: 'x' } });
        expect(appels[0].signal).toBeInstanceOf(AbortSignal);
    });

    it('laisse passer sans délai les envois de fichiers (stockage)', async () => {
        const { f, appels } = fetchMuet();
        const init = { method: 'POST' };
        avecDelaiMaximal(f)('https://exemple.supabase.co/storage/v1/object/pieces/a.pdf', init);
        expect(appels[0]).toBe(init);
        expect(estExempteDeDelai('https://exemple.supabase.co/rest/v1/articles')).toBe(false);
    });

    it('bornes par adresse : stockage seul exempté ; rafraîchissement 60 s ; non idempotents 120 s ; le reste 15 s', () => {
        // Relecture finale (05/10/2026) : /auth/v1/token n'est plus exempté sans borne, et seul
        // grant_type=refresh_token a sa borne propre (password et pkce : borne normale).
        const base = 'https://exemple.supabase.co';
        const reponse = (u: string) => delaisPour(u)?.reponseMs ?? null;
        expect(DELAI_RAFRAICHISSEMENT_MS).toBe(60_000);
        expect(DELAI_NON_IDEMPOTENT_MS).toBe(120_000);
        expect(reponse(`${base}/storage/v1/object/pieces/a.pdf`)).toBeNull();
        expect(reponse(`${base}/auth/v1/token?grant_type=refresh_token`)).toBe(60_000);
        expect(reponse(`${base}/auth/v1/token?grant_type=password`)).toBe(DELAI_REPONSE_MS);
        expect(reponse(`${base}/auth/v1/token?grant_type=pkce`)).toBe(DELAI_REPONSE_MS);
        expect(reponse(`${base}/auth/v1/token?grant_type=refresh_token_x`)).toBe(DELAI_REPONSE_MS);
        for (const f of ['delete-account', 'admin-delete-user', 'send-contact-email']) {
            expect(reponse(`${base}/functions/v1/${f}`), f).toBe(120_000);
        }
        for (const a of ['signup', 'verify', 'otp', 'recover', 'resend']) {
            expect(reponse(`${base}/auth/v1/${a}`), a).toBe(120_000);
            expect(reponse(`${base}/auth/v1/${a}?redirect_to=https%3A%2F%2Fx`), a).toBe(120_000);
        }
        expect(reponse(`${base}/functions/v1/search`)).toBe(DELAI_REPONSE_MS);
        expect(reponse(`${base}/functions/v1/delete-account-preview`)).toBe(DELAI_REPONSE_MS);
        expect(reponse(`${base}/auth/v1/user`)).toBe(DELAI_REPONSE_MS);
        expect(reponse(`${base}/auth/v1/signups`)).toBe(DELAI_REPONSE_MS);
        expect(reponse(`${base}/rest/v1/rpc/search_articles`)).toBe(DELAI_REPONSE_MS);
        // Le corps garde partout la borne d'inactivité.
        expect(delaisPour(`${base}/functions/v1/delete-account`)?.inactiviteCorpsMs).toBe(DELAI_INACTIVITE_CORPS_MS);
        for (const u of ['/auth/v1/token?grant_type=refresh_token', '/auth/v1/token?grant_type=password', '/functions/v1/delete-account', '/auth/v1/signup']) {
            expect(estExempteDeDelai(base + u), u).toBe(false);
        }
    });

    it('requête non idempotente (inscription) : pas coupée à 15 s, coupée à 120 s, jamais en suspens', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        let erreur: unknown = 'en suspens';
        avecDelaiMaximal(f)('https://exemple.supabase.co/auth/v1/signup', { method: 'POST' }).catch((e) => { erreur = e; });
        await vi.advanceTimersByTimeAsync(DELAI_NON_IDEMPOTENT_MS - 1);
        expect(erreur).toBe('en suspens');
        await vi.advanceTimersByTimeAsync(1);
        expect(erreur).toMatchObject({ name: NOM_ERREUR_DELAI });
    });
});

describe('estDelaiDepasse', () => {
    it('reconnaît l’erreur PostgREST d’un délai dépassé', () => {
        expect(estDelaiDepasse({ message: 'TimeoutError: Aucune réponse du serveur après 15 s', code: '' })).toBe(true);
    });
    it('reconnaît l’AbortError générique de navigateurs plus anciens', () => {
        expect(estDelaiDepasse({ message: 'AbortError: The user aborted a request.' })).toBe(true);
    });
    it('reconnaît l’erreur des fonctions edge (motif dans context)', () => {
        const motif = new DOMException('Aucune réponse', 'TimeoutError');
        expect(estDelaiDepasse({ name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function', context: motif })).toBe(true);
    });
    it('reconnaît l’erreur d’authentification d’un délai dépassé (AuthRetryableFetchError, message seul)', () => {
        expect(estDelaiDepasse({ name: 'AuthRetryableFetchError', status: 0, message: `Aucune réponse du serveur après 15 s (${MENTION_DELAI})` })).toBe(true);
    });
    it('ne confond pas une autre erreur avec un délai', () => {
        expect(estDelaiDepasse({ message: 'JWT expired', code: 'PGRST301' })).toBe(false);
        expect(estDelaiDepasse({ message: "Error: Verrou d'authentification « lock:x » indisponible après 5000 ms." })).toBe(false);
        expect(estDelaiDepasse(null)).toBe(false);
        expect(estDelaiDepasse(undefined)).toBe(false);
        expect(estDelaiDepasse({ name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' })).toBe(false);
    });
});

describe('client Supabase muni du délai (chaîne réelle supabase-js)', () => {
    const client = (f: typeof fetch) => createClient('https://exemple.supabase.co', 'cle-anon', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: avecDelaiMaximal(f) },
    });

    it('une lecture sans réponse rend { error } (délai), jamais une promesse en suspens', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        // .then() lance la requête (un constructeur PostgREST est paresseux).
        const p = client(f).from('laws_and_codes').select('*').eq('slug', 'cocc').maybeSingle().then((r) => r);
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        const { data, error } = await p;
        expect(data).toBeNull();
        expect(estDelaiDepasse(error)).toBe(true);
    });

    it('une RPC sans réponse rend { error } (délai)', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        const p = client(f).rpc('get_theme_page', { p_slug: 'droit-ohada' }).then((r) => r);
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        const { error } = await p;
        expect(estDelaiDepasse(error)).toBe(true);
    });

    it('une fonction edge sans réponse rend { error } (délai)', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        const p = client(f).functions.invoke('search', { body: { query: 'bail' } });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        const { data, error } = await p;
        expect(data).toBeNull();
        expect(estDelaiDepasse(error)).toBe(true);
    });

    it('un corps qui n’arrive jamais rend { error } (délai) au bout du délai d’inactivité', async () => {
        vi.useFakeTimers();
        const p = client(fetchCorpsMuet()).from('articles').select('id').range(0, 999).then((r) => r);
        await vi.advanceTimersByTimeAsync(DELAI_INACTIVITE_CORPS_MS);
        const { error } = await p;
        expect(estDelaiDepasse(error)).toBe(true);
    });

    it('une lecture de 600 Ko à 120 kbit/s aboutit (connexion lente mais vivante)', async () => {
        vi.useFakeTimers();
        const { f } = fetchCorpsADebit(597_933, 15_000);
        const p = client(f).from('articles').select('id').range(0, 999).then((r) => r);
        await vi.advanceTimersByTimeAsync(45_000);
        const { data, error } = await p;
        expect(error).toBeNull();
        expect((data as unknown as string[])[0].length).toBe(597_933 - 4);
    });

    it('authentification hors délai (getUser) : erreur reconnue par estDelaiDepasse', async () => {
        vi.useFakeTimers();
        const { f } = fetchMuet();
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        const p = client(f).auth.getUser('jeton.factice.de-test');
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        const { error } = await p;
        espion.mockRestore();
        expect(error?.name).toBe('AuthRetryableFetchError');
        expect(estDelaiDepasse(error)).toBe(true);
    });

    it('rafraîchissement de session lent (16 s) : pas coupé à 15 s, donc jamais renvoyé avec le même refresh_token', async () => {
        // Rapport « react » (D2b) : coupé à 15 s, il était relancé avec le MÊME jeton, que le
        // serveur avait pu consommer (« already used », puis session effacée).
        vi.useFakeTimers();
        const corps: string[] = [];
        const lent = ((_i: RequestInfo | URL, init?: RequestInit) => {
            corps.push(String(init?.body));
            return new Promise<Response>((ok) => {
                setTimeout(() => ok(new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'factice' }), { status: 400 })), 16_000);
            });
        }) as typeof fetch;
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        const p = client(lent).auth.refreshSession({ refresh_token: 'jeton-A' });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS + 5_000);
        await p;
        espion.mockRestore();
        expect(corps).toHaveLength(1);
    });

    it('rafraîchissement sans réponse : échec réessayable à 60 s, sans relance du même jeton (au-delà des 30 s de supabase-js)', async () => {
        vi.useFakeTimers();
        const { f, appels } = fetchMuet();
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        let issue: { error: unknown } | 'en suspens' = 'en suspens';
        client(f).auth.refreshSession({ refresh_token: 'jeton-A' }).then((r) => { issue = r; });
        await vi.advanceTimersByTimeAsync(DELAI_RAFRAICHISSEMENT_MS - 1);
        expect(issue).toBe('en suspens');
        await vi.advanceTimersByTimeAsync(1 + 60_000);
        espion.mockRestore();
        expect(issue).not.toBe('en suspens');
        const erreur = (issue as unknown as { error: { name?: string } }).error;
        // Réessayable : supabase-js GARDE la session (aucune déconnexion pour une lenteur).
        expect(erreur?.name).toBe('AuthRetryableFetchError');
        expect(estDelaiDepasse(erreur)).toBe(true);
        expect(appels).toHaveLength(1);
    });

    it('connexion par mot de passe sur connexion morte : échec borné (15 s), plus de bouton qui tourne sans fin', async () => {
        // Relecture finale : le motif « /auth/v1/token » exemptait aussi grant_type=password.
        vi.useFakeTimers();
        const { f } = fetchMuet();
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        let issue: unknown = 'en suspens';
        client(f).auth.signInWithPassword({ email: 'essai@exemple.invalid', password: 'factice-de-test' }).then((r) => { issue = r; });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS + 1_000);
        espion.mockRestore();
        expect(issue).not.toBe('en suspens');
        expect(estDelaiDepasse((issue as { error: unknown }).error)).toBe(true);
    });
});

/*
 * Relecture finale (05/10/2026) : membre au jeton d'accès EXPIRÉ (site rouvert plus d'une heure après) et
 * rafraîchissement qui ne reçoit jamais de réponse. Avec /auth/v1/token exempté de toute borne, aucune
 * lecture ne partait jamais : getSession() attend l'initialisation de supabase-js, qui attend ce
 * rafraîchissement. Session SIMULÉE, aucun compte réel ; client supabase-js réel, enveloppe de l'application.
 */
describe('jeton expiré + point d’authentification muet (client réel)', () => {
    const CLE = 'sb-exemple-auth-token';
    function stockageAvecSessionExpiree() {
        const maintenant = Math.floor(Date.now() / 1000);
        const session = {
            access_token: 'jeton.factice.expire', refresh_token: 'rafraichissement-factice', token_type: 'bearer',
            expires_in: 3600, expires_at: maintenant - 600,
            user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'membre@exemple.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
        };
        const m = new Map<string, string>([[CLE, JSON.stringify(session)]]);
        return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); }, m };
    }
    /** /auth/v1/token ne répond jamais (sauf annulation par signal) ; le reste répond tout de suite. */
    function fetchJetonMuet() {
        const appels: { url: string; corps: string }[] = [];
        const f = ((input: RequestInfo | URL, init?: RequestInit) => {
            const url = String(input instanceof Request ? input.url : input);
            appels.push({ url, corps: String(init?.body ?? '') });
            if (url.includes('/auth/v1/token')) {
                return new Promise<Response>((_ok, ko) => {
                    const s = init?.signal;
                    if (s) s.addEventListener('abort', () => ko(s.reason));
                });
            }
            return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }) as typeof fetch;
        return { f, appels };
    }

    it('la lecture PostgREST finit par partir (clé publique), la session est gardée', async () => {
        vi.useFakeTimers();
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        const stockage = stockageAvecSessionExpiree();
        const { f, appels } = fetchJetonMuet();
        const c = createClient('https://exemple.supabase.co', 'cle-anon', {
            auth: { storage: stockage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: lockAuthBorne },
            global: { fetch: avecDelaiMaximal(f) },
        });
        let issue: unknown = 'en suspens';
        c.from('laws_and_codes').select('id').eq('slug', 'cocc').maybeSingle().then((r) => { issue = r; });
        // Initialisation (un rafraîchissement borné à 60 s) puis lecture de la session (un second) : 120 s au plus.
        await vi.advanceTimersByTimeAsync(2 * DELAI_RAFRAICHISSEMENT_MS + 1_000);
        espion.mockRestore();
        expect(issue).not.toBe('en suspens');
        expect(appels.filter((a) => a.url.includes('/rest/v1/'))).toHaveLength(1);
        // Échec réessayable : aucune déconnexion pour une lenteur.
        expect(stockage.m.has(CLE)).toBe(true);
        c.auth.stopAutoRefresh();
    });
});
