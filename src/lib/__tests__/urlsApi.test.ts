import { describe, it, expect } from 'vitest';
import * as urls from '../urls';

/*
 * La règle des adresses (src/lib/urls.ts) est recopiée dans les fonctions Vercel (api/render.js,
 * api/sitemap.js), qui ne peuvent pas importer le module TypeScript. Ce test garantit que les
 * copies répondent exactement comme l'original : une divergence produirait des liens et des
 * canonicals contradictoires entre le rendu serveur, le sitemap et l'application.
 */
const SLUGS = [
    'ccn-banques', 'ccn-transports-aeriens-1965', 'ccni-2019', 'code-penal', 'code-travail-2026',
    'cocc', 'code-assurances-cima', 'ohada-societes-commerciales-gie', 'ccnx', '',
];
const SEGMENTS = ['banques', 'ccn-banques', 'ccni-2019', 'transports-aeriens-1965'];

// Import dynamique à chemin calculé : ces modules .js n'ont pas de déclarations de types.
// Chemin disque décodé : le dossier du projet contient des espaces (« Test code 28-11 »).
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

describe.each(['render.js', 'sitemap.js'])('copie de la règle des adresses dans api/%s', (fichier) => {
    it('répond comme src/lib/urls.ts', async () => {
        const api = await charger(fichier);
        for (const slug of SLUGS) {
            expect(api.estConvention(slug)).toBe(urls.estConvention(slug));
            expect(api.urlTexte(slug)).toBe(urls.urlTexte(slug));
            expect(api.urlArticle(slug, 'art-12')).toBe(urls.urlArticle(slug, 'art-12'));
            if (slug) expect(api.segmentConvention(slug)).toBe(urls.segmentConvention(slug));
        }
        for (const segment of SEGMENTS) {
            expect(api.slugDepuisSegmentCcn(segment)).toBe(urls.slugDepuisSegmentCcn(segment));
        }
        expect(api.estConvention(null)).toBe(false);
    });
});
