import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Index des renvois du corps des articles (LinkedLegalContent). La lecture doit suivre l'ordre
 * de lecture du code (display_order, puis id) et garder le premier article de chaque numéro :
 * triée sur le seul id (un uuid), la cible d'un numéro en double était tirée au sort.
 * Fusion des codes 2026 : la concordance du code est lue avec, triée sur sa clé primaire
 * (pagination sans trou ni doublon) ; vide, l'index est celui d'avant la fusion.
 */
const { ordres, etat } = vi.hoisted(() => ({
    ordres: {} as Record<string, string[]>,
    etat: { concordance: [] as any[], concordanceEnErreur: false },
}));

vi.mock('../supabase', () => {
    // Code pénal tel que la base le rend dans l'ordre display_order, id.
    const lignes = [
        { id: 'c7174038', article_number: '4', slug: 'annexe2-art-4' },
        { id: 'de8673c5', article_number: '5', slug: 'annexe2-art-5' },
        { id: '86e7f003', article_number: '4', slug: 'annexe-iii-art-4' },
        { id: '228bf05b', article_number: '5', slug: 'annexe-iii-art-5' },
    ];
    const requete = (table: string) => {
        const q: any = {
            select: () => q,
            eq: () => q,
            order: (colonne: string) => { (ordres[table] ||= []).push(colonne); return q; },
            maybeSingle: async () => ({ data: { id: 'cp', short_title: 'Code pénal', title: 'Code pénal' }, error: null }),
            range: async (de: number, a: number) => {
                if (table !== 'article_concordance') return { data: lignes.slice(de, a + 1), error: null };
                if (etat.concordanceEnErreur) return { data: null, error: { message: 'relation absente' } };
                return { data: etat.concordance.slice(de, a + 1), error: null };
            },
        };
        return q;
    };
    return { supabase: { from: requete } };
});

import { getCodeArticleIndex } from '../codeArticleIndex';
import { resoudreRenvoi } from '../articleRefResolver';

beforeEach(() => {
    for (const k of Object.keys(ordres)) delete ordres[k];
    etat.concordance = [];
    etat.concordanceEnErreur = false;
});

describe('getCodeArticleIndex', () => {
    it('lit dans l’ordre de lecture et garde le corps du code avant l’annexe III', async () => {
        const index = await getCodeArticleIndex('code-penal');
        expect(ordres.articles).toEqual(['display_order', 'id']);
        expect(ordres.article_concordance).toEqual(['ancien_norm', 'article_id']);
        expect(index.actuel.get('5')).toEqual({ id: 'de8673c5', slug: 'annexe2-art-5', article_number: '5', codeName: 'Code pénal' });
        expect(index.actuel.get('4')?.slug).toBe('annexe2-art-4');
        // Concordance vide : pas d'ancienne numérotation, comportement d'avant la fusion.
        expect(index.ancien.size).toBe(0);
        expect(resoudreRenvoi({ numero: '5', date: '2015-01-01' }, index)?.article.slug).toBe('annexe2-art-5');
    });

    it('concordance illisible sur un code non refondu : index inchangé', async () => {
        etat.concordanceEnErreur = true;
        const index = await getCodeArticleIndex('code-penal-bis');
        expect(index.actuel.get('5')?.slug).toBe('annexe2-art-5');
    });

    it('concordance illisible sur un code refondu : aucun lien plutôt qu’un lien faux', async () => {
        etat.concordanceEnErreur = true;
        const index = await getCodeArticleIndex('code-securite-sociale-senegal');
        expect(resoudreRenvoi({ numero: '5', date: '2015-01-01' }, index)).toBeNull();
    });

    it('concordance remplie : l’ancien numéro mène au successeur, avec ?ancien', async () => {
        etat.concordance = [{
            ancien_numero: '12', ancien_norm: '12', ancien_slug: 'article-12', role: 'principal', statut: 'repris',
            en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1973-07-31', article_id: 'de8673c5',
        }];
        const index = await getCodeArticleIndex('code-securite-sociale-2027-essai');
        expect(resoudreRenvoi({ numero: '12', date: '2015-01-01' }, index))
            .toEqual({ article: index.actuel.get('5'), query: { ancien: '12', date: '2015-01-01' } });
    });
});
