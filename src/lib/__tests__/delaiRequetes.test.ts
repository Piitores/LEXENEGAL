import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
    avecDelaiMaximal, estDelaiDepasse, estExempteDeDelai,
    DELAI_REPONSE_MS, DELAI_CORPS_MS, NOM_ERREUR_DELAI,
} from '../delaiRequetes';

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

/** fetch dont les en-têtes arrivent tout de suite mais dont le corps ne vient jamais. */
function fetchCorpsMuet() {
    return ((_input: RequestInfo | URL, init?: RequestInit) => {
        const signal = init!.signal!;
        const reponse = {
            ok: true,
            status: 200,
            text: () => new Promise<string>((_ok, ko) => {
                if (signal.aborted) { ko(signal.reason); return; }
                signal.addEventListener('abort', () => ko(signal.reason));
            }),
        } as unknown as Response;
        return Promise.resolve(reponse);
    }) as typeof fetch;
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

    it('borne aussi la lecture du CORPS, avec son propre délai', async () => {
        vi.useFakeTimers();
        const reponse = await avecDelaiMaximal(fetchCorpsMuet())(URL_REST);
        const lecture = reponse.text();
        const attendu = expect(lecture).rejects.toMatchObject({ name: NOM_ERREUR_DELAI });
        // Le délai de réponse ne s'applique plus au corps : rien à 15 s…
        let fini = false;
        lecture.catch(() => { fini = true; });
        await vi.advanceTimersByTimeAsync(DELAI_REPONSE_MS);
        expect(fini).toBe(false);
        // … échec à 30 s.
        await vi.advanceTimersByTimeAsync(DELAI_CORPS_MS - DELAI_REPONSE_MS);
        await attendu;
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
    it('ne confond pas une autre erreur avec un délai', () => {
        expect(estDelaiDepasse({ message: 'JWT expired', code: 'PGRST301' })).toBe(false);
        expect(estDelaiDepasse({ message: "Error: Verrou d'authentification « lock:x » indisponible après 5000 ms." })).toBe(false);
        expect(estDelaiDepasse(null)).toBe(false);
        expect(estDelaiDepasse(undefined)).toBe(false);
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

    it('un corps qui n’arrive jamais rend { error } (délai) au bout du délai du corps', async () => {
        vi.useFakeTimers();
        const p = client(fetchCorpsMuet()).from('articles').select('id').range(0, 999).then((r) => r);
        await vi.advanceTimersByTimeAsync(DELAI_CORPS_MS);
        const { error } = await p;
        expect(estDelaiDepasse(error)).toBe(true);
    });
});
