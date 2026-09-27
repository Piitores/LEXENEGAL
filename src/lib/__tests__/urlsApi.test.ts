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

describe('texteDeLaRequete (api/render.js)', () => {
    it('lit ccn= (/ccn/…) ou slug= / code= (/code/…), jamais les deux', async () => {
        const { texteDeLaRequete, urlTexte } = await charger('render.js');
        expect(texteDeLaRequete('banques', undefined)).toEqual({ slug: 'ccn-banques', recue: '/ccn/banques' });
        expect(texteDeLaRequete('ccni-2019', undefined)).toEqual({ slug: 'ccni-2019', recue: '/ccn/ccni-2019' });
        expect(texteDeLaRequete(undefined, 'code-penal')).toEqual({ slug: 'code-penal', recue: '/code/code-penal' });
        // Paramètre vide ignoré (/code/code-penal?ccn=) : c'est bien le Code pénal.
        expect(texteDeLaRequete('', 'code-penal')).toEqual({ slug: 'code-penal', recue: '/code/code-penal' });
        // Ancienne forme : la page ne répond pas en 200, le handler redirige (recue ≠ adresse publique).
        const ancienne = texteDeLaRequete('ccn-banques', undefined);
        expect(ancienne.recue).not.toBe(urlTexte(ancienne.slug));
    });

    it('requête ambiguë ou incomplète : null (le handler sert la coquille)', async () => {
        const { texteDeLaRequete } = await charger('render.js');
        // /code/code-penal?ccn=banques comme /ccn/banques?slug=code-penal (ou ?code= pour un
        // article) : ni la convention sous l'adresse du Code pénal, ni l'inverse.
        expect(texteDeLaRequete('banques', 'code-penal')).toBeNull();
        expect(texteDeLaRequete(undefined, undefined)).toBeNull();
        expect(texteDeLaRequete(undefined, '')).toBeNull();
        // Paramètre répété (tableau) : pas de devinette.
        expect(texteDeLaRequete(['banques', 'transports'], undefined)).toBeNull();
        expect(texteDeLaRequete(undefined, ['code-penal', 'cocc'])).toBeNull();
    });
});
