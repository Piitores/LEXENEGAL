import { describe, it, expect } from 'vitest';
import * as seo from '../seoDoctrine';

// La règle de doctrine (src/lib/seoDoctrine.ts) est recopiée dans api/render.js : les deux copies doivent concorder.
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const cgi = { slug: 'code-general-impots', title: 'Code Général des Impôts', short_title: 'CGI', category: 'code' };
const cocc = { slug: 'cocc', title: 'Code des obligations civiles et commerciales', short_title: 'Code des obligations civiles et commerciales', category: 'code' };
const lien = (law: any, n: string, ordre: number) => ({ articles: { slug: `art-${n}`, num: `Article ${n}`, article_number: n, display_order: ordre, is_active: true, laws_and_codes: law } });
const JEUX = [
    [], [lien(cgi, '256', 1)], [lien(cgi, '256', 1), lien(cgi, '669', 2)], [lien(cgi, '1', 1), lien(cgi, '2', 2), lien(cgi, '3', 3)],
    [lien(cgi, '1', 1), lien(cgi, '2', 2), lien(cgi, '3', 3), lien(cgi, '4', 4)], [lien(cocc, '118', 5), lien(cgi, '7', 1)],
];
const DOCS = [
    { numero: '71', date: '2019-01-21', objet: 'demande de précision.' }, { numero: null, date: '2011-05-01', objet: '', reference_complete: 'Circulaire DGID' },
    { numero: '5', date: null, objet: 'Votre recours hiérarchique' },
];

describe('seoDoctrine : copie de api/render.js identique', () => {
    it('articles, titre et description', async () => {
        const api = await charger('render.js');
        for (const j of JEUX) {
            expect(api.articlesDeDoctrine(j)).toEqual(seo.articlesDeDoctrine(j as any));
            for (const d of DOCS) {
                const a = seo.articlesDeDoctrine(j as any);
                expect(api.titreSeoDoctrine(d, a)).toBe(seo.titreSeoDoctrine(d, a));
                expect(api.descriptionSeoDoctrine(d, a)).toBe(seo.descriptionSeoDoctrine(d, a));
            }
        }
        expect(api.dateLongue('2019-01-21')).toBe(seo.dateLongue('2019-01-21'));
    });
});
