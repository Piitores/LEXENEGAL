import { describe, it, expect } from 'vitest';
import { formatNodeLabel, buildTreeFromNodes, buildTreeLegacy, countArticles, segmentsNoeud } from '../codeTree';

/*
 * Page article servie par api/render.js (05/10/2026, option A) : la version serveur porte la mise en
 * page de la page React prête. Ses libellés et son arbre sont des COPIES de src/lib/codeTree.ts
 * (formatNodeLabel, buildTreeFromNodes, buildTreeLegacy, countArticles, segmentsNoeud), que cette
 * fonction Vercel ne peut pas importer : ces tests vérifient que les copies répondent pareil.
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

// Nœuds réels (structure_nodes, un par forme de libellé), relevés le 05/10/2026.
const NOEUDS = [
    { type: 'titre', numero: 'TITRE XIII BIS', intitule: 'DE LA SAISIE-LICITATION SUR LES OBJETS MOBILIERS ABANDONNÉS', label: 'TITRE XIII BIS - DE LA SAISIE-LICITATION' },
    { type: 'annexe', numero: '5', intitule: 'EQUIVALENCE DES HORAIRES', label: '5 - EQUIVALENCE DES HORAIRES' },
    { type: 'chapitre', numero: 'IX', intitule: 'De l’expertise', label: 'Chapitre IX - De l’expertise' },
    { type: 'division', numero: 'IV', intitule: 'MUTATION', label: 'IV - MUTATION' },
    { type: 'sous_section', numero: '3', intitule: 'LIEU DE VERIFICATION', label: 'Sous-section 3 - LIEU DE VERIFICATION' },
    { type: 'sous-chapitre', numero: '', intitule: 'DISPOSITIONS COMMUNES', label: 'DISPOSITIONS COMMUNES' },
    { type: 'titre', numero: 'TITRE PREMIER', intitule: 'DES OFFRES DE PAIEMENT ET DE LA CONSIGNATION', label: 'TITRE PREMIER - DES OFFRES' },
    { type: 'section', numero: 'PREMIERE', intitule: 'TITRE DE NATIONALITE', label: 'PREMIERE - TITRE DE NATIONALITE' },
    { type: 'paragraphe', numero: null, intitule: 'PARAGRAPHE III - DES FAUX EN ÉCRITURE PUBLIQUE AUTHENTIQUE', label: 'PARAGRAPHE III' },
    { type: 'partie', numero: null, intitule: 'PREMIERE PARTIE', label: 'PREMIERE PARTIE' },
    { type: 'chapitre', numero: null, intitule: 'Chapitre unique', label: 'Chapitre unique' },
    { type: 'division', numero: null, intitule: 'B - Deuxième classe', label: 'B - Deuxième classe' },
    { type: 'livre', numero: null, intitule: 'SIXIEME LES CONTRATS GENERATEURS DE PERSONNES MORALES', label: 'SIXIEME' },
    { type: 'partie', numero: null, intitule: '2ème Partie Revenus des créances, dépôts et cautionnements', label: 'Partie' },
    { type: 'preambule', numero: null, intitule: 'Préambule', label: 'Préambule' },
    { type: 'section', numero: '4', intitule: '', label: 'SECTION 4' },
    { type: 'livre', numero: 'LIVRE PREMIER', intitule: null, label: 'LIVRE PREMIER' },
    { type: 'point-lettre', numero: 'A', intitule: 'Limites du domaine public maritime', label: 'A / Limites' },
    { type: 'chapitre', numero: 'V', intitule: 'CHAPITRE V : DES MESURES CONSERVATOIRES', label: 'CHAPITRE V' },
];

describe('page article du rendu serveur : copies de src/lib/codeTree.ts', () => {
    it('formatNodeLabelSsr répond comme formatNodeLabel', async () => {
        const api = await charger('render.js');
        for (const n of NOEUDS) expect(api.formatNodeLabelSsr({ ...n, name: n.label })).toEqual(formatNodeLabel({ ...n, name: n.label }));
    });

    // Plan : un chapitre dont un article précède la première section, un orphelin, un préambule sans nœud.
    const NODES = [
        { id: 't1', code_id: 'X', type: 'titre', numero: 'I', intitule: 'Généralités', label: 'Titre I', parent_id: null, position: 1 },
        { id: 'c1', code_id: 'X', type: 'chapitre', numero: 'I', intitule: 'Champ', label: 'Chapitre I', parent_id: 't1', position: 2 },
        { id: 's1', code_id: 'X', type: 'section', numero: '1', intitule: 'Principe', label: 'Section 1', parent_id: 'c1', position: 3 },
        { id: 's2', code_id: 'X', type: 'section', numero: '2', intitule: 'Exceptions', label: 'Section 2', parent_id: 'c1', position: 4 },
        { id: 't2', code_id: 'X', type: 'titre', numero: 'II', intitule: 'Sanctions', label: 'Titre II', parent_id: null, position: 5, note: 'Nota du titre' },
    ];
    const ART = (slug: string, node_id: string | null, display_order: number, extra = {}) =>
        ({ id: slug, slug, node_id, display_order, num: `Article ${slug}`, num_court: null, article_number: slug, status: 'validated', is_active: true, tags: null, ...extra });
    const ARTS = [ART('pre', null, 1, { num: 'Préambule', article_number: 'Préambule' }), ART('1', 'c1', 10), ART('2', 's1', 20), ART('3', 's1', 30),
        ART('4', 's2', 40), ART('5', 't2', 50, { status: 'abrogé' }), ART('6', null, 60)];

    it('arbreDuTexteSsr : mêmes nœuds, mêmes nombres, mêmes segments que buildTreeFromNodes et buildTreeLegacy', async () => {
        const api = await charger('render.js');
        const plat = (ns: any[], f: (n: any) => unknown): unknown[] => ns.flatMap((n) => [f(n), ...plat(n.children, f)]);
        const resume = (n: any) => [n.id, n.note ?? null, countArticles(n), segmentsNoeud(n).map((s) => (s.kind === 'articles'
            ? s.articles.map((a) => a.slug).join(',') : s.nodes.map((x) => x.id).join(',')))];
        expect(plat(api.arbreDuTexteSsr(NODES, ARTS), resume)).toEqual(plat(buildTreeFromNodes(NODES as any, ARTS as any), resume));
        const plats = ARTS.map((a, i) => ({ ...a, node_id: null, part_title: i < 3 ? 'Partie A' : null, title_name: i % 2 ? 'Titre X' : null, chapter_name: i === 3 ? 'Chap' : null }));
        expect(plat(api.arbreDuTexteSsr([], plats), resume)).toEqual(plat(buildTreeLegacy(plats as any), resume));
    });

    it('arbreHtmlSsr : chemin de l’article déplié, nœud et pastille actifs, nombres hors du texte', async () => {
        const api = await charger('render.js');
        const html = api.arbreHtmlSsr({ slug: 'code-x' }, { slug: '2', node_id: 's1' }, NODES, ARTS);
        expect(html).toContain('<div class="ssr-th is-active"><span class="ssr-tt is-open"></span><span class="ssr-tl"><span class="ssr-ty">Section 1</span> <span class="ssr-tm">Principe</span></span><span class="ssr-tc" data-n="2"></span></div>');
        expect(html).toContain('<a class="ssr-tchip is-active" href="/code/code-x/2">Article 2</a> <a class="ssr-tchip" href="/code/code-x/3">Article 3</a>');
        // Chapitre déplié : l'article 1 avant ses sections ; titre II replié, sa nota marquée sans texte.
        expect(html.indexOf('/code/code-x/1"')).toBeLessThan(html.indexOf('>Principe<'));
        expect(html).not.toContain('/code/code-x/5"');
        expect(html).toContain('<span class="ssr-tnota" aria-hidden="true"></span>');
        // Orphelin regroupé en fin, comme la page React.
        expect(html).toContain('<span class="ssr-ty">division</span> <span class="ssr-tm">Autres dispositions</span>');
    });

    it('buildArticleBody : tout le contenu reste en texte et en liens, les boutons sont des emplacements vides', async () => {
        const api = await charger('render.js');
        const law = { slug: 'code-x', title: 'Code X' };
        const art = { id: 'a2', slug: '2', article_number: '2', num: 'Article 2', node_id: 's1' };
        const citing = [{ citation_text: 'article 2', decision: { reference: 'Arrêt n° 1', slug: 'cs-1', date_decision: '2020-01-31', chambre: 'Chambre sociale' } }];
        const fa = { avantTitre: '', apresTitre: '\n    <p class="ssr-correspondance">Correspond à l’ancien article L.2.</p>', h1: null, ancien: null };
        const corps = api.buildArticleBody(law, art, '<p class="alinea">Texte.</p>', citing, [NODES[0], NODES[1], NODES[2]],
            { prec: { slug: '1', num: 'Article 1' }, suiv: { slug: '3', num: 'Article 3' } }, fa,
            { arbre: '<div class="ssr-troot"></div>', version: { texte: 'En vigueur depuis le 3 septembre 2026', note: 'Texte d’origine' } });
        for (const attendu of ['<h1>Article 2</h1>', '<p class="alinea">Texte.</p>', 'Correspond à l’ancien article L.2.',
            '<a href="/decision/cs-1">Arrêt n° 1</a> <span class="ssr-cc-m">Chambre sociale · 31/01/2020</span>',
            '<a class="ssr-nav-prev" href="/code/code-x/1" rel="prev">Article 1</a>', '<a class="ssr-nav-next" href="/code/code-x/3" rel="next">Article 3</a>',
            '<span class="ssr-ah-badge ssr-ah-badge--titre">Titre I</span> <span class="ssr-ah-label">Généralités</span>',
            '<p class="ssr-ver">En vigueur depuis le 3 septembre 2026<span class="ssr-ver-note"> · Texte d’origine</span></p>',
            '<a href="/codes">Codes</a>', '<nav class="ssr-a-tree" aria-label="Sommaire du texte">']) expect(corps).toContain(attendu);
        expect(corps).toContain('<div class="ssr-act" aria-hidden="true"><span></span><span></span><span></span></div>');
        // Typographie maison : aucun tiret long produit par le gabarit.
        expect(corps).not.toMatch(/[\u2013\u2014]/);
    });
});
