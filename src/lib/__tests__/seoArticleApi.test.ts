import { describe, it, expect } from 'vitest';
import * as seo from '../seoArticle';

/*
 * La règle des titres d'articles (src/lib/seoArticle.ts) est recopiée dans api/render.js (fonction Vercel,
 * qui ne peut pas importer un module TypeScript). Une divergence donnerait à Google un titre serveur différent
 * du titre posé par l'application après rendu.
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const TEXTES = [
    { title: 'Code Pénal', short_title: 'Code Pénal', category: 'code' },
    { title: 'Loi n° 2001-03 du 22 janvier 2001 portant Constitution', short_title: 'Constitution du Sénégal', category: 'code' },
    { title: 'Code Général des Impôts', short_title: 'CGI', category: 'code' },
    { title: 'Code du Travail', short_title: 'Code du Travail de 1997 (abrogé)', category: 'code' },
    { title: 'DECRET N°67-1360 du 9 décembre 1967 fixant les conditions et les modalités de désignation des délégués du personnel', short_title: null, category: 'decret' },
    { title: 'Loi n° 2021-34 du 23 juillet 2021 modifiant la loi n° 65-61 du 21 juillet 1965 portant Code de procédure pénale', short_title: null, category: 'loi' },
    { title: 'Acte uniforme révisé portant sur le droit commercial général', short_title: 'Acte uniforme révisé portant sur le droit commercial général', category: 'ohada' },
    { title: 'Convention Collective Nationale Interprofessionnelle du Sénégal (2019)', short_title: null, category: 'convention_collective' },
    { title: 'Règlement n° 02/2002/CM/UEMOA', short_title: null, category: 'communautaire' },
    { title: 'Arrêté n° 11512 du 11 décembre 2009 fixant, en application de l’article L.100 du Code du travail, les modalités', short_title: null, category: 'arrete' },
];
const ARTICLES = [
    { article_number: '363' }, { num: 'L.107.', article_number: 'L.107.' }, { article_number: 'préambule' },
    { num: 'Article premier', article_number: '1' }, { article_number: 'Article 5 bis' }, { num_court: 'Art. 3' },
];

describe('seoArticle : copie de api/render.js identique', () => {
    it('titre et description', async () => {
        const api = await charger('render.js');
        for (const t of TEXTES) for (const a of ARTICLES) {
            expect(api.titreSeoArticle(a, t)).toBe(seo.titreSeoArticle(a, t));
            expect(api.descriptionSeoArticle(a, t, 'Texte de l’article, assez long pour être coupé proprement sur un mot. '.repeat(4)))
                .toBe(seo.descriptionSeoArticle(a, t, 'Texte de l’article, assez long pour être coupé proprement sur un mot. '.repeat(4)));
            expect(api.descriptionSeoArticle(a, t, '')).toBe(seo.descriptionSeoArticle(a, t, ''));
        }
    });
});
