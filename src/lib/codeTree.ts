// Construction et navigation de l'arbre d'un code (partagé entre CodePage et ArticlePage).
// Fonctions PURES (aucun état React) extraites de CodePage.tsx — comportement inchangé.

export interface Law {
    id: string;
    title: string;
    slug: string;
    reference: string;
    category: string;
    short_title?: string | null;
    publication_date?: string | null;
    description?: string | null;
    abrogation_note?: string | null;
    abrogated_by_slug?: string | null;
}

export interface Article {
    id: string;
    part_title: string;
    title_name: string;
    chapter_name: string;
    section_name: string;
    article_number: string;
    slug: string;
    display_order: number;
    node_id: string | null;
    num: string | null;
    num_court: string | null;
    content_raw: string | null;
    content_html: string | null;
    modifications: string[] | null;
    tags: string[] | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface StructureNode {
    id: string;
    code_id: string;
    type: string;
    numero: string | null;
    intitule: string | null;
    label: string;
    parent_id: string | null;
    position: number;
    note?: string | null;
}

export interface HierarchyNode {
    id: string;
    name: string;
    type: string;
    numero: string | null;
    intitule: string | null;
    note?: string | null;
    articles: Article[];
    children: HierarchyNode[];
}

// Arbre depuis structure_nodes (parent_id + ordre des nœuds déjà trié par `position`).
export const buildTreeFromNodes = (nodes: StructureNode[], arts: Article[]): HierarchyNode[] => {
    const map = new Map<string, HierarchyNode>();
    const root: HierarchyNode[] = [];

    for (const nd of nodes) {
        map.set(nd.id, {
            id: nd.id,
            name: nd.label,
            type: nd.type,
            numero: nd.numero,
            intitule: nd.intitule,
            note: nd.note ?? null,
            articles: [],
            children: []
        });
    }

    for (const nd of nodes) {
        const hNode = map.get(nd.id)!;
        if (nd.parent_id && map.has(nd.parent_id)) {
            map.get(nd.parent_id)!.children.push(hNode);
        } else {
            root.push(hNode);
        }
    }

    for (const art of arts) {
        if (art.node_id && map.has(art.node_id)) {
            map.get(art.node_id)!.articles.push(art);
        }
    }

    return root;
};

// Fallback (codes sans structure_nodes) : reconstruit depuis les champs de l'article.
export const buildTreeLegacy = (arts: Article[]): HierarchyNode[] => {
    const root: HierarchyNode[] = [];

    arts.forEach(art => {
        const partName = art.part_title || 'Dispositions';
        let partNode = root.find(n => n.name === partName);
        if (!partNode) {
            partNode = { id: partName, name: partName, type: 'partie', numero: null, intitule: partName, articles: [], children: [] };
            root.push(partNode);
        }

        if (art.title_name) {
            let titleNode = partNode.children.find(n => n.name === art.title_name);
            if (!titleNode) {
                titleNode = { id: art.title_name, name: art.title_name, type: 'titre', numero: null, intitule: art.title_name, articles: [], children: [] };
                partNode.children.push(titleNode);
            }

            if (art.chapter_name) {
                let chNode = titleNode.children.find(n => n.name === art.chapter_name);
                if (!chNode) {
                    chNode = { id: art.chapter_name, name: art.chapter_name, type: 'chapitre', numero: null, intitule: art.chapter_name, articles: [], children: [] };
                    titleNode.children.push(chNode);
                }
                chNode.articles.push(art);
            } else {
                titleNode.articles.push(art);
            }
        } else {
            partNode.articles.push(art);
        }
    });

    return root;
};

// Nombre d'articles d'un nœud (récursif).
export const countArticles = (node: HierarchyNode): number => {
    let c = node.articles.length;
    node.children.forEach(ch => { c += countArticles(ch); });
    return c;
};

// Tous les articles sous un nœud (récursif, dans l'ordre de l'arbre).
export const getArticlesForNode = (node: HierarchyNode): Article[] => {
    const result: Article[] = [...node.articles];
    node.children.forEach(ch => result.push(...getArticlesForNode(ch)));
    return result;
};

// Chemin (racine → nœud cible) ou null.
export const getBreadcrumb = (
    targetId: string,
    nodes: HierarchyNode[],
    path: HierarchyNode[] = []
): HierarchyNode[] | null => {
    for (const node of nodes) {
        const newPath = [...path, node];
        if (node.id === targetId) return newPath;
        const found = getBreadcrumb(targetId, node.children, newPath);
        if (found) return found;
    }
    return null;
};

// Tous les ids de nœuds (pour « tout déplier »).
export const collectAllNodeIds = (nodes: HierarchyNode[]): string[] => {
    const ids: string[] = [];
    nodes.forEach(n => { ids.push(n.id); ids.push(...collectAllNodeIds(n.children)); });
    return ids;
};

// Max d'articles sur un niveau (pour la barre de densité).
export const computeMaxArticlesInLevel = (nodes: HierarchyNode[]): number => {
    let max = 0;
    const walk = (ns: HierarchyNode[]) => {
        ns.forEach(n => {
            const c = countArticles(n);
            if (c > max) max = c;
            walk(n.children);
        });
    };
    walk(nodes);
    return max || 1;
};
