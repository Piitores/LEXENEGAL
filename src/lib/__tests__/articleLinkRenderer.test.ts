import { describe, it, expect } from 'vitest';
import {
    findAllArticleCitations, renderTextWithArticleLinks, textToHtmlWithLinks, numerotationPropreEnL,
} from '../../utils/articleLinkRenderer';

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

describe('findAllArticleCitations : numéros composés et urbanisme', () => {
    it('« L.29-1 » et « L.76 bis » sont capturés en entier (et non L.29, L.76)', () => {
        const c = findAllArticleCitations('vu les articles L.29-1 et Article L.76 bis du Code du travail');
        expect(c.map((x) => x.articleNum)).toEqual(['76 bis']);
        expect(findAllArticleCitations('Article L.29-1 du Code du travail')[0].articleNum).toBe('29-1');
        expect(findAllArticleCitations('Art. L 85bis, alinéa 2')[0].articleNum).toBe('85bis');
        expect(findAllArticleCitations('Article L.76 bisannuel')[0].articleNum).toBe('76');
    });

    it('« Article L.12 du Code de l’urbanisme » n’est plus lu comme le L.12 du Code du travail', () => {
        const c = findAllArticleCitations("Article L.12 du Code de l'urbanisme et article L.12 du Code du travail");
        expect(c.map((x) => [x.codeSlug, x.articleNum])).toEqual([
            ['code-de-l-urbanisme', '12'],
            ['code-travail', '12'],
        ]);
        expect(findAllArticleCitations('Article L.3 du Code de la construction')[0].codeSlug).toBe('code-de-la-construction');
    });
});

/*
 * Fusion des codes 2026 (décisions du propriétaire du 02/10/2026) : les renvois vers un code
 * refondu passent par sa concordance et la date de la citation. L.56 a pour successeur principal
 * l'art. 137 ; l'art. 56 de 2026 traite d'un autre sujet.
 */
describe('textToHtmlWithLinks : code refondu (Code du travail)', () => {
    const CT = [
        { id: 'a56', article_number: '56', slug: 'art-56', code_slug: 'code-travail', code_name: 'Code du Travail' },
        { id: 'a137', article_number: '137', slug: 'art-137', code_slug: 'code-travail', code_name: 'Code du Travail' },
    ];
    const ligne = (ancien_numero: string, ancien_norm: string, article_id: string) => ({
        ancien_numero, ancien_norm, ancien_slug: `article-${ancien_norm.toLowerCase()}`, role: 'principal', statut: 'repris',
        en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1997-12-01', article_id,
    });
    const concordances = { 'code-travail': [ligne('L.56.', 'L56', 'a137'), ligne('L.76 bis', 'L76BIS', 'a137')] };

    it('décision de 2015 : « article L.56 » mène à l’art. 137 daté, « & » échappé', () => {
        const html = textToHtmlWithLinks("en application de l'article L.56 du Code du travail", CT, { dateCitation: '2015-03-04', concordances });
        expect(html).toContain('href="/code/code-travail/art-137?ancien=L56&amp;date=2015-03-04"');
        expect(html).toContain('data-article-id="a137"');
    });

    it('« L.76 bis » relié à son propre successeur', () => {
        const html = textToHtmlWithLinks('Article L.76 bis', CT, { dateCitation: '2010-01-01', concordances });
        expect(html).toContain('href="/code/code-travail/art-137?ancien=L76BIS&amp;date=2010-01-01"');
    });

    it('numéro absent de la concordance ou décision antérieure à 1997 : texte', () => {
        expect(textToHtmlWithLinks('Article L.999', CT, { dateCitation: '2015-03-04', concordances })).toBe('Article L.999');
        expect(textToHtmlWithLinks('Article L.56', CT, { dateCitation: '1990-03-04', concordances })).toBe('Article L.56');
    });

    it('concordance illisible : pas de lien vers le code refondu', () => {
        expect(textToHtmlWithLinks('Article L.56', CT, { dateCitation: '2015-03-04', concordances: { 'code-travail': null } })).toBe('Article L.56');
    });

    it('sans concordance (avant la migration) : comportement inchangé', () => {
        const CT_1997 = [{ id: 'x56', article_number: 'L.56.', slug: 'article-l56', code_slug: 'code-travail', code_name: 'Code du Travail de 1997 (abrogé)' }];
        const attendu = 'href="/code/code-travail/article-l56"';
        expect(textToHtmlWithLinks('Article L.56', CT_1997)).toContain(attendu);
        expect(textToHtmlWithLinks('Article L.56', CT_1997, { dateCitation: '2015-03-04', concordances: { 'code-travail': [] } })).toContain(attendu);
    });

    it('renderTextWithArticleLinks : même règle, aperçu daté', () => {
        const noeuds = renderTextWithArticleLinks('Article L.56', { articles: CT, dateCitation: '2015-03-04', concordances });
        const lien = noeuds.find((n: any) => n?.props?.articleSlug) as any;
        expect(lien.props).toMatchObject({ articleSlug: 'art-137', date: '2015-03-04', ancien: 'L56' });
        expect(lien.props.children.props.href).toBe('/code/code-travail/art-137?ancien=L56&date=2015-03-04');
    });
});

/*
 * Relecture du 02/10/2026 : le motif générique du Code du travail (« Art. L.N ») lisait comme des
 * renvois au Code du travail les numéros « L. » d'autres textes. Exemples vérifiés en base : le Code
 * électoral (« article L.68 du Code électoral », et dans son propre texte « article L.209 ; »), le
 * Code de l'assainissement (« article L 107 de la présente loi »).
 */
describe('findAllArticleCitations : numéros « L. » d’autres codes', () => {
    const codes = (t: string, o?: Parameters<typeof findAllArticleCitations>[1]) =>
        findAllArticleCitations(t, o).map((c) => [c.codeSlug, c.articleNum]);

    it('« L.68 du Code électoral » n’est plus un renvoi au Code du travail (capturé, sans lien)', () => {
        expect(codes('conformément à l’article L.68 du Code électoral')).toEqual([]);
        expect(codes('article L.122 du code Électoral')).toEqual([]);
        expect(codes('l’article LO.160 du Code électoral')).toEqual([]);
        // L'autre citation de la phrase reste reconnue.
        expect(codes('article L.68 du Code électoral et article L.56 du Code du travail')).toEqual([['code-travail', '56']]);
    });

    it('autres codes en « L. » nommés après le numéro : neutralisés', () => {
        expect(codes('article L.12 du code de l’environnement')).toEqual([]);
        expect(codes("article L.12 du Code de l'environnement")).toEqual([]);
        expect(codes('article L.511 du Code de la Santé publique')).toEqual([]);
        expect(codes('article L. 310-4 du Code des assurances français')).toEqual([]);
        expect(codes('article L.5 du code de la route')).toEqual([]);
    });

    it('Code de l’urbanisme avec apostrophe typographique : routé vers l’urbanisme', () => {
        expect(codes('Article L.12 du Code de l’urbanisme')).toEqual([['code-de-l-urbanisme', '12']]);
    });

    it('sans contexte (décisions) : « article L.56 » reste un renvoi au Code du travail', () => {
        expect(codes('en application de l’article L.56')).toEqual([['code-travail', '56']]);
        expect(codes('article L.214 fait obligation à l’employeur')).toEqual([['code-travail', '214']]);
    });

    it('texte à numérotation propre en « L. » : ses renvois sans nom de code ne vont pas au Code du travail', () => {
        const propre = { numerotationPropreEnL: true };
        expect(codes('dans les conditions fixées par l’article L.209 ;', propre)).toEqual([]);
        expect(codes('à l’article L.28 alinéa 2 du présent Code', propre)).toEqual([]);
        expect(codes('visés à l’article L 98 de la présente loi', propre)).toEqual([]);
        // Le Code du travail NOMMÉ reste relié (y compris la coquille « Code de travail »).
        expect(codes('article L.56 du Code du travail', propre)).toEqual([['code-travail', '56']]);
        expect(codes('article L.56, du code du Travail', propre)).toEqual([['code-travail', '56']]);
        expect(codes('article L.5 du Code de travail', propre)).toEqual([['code-travail', '5']]);
        // Les autres codes ne sont pas concernés.
        expect(codes('article 5 du code pénal', propre)).toEqual([['code-penal', '5']]);
    });

    it('textToHtmlWithLinks : « L.68 du Code électoral » reste du texte, même si le CT a un L.68', () => {
        const CT = [{ id: 'l68', article_number: 'L.68.', slug: 'article-l68', code_slug: 'code-travail', code_name: 'Code du Travail' }];
        const texte = 'article L.68 du Code électoral';
        expect(textToHtmlWithLinks(texte, CT)).toBe(texte);
        expect(textToHtmlWithLinks('article L.68 du Code du travail', CT)).toContain('href="/code/code-travail/article-l68"');
    });
});

describe('numerotationPropreEnL', () => {
    it('textes à numérotation « L. » (vérifiés en base le 02/10/2026)', () => {
        expect(numerotationPropreEnL('code-electoral', ['L. premier', 'L.68', 'L.O.168', 'R.68'])).toBe(true);
        expect(numerotationPropreEnL('code-assainissement', ['Exposé des motifs', 'L premier', 'L 68'])).toBe(true);
        expect(numerotationPropreEnL('code-de-la-route', ['L1'])).toBe(true);
    });

    it('le Code du travail lui-même, et les textes à numérotation nue, non', () => {
        expect(numerotationPropreEnL('code-travail', ['L.56.'])).toBe(false);
        expect(numerotationPropreEnL('code-travail-2026', ['137', 'L.10.'])).toBe(false);
        expect(numerotationPropreEnL('ccn-banques', ['1', '2', 'Préambule'])).toBe(false);
        expect(numerotationPropreEnL('code-penal', ['Livre premier', '5'])).toBe(false);
        expect(numerotationPropreEnL(undefined, ['L.1'])).toBe(false);
        expect(numerotationPropreEnL('code-electoral', [])).toBe(false);
    });
});
