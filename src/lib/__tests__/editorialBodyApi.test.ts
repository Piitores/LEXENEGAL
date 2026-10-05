import { describe, it, expect } from 'vitest';

// Pages éditoriales rendues par le serveur (api/render.js) : la version serveur est habillée comme la page
// React prête (api/_ssr/styles.js, blocs guides, guide, doctrine et codes), SANS perdre le contenu de référencement.
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

describe('guides (rendu serveur habillé)', () => {
    it('liste : titre h1, chapô avec ses deux liens internes, un lien et une description par guide', async () => {
        const { buildGuidesBody } = await charger('render.js');
        const html = buildGuidesBody([
            { slug: 'licenciement', title: 'Licenciement au Sénégal', description: 'Motifs et recours.' },
            { slug: 'divorce', title: 'Divorce', description: '' },
        ]);
        expect(html).toContain('class="ssr-guides ssr-ed"');
        expect(html).toContain('<h1>Guides pratiques du droit sénégalais</h1>');
        expect(html).toContain('<a href="/codes">');
        expect(html).toContain('<a href="/jurisprudence">');
        expect(html).toContain('<li><a href="/guides/licenciement">Licenciement au Sénégal</a><p>Motifs et recours.</p></li>');
        expect(html).toContain('<li><a href="/guides/divorce">Divorce</a></li>');
    });
    it('guide : fil d\'Ariane, h1, corps, FAQ aux réponses visibles, lien thème et devise conservée', async () => {
        const { buildGuideBody } = await charger('render.js');
        const html = buildGuideBody({
            slug: 'g', title: 'Titre', h1: 'Titre long', content_html: '<p>Corps</p>', published_at: '2026-07-07',
            faq: [{ q: 'Question ?', a: 'Réponse.' }], theme_slug: 'licenciement',
        });
        expect(html).toContain('<a href="/guides">Guides pratiques</a> <span>›</span> Titre</nav>');
        expect(html).toContain('<h1>Titre long</h1>');
        expect(html).toContain('Publié le 7 juillet 2026 - Lexenegal</p>');
        expect(html).toContain('<div class="ssr-guide-body"><p>Corps</p></div>');
        expect(html).toContain('<h3>Question ?</h3><p>Réponse.</p>');
        expect(html).toContain('href="/jurisprudence/theme/licenciement"');
        expect(html).toContain('Lexenegal, la mémoire juridique du Sénégal.');
    });
});

describe('codes (rendu serveur habillé)', () => {
    const textes = [
        { slug: 'code-du-travail', title: 'Code du travail', short_title: 'Code du travail', category: 'code', branche_slug: 'travail' },
        { slug: 'code-du-sport', title: 'Code du sport', short_title: null, category: 'code', branche_slug: null },
        { slug: 'loi-2020-01', title: 'Loi n° 2020-01', short_title: null, category: 'loi', branche_slug: 'travail' },
    ];
    const branches = [
        { slug: 'travail', label: 'Travail & Protection sociale', icon: 'Briefcase', color: '#047857', description: 'Relations de travail', ordre: 1 },
        { slug: 'mines', label: 'Mines', icon: 'Pickaxe', color: 'red;}', description: null, ordre: 2 },
        { slug: 'autres', label: 'Autres', icon: 'FolderOpen', color: '#6B7280', description: null, ordre: 99 },
    ];
    it('chaque texte garde exactement un lien, h1 conservé, grille des branches comme la page React', async () => {
        const { buildCodesBody } = await charger('render.js');
        const html = buildCodesBody(textes, branches, { 'code-du-travail': 410 });
        expect(html).toContain('<h1>Tous les codes et textes juridiques du Sénégal</h1>');
        for (const t of textes) expect(html.split(`href="/code/${t.slug}"`).length - 1).toBe(1);
        // Titre et nombre d'articles séparés : ancre « Code du travail 410 art. » (05/10/2026).
        expect(html).toContain('<span>Code du travail</span> <span class="ssr-codes-n">410 art.</span>');
        const ancre = /<a href="\/code\/code-du-travail">([\s\S]*?)<\/a>/.exec(html)![1].replace(/<[^>]+>/g, '');
        expect(ancre).toBe('Code du travail 410 art.');
        expect(html).toContain('<h2>Travail &amp; Protection sociale</h2>');
        expect(html).toContain('<span>Prochainement</span>');
        expect(html).not.toContain('<h2>Autres</h2>');
        expect(html).not.toContain('red;}'); // couleur hors format : couleur par défaut
        expect(html).toContain('<h2>Codes</h2><ul><li><a href="/code/code-du-sport">Code du sport</a></li></ul>');
    });
    it('sans branches (requête en échec) : pas de grille, tous les codes dans l\'index', async () => {
        const { buildCodesBody } = await charger('render.js');
        const html = buildCodesBody(textes, [], null);
        expect(html).not.toContain('ssr-codes-grille');
        expect(html).toContain('<li><a href="/code/code-du-travail">Code du travail</a></li>');
    });
});

describe('doctrine (rendu serveur habillé)', () => {
    it('garde les libellés de l\'ancienne fiche et le retour vers la doctrine fiscale', async () => {
        const { buildDoctrineBody } = await charger('render.js');
        const html = buildDoctrineBody({ numero: '329', date: '2012-07-24', objet: 'votre recours', reference_complete: 'N° 329 DGID', service_emetteur: 'DGID/DLEC', destinataire: 'Madame', signataire: 'A. BA', extrait: null });
        expect(html).toContain('<h1>votre recours</h1>');
        expect(html).toContain('href="/doctrine-fiscale"');
        expect(html).toContain('<li><strong>Référence :</strong> N° 329 DGID</li>');
        expect(html).toContain('<li><strong>Service émetteur :</strong> DGID/DLEC</li>');
        expect(html).toContain('<li><strong>Date :</strong> 24 juillet 2012</li>');
        expect(html).toContain('<div class="ssr-doctrine-actions" aria-hidden="true"><span></span><span></span></div>');
    });
    it('date absente : lue dans la référence comme formatDoctrineDate, sinon « Date inconnue »', async () => {
        const { dateDoctrineSsr } = await charger('render.js');
        expect(dateDoctrineSsr(null, 'N° 12 MEF/DGID du 18 septembre 2009')).toBe('18 septembre 2009');
        expect(dateDoctrineSsr(null, 'N° 225 MEF/DGID/DLEC/BRFS')).toBe('Date inconnue');
        expect(dateDoctrineSsr('2012-07-24', '')).toBe('24 juillet 2012');
    });
});
