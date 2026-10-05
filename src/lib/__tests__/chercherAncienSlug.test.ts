import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/*
 * Ancienne adresse d'article (fusion des codes 2026) : une lecture de la concordance en ÉCHEC
 * n'est pas une absence. Avant (rapport « react » du 05/10/2026), chercherAncienSlug rendait null
 * sur erreur et la page affichait « Article non trouvé » (Soft 404) au lieu de « Chargement
 * interrompu ».
 */
const { etat } = vi.hoisted(() => ({
    etat: { reponses: [] as Array<{ data: any; error: any }>, appels: 0 },
}));

vi.mock('../supabase', () => {
    const requete = () => {
        const q: any = {
            select: () => q, eq: () => q, in: () => q, order: () => q, maybeSingle: () => q,
            then: (ok: any, ko: any) => {
                const r = etat.reponses[Math.min(etat.appels, etat.reponses.length - 1)];
                etat.appels++;
                return Promise.resolve(r).then(ok, ko);
            },
        };
        return q;
    };
    return { supabase: { from: requete } };
});

import { chercherAncienSlug, resoudreAdresseArticle } from '../articlesDuCode';

const LIGNE = { ancien_norm: 'L56', role: 'principal', article: { id: 'a-137', slug: 'art-137', article_number: '137' } };
const ERREUR = { message: 'TimeoutError: Aucune réponse du serveur après 15 s (délai maximal dépassé)', code: '' };

beforeEach(() => { etat.reponses = []; etat.appels = 0; });
afterEach(() => { vi.useRealTimers(); });

describe('chercherAncienSlug', () => {
    it('ancienne adresse reprise : rend l’article qui en a repris le sujet', async () => {
        etat.reponses = [{ data: [LIGNE_IDENTITE(), LIGNE], error: null }];
        expect(await chercherAncienSlug('c-1', 'article-l56')).toEqual({ id: 'a-137', slug: 'art-137', article_number: '137', ancienNorm: 'L56' });
    });

    it('adresse absente de la concordance : null (absence, « Article non trouvé » légitime)', async () => {
        etat.reponses = [{ data: [], error: null }];
        expect(await chercherAncienSlug('c-1', 'article-l999')).toBeNull();
    });

    it('lecture en ÉCHEC : l’erreur est LEVÉE, jamais confondue avec une absence', async () => {
        etat.reponses = [{ data: null, error: ERREUR }];
        await expect(chercherAncienSlug('c-1', 'article-l56')).rejects.toBe(ERREUR);
        expect(etat.appels).toBe(1); // délai dépassé : pas de seconde attente (lib/reprise.ts)
    });

    it('erreur passagère : une reprise, puis le résultat', async () => {
        vi.useFakeTimers();
        etat.reponses = [{ data: null, error: { message: 'erreur 503', code: '' } }, { data: [LIGNE], error: null }];
        const p = chercherAncienSlug('c-1', 'article-l56');
        await vi.advanceTimersByTimeAsync(1_500);
        expect((await p)?.slug).toBe('art-137');
        expect(etat.appels).toBe(2);
    });

    it('aperçu au survol (resoudreAdresseArticle) : un échec reste « contenu non disponible », sans exception', async () => {
        // laws_and_codes trouvé, article absent, puis concordance en échec.
        etat.reponses = [{ data: { id: 'c-1' }, error: null }, { data: null, error: null }, { data: null, error: ERREUR }];
        await expect(resoudreAdresseArticle('code-travail', 'article-l56')).resolves.toBeNull();
    });
});

function LIGNE_IDENTITE() {
    return { ancien_norm: 'L56', role: 'identite', article: { id: 'a-ancien', slug: 'article-l56', article_number: 'L56' } };
}
