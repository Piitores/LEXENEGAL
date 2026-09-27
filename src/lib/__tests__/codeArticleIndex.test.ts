import { describe, it, expect, vi } from 'vitest';

/*
 * Index des renvois du corps des articles (LinkedLegalContent). La lecture doit suivre l'ordre
 * de lecture du code (display_order, puis id) et garder le premier article de chaque numéro :
 * triée sur le seul id (un uuid), la cible d'un numéro en double était tirée au sort.
 */
const { ordres } = vi.hoisted(() => ({ ordres: [] as string[] }));

vi.mock('../supabase', () => {
    // Code pénal tel que la base le rend dans l'ordre display_order, id.
    const lignes = [
        { article_number: '4', slug: 'annexe2-art-4' },
        { article_number: '5', slug: 'annexe2-art-5' },
        { article_number: '4', slug: 'annexe-iii-art-4' },
        { article_number: '5', slug: 'annexe-iii-art-5' },
    ];
    const requete = () => {
        const q: any = {
            select: () => q,
            eq: () => q,
            order: (colonne: string) => { ordres.push(colonne); return q; },
            maybeSingle: async () => ({ data: { id: 'cp', short_title: 'Code pénal', title: 'Code pénal' }, error: null }),
            range: async (de: number, a: number) => ({ data: lignes.slice(de, a + 1), error: null }),
        };
        return q;
    };
    return { supabase: { from: requete } };
});

import { getCodeArticleIndex } from '../codeArticleIndex';

describe('getCodeArticleIndex', () => {
    it('lit dans l’ordre de lecture et garde le corps du code avant l’annexe III', async () => {
        const index = await getCodeArticleIndex('code-penal');
        expect(ordres).toEqual(['display_order', 'id']);
        expect(index.get('5')).toEqual({ slug: 'annexe2-art-5', codeName: 'Code pénal' });
        expect(index.get('4')?.slug).toBe('annexe2-art-4');
    });
});
