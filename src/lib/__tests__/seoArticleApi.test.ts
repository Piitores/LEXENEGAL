import { describe, it, expect } from 'vitest';
import * as seo from '../seoArticle';
import { texteAvecIntitule } from '../intituleArticle';

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

    it('texte de la description : intitulé ponctué, identique serveur et client', async () => {
        const api = await charger('render.js');
        const html = [
            '<p class="alinea intitule-article">Champ d’application</p>\n<p class="alinea">Le présent Code s’applique.</p>',
            '<p class="article-intitule"><strong>De la durée :</strong></p><p class="alinea">Texte.</p>',
            '<p class="article-rubrique"><strong>Amortissements</strong></p>\n<p class="alinea niv1"><span class="marqueur">1)</span> Sont admis.</p>',
            '<p class="alinea">Tout condamné à mort sera fusillé.</p>',
            '<p class="alinea-titre"><strong>A - Travail des femmes</strong></p><p class="alinea">Texte.</p>',
            '',
        ];
        for (const h of html) {
            expect(api.texteSeoArticle(h)).toBe(texteAvecIntitule(h, (x) => x.replace(/<[^>]+>/g, ' ')));
        }
        expect(api.texteSeoArticle(html[0])).toBe('Champ d’application. Le présent Code s’applique.');
    });
});

/*
 * Fusion des codes 2026 (décisions du propriétaire du 02/10/2026) : un ancien article NON REPRIS reste
 * dans le code comme article abrogé. Son titre serveur porte l'année du code d'origine et « (abrogé) »,
 * sinon l'ancien article 13 de 1973 et l'article 13 en vigueur auraient le même titre dans Google.
 * Paramètre facultatif de la copie serveur : sans lui, la règle reste celle de src/lib/seoArticle.ts
 * (vérifié par les tests ci-dessus).
 */
describe('seoArticle : ancien article non repris (rendu serveur)', () => {
    const SECU = { title: 'Code de la Sécurité sociale', short_title: 'Code de la Sécurité sociale', category: 'code' };
    const TRAVAIL = { title: 'Code du Travail', short_title: 'Code du Travail', category: 'code' };

    it('titre et description marqués « (abrogé) », année tirée des données', async () => {
        const api = await charger('render.js');
        const fusion = api.contexteFusion([{ article_id: 'a13', role: 'identite', ancien_numero: '13', en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1973-07-31' }]);
        const art = { id: 'a13', num: 'Article 13 (Code de 1973)', article_number: '13' };
        const ancien = api.articleAncien(art, fusion);
        expect(ancien).toEqual({ libelle: 'Article 13', annee: '1973' });
        expect(api.titreSeoArticle(art, SECU, ancien)).toBe('Article 13 du Code de la Sécurité sociale de 1973 (abrogé) | Lexenegal');
        expect(api.descriptionSeoArticle(art, SECU, 'Texte.', ancien)).toBe('Article 13 du Code de la Sécurité sociale de 1973 (abrogé) : Texte.');
        expect(api.descriptionSeoArticle(art, SECU, '', ancien))
            .toBe('Texte intégral de l’article 13 du Code de la Sécurité sociale de 1973 (abrogé), avec la jurisprudence qui le cite.');
        // L'article en vigueur de même numéro garde son titre habituel.
        expect(api.titreSeoArticle({ num: 'Article 13', article_number: '13' }, SECU)).toBe(seo.titreSeoArticle({ num: 'Article 13', article_number: '13' }, SECU));
    });

    it('num sans mention d’année : année de la numérotation d’origine ; sinon pas d’année inventée', async () => {
        const api = await charger('render.js');
        const ligne = { article_id: 'l10', role: 'identite', ancien_numero: 'L.10.', en_vigueur_jusqu_au: '2026-09-03' };
        const avecDate = api.contexteFusion([{ ...ligne, numerotation_depuis: '1997-12-01' }]);
        const sansDate = api.contexteFusion([{ ...ligne, numerotation_depuis: null }]);
        const art = { id: 'l10', num: 'L.10.', article_number: 'L.10.' };
        expect(api.titreSeoArticle(art, TRAVAIL, api.articleAncien(art, avecDate))).toBe('Article L.10 du Code du Travail de 1997 (abrogé) | Lexenegal');
        expect(api.titreSeoArticle(art, TRAVAIL, api.articleAncien(art, sansDate))).toBe('Article L.10 du Code du Travail (abrogé) | Lexenegal');
        // Article qui n'est pas un ancien article non repris : rien.
        expect(api.articleAncien({ id: 'autre', num: 'Article 3' }, avecDate)).toBeNull();
    });

    it('sans le paramètre, copie toujours identique à src/lib/seoArticle.ts', async () => {
        const api = await charger('render.js');
        for (const t of TEXTES) for (const a of ARTICLES) {
            expect(api.titreSeoArticle(a, t, undefined)).toBe(seo.titreSeoArticle(a, t));
            expect(api.descriptionSeoArticle(a, t, '', null)).toBe(seo.descriptionSeoArticle(a, t, ''));
        }
    });
});
