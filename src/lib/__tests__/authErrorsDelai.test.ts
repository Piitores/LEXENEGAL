import { describe, it, expect, vi, afterEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { traduireErreurAuthPour, traduireErreurAuth } from '../authErrors';
import { avecDelaiMaximal, DELAI_NON_IDEMPOTENT_MS } from '../delaiRequetes';

/*
 * Requêtes d'authentification non idempotentes (inscription, code, courriels) : borne de 120 s, et en cas de
 * délai dépassé un message qui n'affirme PAS l'échec (rapport « pannes » du 05/10/2026 : GoTrue envoie le
 * courriel avant de répondre à /signup, un nouvel essai recevait « User already registered »).
 */
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

/** fetch qui ne répond jamais, sauf annulation par son signal. */
const muet = ((_i: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_ok, ko) => {
    init?.signal?.addEventListener('abort', () => ko(init!.signal!.reason));
})) as typeof fetch;
const client = () => createClient('https://exemple.supabase.co', 'cle-anon', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: avecDelaiMaximal(muet) },
});

describe('issue incertaine des requêtes d’authentification non idempotentes', () => {
    it('inscription sans réponse : erreur à 120 s, message « vérifiez votre boîte mail ou essayez de vous connecter »', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        let issue: { error: unknown } | null = null;
        client().auth.signUp({ email: 'essai@exemple.invalid', password: 'factice-de-test-1' }).then((r) => { issue = r; });
        await vi.advanceTimersByTimeAsync(15_000);
        expect(issue).toBeNull(); // plus coupée à 15 s
        await vi.advanceTimersByTimeAsync(DELAI_NON_IDEMPOTENT_MS - 15_000);
        expect(issue).not.toBeNull();
        const message = traduireErreurAuthPour(issue!.error, 'inscription');
        expect(message).toMatch(/peut-être été créé/);
        expect(message).toMatch(/boîte mail/);
        expect(message).toMatch(/vous connecter/);
        expect(message).not.toMatch(/échec|erreur est survenue/i);
    });

    it('vérification du code, lien, réinitialisation, renvoi : jamais d’échec affirmé sur un délai', async () => {
        vi.useFakeTimers();
        vi.spyOn(console, 'error').mockImplementation(() => {});
        const c = client();
        const appels = {
            verification: c.auth.verifyOtp({ email: 'essai@exemple.invalid', token: '123456', type: 'signup' }),
            lien: c.auth.signInWithOtp({ email: 'essai@exemple.invalid' }),
            reinitialisation: c.auth.resetPasswordForEmail('essai@exemple.invalid'),
            renvoi: c.auth.resend({ type: 'signup', email: 'essai@exemple.invalid' }),
        } as const;
        await vi.advanceTimersByTimeAsync(DELAI_NON_IDEMPOTENT_MS);
        for (const [action, p] of Object.entries(appels)) {
            const { error } = await p;
            const message = traduireErreurAuthPour(error, action as keyof typeof appels);
            expect(message, action).toMatch(/^Le serveur a tardé à répondre : .* peut-être /);
            expect(message, action).not.toMatch(/échec/i);
        }
    });

    it('une autre erreur garde sa traduction habituelle', () => {
        const deja = { message: 'User already registered' };
        expect(traduireErreurAuthPour(deja, 'inscription')).toBe(traduireErreurAuth(deja));
        expect(traduireErreurAuthPour({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' }, 'lien')).toBe('Failed to fetch');
    });
});
