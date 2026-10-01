import { describe, it, expect } from 'vitest';
import { formatJoReference } from '../joReference';

// Mention de publication au Journal officiel (laws_and_codes.jo_numero / jo_date / jo_page).
// Données vérifiées sur pièce (chantier « Archive du Journal officiel », 01/10/2026).
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

describe('mention « Journal officiel n° … du … »', () => {
    it('numéro, date et page', () => {
        expect(formatJoReference({ jo_numero: '3767', jo_date: '1965-09-06', jo_page: 1009 }))
            .toBe('Journal officiel n° 3767 du 6 septembre 1965, p. 1009');
    });
    it('sans page', () => {
        expect(formatJoReference({ jo_numero: '7299 bis', jo_date: '2020-04-08', jo_page: null }))
            .toBe('Journal officiel n° 7299 bis du 8 avril 2020');
    });
    it('« 1er » pour le premier du mois, côté navigateur comme côté serveur', async () => {
        expect(formatJoReference({ jo_numero: '7490', jo_date: '2022-01-01', jo_page: 1 }))
            .toBe('Journal officiel n° 7490 du 1er janvier 2022, p. 1');
        const { buildCodeBody } = await charger('render.js');
        const html = buildCodeBody({ slug: 'x', title: 'Loi x', category: 'loi', jo_numero: '7490', jo_date: '2022-01-01', jo_page: 1 }, [], null);
        expect(html).toContain('publié au Journal officiel n° 7490 du 1er janvier 2022, p. 1');
    });
    it('la date ne recule pas d\'un jour selon le fuseau du visiteur', () => {
        const avant = process.env.TZ;
        process.env.TZ = 'America/New_York';
        try {
            expect(formatJoReference({ jo_numero: '3767', jo_date: '1965-09-06', jo_page: null }))
                .toBe('Journal officiel n° 3767 du 6 septembre 1965');
        } finally { process.env.TZ = avant; }
    });
    it('rien sans numéro ou sans date (jamais de mention incomplète)', () => {
        expect(formatJoReference({ jo_numero: null, jo_date: '2020-04-08', jo_page: 12 })).toBeNull();
        expect(formatJoReference({ jo_numero: '7299', jo_date: null, jo_page: 12 })).toBeNull();
        expect(formatJoReference({})).toBeNull();
    });
});

describe('rendu serveur des pages de texte (api/render.js)', () => {
    const law = {
        slug: 'code-penal', title: 'Code pénal', short_title: 'Code pénal', category: 'code',
        reference: 'Loi n° 65-60 du 21 juillet 1965', publication_date: '1965-07-21',
    };
    it('chapô : mention du Journal officiel quand elle est connue', async () => {
        const { buildCodeBody } = await charger('render.js');
        const html = buildCodeBody({ ...law, jo_numero: '3767', jo_date: '1965-09-06', jo_page: 1009 }, [], null);
        expect(html).toContain('publié au Journal officiel n° 3767 du 6 septembre 1965, p. 1009');
        expect(html).not.toContain('publié le 21 juillet 1965');
    });
    it('chapô : comportement inchangé sans mention', async () => {
        const { buildCodeBody } = await charger('render.js');
        const html = buildCodeBody(law, [], null);
        expect(html).toContain('publié le 21 juillet 1965');
        expect(html).not.toContain('Journal officiel n°');
    });
    it('JSON-LD : datePublished = date du J.O., legislationDate = date du texte', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ ...law, jo_numero: '3767', jo_date: '1965-09-06', jo_page: 1009 }, 0, 'https://www.lexenegal.sn/code/code-penal');
        expect(head).toContain('"datePublished":"1965-09-06"');
        expect(head).toContain('"legislationDate":"1965-07-21"');
    });
    it('JSON-LD inchangé sans mention', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead(law, 0, 'https://www.lexenegal.sn/code/code-penal');
        expect(head).toContain('"datePublished":"1965-07-21"');
        expect(head).not.toContain('legislationDate');
    });
});
