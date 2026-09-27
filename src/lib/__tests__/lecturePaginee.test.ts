import { describe, it, expect } from 'vitest';
import { lireToutesLesPages } from '../lecturePaginee';

// Table simulée derrière un plafond PostgREST : chaque appel rend au plus `taille` lignes.
function tableSimulee(n: number) {
    const lignes = Array.from({ length: n }, (_, i) => ({ id: i }));
    const appels: [number, number][] = [];
    const lirePage = async (de: number, a: number) => {
        appels.push([de, a]);
        return { data: lignes.slice(de, a + 1), error: null };
    };
    return { lirePage, appels };
}

describe('lireToutesLesPages', () => {
    it('lit au-delà de 1 000 lignes (AUSCGIE : 1 104 articles)', async () => {
        const { lirePage, appels } = tableSimulee(1104);
        const lignes = await lireToutesLesPages(lirePage);
        expect(lignes).toHaveLength(1104);
        expect(lignes[1103]).toEqual({ id: 1103 });
        expect(appels).toEqual([[0, 999], [1000, 1999]]);
    });

    it('s’arrête sur une page vide quand le total tombe juste sur la taille de page', async () => {
        const { lirePage, appels } = tableSimulee(2000);
        expect(await lireToutesLesPages(lirePage)).toHaveLength(2000);
        expect(appels).toHaveLength(3);
    });

    it('une seule requête pour un petit texte', async () => {
        const { lirePage, appels } = tableSimulee(59);
        expect(await lireToutesLesPages(lirePage)).toHaveLength(59);
        expect(appels).toHaveLength(1);
    });

    it('respecte une taille de page imposée', async () => {
        const { lirePage, appels } = tableSimulee(25);
        expect(await lireToutesLesPages(lirePage, 10)).toHaveLength(25);
        expect(appels).toEqual([[0, 9], [10, 19], [20, 29]]);
    });

    it('lève l’erreur d’une page plutôt que de rendre une liste tronquée', async () => {
        let n = 0;
        const lirePage = async () => (n++ === 0
            ? { data: Array.from({ length: 1000 }, (_, i) => ({ id: i })), error: null }
            : { data: null, error: new Error('supabase 500') });
        await expect(lireToutesLesPages(lirePage)).rejects.toThrow('supabase 500');
    });
});
