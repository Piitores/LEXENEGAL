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

    it('requête d’origine reportée sur une redirection, sans les paramètres des réécritures', async () => {
        const { requeteConservee } = await charger('render.js');
        expect(requeteConservee({ type: 'code', slug: 'code-travail-2026' })).toBe('');
        expect(requeteConservee({ type: 'code', slug: 'code-travail-2026', node: 'Titre I' })).toBe('?node=Titre+I');
        expect(requeteConservee({ type: 'article', code: 'code-travail-2026', slug: 'art-137', ancien: 'L56', date: '2015-03-04' }))
            .toBe('?ancien=L56&date=2015-03-04');
        expect(requeteConservee({ type: 'code', ccn: 'banques', x: ['1', '2'] })).toBe('?x=1&x=2');
        expect(requeteConservee(undefined)).toBe('');
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

/*
 * Textes retirés par la fusion des codes 2026 (décision du propriétaire du 02/10/2026). Le 301 vient du
 * relais de api/render.js (TEXTES_RETIRES), qui n'agit que si la ligne du texte a DISPARU de la base,
 * donc après la migration de données.
 * ⛔ Aucune règle statique de vercel.json ne doit capter ces adresses (relecture du 02/10/2026) : avant
 * la migration, code-travail-2026 est le texte EN VIGUEUR. Une règle inconditionnelle le renverrait vers
 * le code de 1997, dont le bandeau « Voir le texte en vigueur » pointe vers code-travail-2026 (boucle),
 * et ses articles vers des adresses vides (art-137 n'existe pas sous code-travail avant la migration).
 * Si le propriétaire veut aussi des règles statiques : lot distinct, déployé APRÈS la migration, avec
 * son propre test.
 */
describe('textes retirés (fusion des codes 2026)', () => {
    // Motif d'une source Vercel (« :x* » = plusieurs segments, « :x » = un segment).
    const motif = (source: string) => new RegExp(`^${source.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/:\w+\*/g, '.*').replace(/:\w+/g, '[^/]+')}$`);

    it('vercel.json ne redirige pas les textes retirés : leurs adresses vont au rendu serveur', async () => {
        const { TEXTES_RETIRES } = await charger('render.js');
        const fs = await import('fs');
        const config = JSON.parse(fs.readFileSync(decodeURIComponent(new URL('../../../vercel.json', import.meta.url).pathname), 'utf8'));
        const redirects: Array<{ source: string; destination: string; has?: unknown }> = config.redirects;
        const rewrites: Array<{ source: string; destination: string }> = config.rewrites;
        expect(Object.keys(TEXTES_RETIRES).sort()).toEqual(['code-securite-sociale-2026', 'code-travail-2026']);
        // Le motif reconnaît bien les formes de vercel.json (contrôle du contrôle).
        expect(motif('/code/ccn-:nom').test('/code/ccn-banques')).toBe(true);
        expect(motif('/code/:codeSlug/:articleSlug').test('/code/code-travail-2026/art-137')).toBe(true);
        for (const ancien of Object.keys(TEXTES_RETIRES)) {
            for (const adresse of [`/code/${ancien}`, `/code/${ancien}/art-1`, `/code/${ancien}/art-137`]) {
                // Seule la règle de l'apex, conditionnée à l'hôte lexenegal.sn (« has »), peut s'appliquer.
                expect(redirects.filter((r) => !r.has && motif(r.source).test(adresse)).map((r) => r.source)).toEqual([]);
                // Première réécriture qui capte l'adresse : le rendu serveur, seul à savoir si le texte existe encore.
                const rw = rewrites.find((r) => motif(r.source).test(adresse));
                expect(rw && rw.destination).toMatch(/^\/api\/render\?type=(code|article)&/);
            }
        }
    });

    it('les adresses de texte restent la règle commune (un texte retiré n’est pas une convention)', async () => {
        const { TEXTES_RETIRES, urlTexte } = await charger('render.js');
        for (const [ancien, nouveau] of Object.entries(TEXTES_RETIRES)) {
            expect(urlTexte(ancien)).toBe(urls.urlTexte(ancien));
            expect(urlTexte(nouveau)).toBe(`/code/${nouveau}`);
        }
    });
});
