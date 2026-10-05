import { describe, it, expect } from 'vitest';

// En-tête serveur des pages de code (api/render.js, buildCodeHead).
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const titre = (html: string) => (html.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1];

describe('titre des pages de code (rendu serveur)', () => {
    it('nom court réduit à un sigle : nom en toutes lettres suivi du sigle', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ slug: 'code-general-impots', title: 'Code Général des Impôts', short_title: 'CGI', category: 'code' }, 764, 'https://www.lexenegal.sn/code/code-general-impots');
        expect(titre(head)).toBe('Code Général des Impôts (CGI) du Sénégal - texte intégral et version consolidée | Lexenegal');
    });
    it('Acte uniforme OHADA à sigle : jamais « du Sénégal »', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ slug: 'ohada-x', title: 'Acte uniforme portant organisation des sûretés', short_title: 'AUS', category: 'ohada' }, 0, 'https://www.lexenegal.sn/code/ohada-x');
        expect(titre(head)).toBe('Acte uniforme portant organisation des sûretés (AUS) - texte intégral | Lexenegal');
    });
    it('nom court ordinaire : inchangé', async () => {
        const { buildCodeHead } = await charger('render.js');
        const head = buildCodeHead({ slug: 'cocc', title: 'Code des obligations civiles et commerciales', short_title: 'Code des obligations civiles et commerciales', category: 'code' }, 0, 'https://www.lexenegal.sn/code/cocc');
        expect(titre(head)).toBe('Code des obligations civiles et commerciales du Sénégal - texte intégral et version consolidée | Lexenegal');
    });
});

/*
 * Code fusionné en 2026 (décisions du propriétaire du 02/10/2026) : les anciens articles non repris
 * restent dans le code comme abrogés. Le compteur du titre et du chapô ne retient que les articles en
 * vigueur ; les anciens forment une liste à part, en fin de sommaire, jamais mêlée au code en vigueur.
 */
describe('code fusionné (rendu serveur)', () => {
    const LAW = { slug: 'code-travail', title: 'Code du Travail', short_title: 'Code du Travail', category: 'code', reference: 'Loi n° 2026-18 du 3 septembre 2026' };
    const ARTICLES = [
        { id: 'a1', slug: 'art-premier', num: 'Article premier', article_number: 'premier' },
        { id: 'a2', slug: 'art-2', num: 'Article 2', article_number: '2' },
        { id: 'l10', slug: 'article-l10', num: 'Article L.10 (Code de 1997)', article_number: 'L.10.' },
    ];
    const CONC = [
        { article_id: 'a2', role: 'principal', ancien_numero: 'L.2.', en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1997-12-01' },
        { article_id: 'l10', role: 'identite', ancien_numero: 'L.10.', en_vigueur_jusqu_au: '2026-09-03', numerotation_depuis: '1997-12-01' },
    ];
    const description = (html: string) => (html.match(/name="description" content="([^"]*)"/) || [])[1];

    it('compteur des articles en vigueur dans l’en-tête et le chapô', async () => {
        const { buildCodeHead, buildCodeBody, contexteFusion, nombreArticlesEnVigueur } = await charger('render.js');
        const fusion = contexteFusion(CONC);
        const n = nombreArticlesEnVigueur(ARTICLES, fusion);
        expect(n).toBe(2);
        expect(description(buildCodeHead(LAW, n, 'https://www.lexenegal.sn/code/code-travail'))).toContain('texte intégral et version consolidée, 2 articles.');
        expect(buildCodeBody(LAW, ARTICLES, [], fusion)).toContain('Texte intégral et version consolidée, 2 articles, consultable');
    });

    it('anciens articles non repris : liste à part, en fin de sommaire', async () => {
        const { buildCodeBody, contexteFusion } = await charger('render.js');
        const html = buildCodeBody(LAW, ARTICLES, [], contexteFusion(CONC));
        const sommaire = html.slice(html.indexOf('aria-label="Articles"'), html.indexOf('</nav>'));
        expect(sommaire).toContain('/code/code-travail/art-2');
        expect(sommaire).not.toContain('article-l10');
        const anciens = html.slice(html.indexOf('<h2>Articles du Code de 1997 non repris (1)</h2>'));
        expect(anciens).toContain('<a href="/code/code-travail/article-l10">Article L.10 (Code de 1997)</a>');
        expect(html.indexOf('non repris (1)')).toBeGreaterThan(html.indexOf('/code/code-travail/art-2'));
    });

    /*
     * Sortie attendue FIGÉE sur celle de buildCodeBody avant la fusion (HEAD du 02/10/2026, mêmes
     * entrées), refigée le 05/10/2026 avec l'habillage serveur calqué sur la page React (sans plan ni
     * contenus : colonne et division en emplacements) : comparer l'appel avec null à l'appel sans argument
     * ne prouverait rien, les deux suivent le même chemin.
     */
    const CORPS_AVANT_FUSION = [
        '<div id="ssr-content" class="ssr-prerender"><div class="ssr-code">',
        '  <aside class="ssr-st" aria-hidden="true"><div class="ssr-st__in"><div class="ssr-st__head"><div class="ssr-st__sur">Code sénégalais</div><div class="ssr-st__title">Code du Travail</div></div><i class="ssr-st__search"></i><span class="ssr-st__ctl"><i></i><i></i></span><span class="ssr-st__tree"><i class="ssr-st__row is-active"></i><span class="ssr-st__chips"><i style="width:98px"></i><i style="width:63px"></i><i style="width:63px"></i></span><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i><i class="ssr-st__row"></i></span></div></aside>',
        '  <article class="ssr-code__main">',
        '    <h1>Code du Travail du Sénégal - texte intégral et version consolidée</h1>',
        '    <p class="ssr-code-intro">Code du Travail - Loi n° 2026-18 du 3 septembre 2026. Texte intégral et version consolidée, 3 articles, consultable gratuitement article par article, avec la jurisprudence et les textes liés.</p>',
        '    <i class="ssr-code__toggle" aria-hidden="true"></i>',
        '    ',
        '    ',
        '    <section class="ssr-tp" aria-label="Présentation du texte"><div class="ssr-tp__meta"><span class="ssr-tp__nature">Code</span><span class="ssr-tp__chip">3 articles</span></div><p class="ssr-tp__fallback">Code du Travail - texte intégral consolidé, à jour et structuré article par article, dans le corpus du droit sénégalais sur Lexenegal. Texte institué par : Loi n° 2026-18 du 3 septembre 2026.</p></section>',
        '    <div class="ssr-dv__report" aria-hidden="true"><i></i></div><div class="ssr-dv__bc"><i aria-hidden="true"></i><span class="ssr-dv__pill">Version en vigueur</span></div><div class="ssr-dv__head"><span class="ssr-dv__h2" aria-hidden="true"><i></i><i></i></span><i class="ssr-dv__meta" aria-hidden="true"></i><i class="ssr-dv__print" aria-hidden="true"></i></div><div class="ssr-dv__tabs" aria-hidden="true"><i></i></div><div class="ssr-dv__carte" aria-hidden="true"><span class="ssr-dv__carte-tete"><i></i><i></i></span><i></i><i></i><i class="ssr-dv__carte-lien"></i></div><div class="ssr-dv__nav" aria-hidden="true"><i></i></div>',
        '    <nav class="ssr-toc" aria-label="Articles"><h2>Articles · Code du Travail</h2><ul><li><a href="/code/code-travail/art-premier">Article premier</a></li>',
        '<li><a href="/code/code-travail/art-2">Article 2</a></li>',
        '<li><a href="/code/code-travail/article-l10">Article L.10 (Code de 1997)</a></li></ul></nav>',
        '    ',
        '  </article>',
        '</div></div>',
    ].join('\n');

    it('sans concordance : sommaire et compteur d’avant la fusion, à l’identique', async () => {
        const { buildCodeBody, nombreArticlesEnVigueur } = await charger('render.js');
        expect(nombreArticlesEnVigueur(ARTICLES, null)).toBe(3);
        expect(buildCodeBody(LAW, ARTICLES, [], null)).toBe(CORPS_AVANT_FUSION);
        expect(buildCodeBody(LAW, ARTICLES, [])).toBe(CORPS_AVANT_FUSION);
        // Un article désactivé reste listé hors fusion (règle d'avant, aucun filtre nouveau).
        const desactive = ARTICLES.map((a) => (a.id === 'a2' ? { ...a, is_active: false } : a));
        expect(buildCodeBody(LAW, desactive, [], null)).toBe(CORPS_AVANT_FUSION);
        expect(nombreArticlesEnVigueur(desactive, null)).toBe(3);
    });

    /*
     * Filet (relecture du 02/10/2026) : si la migration DÉSACTIVAIT les anciens articles repris au lieu
     * de les supprimer, ils ne doivent ni entrer au sommaire, ni compter, ni servir de précédent/suivant.
     */
    it('code fusionné : un article désactivé n’est ni listé, ni compté, ni chaîné', async () => {
        const { buildCodeBody, contexteFusion, nombreArticlesEnVigueur, articleDuSommaire, filtreVoisinsFusion } = await charger('render.js');
        const fusion = contexteFusion(CONC);
        const avecRepris = [...ARTICLES, { id: 'l57', slug: 'article-l57', num: 'L.57.', article_number: 'L.57.', is_active: false }];
        const html = buildCodeBody(LAW, avecRepris, [], fusion);
        expect(html).not.toContain('article-l57');
        expect(html).toContain('2 articles, consultable');
        expect(nombreArticlesEnVigueur(avecRepris, fusion)).toBe(2);
        expect(articleDuSommaire(fusion, { is_active: false })).toBe(false);
        expect(articleDuSommaire(fusion, { is_active: true })).toBe(true);
        expect(articleDuSommaire(fusion, {})).toBe(true);
        expect(articleDuSommaire(null, { is_active: false })).toBe(true);
        // Précédent/suivant : même ensemble que l'article courant, articles actifs seulement.
        expect(filtreVoisinsFusion(fusion, 'a2')).toBe('&id=not.in.(l10)&is_active=eq.true');
        expect(filtreVoisinsFusion(fusion, 'l10')).toBe('&id=in.(l10)&is_active=eq.true');
        expect(filtreVoisinsFusion(contexteFusion([{ article_id: 'a2', role: 'principal', ancien_numero: 'L.2.' }]), 'a2')).toBe('&is_active=eq.true');
        // Hors fusion : aucun filtre, requêtes d'avant.
        expect(filtreVoisinsFusion(null, 'a2')).toBe('');
    });
});
