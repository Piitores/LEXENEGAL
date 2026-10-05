import { describe, it, expect, vi, afterEach } from 'vitest';
import { avecReprise, attendreAuPlus } from '../reprise';

describe('avecReprise', () => {
    it('ne relance pas une requête réussie', async () => {
        let appels = 0;
        const r = await avecReprise(async () => { appels++; return { data: 1, error: null }; }, 0);
        expect(r.data).toBe(1);
        expect(appels).toBe(1);
    });
    it('relance une fois après une erreur', async () => {
        let appels = 0;
        const r = await avecReprise(async () => { appels++; return appels === 1 ? { data: null, error: 'délai' } : { data: 2, error: null }; }, 0);
        expect(r.data).toBe(2);
        expect(appels).toBe(2);
    });
    it("rend l'erreur si la seconde tentative échoue aussi", async () => {
        let appels = 0;
        const r = await avecReprise(async () => { appels++; return { data: null, error: 'délai' }; }, 0);
        expect(r.error).toBe('délai');
        expect(appels).toBe(2);
    });
    it('ne relance PAS après un délai maximal dépassé (le lecteur a déjà attendu 15 s)', async () => {
        let appels = 0;
        const erreur = { message: 'TimeoutError: Aucune réponse du serveur après 15 s (délai maximal dépassé)', code: '' };
        const r = await avecReprise(async () => { appels++; return { data: null, error: erreur }; }, 0);
        expect(r.error).toBe(erreur);
        expect(appels).toBe(1);
    });
});

describe('attendreAuPlus', () => {
    afterEach(() => { vi.useRealTimers(); });

    it('rend la valeur si la promesse aboutit à temps', async () => {
        vi.useFakeTimers();
        const p = attendreAuPlus(new Promise<number>((ok) => setTimeout(() => ok(7), 300)), 2_500);
        await vi.advanceTimersByTimeAsync(300);
        expect(await p).toEqual({ fini: true, valeur: 7 });
    });

    it('rend la main à l’échéance sans attendre la promesse, qui continue', async () => {
        vi.useFakeTimers();
        let resoudre: (v: number) => void = () => {};
        const lente = new Promise<number>((ok) => { resoudre = ok; });
        const p = attendreAuPlus(lente, 2_500);
        await vi.advanceTimersByTimeAsync(2_500);
        expect(await p).toEqual({ fini: false });
        resoudre(9);
        expect(await lente).toBe(9);
    });
});
