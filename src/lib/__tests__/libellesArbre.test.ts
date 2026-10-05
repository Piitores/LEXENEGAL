import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createElement as h } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import CodeNavTree from '../../components/CodeNavTree/CodeNavTree';
import { buildTreeFromNodes, NODE_KIND } from '../codeTree';

/*
 * Arbre du plan : le type affiché est le SEUL badge de formatNodeLabel, à l'identique côté React
 * (CodeNavTree, cartes de structure de CodePage) et côté serveur (api/render.js, arbreHtmlSsr).
 * Relecture finale (05/10/2026) : un repli `badge || NODE_KIND[type] || type` réintroduisait le type
 * brut « DIVISION » (86 nœuds sans numéro, dont l'arrêté 974 de 1968) et les doublons « PRÉAMBULE
 * Préambule » (56) et « PROMULGATION Promulgation » (41).
 */
const charger = (fichier: string): Promise<any> =>
    import(/* @vite-ignore */ decodeURIComponent(new URL(`../../../api/${fichier}`, import.meta.url).pathname));
const source = (chemin: string) => readFileSync(decodeURIComponent(new URL(`../../${chemin}`, import.meta.url).pathname), 'utf8');

// Cas types (formes réelles de structure_nodes, relevées le 05/10/2026), tous à la racine.
const CAS = [
    { type: 'division', numero: null, intitule: 'Dispositif', label: 'Dispositif' },
    { type: 'division', numero: null, intitule: 'MARIAGE ET FAMILLE', label: 'MARIAGE ET FAMILLE' },
    { type: 'preambule', numero: null, intitule: 'Préambule', label: 'Préambule' },
    { type: 'promulgation', numero: null, intitule: 'Promulgation', label: 'Promulgation' },
    { type: 'division', numero: 'IV', intitule: 'MUTATION', label: 'IV - MUTATION' },
    { type: 'annexe', numero: '5', intitule: 'EQUIVALENCE DES HORAIRES', label: '5 - EQUIVALENCE DES HORAIRES' },
    { type: 'sous_section', numero: '3', intitule: 'LIEU DE VERIFICATION', label: 'Sous-section 3 - LIEU DE VERIFICATION' },
    { type: 'point-lettre', numero: 'A', intitule: 'Limites du domaine public maritime', label: 'A / Limites' },
    { type: 'sous-chapitre', numero: '', intitule: 'DISPOSITIONS COMMUNES', label: 'DISPOSITIONS COMMUNES' },
    { type: 'chapitre', numero: null, intitule: 'Chapitre unique', label: 'Chapitre unique' },
    { type: 'titre', numero: 'TITRE PREMIER', intitule: 'DES OFFRES DE PAIEMENT', label: 'TITRE PREMIER - DES OFFRES' },
    { type: 'section', numero: '4', intitule: '', label: 'SECTION 4' },
    // Annexes (contrôle du 06/10/2026) : « Annexe / Annexes » et « Annexe I / ANNEXE I : … » affichaient le mot deux fois.
    { type: 'annexe', numero: null, intitule: 'Annexes', label: 'Annexes' },
    { type: 'annexe', numero: 'I', intitule: 'ANNEXE I : CLASSIFICATION PROFESSIONNELLE', label: 'ANNEXE I : CLASSIFICATION PROFESSIONNELLE' },
    { type: 'annexe', numero: null, intitule: 'ADDITIF A L’ANNEXE II', label: 'ADDITIF A L’ANNEXE II' },
].map((n, i) => ({ ...n, id: `n${i}`, code_id: 'X', parent_id: null, position: i + 1 }));

const TYPES_BRUTS = Object.keys(NODE_KIND);
const texte = (html: string) => html.replace(/<[^>]+>/g, '').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, '&');

/** [type affiché, intitulé affiché] de chaque nœud, lus dans le HTML d'un arbre. */
function lireArbre(html: string, classeType: string, classeNom: string): Array<[string, string]> {
    const re = new RegExp(`<span class="${classeType}">([\\s\\S]*?)</span>\\s*<span class="${classeNom}"[^>]*>([\\s\\S]*?)</span>`, 'g');
    return [...html.matchAll(re)].map((m) => [texte(m[1]), texte(m[2])]);
}

describe('arbre du plan : aucun type brut, à l’identique des deux côtés', () => {
    it('React (CodeNavTree) et serveur (arbreHtmlSsr) affichent les mêmes libellés', async () => {
        const api = await charger('render.js');
        // MemoryRouter avertit (useLayoutEffect sans navigateur) : sans objet ici.
        const espion = vi.spyOn(console, 'error').mockImplementation(() => {});
        const react = renderToStaticMarkup(h(MemoryRouter, null, h(CodeNavTree, {
            nodes: buildTreeFromNodes(CAS as any, []), slug: 'code-x', expandedNodes: new Set<string>(),
            onToggle: () => {}, onSelect: () => {},
        })));
        espion.mockRestore();
        const serveur = api.arbreHtmlSsr({ slug: 'code-x' }, { slug: 'zz', node_id: null }, CAS, []);
        const r = lireArbre(react, 'node-type', 'node-name');
        const s = lireArbre(serveur, 'ssr-ty', 'ssr-tm');
        expect(r).toHaveLength(CAS.length);
        expect(s).toEqual(r);
    });

    it('aucun type brut affiché, aucun doublon « Préambule Préambule »', async () => {
        const api = await charger('render.js');
        const s: Array<[string, string]> = lireArbre(api.arbreHtmlSsr({ slug: 'code-x' }, { slug: 'zz', node_id: null }, CAS, []), 'ssr-ty', 'ssr-tm');
        const attendu: Array<[string, string]> = [
            ['', 'Dispositif'], ['', 'MARIAGE ET FAMILLE'], ['', 'Préambule'], ['', 'Promulgation'], ['IV', 'MUTATION'],
            ['Annexe 5', 'EQUIVALENCE DES HORAIRES'], ['Sous-section 3', 'LIEU DE VERIFICATION'], ['Point A', 'Limites du domaine public maritime'],
            ['Sous-chapitre', 'DISPOSITIONS COMMUNES'], ['', 'Chapitre unique'], ['Titre PREMIER', 'DES OFFRES DE PAIEMENT'], ['Section 4', ''],
            ['', 'Annexes'], ['Annexe I', 'CLASSIFICATION PROFESSIONNELLE'], ['', 'ADDITIF A L’ANNEXE II'],
        ];
        expect(s).toEqual(attendu);
        for (const [type, nom] of s) {
            expect(TYPES_BRUTS, type).not.toContain(type);
            const mot = type.split(' ')[0].toLowerCase();
            if (mot) expect(nom.toLowerCase().startsWith(mot), `${type} ${nom}`).toBe(false);
        }
    });

    it('orphelins regroupés (« Autres dispositions ») : plus de « division » affiché', async () => {
        const api = await charger('render.js');
        const html = api.arbreHtmlSsr({ slug: 'code-x' }, { slug: 'zz', node_id: null }, CAS.slice(0, 1), [
            { id: 'a', slug: 'a', node_id: null, display_order: 1, num: 'Article 1', num_court: null, article_number: '1', status: 'validated', is_active: true, tags: null },
        ]);
        expect(html).toContain('<span class="ssr-ty"></span> <span class="ssr-tm">Autres dispositions</span>');
        expect(html).not.toMatch(/class="ssr-ty">division</);
    });

    it('les trois arbres n’ont plus de repli sur le type (CodeNavTree, cartes de CodePage, render.js)', () => {
        expect(source('components/CodeNavTree/CodeNavTree.tsx')).toMatch(/<span className="node-type">\{badge\}<\/span>/);
        expect(source('pages/Code/CodePage.tsx')).toMatch(/<div className="sc-type">\{scBadge\}<\/div>/);
        const render = readFileSync(decodeURIComponent(new URL('../../../api/render.js', import.meta.url).pathname), 'utf8');
        expect(render).toMatch(/<span class="ssr-ty">\$\{esc\(badge\)\}<\/span>/);
        for (const s of [source('components/CodeNavTree/CodeNavTree.tsx'), source('pages/Code/CodePage.tsx'), render]) {
            expect(s).not.toMatch(/(?:badge|scBadge) \|\| NODE_KIND/);
        }
    });

    it('« Emplacement dans le code » (ArticlePage) : une espace entre le badge et l’intitulé, comme le serveur', () => {
        // Relecture « contenu » : « Livre IIIPROCEDURES… » dans le texte de la page React.
        expect(source('pages/Code/ArticlePage.tsx')).toMatch(/<span className=\{`ah-badge ah-badge--\$\{n\.type\}`\}>\{badge\}<\/span>\{' '\}<\/>\}/);
    });
});
