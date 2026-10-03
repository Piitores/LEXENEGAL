import { describe, it, expect } from 'vitest';
import { buildTreeFromNodes, getArticlesForNode, segmentsNoeud, Article, StructureNode } from '../codeTree';

const art = (num: number, node_id: string): Article => ({
    id: `a${num}`, part_title: '', title_name: '', chapter_name: '', section_name: '',
    article_number: String(num), slug: `art-${num}`, display_order: num * 10, node_id,
    num: `Article ${num}`, num_court: `Art. ${num}`, content_raw: '', content_html: '',
    modifications: null, tags: null, created_at: null, updated_at: null,
});
const noeud = (id: string, type: string, parent_id: string | null, position: number): StructureNode => ({
    id, code_id: 'c', type, numero: null, intitule: id, label: id, parent_id, position,
});

describe('ordre de lecture d’un nœud (articles rattachés au chapitre + sections)', () => {
    // Code de l'électricité, chapitre III : l'art. 13 précède la section première.
    const nodes = [
        noeud('ch3', 'chapitre', null, 0),
        noeud('s1', 'section', 'ch3', 1),
        noeud('s2', 'section', 'ch3', 2),
    ];
    const arts = [art(13, 'ch3'), art(14, 's1'), art(15, 's1'), art(29, 's2'), art(30, 's2')];
    const [ch3] = buildTreeFromNodes(nodes, arts);

    it('l’article du chapitre s’affiche AVANT les sections', () => {
        const segs = segmentsNoeud(ch3);
        expect(segs.map(s => s.kind)).toEqual(['articles', 'divisions']);
        expect(segs[0].kind === 'articles' && segs[0].articles.map(a => a.article_number)).toEqual(['13']);
    });

    it('la lecture de la division suit les rangs', () => {
        expect(getArticlesForNode(ch3).map(a => a.article_number)).toEqual(['13', '14', '15', '29', '30']);
    });

    it('un article du chapitre placé APRÈS ses sections reste en fin', () => {
        const [ch] = buildTreeFromNodes(nodes, [art(14, 's1'), art(29, 's2'), art(40, 'ch3')]);
        expect(segmentsNoeud(ch).map(s => s.kind)).toEqual(['divisions', 'articles']);
        expect(getArticlesForNode(ch).map(a => a.article_number)).toEqual(['14', '29', '40']);
    });

    it('un article ENTRE deux sections s’intercale', () => {
        const [ch] = buildTreeFromNodes(nodes, [art(14, 's1'), art(20, 'ch3'), art(29, 's2')]);
        expect(segmentsNoeud(ch).map(s => s.kind)).toEqual(['divisions', 'articles', 'divisions']);
        expect(getArticlesForNode(ch).map(a => a.article_number)).toEqual(['14', '20', '29']);
    });

    it('une section vide reste collée à la précédente et garde l’ordre des positions', () => {
        const ns = [...nodes, noeud('s3', 'section', 'ch3', 3)];
        const [ch] = buildTreeFromNodes(ns, [art(14, 's1'), art(29, 's2')]);
        const segs = segmentsNoeud(ch);
        expect(segs).toHaveLength(1);
        expect(segs[0].kind === 'divisions' && segs[0].nodes.map(n => n.id)).toEqual(['s1', 's2', 's3']);
    });

    it('cas courant inchangé : articles seuls, ou sections seules', () => {
        const [ch] = buildTreeFromNodes([noeud('ch', 'chapitre', null, 0)], [art(1, 'ch'), art(2, 'ch')]);
        expect(segmentsNoeud(ch).map(s => s.kind)).toEqual(['articles']);
        expect(getArticlesForNode(ch).map(a => a.article_number)).toEqual(['1', '2']);
    });
});
