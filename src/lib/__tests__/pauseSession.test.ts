import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { avecDelaiMaximal, estRafraichissement, DELAI_RAFRAICHISSEMENT_MS } from '../delaiRequetes';
import { lockAuthBorne } from '../authLock';
import { stockageAvecPause, suspendreSession, sessionSuspendue, reprendreSession, PAUSE_SESSION_MS } from '../pauseSession';

/*
 * Membre au jeton EXPIRÉ (site rouvert plus d'une heure après) et rafraîchissement sans réponse
 * (relecture finale du 05/10/2026). Borné à 60 s, il ne figeait plus tout ; mais chaque getSession()
 * suivant relançait un rafraîchissement de 60 s, l'un après l'autre sous le verrou d'authentification :
 * lectures d'une page rendues à 180, 240 et 300 s, celles d'une navigation interne à 420-540 s. La pause
 * (lib/pauseSession.ts) masque la session après le premier échec. Session SIMULÉE, aucun compte réel ;
 * client supabase-js réel ; verrous Web Locks simulés (file d'attente, comme le navigateur).
 */

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); reprendreSession(); });

/** navigator.locks simulé : verrou exclusif, file d'attente, demande en attente annulable par signal. */
function verrousFifo() {
    const files = new Map<string, Array<() => void>>();
    const tenus = new Set<string>();
    return {
        async request(nom: string, options: { signal?: AbortSignal }, fn: () => Promise<unknown>) {
            if (tenus.has(nom)) {
                await new Promise<void>((ok, ko) => {
                    const file = files.get(nom) ?? [];
                    files.set(nom, file);
                    file.push(ok);
                    options?.signal?.addEventListener('abort', () => {
                        const i = file.indexOf(ok);
                        if (i >= 0) { file.splice(i, 1); const e = new Error('aborted'); e.name = 'AbortError'; ko(e); }
                    });
                });
            }
            tenus.add(nom);
            try { return await fn(); } finally {
                tenus.delete(nom);
                files.get(nom)?.shift()?.();
            }
        },
    };
}

const CLE = 'sb-exemple-auth-token';
function stockageBrut() {
    const maintenant = Math.floor(Date.now() / 1000);
    const session = {
        access_token: 'jeton.factice.expire', refresh_token: 'rafraichissement-factice', token_type: 'bearer',
        expires_in: 3600, expires_at: maintenant - 600,
        user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'membre@exemple.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' },
    };
    const m = new Map<string, string>([[CLE, JSON.stringify(session)]]);
    return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
}

/** Réseau : /auth/v1/token muet tant que `jetonMuet.valeur` ; le reste répond tout de suite. */
function reseau(t0: number) {
    const journal: Array<{ t: number; url: string }> = [];
    const jetonMuet = { valeur: true };
    const f = ((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input instanceof Request ? input.url : input);
        journal.push({ t: (Date.now() - t0) / 1000, url });
        if (url.includes('/auth/v1/token') && jetonMuet.valeur) {
            return new Promise<Response>((_ok, ko) => { init?.signal?.addEventListener('abort', () => ko(init!.signal!.reason)); });
        }
        if (url.includes('/auth/v1/token')) {
            const s = Math.floor(Date.now() / 1000);
            return Promise.resolve(new Response(JSON.stringify({ access_token: 'neuf', refresh_token: 'neuf-r', token_type: 'bearer', expires_in: 3600, expires_at: s + 3600,
                user: { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'membre@exemple.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' } }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
        }
        return Promise.resolve(new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }));
    }) as typeof fetch;
    return { f, journal, jetonMuet };
}

describe('stockageAvecPause', () => {
    it('masque la SEULE clé de session pendant la pause ; écrire ou effacer la session y met fin', () => {
        const base = stockageBrut();
        base.m.set(`${CLE}-code-verifier`, 'v');
        const s = stockageAvecPause(base);
        expect(s.getItem(CLE)).not.toBeNull();
        suspendreSession();
        expect(sessionSuspendue()).toBe(true);
        expect(s.getItem(CLE)).toBeNull();
        expect(s.getItem(`${CLE}-code-verifier`)).toBe('v');
        expect(base.m.has(CLE)).toBe(true); // jamais effacée
        s.setItem(CLE, '{}');
        expect(sessionSuspendue()).toBe(false);
        suspendreSession();
        s.removeItem(CLE);
        expect(sessionSuspendue()).toBe(false);
    });

    it('la pause dure PAUSE_SESSION_MS', () => {
        suspendreSession(1_000);
        expect(sessionSuspendue(1_000 + PAUSE_SESSION_MS - 1)).toBe(true);
        expect(sessionSuspendue(1_000 + PAUSE_SESSION_MS)).toBe(false);
    });
});

describe('jeton expiré + rafraîchissement sans réponse (client réel, verrous simulés)', () => {
    async function scenario(avecPause: boolean) {
        vi.useFakeTimers();
        vi.stubGlobal('navigator', { locks: verrousFifo() });
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const t0 = Date.now();
        const base = stockageBrut();
        const { f, journal, jetonMuet } = reseau(t0);
        const c = createClient('https://exemple.supabase.co', 'cle-anon', {
            auth: { storage: avecPause ? stockageAvecPause(base) : base, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, lock: lockAuthBorne },
            global: { fetch: avecDelaiMaximal(f, undefined, avecPause ? (u) => { if (estRafraichissement(u)) suspendreSession(); } : undefined) },
        });
        const rendues: Record<string, number> = {};
        const lire = (nom: string) => { c.from('t').select('id').then(() => { rendues[nom] = (Date.now() - t0) / 1000; }); };
        return { c, base, journal, jetonMuet, rendues, lire, t0 };
    }

    it('les lectures de la page partent au premier échec (60 s), celles d’une navigation interne aussitôt', async () => {
        const { c, base, journal, rendues, lire } = await scenario(true);
        lire('A1'); lire('A2'); lire('A3');
        await vi.advanceTimersByTimeAsync(DELAI_RAFRAICHISSEMENT_MS + 1_000);
        expect(Object.keys(rendues).sort()).toEqual(['A1', 'A2', 'A3']);
        for (const n of ['A1', 'A2', 'A3']) expect(rendues[n]).toBeLessThanOrEqual(61);
        // Navigation interne à 70 s : rendue sans attendre aucun rafraîchissement.
        await vi.advanceTimersByTimeAsync(9_000);
        lire('B1'); lire('B2'); lire('B3');
        await vi.advanceTimersByTimeAsync(1_000);
        for (const n of ['B1', 'B2', 'B3']) expect(rendues[n], n).toBeLessThanOrEqual(71);
        // Un seul rafraîchissement envoyé pendant la pause ; la session n'est pas effacée.
        expect(journal.filter((r) => r.url.includes('/auth/v1/token') && r.t < 61 + PAUSE_SESSION_MS / 1000)).toHaveLength(1);
        expect(base.m.has(CLE)).toBe(true);
        c.auth.stopAutoRefresh();
    });

    it('contre-épreuve sans pause : lectures rendues l’une après l’autre, toutes les 60 s', async () => {
        const { c, rendues, lire } = await scenario(false);
        lire('A1'); lire('A2'); lire('A3');
        await vi.advanceTimersByTimeAsync(DELAI_RAFRAICHISSEMENT_MS + 1_000);
        expect(Object.keys(rendues)).toHaveLength(0);
        await vi.advanceTimersByTimeAsync(5 * DELAI_RAFRAICHISSEMENT_MS);
        expect(Math.max(...Object.values(rendues))).toBeGreaterThanOrEqual(240);
        c.auth.stopAutoRefresh();
    });

    it('le serveur répond de nouveau : après la pause, le membre retrouve sa session', async () => {
        const { c, base, jetonMuet, lire, rendues } = await scenario(true);
        lire('A1');
        await vi.advanceTimersByTimeAsync(DELAI_RAFRAICHISSEMENT_MS + 1_000);
        expect(rendues.A1).toBeLessThanOrEqual(61);
        jetonMuet.valeur = false;
        // Fin de la pause, puis la boucle de rafraîchissement (30 s) ou le getSession suivant retente.
        await vi.advanceTimersByTimeAsync(PAUSE_SESSION_MS + 1_000);
        const { data } = await c.auth.getSession();
        expect(data.session?.access_token).toBe('neuf');
        expect(JSON.parse(base.m.get(CLE) as string).access_token).toBe('neuf');
        expect(sessionSuspendue()).toBe(false);
        c.auth.stopAutoRefresh();
    });
});
