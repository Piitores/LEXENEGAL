import { describe, it, expect } from 'vitest';
import { formatNodeLabel, isPreambule, type Article } from '../codeTree';

/*
 * Version serveur de la page d'un texte habillée comme la page React prête (api/render.js, 05/10/2026).
 * Le libellé des divisions (formatNodeLabel) et le critère du préambule (isPreambule) y sont RECOPIÉS :
 * une fonction Vercel ne peut pas importer un module TypeScript. Une divergence ferait changer le fil et
 * le titre de la division au moment où React remplace la version serveur.
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));

const NOEUDS = [
    { type: 'titre', numero: 'II', intitule: 'Des personnes' },
    { type: 'titre', numero: null, intitule: 'TITRE II - DES PERSONNES' },
    { type: 'chapitre', numero: null, intitule: 'CHAPITRE V : Des sanctions' },
    { type: 'chapitre', numero: null, intitule: 'Chapitre premier - Dispositions générales' },
    { type: 'livre', numero: null, intitule: 'DEUXIEME EFFETS DES OBLIGATIONS' },
    { type: 'partie', numero: null, intitule: 'DEUXIEME PARTIE DISPOSITIONS FINALES' },
    { type: 'livre', numero: 'LIVRE PREMIER', intitule: 'LIVRE PREMIER' },
    { type: 'section', numero: '4', intitule: '4' },
    { type: 'chapitre', numero: null, intitule: 'Chapitre unique' },
    { type: 'division', numero: 'Signature', intitule: 'Signature' },
    { type: 'section', numero: null, intitule: 'CIVIL' },
    { type: 'point-lettre', numero: 'A', intitule: 'A / Limites du domaine public maritime' },
    { type: 'partie', numero: null, intitule: 'LEGISLATIVE' },
    { type: 'preambule', numero: null, intitule: 'Préambule' },
    { type: 'livre', numero: null, intitule: 'DISPOSITIONS PRÉLIMINAIRES' },
    { type: 'titre', numero: 'premier', intitule: 'Dispositions générales' },
    { type: 'sous-section', numero: '2 bis', intitule: 'Du contrôle' },
    { type: 'division', numero: null, intitule: 'Autres dispositions', name: 'Autres dispositions' },
    { type: 'partie', numero: null, intitule: 'Dispositions', name: 'Dispositions' },
    { type: 'titre', numero: null, intitule: null, name: 'TITRE III' },
];

describe('version serveur de la page d’un texte : copies identiques à React', () => {
    it('formatNodeLabel', async () => {
        const { formatNodeLabelSsr } = await charger('render.js');
        for (const n of NOEUDS) expect({ n, r: formatNodeLabelSsr(n) }).toEqual({ n, r: formatNodeLabel(n) });
    });
    it('isPreambule', async () => {
        const { estPreambuleSsr } = await charger('render.js');
        const cas = [{ num: 'Préambule' }, { num: 'Article Préambule' }, { num_court: 'Art. préambule' }, { tags: ['preambule'] },
            { num: 'Article premier' }, { num: 'Préambule et visas' }, {}];
        for (const a of cas) expect({ a, r: estPreambuleSsr(a) }).toEqual({ a, r: isPreambule(a as unknown as Article) });
    });
});

describe('division ouverte par défaut (divisionParDefautSsr)', () => {
    const art = (id: string, node_id: string | null, num = `Article ${id}`) => ({ id, slug: `art-${id}`, num, article_number: id, node_id });
    it('arbre : première racine dans l’ordre du plan, articles de tout son sous-arbre, préambules exclus', async () => {
        const { divisionParDefautSsr } = await charger('render.js');
        const plan = [{ id: 'L1', parent_id: null, type: 'livre' }, { id: 'C1', parent_id: 'L1', type: 'chapitre' },
            { id: 'L2', parent_id: null, type: 'livre' }, { id: 'C2', parent_id: 'L2', type: 'chapitre' }];
        const f = divisionParDefautSsr([art('p', 'L1', 'Préambule'), art('1', 'C1'), art('2', 'C1'), art('3', 'C2')], plan,
            { id: 'L1', type: 'livre', numero: null, intitule: 'LIVRE PREMIER - Des peines', label: 'x' });
        expect(f.articles).toBe(true);
        expect(f.liste.map((a: { id: string }) => a.id)).toEqual(['1', '2']);
        expect(f.puces.map((a: { id: string }) => a.id)).toEqual(['p']); // pastilles : rattachés en propre
        expect([f.racines, f.enfants, f.chapitres]).toEqual([2, 1, 2]);
        expect(f.noeud.intitule).toBe('LIVRE PREMIER - Des peines');
    });
    it('division du préambule seul : vide (message « Sélectionnez une sous-section »)', async () => {
        const { divisionParDefautSsr } = await charger('render.js');
        const plan = [{ id: 'P', parent_id: null, type: 'preambule' }, { id: 'T1', parent_id: null, type: 'titre' }];
        const f = divisionParDefautSsr([art('p', 'P', 'Préambule'), art('1', 'T1')], plan, { id: 'T1', type: 'titre' });
        expect(f.articles).toBe(false);
        expect(f.noeud).toBeNull(); // le libellé lu n'est pas celui de la première racine : emplacement
    });
    it('articles sans division placés avant tous les autres : « Autres dispositions » en tête', async () => {
        const { divisionParDefautSsr } = await charger('render.js');
        const f = divisionParDefautSsr([art('1', null), art('2', 'T1')], [{ id: 'T1', parent_id: null, type: 'titre' }]);
        expect(f.liste.map((a: { id: string }) => a.id)).toEqual(['1']);
        expect(f.noeud.intitule).toBe('Autres dispositions');
        expect(f.racines).toBe(2);
    });
    it('texte sans plan : une partie, celle du premier article', async () => {
        const { divisionParDefautSsr } = await charger('render.js');
        const f = divisionParDefautSsr([art('p', null, 'Préambule'), art('1', null)], [], null, { id: 'p', part_title: null });
        expect(f.liste.map((a: { id: string }) => a.id)).toEqual(['1']);
        expect(f.noeud).toEqual({ type: 'partie', numero: null, intitule: 'Dispositions', name: 'Dispositions' });
        expect([f.racines, f.enfants, f.chapitres, f.puces.length]).toEqual([1, 0, 0, 2]);
    });
    it('plan illisible : forme la plus courante, aucun libellé', async () => {
        const { divisionParDefautSsr } = await charger('render.js');
        expect(divisionParDefautSsr([art('1', 'x')], null)).toMatchObject({ articles: true, liste: null, noeud: null });
    });
});

describe('présentation du texte (copie de TextPresentation.tsx)', () => {
    it('pastilles et texte de repli', async () => {
        const { presentationTexteSsr } = await charger('render.js');
        const sans = presentationTexteSsr({ title: 'Convention X', category: 'convention_collective', publication_date: '2018-11-26' }, 76);
        expect(sans).toContain('<span class="ssr-tp__nature">Texte juridique</span><span class="ssr-tp__chip">Publié le 26 novembre 2018</span><span class="ssr-tp__chip">76 articles</span>');
        expect(sans).toContain('Convention X - texte intégral consolidé, à jour et structuré article par article, dans le corpus du droit sénégalais sur Lexenegal.</p>');
        // Description : pastille de la référence ; date tue quand la référence porte déjà l'année.
        const avec = presentationTexteSsr({ title: 'Code Pénal', category: 'code', reference: 'Loi n° 65-60 du 21 juillet 1965',
            publication_date: '1965-07-21', description: '<p>Texte.</p>' }, 1104);
        expect(avec).toContain('<span class="ssr-tp__nature">Code</span><span class="ssr-tp__chip">Loi n° 65-60 du 21 juillet 1965</span><span class="ssr-tp__chip">1 104 articles</span>');
        expect(avec).toContain('<h2 class="ssr-tp__label">Présentation</h2><div class="ssr-tp__body"><p>Texte.</p></div>');
        // Mention du Journal officiel : remplace la date.
        const jo = presentationTexteSsr({ title: 'D', category: 'decret', publication_date: '1966-12-31', jo_numero: '3868', jo_date: '1967-01-14', jo_page: 44 }, 0);
        expect(jo).toContain('<span class="ssr-tp__chip">Publié au Journal officiel n° 3868 du 14 janvier 1967, p. 44</span>');
        expect(jo).not.toContain('Publié le');
    });
});

describe('cartes des premiers articles', () => {
    it('rendues jusqu’au premier contenu absent, lien vers l’article', async () => {
        const { buildCodeBody } = await charger('render.js');
        const law = { slug: 'code-x', title: 'Code X', category: 'code' };
        const arts = [{ id: 'a1', slug: 'art-1', num: 'Article 1', node_id: 'T1' }, { id: 'a2', slug: 'art-2', num: 'Article 2', node_id: 'T1' },
            { id: 'a3', slug: 'art-3', num: 'Article 3', node_id: 'T1' }];
        const contenus = new Map([['a1', { id: 'a1', content_html: '<p class="alinea">Un.</p>', modifications: ['Loi n° 1'] }],
            ['a3', { id: 'a3', content_html: '<p>Trois.</p>' }]]);
        const html = buildCodeBody(law, arts, [], null, [{ id: 'T1', parent_id: null, type: 'titre' }], contenus,
            { id: 'T1', type: 'titre', numero: 'I', intitule: 'Dispositions générales', label: 'TITRE I' });
        expect(html).toContain('<span class="ssr-ac__date">Loi n° 1</span>');
        expect(html).toContain('<div class="ssr-ac__body"><div><p class="alinea">Un.</p></div></div>');
        expect(html).toContain('href="/code/code-x/art-1"');
        expect(html).not.toContain('Trois.'); // a2 sans contenu lu : on s'arrête
        expect(html).toContain('<span class="ssr-dv__crumb">Titre I - Dispositions générales</span>');
        expect(html).toContain('<div class="ssr-dv__compte">3 articles</div>');
        // Le contenu de référencement reste premier dans le DOM.
        expect(html.indexOf('<h1>')).toBeLessThan(html.indexOf('ssr-tp'));
    });
});
