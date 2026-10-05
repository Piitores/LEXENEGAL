import { describe, it, expect } from 'vitest';

/*
 * Version serveur d'un article et d'un texte : éléments de la page React qui manquaient (relecture visuelle
 * du 05/10/2026, mesurée hors échantillon). Chacun faisait sauter le contenu au moment où React remplace la
 * version serveur :
 *  - bascule « Législative / Réglementaire » des textes à parties sœurs (+63 px, 2 911 articles de 8 textes) ;
 *  - texte modificateur (dernier élément de article.modifications) sous la ligne de version (+32 px en 390 px) ;
 *  - bandeau d'abrogation en boîte flex (icône à part), comme ArticlePage.tsx (+23 px en 390 px).
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const LAW = { slug: 'code-de-procedure-penale', title: 'Code de procédure pénale', category: 'code' };
const ART = { id: 'a1', slug: 'art-480', num: 'Article 480', article_number: '480' };
// Ordre reçu volontairement inversé : la partie législative passe toujours en premier.
const PARTIES = [{ slug: 'code-de-procedure-penale-reglementaire', partie: 'reglementaire' }, { slug: 'code-de-procedure-penale', partie: 'legislative' }];

describe('page article : éléments de la page React rendus côté serveur', () => {
    it('bascule Législative / Réglementaire sous le fil d’Ariane, partie courante active, sœur en lien', async () => {
        const { buildArticleBody } = await charger('render.js');
        const html: string = buildArticleBody(LAW, ART, '<p>T</p>', [], [], {}, null, { parties: PARTIES });
        const bascule = '<div class="ssr-pt" role="tablist" aria-label="Partie du code">'
            + '<span class="ssr-pt__btn is-actif" role="tab" aria-selected="true">Législative</span>'
            + '<a class="ssr-pt__btn" role="tab" aria-selected="false" href="/code/code-de-procedure-penale-reglementaire">Réglementaire</a></div>';
        expect(html).toContain(bascule);
        expect(html.indexOf(bascule)).toBeGreaterThan(html.indexOf('<nav class="ssr-bc"'));
        expect(html.indexOf(bascule)).toBeLessThan(html.indexOf('<header class="ssr-a-head">'));
        // Une seule partie (ou aucune famille) : pas de bascule, comme React (parties.length > 1).
        expect(buildArticleBody(LAW, ART, '<p>T</p>', [], [], {}, null, { parties: [PARTIES[1]] })).not.toContain('ssr-pt');
        expect(buildArticleBody(LAW, ART, '<p>T</p>', [], [], {}, null, null)).not.toContain('ssr-pt');
    });

    it('texte modificateur : dernier élément de modifications, à côté de la ligne de version', async () => {
        const { buildArticleBody } = await charger('render.js');
        const art = { ...ART, modifications: ['Loi n° 2008-50', 'Loi n° 2013-05 du 8 juillet 2013'] };
        const html: string = buildArticleBody(LAW, art, '<p>T</p>', [], [], {}, null, { version: { texte: 'En vigueur depuis le 1 janvier 2014', note: '' } });
        expect(html).toContain('<div class="ssr-ver-wrap"><p class="ssr-ver">En vigueur depuis le 1 janvier 2014</p>'
            + '<div class="ssr-modif"><span>Loi n° 2013-05 du 8 juillet 2013</span></div></div>');
        expect(html).not.toContain('Loi n° 2008-50');
        // Sans modification : la ligne seule, inchangée.
        const sans: string = buildArticleBody(LAW, { ...ART, modifications: [] }, '<p>T</p>', [], [], {}, null, { version: { texte: 'En vigueur', note: '' } });
        expect(sans).toContain('<p class="ssr-ver">En vigueur</p></header>');
        expect(sans).not.toContain('ssr-ver-wrap');
    });

    it('bandeaux d’abrogation : icône à part, texte dans son propre bloc (boîte flex)', async () => {
        const { buildArticleBody } = await charger('render.js');
        const abroge: string = buildArticleBody(LAW, { ...ART, status: 'abrogé', notes: 'Supprimé par la loi n° 2016-30.' }, '<p>T</p>', [], [], {});
        expect(abroge).toContain('<span class="ssr-lab-icon" aria-hidden="true">⛔</span><span>Supprimé par la loi n° 2016-30.</span></div>');
        const texte: string = buildArticleBody({ ...LAW, abrogation_note: 'Texte abrogé.', abrogated_by_slug: 'code-x' }, ART, '<p>T</p>', [], [], {});
        expect(texte).toContain('<div class="ssr-abrogation ssr-abrogation--texte" role="note"');
        expect(texte).toContain('<span class="ssr-lab-icon" aria-hidden="true">⛔</span><span>Texte abrogé. <a href="/code/code-x">Voir le texte en vigueur →</a></span>');
    });
});

describe('page d’un texte : bascule dans la colonne « Sommaire »', () => {
    it('libellés seuls (colonne aria-hidden), partie législative d’abord', async () => {
        const { buildCodeBody } = await charger('render.js');
        const html: string = buildCodeBody({ ...LAW, slug: 'code-de-procedure-penale-reglementaire' }, [], [], null, null, null, null, PARTIES);
        expect(html).toContain('<div class="ssr-st__title">Code de procédure pénale</div><div class="ssr-pt">'
            + '<span class="ssr-pt__btn">Législative</span><span class="ssr-pt__btn is-actif">Réglementaire</span></div></div>');
        expect(buildCodeBody(LAW, [], [], null)).not.toContain('ssr-pt');
    });
});

describe('mise en forme (api/_ssr/styles.js) des éléments ajoutés', () => {
    it('règles présentes, recopiées de ArticlePage.css et CodePage.css', async () => {
        const { STYLES_SSR } = await charger('_ssr/styles.js');
        expect(STYLES_SSR.article).toContain('#ssr-content .ssr-article .ssr-abrogation{display:flex;gap:.6rem;align-items:flex-start}');
        expect(STYLES_SSR.article).toContain('#ssr-content .ssr-article .ssr-lab-icon{font-size:1.05rem;line-height:1.4;');
        expect(STYLES_SSR.article).toMatch(/\.ssr-pt\{display:inline-flex;gap:2px;margin:-18px 0 28px;padding:3px;/);
        expect(STYLES_SSR.article).toMatch(/\.ssr-ver-wrap\{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;margin:16px 0 0\}/);
        expect(STYLES_SSR.code).toMatch(/\.ssr-pt\{display:flex;gap:2px;margin-top:12px;/);
    });
});
