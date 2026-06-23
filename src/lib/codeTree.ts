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

// Libellé des niveaux de structure (partagé : arbre, fil d'Ariane, en-têtes, cartes).
export const NODE_KIND: Record<string, string> = {
    partie: 'Partie', livre: 'Livre', titre: 'Titre', chapitre: 'Chapitre',
    section: 'Section', 'sous-section': 'Sous-section', paragraphe: 'Paragraphe', division: '',
};

const TYPE_WORDS = 'titre|chapitre|sous-section|section|paragraphe|partie|livre|division';

const ORDINALS: Record<string, string> = {
    premier: '1', premiere: '1', deuxieme: '2', second: '2', seconde: '2',
    troisieme: '3', quatrieme: '4', cinquieme: '5', sixieme: '6', septieme: '7',
    huitieme: '8', neuvieme: '9', dixieme: '10', onzieme: '11', douzieme: '12',
    treizieme: '13', quatorzieme: '14', quinzieme: '15', seizieme: '16',
    dixseptieme: '17', dixhuitieme: '18', dixneuvieme: '19', vingtieme: '20',
};

const deburr = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const titleWord = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();

function romanToInt(s: string): number {
    const map: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    const u = s.toUpperCase();
    if (!/^[IVXLCDM]+$/.test(u)) return 0;
    let total = 0;
    for (let i = 0; i < u.length; i++) {
        const cur = map[u[i]], next = map[u[i + 1]] || 0;
        total += cur < next ? -cur : cur;
    }
    return total;
}

// Convertit un jeton de numérotation (romain, ordinal en lettres, arabe, + suffixe
// bis/ter) en chiffre arabe — ou null si ce n'est pas un numéro (ex. « Législative »).
function numToArabicOrNull(token: string): string | null {
    const t = (token || '').trim();
    const suf = t.match(/\b(bis|ter|quater|quinquies)\b/i);
    const suffix = suf ? ' ' + suf[1].toLowerCase() : '';
    const core = t.replace(/\b(bis|ter|quater|quinquies)\b/ig, '').trim();
    if (/^[0-9]+$/.test(core)) return core + suffix;
    if (ORDINALS[deburr(core)]) return ORDINALS[deburr(core)] + suffix;
    const r = romanToInt(core);
    if (r > 0) return String(r) + suffix;
    return null;
}

/**
 * Formatage UNIFORME d'un nœud de structure → { badge, label } (cf. étude
 * `pages/Analyse-Normalisation-Structure-Nodes.md`). Gère les 3 formes de données :
 *  1) numero rempli + intitulé propre ;
 *  2) intitulé « TITRE II - … » (mot du niveau + chiffre collés) ;
 *  3) intitulé abîmé « DEUXIEME [PARTIE] … » (ordinal collé, mot du niveau parfois perdu).
 * Le mot du niveau vient de `type` (fiable) ; le numéro de `numero` ou du préfixe
 * de l'intitulé, converti en chiffre arabe pour un badge uniforme (« Titre 2 », « Livre 2 »).
 */
export function formatNodeLabel(
    n: { type: string; numero?: string | null; intitule?: string | null; name?: string }
): { badge: string; label: string } {
    let kind = NODE_KIND[n.type] ?? n.type;
    let num = (n.numero || '').trim();
    let label = (n.intitule || n.name || '').trim();
    let stripped = false;

    // Forme 2 : « TYPE <jeton> [séparateur] reste » — jeton = chiffre / romain / ordinal.
    // Deux variantes : avec séparateur (« TITRE II - … », « CHAPITRE V : … ») ou simple espace.
    const mType =
        label.match(new RegExp(`^\\s*(${TYPE_WORDS})\\s+(\\S+?)(\\s+(?:bis|ter|quater))?\\s*[)\\].:°—–-]+\\s*(.*)$`, 'i'))
        || label.match(new RegExp(`^\\s*(${TYPE_WORDS})\\s+(\\S+?)(\\s+(?:bis|ter|quater))?\\s+(.*)$`, 'i'));
    if (mType && numToArabicOrNull((mType[2] + (mType[3] || '')).trim())) {
        kind = NODE_KIND[deburr(mType[1])] ?? titleWord(mType[1]);
        if (!num || !numToArabicOrNull(num)) num = (mType[2] + (mType[3] || '')).trim();
        label = (mType[4] || '').trim();
        stripped = true;
    }

    // Forme 3 : « ORDINAL [TYPE] reste » (intitulé abîmé : ordinal collé, type parfois perdu).
    if (!stripped) {
        const mOrd = label.match(/^\s*([A-Za-zÀ-ÿ]+)\s*(.*)$/);
        if (mOrd && ORDINALS[deburr(mOrd[1])]) {
            if (!num || !numToArabicOrNull(num)) num = mOrd[1];
            let rest = (mOrd[2] || '').trim();
            const mt = rest.match(new RegExp(`^(${TYPE_WORDS})\\b\\s*[)\\].:°—–-]*\\s*(.*)$`, 'i'));
            if (mt) { kind = NODE_KIND[deburr(mt[1])] ?? titleWord(mt[1]); rest = (mt[2] || '').trim(); }
            label = rest;
        }
    }

    // Badge : « Kind N » seulement si N est un vrai numéro (sinon on évite « Partie Législative »).
    const arab = numToArabicOrNull(num);
    let badge = '';
    if (kind && arab) badge = `${kind} ${arab}`;
    else if (kind) {
        const hasKind = new RegExp(`\\b${kind}\\b`, 'i').test(label) || /\bPARTIE\b/i.test(label);
        badge = hasKind ? '' : kind;
    }
    return { badge, label };
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
