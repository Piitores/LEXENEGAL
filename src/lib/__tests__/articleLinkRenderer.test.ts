import { describe, it, expect } from 'vitest';
import { renderTextWithArticleLinks, textToHtmlWithLinks } from '../../utils/articleLinkRenderer';

/*
 * Liens du corps d'un arrêt vers les articles cités. Au Code pénal, les articles premier à 8
 * existent deux fois : dans le corps du code et dans l'annexe III sur la cryptologie. Les articles
 * arrivent dans l'ordre de lecture (chargerArticlesDesCodes : code_id, display_order, id), donc le
 * corps du code d'abord ; « article 5 du code pénal » (cumul des peines) doit y mener.
 */
const CODE_PENAL = [
    { id: 'c7174038', article_number: '4', slug: 'annexe2-art-4', code_slug: 'code-penal', code_name: 'Code pénal' },
    { id: 'de8673c5', article_number: '5', slug: 'annexe2-art-5', code_slug: 'code-penal', code_name: 'Code pénal' },
    { id: '86e7f003', article_number: '4', slug: 'annexe-iii-art-4', code_slug: 'code-penal', code_name: 'Code pénal' },
    { id: '228bf05b', article_number: '5', slug: 'annexe-iii-art-5', code_slug: 'code-penal', code_name: 'Code pénal' },
];

describe('textToHtmlWithLinks', () => {
    it('« article 5 du code pénal » mène au corps du code, pas à l’annexe III', () => {
        const html = textToHtmlWithLinks("en application de l'article 5 du code pénal", CODE_PENAL);
        expect(html).toContain('href="/code/code-penal/annexe2-art-5"');
        expect(html).not.toContain('annexe-iii');
    });

    it('« article 4 du Code pénal » (légalité) mène au corps du code', () => {
        const html = textToHtmlWithLinks('au visa de l’article 4 du Code pénal', CODE_PENAL);
        expect(html).toContain('href="/code/code-penal/annexe2-art-4"');
        expect(html).toContain('data-article-id="c7174038"');
    });

    it('article absent : le renvoi reste du texte (jamais de lien faux)', () => {
        const texte = "l'article 9 du code pénal";
        expect(textToHtmlWithLinks(texte, CODE_PENAL)).toBe(texte);
    });
});

describe('renderTextWithArticleLinks', () => {
    it('même règle : le premier article du numéro dans l’ordre de lecture', () => {
        const noeuds = renderTextWithArticleLinks("en application de l'article 5 du code pénal", { articles: CODE_PENAL });
        const lien = noeuds.find((n: any) => n?.props?.articleSlug) as any;
        expect(lien.props.articleSlug).toBe('annexe2-art-5');
        expect(lien.props.children.props.href).toBe('/code/code-penal/annexe2-art-5');
    });
});
