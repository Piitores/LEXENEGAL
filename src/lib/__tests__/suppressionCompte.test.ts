import { describe, it, expect, vi } from 'vitest';
import { supprimerCompteVerifie, compteEncorePresent } from '../suppressionCompte';

/*
 * Suppression de compte : une erreur côté client (délai, coupure) ne prouve pas l'échec côté
 * serveur. On vérifie l'état du compte (getUser) avant d'afficher « Échec » (rapport « react »).
 */
const DELAI = { name: 'FunctionsFetchError', message: 'Failed to send a request to the Edge Function', context: new DOMException('Aucune réponse du serveur après 15 s (délai maximal dépassé)', 'TimeoutError') };
const present = { data: { user: { id: 'u-1' } }, error: null };
const disparu = { data: { user: null }, error: { name: 'AuthApiError', status: 403, code: 'user_not_found', message: 'User from sub claim in JWT does not exist' } };
const sessionEffacee = { data: { user: null }, error: { name: 'AuthSessionMissingError', status: 400, message: 'Auth session missing!' } };
const reseau = { data: { user: null }, error: { name: 'AuthRetryableFetchError', status: 0, message: 'Failed to fetch' } };

describe('supprimerCompteVerifie', () => {
    it('réponse sans erreur : supprimé, sans vérification', async () => {
        const lire = vi.fn();
        expect(await supprimerCompteVerifie(async () => ({ error: null }), lire)).toBe('supprime');
        expect(lire).not.toHaveBeenCalled();
    });

    it('délai dépassé MAIS compte supprimé côté serveur : « supprime », jamais « Échec »', async () => {
        expect(await supprimerCompteVerifie(async () => ({ error: DELAI }), async () => disparu)).toBe('supprime');
        expect(await supprimerCompteVerifie(async () => ({ error: DELAI }), async () => sessionEffacee)).toBe('supprime');
    });

    it('second essai qui reçoit 401 alors que le compte n’existe plus : « supprime » (session locale à vider)', async () => {
        const http401 = { name: 'FunctionsHttpError', message: 'Edge Function returned a non-2xx status code', context: { status: 401 } };
        expect(await supprimerCompteVerifie(async () => ({ error: http401 }), async () => disparu)).toBe('supprime');
    });

    it('le compte existe toujours : « echec »', async () => {
        expect(await supprimerCompteVerifie(async () => ({ error: DELAI }), async () => present)).toBe('echec');
    });

    it('vérification impossible (réseau) : « incertain », pas d’échec affirmé', async () => {
        expect(await supprimerCompteVerifie(async () => ({ error: DELAI }), async () => reseau)).toBe('incertain');
        expect(await supprimerCompteVerifie(async () => { throw new Error('coupure'); }, async () => { throw new Error('coupure'); })).toBe('incertain');
    });
});

describe('compteEncorePresent', () => {
    it('lit les réponses de getUser', () => {
        expect(compteEncorePresent(present)).toBe(true);
        expect(compteEncorePresent(disparu)).toBe(false);
        expect(compteEncorePresent({ data: { user: null }, error: { name: 'AuthApiError', status: 403, message: 'User from sub claim in JWT does not exist' } })).toBe(false);
        expect(compteEncorePresent(reseau)).toBeNull();
        expect(compteEncorePresent({ data: { user: null }, error: { name: 'AuthApiError', status: 500, message: 'Database error' } })).toBeNull();
    });
});
