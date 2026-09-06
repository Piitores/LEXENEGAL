import React, { useState, useEffect, useLayoutEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronLeft, ChevronRight, Search, X,
    BookOpen, FileText, ChevronDown, ExternalLink, Copy, Check, AlertCircle, Printer
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import SEO from '../../components/SEO/SEO';
import CodeNavTree from '../../components/CodeNavTree/CodeNavTree';
import TextPresentation from '../../components/TextPresentation/TextPresentation';
import RelatedTexts from '../../components/RelatedTexts/RelatedTexts';
import LinkedLegalContent from '../../components/LinkedLegalContent/LinkedLegalContent';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import ActionButton from '../../components/ui/ActionButton';
import {
    Law, Article, HierarchyNode,
    buildTreeFromNodes, buildTreeLegacy, countArticles, getArticlesForNode,
    getBreadcrumb, collectAllNodeIds, computeMaxArticlesInLevel, formatNodeLabel, NODE_KIND,
    isPreambule,
} from '../../lib/codeTree';
import { useCopyAttribution, attributionFooter, articleUrl } from '../../hooks/useCopyAttribution';
import './CodePage.css';
import '../../styles/legal-content.css';


// ── Helpers article ──
// (isPreambule vit dans lib/codeTree : l'arbre doit appliquer EXACTEMENT le même
//  critère que cette page, sinon un article échappe aux deux.)

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

const ArticleCard: React.FC<{ art: Article; slug: string | undefined; codeTitle?: string; basePath: string }> = ({ art, slug, codeTitle, basePath }) => {
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
                            <LinkedLegalContent html={art.content_html} />
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

                    <Link to={`${basePath}/${slug}/${art.slug}`} className="article-link-btn">
                        <ExternalLink size={13} />
                        Voir l'article complet
                    </Link>
                </>
            )}
        </article>
    );
};

// Défilement INSTANTANÉ. `html { scroll-behavior: smooth }` est posé globalement
// (styles/global.css) : sans ce forçage, un window.scrollTo(0, 0) s'anime sur plusieurs
// frames et se fait donc écraser en vol par le rétablissement de position que
// framer-motion opère quand il mesure l'arbre - le lecteur restait alors au milieu de
// la division qu'il venait d'ouvrir.
const remonterEnHaut = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
const allerA = (y: number) => window.scrollTo({ top: y, left: 0, behavior: 'instant' as ScrollBehavior });

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
    // Parties d'un même code (législative / réglementaire) pour la bascule d'en-tête.
    const [parties, setParties] = useState<{ slug: string; partie: string | null }[]>([]);

    // Toute copie de texte d'un article emporte la référence LexeSenegal + le lien.
    useCopyAttribution(slug, law?.title);
    // Préfixe d'URL selon la nature du texte : conventions collectives sous /convention,
    // le reste sous /code (la route /code reste un fallback valide pour tout slug).
    const basePath = (law as any)?.category === 'convention_collective' ? '/convention' : '/code';
    const [activeTab, setActiveTab] = useState<'articles' | 'structure'>('articles');
    // Tiroir « Sommaire » : sous 1024px la colonne de gauche sort du flux et
    // s'ouvre par-dessus la page (même dispositif que la page Article).
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    // Stats
    const [totalArticles, setTotalArticles] = useState(0);
    const [totalChapters, setTotalChapters] = useState(0);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);

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
    // visuel - sinon la page raccourcit, le navigateur « clampe » le scroll vers le bas
    // et on atterrit au footer. En instantané, donc aucune frame « footer » n'est peinte.
    // On en profite pour amener le nœud actif dans la zone visible de l'arbre, SANS
    // bouger la page (on ne touche qu'au scroll interne de la sidebar).
    useLayoutEffect(() => {
        remonterEnHaut();
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
            allerA(preserveScrollY.current);
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

            // Parties du même code (option A) : si le code appartient à une famille
            // (législative + réglementaire), on charge ses parties sœurs pour la bascule.
            const famille = (lawData as any).code_famille as string | null;
            if (famille) {
                const { data: sib } = await supabase
                    .from('laws_and_codes')
                    .select('slug, partie')
                    .eq('code_famille', famille)
                    .eq('is_active', true);
                setParties((sib || []).sort(
                    (a, b) => (a.partie === 'legislative' ? 0 : 1) - (b.partie === 'legislative' ? 0 : 1)
                ));
            } else {
                setParties([]);
            }

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
        // Remonter DÈS LE CLIC, avant le rendu : quand l'arbre déplie un nœud, framer-motion
        // mesure les hauteurs et, pour cela, mémorise puis RESTAURE window.scrollY - ce qui
        // annulait le window.scrollTo(0, 0) du useLayoutEffect ci-dessous et laissait le
        // lecteur au milieu de la division suivante. En remontant avant, la valeur que
        // framer-motion mémorise vaut 0 et sa restauration devient inoffensive.
        remonterEnHaut();
        setSelectedNode(node);
        // Sur mobile, choisir une division referme le tiroir : on veut lire, pas rester
        // devant le sommaire.
        setMobileNavOpen(false);
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
        // (scroll géré par le useLayoutEffect sur selectedNode - voir plus haut)
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

    // ── Division précédente / suivante ──
    // L'arbre à plat, dans l'ordre de lecture (parcours préfixe).
    const flatNodes = useMemo(() => {
        const out: HierarchyNode[] = [];
        const walk = (ns: HierarchyNode[]) => ns.forEach(n => { out.push(n); walk(n.children); });
        walk(hierarchy);
        return out;
    }, [hierarchy]);

    // On ne propose que les divisions qui portent des articles EN PROPRE : les
    // divisions « contenants » (un titre qui n'a que des chapitres) n'apportent
    // rien de plus que leurs enfants. On saute aussi les descendants du nœud
    // courant (déjà affichés sous lui) et ses ancêtres en arrière.
    const { prevNode, nextNode } = useMemo(() => {
        const vide = { prevNode: null as HierarchyNode | null, nextNode: null as HierarchyNode | null };
        if (!selectedNode) return vide;
        const i = flatNodes.findIndex(n => n.id === selectedNode.id);
        if (i < 0) return vide;
        const descendants = new Set(collectAllNodeIds(selectedNode.children));
        const ancetres = new Set(breadcrumbs.map(b => b.id));
        const porteDesArticles = (n: HierarchyNode) => n.articles.length > 0;

        let suivant: HierarchyNode | null = null;
        for (let j = i + 1; j < flatNodes.length; j++) {
            if (descendants.has(flatNodes[j].id)) continue;
            if (porteDesArticles(flatNodes[j])) { suivant = flatNodes[j]; break; }
        }
        let precedent: HierarchyNode | null = null;
        for (let j = i - 1; j >= 0; j--) {
            if (ancetres.has(flatNodes[j].id)) continue;
            if (porteDesArticles(flatNodes[j])) { precedent = flatNodes[j]; break; }
        }
        return { prevNode: precedent, nextNode: suivant };
    }, [selectedNode, flatNodes, breadcrumbs]);

    const labelDivision = (n: HierarchyNode) => {
        const { badge, label } = formatNodeLabel(n);
        // Une division sans titre dans la source ne rend qu'un badge (« Livre PREMIER ») :
        // sans ce test, le séparateur restait orphelin en fin de chaîne.
        if (!badge) return label;
        return label ? `${badge} - ${label}` : badge;
    };

    // ── Loading / Not found ──

    /* ⛔ Aucun <SEO> dans les états transitoires ci-dessous.
       Monter Helmet ici écraserait l'en-tête du rendu serveur (api/render.js) —
       déjà correct et spécifique à l'URL — par un titre « Chargement... » ou
       « Code non trouvé ». Si le crawler photographie la page avant la fin du
       chargement, on préfère qu'il garde le titre et le canonical du serveur.
       Le vrai <SEO url=...> est monté plus bas, une fois les données arrivées. */
    if (loading) {
        return (
            <div className="code-page">
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
            <SEO title={`${law.title} | Lexenegal`} description={`${law.title} - texte intégral consolidé (${totalArticles} articles). ${['ohada', 'uemoa', 'cedeao', 'cima'].includes((law as any).category) ? 'Droit communautaire applicable au Sénégal' : 'Droit sénégalais'} sur Lexenegal.`} url={`https://www.lexenegal.sn${basePath}/${slug}`} />

            <div className="code-layout">
                {/* ═══════ SIDEBAR ═══════
                    Desktop : colonne fixe. Sous 1024px : tiroir « Sommaire » ouvrable
                    (sans lui, l'arbre disparaissait et le texte devenait un cul-de-sac). */}
                {mobileNavOpen && (
                    <div className="code-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
                )}
                <aside
                    className={`code-sidebar ${mobileNavOpen ? 'is-open' : ''}`}
                    ref={sidebarRef}
                    aria-label="Sommaire du texte"
                >
                    <div className="sidebar-inner">
                        <div className="code-sidebar__mhead">
                            <span>Sommaire</span>
                            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le sommaire">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Header */}
                        <div className="sidebar-code-header">
                            <div className="surtitre">Code sénégalais</div>
                            <div className="code-title">{law.title}</div>
                            {parties.length > 1 && (
                                <div className="partie-toggle" role="tablist" aria-label="Partie du code">
                                    {parties.map((p) => {
                                        const actif = p.slug === slug;
                                        const label = p.partie === 'reglementaire' ? 'Réglementaire' : 'Législative';
                                        return actif ? (
                                            <span key={p.slug} className="partie-toggle__btn actif" role="tab" aria-selected="true">{label}</span>
                                        ) : (
                                            <Link key={p.slug} to={`${basePath}/${p.slug}`} className="partie-toggle__btn" role="tab" aria-selected="false">{label}</Link>
                                        );
                                    })}
                                </div>
                            )}
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
                            basePath={basePath}
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
                    {/* Bouton « Sommaire » (mobile / tablette uniquement) pour ouvrir l'arbre */}
                    {hierarchy.length > 0 && (
                        <button type="button" className="code-nav-toggle" onClick={() => setMobileNavOpen(true)}>
                            <BookOpen size={16} /> Sommaire
                        </button>
                    )}

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
                                <ArticleCard key={art.id} art={art} slug={slug} codeTitle={law?.title} basePath={basePath} />
                            ))}
                        </div>
                    )}

                    {/* Search mode */}
                    {filteredArticles ? (
                        <div className="search-results">
                            <h2>{filteredArticles.length} résultat{filteredArticles.length > 1 ? 's' : ''} pour « {searchQuery} »</h2>
                            <div className="search-results-list">
                                {filteredArticles.map(a => (
                                    <Link key={a.id} to={`${basePath}/${slug}/${a.slug}`} className="search-result-item">
                                        <strong>{a.num || `Article ${a.article_number}`}</strong>
                                        <span>{a.chapter_name || a.title_name || ''}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : selectedNode ? (
                        <>
                            {/* Présentation du texte (en tête du code, niveau racine) */}
                            {breadcrumbs.length <= 1 && law && (
                                <>
                                    <TextPresentation law={law} articleCount={totalArticles} />
                                    <div className="code-report-action">
                                        <ActionButton
                                            variant="ghost"
                                            icon={<AlertCircle size={16} />}
                                            onClick={() => setIsReportModalOpen(true)}
                                        >
                                            Signaler une erreur
                                        </ActionButton>
                                    </div>
                                </>
                            )}

                            {/* En-tête visible UNIQUEMENT à l'impression : le titre du code
                                (affiché dans la sidebar à l'écran, masquée sur papier). */}
                            <div className="code-print-header">
                                <div className="cph-title">{law?.title}</div>
                                <div className="cph-meta">Source : www.lexenegal.sn - édité le {new Date().toLocaleDateString('fr-FR')}</div>
                            </div>

                            {/* Breadcrumb */}
                            <div className="code-breadcrumb">
                                {breadcrumbs.map((bc, i) => {
                                    const f = formatNodeLabel(bc);
                                    // même précaution que `labelDivision` : pas de séparateur
                                    // orphelin quand la division n'a pas de titre.
                                    const disp = f.badge && f.label ? `${f.badge} - ${f.label}`
                                        : (f.badge || f.label);
                                    return (
                                        <React.Fragment key={bc.id}>
                                            {i > 0 && <span className="breadcrumb-sep">›</span>}
                                            {i < breadcrumbs.length - 1 ? (
                                                <button className="breadcrumb-item" onClick={() => selectNode(bc)}>
                                                    {disp}
                                                </button>
                                            ) : (
                                                <span className="breadcrumb-current">{disp}</span>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                                <span className="version-pill">Version en vigueur</span>
                            </div>

                            {/* Section header */}
                            <div className="section-header">
                                {(() => {
                                    const { badge, label } = formatNodeLabel(selectedNode);
                                    return <h2>{badge && <span className="section-header__badge">{badge}</span>}{label}</h2>;
                                })()}
                                <div className="section-meta">
                                    {selectedArticles.length} article{selectedArticles.length > 1 ? 's' : ''}
                                    {selectedNode.children.length > 0 && ` · ${selectedNode.children.length} sous-section${selectedNode.children.length > 1 ? 's' : ''}`}
                                </div>
                                {selectedArticles.length > 0 && (
                                    <div className="section-print-action">
                                        <ActionButton
                                            variant="secondary"
                                            icon={<Printer size={16} />}
                                            onClick={() => window.print()}
                                        >
                                            {breadcrumbs.length <= 1 ? 'Imprimer le texte' : 'Imprimer cette division'}
                                        </ActionButton>
                                    </div>
                                )}
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
                                            <ArticleCard key={art.id} art={art} slug={slug} codeTitle={law?.title} basePath={basePath} />
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
                                        const { badge: scBadge, label: scLabel } = formatNodeLabel(child);
                                        return (
                                            <div
                                                key={child.id}
                                                className="structure-card"
                                                onClick={() => selectNode(child)}
                                            >
                                                <div className="sc-type">{scBadge || NODE_KIND[child.type] || child.type}</div>
                                                <div className="sc-name">{scLabel}</div>
                                                <div className="sc-bar">
                                                    <div className="sc-bar-fill" style={{ width: `${pct}%` }} />
                                                </div>
                                                <div className="sc-count">{childCount} article{childCount > 1 ? 's' : ''}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Suite de lecture : sans ça, la fin d'une division était un
                                cul-de-sac dès que l'arbre n'était pas à l'écran. */}
                            {(prevNode || nextNode) && (
                                <nav className="code-division-nav" aria-label="Division précédente ou suivante">
                                    {prevNode ? (
                                        <button type="button" className="cdn-btn cdn-prev" onClick={() => selectNode(prevNode)}>
                                            <ChevronLeft size={16} />
                                            <span className="cdn-txt">
                                                <span className="cdn-sens">Division précédente</span>
                                                <span className="cdn-nom">{labelDivision(prevNode)}</span>
                                            </span>
                                        </button>
                                    ) : <span />}
                                    {nextNode && (
                                        <button type="button" className="cdn-btn cdn-next" onClick={() => selectNode(nextNode)}>
                                            <span className="cdn-txt">
                                                <span className="cdn-sens">Division suivante</span>
                                                <span className="cdn-nom">{labelDivision(nextNode)}</span>
                                            </span>
                                            <ChevronRight size={16} />
                                        </button>
                                    )}
                                </nav>
                            )}
                        </>
                    ) : (
                        <>
                            {law && (
                                <>
                                    <TextPresentation law={law} articleCount={totalArticles} />
                                    <div className="code-report-action">
                                        <ActionButton
                                            variant="ghost"
                                            icon={<AlertCircle size={16} />}
                                            onClick={() => setIsReportModalOpen(true)}
                                        >
                                            Signaler une erreur
                                        </ActionButton>
                                    </div>
                                </>
                            )}
                            <div className="empty-state">
                                <BookOpen size={48} />
                                <p>Sélectionnez une section dans l'arbre de navigation pour consulter les articles.</p>
                            </div>
                        </>
                    )}
                    {law && <RelatedTexts codeId={law.id} />}
                </main>
            </div>

            <ReportErrorModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                entityType="code"
                entityId={law.id}
                url={window.location.href}
            />
        </div>
    );
};

export default CodePage;
