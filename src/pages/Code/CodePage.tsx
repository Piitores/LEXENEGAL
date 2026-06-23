import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronRight, Search,
    BookOpen, FileText, ChevronDown, ExternalLink, Copy, Check
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO/SEO';
import CodeNavTree from '../../components/CodeNavTree/CodeNavTree';
import {
    Law, Article, HierarchyNode,
    buildTreeFromNodes, buildTreeLegacy, countArticles, getArticlesForNode,
    getBreadcrumb, collectAllNodeIds, computeMaxArticlesInLevel,
} from '../../lib/codeTree';
import { useCopyAttribution, attributionFooter, articleUrl } from '../../hooks/useCopyAttribution';
import './CodePage.css';
import '../../styles/legal-content.css';


// ── Helpers article ──

const isPreambule = (art: Article): boolean =>
    !!art.tags?.includes('preambule') ||
    art.num === 'Préambule' ||
    art.num_court === 'Préambule';

// Texte lisible pour le presse-papiers : on privilégie content_raw, sinon on
// dérive un texte propre depuis content_html (suppression des balises + décodage
// des entités courantes), précédé du numéro/intitulé de l'article.
const articleToPlainText = (art: Article): string => {
    const heading = art.num || (art.article_number ? `Article ${art.article_number}` : '');
    let body = (art.content_raw || '').trim();
    if (!body && art.content_html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = art.content_html;
        body = (tmp.textContent || tmp.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
    }
    return heading ? `${heading}\n\n${body}` : body;
};

// ── Carte d'un article (gère le repli du préambule + le bouton Copier) ──

const ArticleCard: React.FC<{ art: Article; slug: string | undefined; codeTitle?: string }> = ({ art, slug, codeTitle }) => {
    const preambule = isPreambule(art);
    // Préambule replié par défaut ; articles normaux toujours ouverts.
    const [open, setOpen] = useState(!preambule);
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            const ref = art.num || `Article ${art.article_number}`;
            const url = articleUrl(slug || '', art.slug);
            await navigator.clipboard.writeText(articleToPlainText(art) + attributionFooter(ref, codeTitle, url));
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            /* presse-papiers indisponible (contexte non sécurisé) : on ignore */
        }
    };

    const heading = art.num_court || art.num || `Art. ${art.article_number}`;

    return (
        <article
            className={`article-card ${preambule ? 'article-card--preambule' : ''}`}
            data-art-slug={art.slug}
            data-art-num={art.num || `Article ${art.article_number}`}
        >
            <div className="article-card-header">
                {preambule ? (
                    <button
                        type="button"
                        className="article-collapse-toggle"
                        onClick={() => setOpen(o => !o)}
                        aria-expanded={open}
                    >
                        <ChevronRight
                            size={15}
                            className={`collapse-chevron ${open ? 'is-open' : ''}`}
                        />
                        <span className="article-num">{heading}</span>
                    </button>
                ) : (
                    <span className="article-num">{heading}</span>
                )}

                <div className="article-card-header-right">
                    {art.modifications && art.modifications.length > 0 && (
                        <span className="article-date">
                            {art.modifications[art.modifications.length - 1]}
                        </span>
                    )}
                    <button
                        type="button"
                        className={`article-copy-btn ${copied ? 'is-copied' : ''}`}
                        onClick={handleCopy}
                        title="Copier le texte de l'article"
                        aria-label="Copier le texte de l'article"
                    >
                        {copied ? <Check size={13} /> : <Copy size={13} />}
                        <span>{copied ? 'Copié' : 'Copier'}</span>
                    </button>
                </div>
            </div>

            {open && (
                <>
                    <div className="article-body">
                        {art.content_html ? (
                            <div dangerouslySetInnerHTML={{ __html: art.content_html }} />
                        ) : (
                            art.content_raw || '(Contenu non disponible)'
                        )}
                    </div>

                    {art.tags && art.tags.length > 0 && (
                        <div className="article-tags">
                            {art.tags.map((tag, ti) => (
                                <span key={ti} className="article-tag">{tag}</span>
                            ))}
                        </div>
                    )}

                    <Link to={`/code/${slug}/${art.slug}`} className="article-link-btn">
                        <ExternalLink size={13} />
                        Voir l'article complet
                    </Link>
                </>
            )}
        </article>
    );
};

// ── Composant principal ──

const CodePage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();

    const [law, setLaw] = useState<Law | null>(null);
    const [articles, setArticles] = useState<Article[]>([]);
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    // Toute copie de texte d'un article emporte la référence LexeSenegal + le lien.
    useCopyAttribution(slug, law?.title);
    const [activeTab, setActiveTab] = useState<'articles' | 'structure'>('articles');

    // Stats
    const [totalArticles, setTotalArticles] = useState(0);
    const [totalChapters, setTotalChapters] = useState(0);

    // Refs pour la gestion du scroll (corrige le « saut au footer »)
    const sidebarRef = useRef<HTMLElement>(null);
    const activeNodeRef = useRef<HTMLButtonElement>(null);
    // Position de page à restaurer après un déplier/replier manuel de l'arbre
    // (évite que le navigateur « clampe » le défilement vers le footer).
    const preserveScrollY = useRef<number | null>(null);

    useEffect(() => {
        if (slug) fetchCodeData();
    }, [slug]);

    // À chaque changement de section : ramener la PAGE en haut APRÈS que le nouveau
    // contenu (potentiellement plus court) soit posé dans le DOM, mais AVANT le rendu
    // visuel — sinon la page raccourcit, le navigateur « clampe » le scroll vers le bas
    // et on atterrit au footer. En instantané, donc aucune frame « footer » n'est peinte.
    // On en profite pour amener le nœud actif dans la zone visible de l'arbre, SANS
    // bouger la page (on ne touche qu'au scroll interne de la sidebar).
    useLayoutEffect(() => {
        window.scrollTo(0, 0);
        const cont = sidebarRef.current;
        const el = activeNodeRef.current;
        if (cont && el) {
            const c = cont.getBoundingClientRect();
            const e = el.getBoundingClientRect();
            if (e.top < c.top) cont.scrollTop += e.top - c.top - 12;
            else if (e.bottom > c.bottom) cont.scrollTop += e.bottom - c.bottom + 12;
        }
    }, [selectedNode]);

    // Déplier/replier l'arbre ne doit PAS bouger la page : on restaure la position
    // mémorisée juste avant l'action (sinon le raccourcissement du contenu fait
    // « clamper » le défilement vers le footer).
    useLayoutEffect(() => {
        if (preserveScrollY.current != null) {
            window.scrollTo(0, preserveScrollY.current);
            preserveScrollY.current = null;
        }
    }, [expandedNodes]);

    // ── Data fetching ──

    const fetchCodeData = async () => {
        setLoading(true);
        try {
            const { data: lawData } = await supabase
                .from('laws_and_codes')
                .select('*')
                .eq('slug', slug)
                .single();

            if (!lawData) { setLoading(false); return; }
            setLaw(lawData);

            // Fetch articles
            const { data: articlesData } = await supabase
                .from('articles')
                .select('*')
                .eq('code_id', lawData.id)
                .order('display_order');

            const allArticles = articlesData || [];
            setArticles(allArticles);
            setTotalArticles(allArticles.length);

            // Fetch structure_nodes
            const { data: nodesData } = await supabase
                .from('structure_nodes')
                .select('*')
                .eq('code_id', lawData.id)
                .order('position');

            let tree: HierarchyNode[];
            if (nodesData && nodesData.length > 0) {
                tree = buildTreeFromNodes(nodesData, allArticles);
            } else {
                tree = buildTreeLegacy(allArticles);
            }

            setHierarchy(tree);

            // Stats
            let chapCount = 0;
            const countChapters = (nodes: HierarchyNode[]) => {
                nodes.forEach(n => {
                    if (n.type === 'chapitre' || n.type === 'chapter') chapCount++;
                    countChapters(n.children);
                });
            };
            countChapters(tree);
            setTotalChapters(chapCount);

            // Auto-select : division passée en ?node=<nom> (depuis le fil d'Ariane
            // d'un article), sinon le premier nœud.
            if (tree.length > 0) {
                const wanted = new URLSearchParams(window.location.search).get('node');
                let target: HierarchyNode | null = null;
                if (wanted) {
                    const decoded = decodeURIComponent(wanted);
                    const find = (nodes: HierarchyNode[]): HierarchyNode | null => {
                        for (const n of nodes) {
                            if (n.name === decoded || n.intitule === decoded) return n;
                            const f = find(n.children);
                            if (f) return f;
                        }
                        return null;
                    };
                    target = find(tree);
                }
                if (target) {
                    setSelectedNode(target);
                    const path = (getBreadcrumb(target.id, tree) || []).map(p => p.id);
                    setExpandedNodes(new Set([tree[0].id, ...path]));
                } else {
                    setSelectedNode(tree[0]);
                    setExpandedNodes(new Set([tree[0].id]));
                }
            }
        } catch (error) {
            console.error('Error fetching code:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── Helpers ──

    const maxArticlesInLevel = useMemo(() => computeMaxArticlesInLevel(hierarchy), [hierarchy]);

    // ── Actions ──

    const toggleNode = (nodeId: string) => {
        preserveScrollY.current = window.scrollY;
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeId)) next.delete(nodeId);
            else next.add(nodeId);
            return next;
        });
    };

    const selectNode = (node: HierarchyNode) => {
        setSelectedNode(node);
        // Onglet intelligent : si le nœud a des articles directs (ou est une feuille),
        // on ouvre « Articles » ; s'il n'a que des sous-divisions, on ouvre « Structure »
        // (évite un panneau « Articles » vide invitant à re-cliquer).
        setActiveTab(node.articles.length > 0 || node.children.length === 0 ? 'articles' : 'structure');
        // Déplie le chemin vers ce nœud ET le nœud lui-même (cliquer un titre l'ouvre).
        // Pour replier, on utilise le chevron.
        setExpandedNodes(prev => {
            const next = new Set(prev);
            const path = getBreadcrumb(node.id, hierarchy);
            if (path) path.forEach(p => next.add(p.id));
            if (node.children.length > 0) next.add(node.id);
            return next;
        });
        // (scroll géré par le useLayoutEffect sur selectedNode — voir plus haut)
    };

    const expandAll = () => { preserveScrollY.current = window.scrollY; setExpandedNodes(new Set(collectAllNodeIds(hierarchy))); };
    const collapseAll = () => { preserveScrollY.current = window.scrollY; setExpandedNodes(new Set()); };

    // ── Search ──

    const filteredArticles = useMemo(() => {
        if (searchQuery.length < 2) return null;
        const q = searchQuery.toLowerCase();
        return articles.filter(a =>
            a.article_number?.toLowerCase().includes(q) ||
            a.num?.toLowerCase().includes(q) ||
            a.content_raw?.toLowerCase().includes(q) ||
            a.chapter_name?.toLowerCase().includes(q) ||
            a.title_name?.toLowerCase().includes(q)
        );
    }, [searchQuery, articles]);

    // ── Render main panel articles ──

    // Préambule(s) : article(s) sans rattachement de chapitre (node_id = null),
    // donc absent(s) de l'arbre. On les affiche en tête de page, repliés par défaut
    // (ArticleCard gère le repli). Vide pour les codes sans préambule (CGI, CPP…).
    const preambuleArticles = useMemo(
        () => articles.filter(isPreambule),
        [articles]
    );
    const preambuleIds = useMemo(
        () => new Set(preambuleArticles.map(a => a.id)),
        [preambuleArticles]
    );

    const selectedArticles = useMemo(() => {
        if (!selectedNode) return [];
        // On exclut les préambules : ils sont rendus une seule fois, en tête de page.
        return getArticlesForNode(selectedNode).filter(a => !preambuleIds.has(a.id));
    }, [selectedNode, getArticlesForNode, preambuleIds]);

    const breadcrumbs = useMemo(() => {
        if (!selectedNode) return [];
        return getBreadcrumb(selectedNode.id, hierarchy) || [];
    }, [selectedNode, hierarchy, getBreadcrumb]);

    // ── Loading / Not found ──

    if (loading) {
        return (
            <div className="code-page">
                <SEO title="Chargement..." />
                <div className="code-loading">
                    <div className="loading-spinner" />
                    <p>Chargement du code...</p>
                </div>
            </div>
        );
    }

    if (!law) {
        return (
            <div className="code-page">
                <SEO title="Code non trouvé" />
                <div className="code-not-found">
                    <BookOpen size={48} />
                    <h2>Code non trouvé</h2>
                    <button onClick={() => navigate('/codes')} className="btn-back">
                        ← Retour aux codes
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="code-page">
            <SEO title={`${law.title} | Lexenegal`} description={`${law.title} — texte intégral consolidé (${totalArticles} articles). Droit sénégalais sur Lexenegal.`} url={`https://www.lexenegal.sn/code/${slug}`} />

            <div className="code-layout">
                {/* ═══════ SIDEBAR ═══════ */}
                <aside className="code-sidebar" ref={sidebarRef}>
                    <div className="sidebar-inner">
                        {/* Header */}
                        <div className="sidebar-code-header">
                            <div className="surtitre">Code sénégalais</div>
                            <div className="code-title">{law.title}</div>
                        </div>

                        {/* Search */}
                        <div className="sidebar-search">
                            <Search size={15} />
                            <input
                                type="text"
                                placeholder="Rechercher un article..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {/* Controls */}
                        <div className="sidebar-controls">
                            <button onClick={expandAll}>Tout déplier</button>
                            <button onClick={collapseAll}>Tout replier</button>
                        </div>

                        {/* Tree */}
                        <CodeNavTree
                            nodes={hierarchy}
                            slug={slug}
                            expandedNodes={expandedNodes}
                            onToggle={toggleNode}
                            onSelect={selectNode}
                            activeNodeId={selectedNode?.id ?? null}
                            activeNodeRef={activeNodeRef}
                        />

                        {/* Footer stats */}
                        <div className="sidebar-footer">
                            <div className="sidebar-stat">
                                <span className="stat-val">{totalArticles}</span>
                                <span className="stat-lbl">Articles</span>
                            </div>
                            <div className="sidebar-stat">
                                <span className="stat-val">{totalChapters}</span>
                                <span className="stat-lbl">Chapitres</span>
                            </div>

                        </div>
                    </div>
                </aside>

                {/* ═══════ MAIN ═══════ */}
                <main className="code-main">
                    {/* BANDEAU ABROGATION (texte entier abrogé par un autre texte) */}
                    {law.abrogation_note && (
                        <div className="law-abrogation-banner" role="note">
                            <span className="lab-icon" aria-hidden="true">⛔</span>
                            <span>{law.abrogation_note}{law.abrogated_by_slug && (
                                <> <Link to={`/code/${law.abrogated_by_slug}`}>Voir le texte en vigueur →</Link></>
                            )}</span>
                        </div>
                    )}

                    {/* Préambule en tête (hors recherche) : article(s) sans chapitre,
                        replié(s) par défaut. Rien si le code n'a pas de préambule. */}
                    {!filteredArticles && preambuleArticles.length > 0 && (
                        <div className="preambule-top articles-list">
                            {preambuleArticles.map(art => (
                                <ArticleCard key={art.id} art={art} slug={slug} codeTitle={law?.title} />
                            ))}
                        </div>
                    )}

                    {/* Search mode */}
                    {filteredArticles ? (
                        <div className="search-results">
                            <h2>{filteredArticles.length} résultat{filteredArticles.length > 1 ? 's' : ''} pour « {searchQuery} »</h2>
                            <div className="search-results-list">
                                {filteredArticles.map(a => (
                                    <Link key={a.id} to={`/code/${slug}/${a.slug}`} className="search-result-item">
                                        <strong>{a.num || `Article ${a.article_number}`}</strong>
                                        <span>{a.chapter_name || a.title_name || ''}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : selectedNode ? (
                        <>
                            {/* Breadcrumb */}
                            <div className="code-breadcrumb">
                                {breadcrumbs.map((bc, i) => (
                                    <React.Fragment key={bc.id}>
                                        {i > 0 && <span className="breadcrumb-sep">›</span>}
                                        {i < breadcrumbs.length - 1 ? (
                                            <button className="breadcrumb-item" onClick={() => selectNode(bc)}>
                                                {bc.name}
                                            </button>
                                        ) : (
                                            <span className="breadcrumb-current">{bc.name}</span>
                                        )}
                                    </React.Fragment>
                                ))}
                                <span className="version-pill">Version en vigueur</span>
                            </div>

                            {/* Section header */}
                            <div className="section-header">
                                <h2>{selectedNode.name}</h2>
                                <div className="section-meta">
                                    {selectedArticles.length} article{selectedArticles.length > 1 ? 's' : ''} 
                                    {selectedNode.children.length > 0 && ` · ${selectedNode.children.length} sous-section${selectedNode.children.length > 1 ? 's' : ''}`}
                                </div>
                            </div>

                            {/* Tabs */}
                            <div className="code-tabs">
                                <button
                                    className={`code-tab ${activeTab === 'articles' ? 'is-active' : ''}`}
                                    onClick={() => setActiveTab('articles')}
                                >
                                    Articles ({selectedArticles.length})
                                </button>
                                {selectedNode.children.length > 0 && (
                                    <button
                                        className={`code-tab ${activeTab === 'structure' ? 'is-active' : ''}`}
                                        onClick={() => setActiveTab('structure')}
                                    >
                                        Structure ({selectedNode.children.length})
                                    </button>
                                )}
                            </div>

                            {/* Tab: Articles */}
                            {activeTab === 'articles' && (
                                <div className="articles-list">
                                    {selectedArticles.length === 0 ? (
                                        <div className="empty-state">
                                            <FileText size={40} />
                                            <p>Sélectionnez une sous-section pour consulter les articles.</p>
                                        </div>
                                    ) : (
                                        selectedArticles.map(art => (
                                            <ArticleCard key={art.id} art={art} slug={slug} codeTitle={law?.title} />
                                        ))
                                    )}
                                </div>
                            )}

                            {/* Tab: Structure */}
                            {activeTab === 'structure' && (
                                <div className="structure-grid">
                                    {selectedNode.children.map(child => {
                                        const childCount = countArticles(child);
                                        const pct = (childCount / maxArticlesInLevel) * 100;
                                        return (
                                            <div
                                                key={child.id}
                                                className="structure-card"
                                                onClick={() => selectNode(child)}
                                            >
                                                <div className="sc-type">{child.type}</div>
                                                <div className="sc-name">{child.name}</div>
                                                <div className="sc-bar">
                                                    <div className="sc-bar-fill" style={{ width: `${pct}%` }} />
                                                </div>
                                                <div className="sc-count">{childCount} article{childCount > 1 ? 's' : ''}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="empty-state">
                            <BookOpen size={48} />
                            <p>Sélectionnez une section dans l'arbre de navigation.</p>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
};

export default CodePage;
