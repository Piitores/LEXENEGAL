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
    status?: string | null;
    is_active?: boolean;
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
    // Sous-division LETTRÉE, sans mot-clé dans la source : « A / Limites du domaine public
    // maritime » (Code de la Marine Marchande), « A. Exceptions au droit de communication
    // au public » (loi 2008-09). Sans cette entrée, le badge affichait le type brut
    // « POINT-LETTRE » et perdait la lettre.
    'point-lettre': 'Point',
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
 * Le mot du niveau vient de `type` (fiable) ; le numéro de `numero` ou du préfixe de
 * l'intitulé, et il est affiché TEL QUEL — « Titre II », « Chapitre premier », « Point A ».
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

    // Forme 4 : la division n'a PAS DE TITRE dans la source. `intitule` étant vide, on
    // retombe sur le libellé, qui ne répète alors que le type et/ou le numéro. Sans ce cas,
    // le code de l'hygiène affichait « SECTION 4 » suivi de « 4 », et le CPC « LIVRE
    // PREMIER » en texte nu, sans badge, à côté de ses frères « LIVRE II ».
    // ⛔ Deux garde-fous, parce qu'un titre d'un seul mot ne doit JAMAIS être avalé :
    //   - avec un mot de niveau devant (« LIVRE PREMIER »), le jeton doit être un vrai
    //     numéro — sinon « Chapitre unique » perdrait son « unique » ;
    //   - sans mot de niveau, le jeton doit être un vrai numéro ET être EXACTEMENT celui
    //     déjà connu (« 4 » pour la section 4) — sinon un nœud dont le numéro et
    //     l'intitulé valent tous deux « Signature » se retrouverait sans texte, et une
    //     section intitulée « CIVIL », dont toutes les lettres sont des chiffres romains,
    //     passerait pour un numéro.
    if (!stripped) {
        const m4 = label.match(
            new RegExp(`^\\s*(?:(${TYPE_WORDS})\\s*[.:°)\\]-]*\\s*)?([A-Za-zÀ-ÿ0-9]+)?\\s*$`, 'i'));
        if (m4) {
            const jeton = (m4[2] || '').trim();
            const estNum = !!jeton && (!!numToArabicOrNull(jeton) || /^[A-Za-z]$/.test(jeton));
            const memeQueNum = !!jeton && !!num && deburr(jeton) === deburr(num);
            if ((m4[1] && (estNum || !jeton)) || (memeQueNum && estNum)) {
                if (m4[1]) kind = NODE_KIND[deburr(m4[1])] ?? titleWord(m4[1]);
                // ⚠️ `numero` porte parfois la CHAÎNE ENTIÈRE (« LIVRE PREMIER ») : elle
                // n'est pas un numéro, il faut la remplacer par le jeton, sinon le badge
                // retombe sur le seul mot de niveau et le numéro DISPARAÎT.
                if (jeton && (!num || !numToArabicOrNull(num))) num = jeton;
                label = '';                  // il ne dirait rien de plus que le badge
            }
        }
    }

    // Badge : « Kind N » seulement si N est un vrai numéro (sinon on évite « Partie Législative »).
    // ⛔ ON AFFICHE LE NUMÉRO DE LA SOURCE, PAS SA CONVERSION. `numToArabicOrNull` ne sert
    // plus qu'à répondre « est-ce bien un numéro ? ». Signalé par le proprio le 2026-09-06 :
    // le Journal officiel écrit « PARAGRAPHE PREMIER » et « TITRE II », le site affichait
    // « Paragraphe 1 » et « Titre 2 » — une réécriture du texte, sur tous les codes.
    // Une lettre est aussi un numéro valide (« A / Limites du domaine public maritime » du
    // Code de la Marine Marchande, « A. Exceptions… » de la loi 2008-09 sur le droit
    // d'auteur) : sans ce cas, le badge tombait sur le repli et la LETTRE disparaissait.
    // Les romains I, V et X passent par `arab`, qui est non nul pour eux — donc inchangés.
    const arab = numToArabicOrNull(num);
    const lettre = /^[A-Za-z]$/.test(num);
    let badge = '';
    if (kind && (arab || lettre)) badge = `${kind} ${num}`;
    else if (kind) {
        const hasKind = new RegExp(`\\b${kind}\\b`, 'i').test(label) || /\bPARTIE\b/i.test(label);
        badge = hasKind ? '' : kind;
    }
    return { badge, label };
}

// Arbre depuis structure_nodes (parent_id + ordre des nœuds déjà trié par `position`).
// Préambule : rendu à part (en tête de page), donc jamais dans l'arbre.
// Le libellé est toléré préfixé (« Article Préambule », « Art. Préambule ») : 27 entrées CIMA
// étaient formées ainsi et n'étaient reconnues NI comme préambule NI comme article rattaché.
// Les données ont été alignées, ce test reste comme filet.
const RE_PREAMBULE = /^\s*(?:articles?\s+|art\.\s*)?pr[ée]ambule\s*$/i;
export const isPreambule = (art: Article): boolean =>
    !!art.tags?.includes('preambule') ||
    RE_PREAMBULE.test(art.num || '') ||
    RE_PREAMBULE.test(art.num_court || '');

// Identifiant du nœud de repli. Sert de garde-fou : un article dont le node_id est
// absent (ou pointe vers un nœud inexistant) n'appartient à aucune division et serait
// donc AFFICHÉ NULLE PART - panne silencieuse, sans erreur. On le regroupe ici plutôt
// que de le perdre. Voir aussi la règle : masquer/omettre = mesurer ce qu'on rend
// inatteignable.
export const NOEUD_ORPHELINS = '__sans-division';

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

    const orphelins: Article[] = [];
    for (const art of arts) {
        if (art.node_id && map.has(art.node_id)) {
            map.get(art.node_id)!.articles.push(art);
        } else if (!isPreambule(art)) {
            orphelins.push(art);
        }
    }

    // Garde-fou : ces articles existent, sont en vigueur et sortent dans la recherche,
    // mais aucune division ne les porte. Plutôt que de les laisser hors de l'arbre (donc
    // introuvables en navigation), on les regroupe dans un nœud de repli, placé selon
    // leur rang de lecture : en tête s'ils précèdent tout le reste, sinon en fin.
    if (orphelins.length > 0) {
        orphelins.sort((a, b) => a.display_order - b.display_order);
        const noeud: HierarchyNode = {
            id: NOEUD_ORPHELINS,
            name: 'Autres dispositions',
            type: 'division',
            numero: null,
            intitule: 'Autres dispositions',
            note: null,
            articles: orphelins,
            children: [],
        };
        const rangsRattaches = arts
            .filter(a => a.node_id && map.has(a.node_id))
            .map(a => a.display_order);
        const avantTout = rangsRattaches.length > 0 &&
            orphelins[orphelins.length - 1].display_order < Math.min(...rangsRattaches);
        if (avantTout) root.unshift(noeud);
        else root.push(noeud);
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
