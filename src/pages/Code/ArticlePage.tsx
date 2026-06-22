import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useCopyAttribution } from '../../hooks/useCopyAttribution';
import AnnotationContent from './AnnotationContent';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronLeft, ChevronRight,
    GitCompare, Clock, Scale, Lock, FileText, Gavel, AlertCircle, X, ExternalLink, BookOpen
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import SEO from '../../components/SEO/SEO';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
import ReportErrorModal from '../../components/ReportError/ReportErrorModal';
import CodeNavTree from '../../components/CodeNavTree/CodeNavTree';
import {
    Article as CodeArticle, StructureNode, HierarchyNode,
    buildTreeFromNodes, buildTreeLegacy, getBreadcrumb,
} from '../../lib/codeTree';
import './ArticlePage.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Article {
    id: string;
    code_id: string;
    part_title: string;
    title_name: string;
    chapter_name: string;
    section_name: string;
    article_number: string;
    slug: string;
    modifications?: string[];
    content_raw?: string;
    notes?: string | null;
    status?: string | null;
    is_active?: boolean;
}

interface ArticleVersion {
    id: string;
    content: string;
    effective_date: string;
    expiration_date: string | null;
    version_note: string | null;
    is_current: boolean;
}

interface Law {
    title: string;
    slug: string;
    publication_date?: string | null;
    reference?: string | null;
    abrogation_note?: string | null;
    abrogated_by_slug?: string | null;
}

interface CitingDecision {
    id: string;
    titre: string;
    slug: string;
    date_decision: string;
    chambre: string;
    citation_text: string;
}

interface ArticleAnnotation {
    id: string;
    type: string;
    reference: string;
    date: string | null;
    title: string | null;
    content_raw: string;
}

interface DoctrineLink {
    doctrine_id: string;
    doctrine: {
        id: string;
        reference_complete: string;
        objet: string;
        content_raw: string;
    }
}

// --- Diff mot à mot, conscient des balises HTML (aucune dépendance) ----------
// Tokenise : balises <...> (atomiques), mots, espaces. Compare par plus longue
// sous-séquence commune (LCS) et surligne les écarts SANS jamais couper une balise.
const tokenizeHtml = (html: string): string[] => html.match(/<[^>]+>|[^<\s]+|\s+/g) || [];
const isWord = (t: string): boolean => t.length > 0 && t[0] !== '<' && /\S/.test(t);

function diffVersions(oldHtml: string, newHtml: string): { oldHtml: string; newHtml: string } {
    const a = tokenizeHtml(oldHtml);
    const b = tokenizeHtml(newHtml);
    const n = a.length, m = b.length;
    // Garde-fou perf : sur un texte gigantesque, on ne tente pas le diff.
    if (n * m > 4_000_000) return { oldHtml, newHtml };
    const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    let oldOut = '', newOut = '', i = 0, j = 0;
    const del = (t: string) => (isWord(t) ? `<mark class="diff-removed">${t}</mark>` : t);
    const ins = (t: string) => (isWord(t) ? `<mark class="diff-added">${t}</mark>` : t);
    while (i < n && j < m) {
        if (a[i] === b[j]) { oldOut += a[i]; newOut += b[j]; i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) { oldOut += del(a[i]); i++; }
        else { newOut += ins(b[j]); j++; }
    }
    while (i < n) oldOut += del(a[i++]);
    while (j < m) newOut += ins(b[j++]);
    return { oldHtml: oldOut, newHtml: newOut };
}

const ArticlePage: React.FC = () => {
    const { codeSlug, articleSlug } = useParams();
    const navigate = useNavigate();

    // « Retour au code » : on revient TOUJOURS à la page du code en cours de
    // consultation. (Auparavant un retour navigateur « intelligent » renvoyait vers
    // la page d'où l'on venait — souvent l'accueil du Corpus national — ce qui était
    // déroutant : le bouton est libellé « Retour au code », il doit mener au code.)
    const goBack = (fallback: string) => {
        navigate(fallback);
    };

    const [article, setArticle] = useState<Article | null>(null);
    const [law, setLaw] = useState<Law | null>(null);

    // Toute copie de texte de l'article emporte la référence LexeSenegal + le lien.
    useCopyAttribution(codeSlug, law?.title);
    const [versions, setVersions] = useState<ArticleVersion[]>([]);
    const [currentVersion, setCurrentVersion] = useState<ArticleVersion | null>(null);
    const [loading, setLoading] = useState(true);

    // Arbre de navigation (même mécanique que la page Code)
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [treeActiveNodeId, setTreeActiveNodeId] = useState<string | null>(null);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);

    const toggleNode = (id: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    // Navigation - previous/next articles
    const [prevArticle, setPrevArticle] = useState<{ slug: string; number: string } | null>(null);
    const [nextArticle, setNextArticle] = useState<{ slug: string; number: string } | null>(null);

    // Comparison mode
    const [showComparison, setShowComparison] = useState(false);
    const [compareVersion, setCompareVersion] = useState<ArticleVersion | null>(null);
    // En dev local (npm run dev) on débloque les fonctions PRO pour tester.
    // import.meta.env.DEV est TOUJOURS false dans le build de production.
    const [isPro, setIsPro] = useState(import.meta.env.DEV);
    const [showConversionModal, setShowConversionModal] = useState(false);

    // Citing decisions
    const [citingDecisions, setCitingDecisions] = useState<CitingDecision[]>([]);
    const [loadingDecisions, setLoadingDecisions] = useState(false);

    // CGI Annotations & Doctrine
    const [annotations, setAnnotations] = useState<ArticleAnnotation[]>([]);
    const [doctrineLinks, setDoctrineLinks] = useState<DoctrineLink[]>([]);
    const [selectedDoctrine, setSelectedDoctrine] = useState<DoctrineLink['doctrine'] | null>(null);
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [doctrineOpen, setDoctrineOpen] = useState(false); // repliée par défaut
    const [isAuthenticated, setIsAuthenticated] = useState(false);

    // Report Error Modal
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);


    useEffect(() => {
        if (codeSlug && articleSlug) {
            fetchArticleData();
            checkProAccess();
        }
    }, [codeSlug, articleSlug]);

    // Ferme le tiroir « Sommaire » (mobile) quand on change d'article
    useEffect(() => { setMobileNavOpen(false); }, [articleSlug]);

    const checkProAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setIsAuthenticated(true);
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_tier, role')
                    .eq('id', session.user.id)
                    .single();
                setIsPro(import.meta.env.DEV || profile?.subscription_tier === 'pro' || profile?.role === 'admin');
            } else {
                setIsAuthenticated(false);
            }
        } catch (error) {
            console.error('Error checking PRO access:', error);
        }
    };

    const fetchArticleData = async () => {
        setLoading(true);
        setPrevArticle(null);
        setNextArticle(null);

        try {
            // Get law info
            const { data: lawData } = await supabase
                .from('laws_and_codes')
                .select('id, title, slug, publication_date, reference, abrogation_note, abrogated_by_slug')
                .eq('slug', codeSlug)
                .single();

            if (lawData) {
                setLaw(lawData);

                // Get article
                const { data: articleData } = await supabase
                    .from('articles')
                    .select('*')
                    .eq('code_id', lawData.id)
                    .eq('slug', articleSlug)
                    .single();

                if (articleData) {
                    setArticle(articleData);

                    // Arbre de navigation du code (mêmes données/mécanique que CodePage)
                    const { data: allArts } = await supabase
                        .from('articles')
                        .select('*')
                        .eq('code_id', lawData.id)
                        .order('display_order');
                    const { data: nodesData } = await supabase
                        .from('structure_nodes')
                        .select('*')
                        .eq('code_id', lawData.id)
                        .order('position');
                    const tree = (nodesData && nodesData.length > 0)
                        ? buildTreeFromNodes(nodesData as StructureNode[], (allArts || []) as CodeArticle[])
                        : buildTreeLegacy((allArts || []) as CodeArticle[]);
                    setHierarchy(tree);
                    setTreeActiveNodeId(articleData.node_id ?? null);
                    if (articleData.node_id) {
                        const path = getBreadcrumb(articleData.node_id, tree) || [];
                        setExpandedNodes(new Set(path.map(p => p.id)));
                    } else {
                        setExpandedNodes(new Set());
                    }

                    // Get versions
                    const { data: versionsData } = await supabase
                        .from('article_versions')
                        .select('*')
                        .eq('article_id', articleData.id)
                        .order('effective_date', { ascending: false });

                    if (versionsData && versionsData.length > 0) {
                        setVersions(versionsData);
                        const current = versionsData.find(v => v.is_current);
                        setCurrentVersion(current || versionsData[0]);
                    } else if (articleData.content_raw) {
                        // Fallback (articles sans versions, ex. CGI) : « en vigueur depuis »
                        // = date d'institution du code (publication_date), pas la date du jour.
                        setCurrentVersion({
                            id: `raw-${articleData.id}`,
                            content: articleData.content_raw,
                            effective_date: lawData.publication_date || new Date().toISOString(),
                            expiration_date: null,
                            version_note: null,
                            is_current: true
                        });
                    }

                    // Get previous article (lower display_order)
                    const { data: prevData } = await supabase
                        .from('articles')
                        .select('slug, article_number')
                        .eq('code_id', lawData.id)
                        .lt('display_order', articleData.display_order)
                        .order('display_order', { ascending: false })
                        .limit(1)
                        .single();

                    if (prevData) {
                        setPrevArticle({ slug: prevData.slug, number: prevData.article_number });
                    }

                    // Get next article (higher display_order)
                    const { data: nextData } = await supabase
                        .from('articles')
                        .select('slug, article_number')
                        .eq('code_id', lawData.id)
                        .gt('display_order', articleData.display_order)
                        .order('display_order', { ascending: true })
                        .limit(1)
                        .single();

                    if (nextData) {
                        setNextArticle({ slug: nextData.slug, number: nextData.article_number });
                    }

                    // Fetch citing decisions
                    fetchCitingDecisions(articleData.id);

                    // Fetch annotations
                    const { data: annoData } = await supabase
                        .from('article_annotations')
                        .select('*')
                        .eq('article_id', articleData.id)
                        .order('created_at', { ascending: true });
                    if (annoData) setAnnotations(annoData);

                    // Fetch doctrine links
                    const { data: doctrineData } = await supabase
                        .from('article_doctrine_links')
                        .select(`
                            doctrine_id,
                            doctrine:doctrine(id, reference_complete, objet, content_raw)
                        `)
                        .eq('article_id', articleData.id);
                    if (doctrineData) setDoctrineLinks(doctrineData as unknown as DoctrineLink[]);
                }
            }
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchCitingDecisions = async (articleId: string) => {
        setLoadingDecisions(true);
        try {
            const { data: links, error } = await supabase
                .from('decision_article_links')
                .select(`
                    citation_text,
                    decision:decisions(
                        id,
                        reference,
                        slug,
                        date_decision,
                        chambre
                    )
                `)
                .eq('article_id', articleId)
                .limit(10);

            if (error) throw error;

            const decisions: CitingDecision[] = (links || [])
                .filter((l: any) => l.decision)
                .map((l: any) => ({
                    id: l.decision.id,
                    titre: l.decision.reference,
                    slug: l.decision.slug,
                    date_decision: l.decision.date_decision,
                    chambre: l.decision.chambre,
                    citation_text: l.citation_text
                }));

            setCitingDecisions(decisions);
        } catch (error) {
            console.error('Error fetching citing decisions:', error);
        } finally {
            setLoadingDecisions(false);
        }
    };


    const handleCompareClick = () => {
        if (!isPro) {
            setShowConversionModal(true);
            return;
        }
        setShowComparison(!showComparison);
    };

    const selectCompareVersion = (version: ArticleVersion) => {
        setCompareVersion(version);
    };

    // Simple diff renderer
    const renderDiff = (oldText: string, newText: string) => {
        const oldLines = oldText.split('\n');
        const newLines = newText.split('\n');

        return (
            <div className="diff-content">
                {newLines.map((line, i) => {
                    const oldLine = oldLines[i] || '';
                    const isAdded = !oldLines.includes(line) && line.trim();
                    const isRemoved = !newLines.includes(oldLine) && oldLine.trim();

                    return (
                        <p
                            key={i}
                            className={`diff-line ${isAdded ? 'diff-added' : ''}`}
                        >
                            {line || '\u00A0'}
                        </p>
                    );
                })}
            </div>
        );
    };

    const handleDoctrineClick = (doctrine: DoctrineLink['doctrine']) => {
        if (!isAuthenticated) {
            setShowAuthModal(true);
        } else {
            setSelectedDoctrine(doctrine);
        }
    };

    // Diff surligné entre l'ancienne version sélectionnée et la version courante.
    const diff = React.useMemo(
        () => (showComparison && compareVersion && currentVersion)
            ? diffVersions(compareVersion.content, currentVersion.content)
            : null,
        [showComparison, compareVersion, currentVersion]
    );

    if (loading) {
        return (
            <div className="article-page article-loading">
                <div className="loading-spinner" />
                <p>Chargement de l'article...</p>
            </div>
        );
    }

    if (!article || !currentVersion) {
        return (
            <div className="article-page article-not-found">
                <h2>Article non trouvé</h2>
                <button onClick={() => goBack(`/code/${codeSlug}`)}>Retour au code</button>
            </div>
        );
    }

    return (
        <div className="article-page">
            <SEO
                title={`Article ${article.article_number} — ${law?.title} | Lexenegal`}
                description={`Texte intégral de l'article ${article.article_number} du ${law?.title}. Droit sénégalais consolidé sur Lexenegal.`}
                url={`https://www.lexenegal.sn/code/${codeSlug}/${articleSlug}`}
            />

            <div className="article-layout">
                {/* ARBRE DE NAVIGATION (gauche) — même composant que la page Code.
                    Desktop : colonne fixe. Mobile : tiroir « Sommaire » ouvrable. */}
                {hierarchy.length > 0 && (
                    <>
                        {mobileNavOpen && (
                            <div className="article-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
                        )}
                        <aside className={`article-tree-aside ${mobileNavOpen ? 'is-open' : ''}`}>
                            <div className="article-tree-aside__mhead">
                                <span>Sommaire</span>
                                <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Fermer le sommaire">
                                    <X size={18} />
                                </button>
                            </div>
                            <CodeNavTree
                                nodes={hierarchy}
                                slug={codeSlug}
                                expandedNodes={expandedNodes}
                                onToggle={toggleNode}
                                onSelect={(node) => { setMobileNavOpen(false); navigate(`/code/${codeSlug}?node=${encodeURIComponent(node.name)}`); }}
                                activeNodeId={treeActiveNodeId}
                                activeArticleSlug={article.slug}
                            />
                        </aside>
                    </>
                )}

                <div className="article-container">
                {/* Bouton « Sommaire » (mobile uniquement) pour ouvrir l'arbre */}
                {hierarchy.length > 0 && (
                    <button type="button" className="article-nav-toggle" onClick={() => setMobileNavOpen(true)}>
                        <BookOpen size={16} /> Sommaire
                    </button>
                )}
                {/* BREADCRUMB — minimal et raffiné */}
                <nav className="article-breadcrumb">
                    <Link to="/codes">Codes</Link>
                    <ChevronRight size={13} />
                    <Link to={`/code/${codeSlug}`}>{law?.title}</Link>
                    <ChevronRight size={13} />
                    <span className="bc-current">Article {article.article_number}</span>
                </nav>

                {/* BANDEAU ABROGATION (texte entier abrogé par un autre texte) */}
                {law?.abrogation_note && (
                    <div className="law-abrogation-banner" role="note">
                        <span className="lab-icon" aria-hidden="true">⛔</span>
                        <span>{law.abrogation_note}{law.abrogated_by_slug && (
                            <> <Link to={`/code/${law.abrogated_by_slug}`}>Voir le texte en vigueur →</Link></>
                        )}</span>
                    </div>
                )}

                {/* BANDEAU ABROGATION (article individuel abrogé) */}
                {(article.status === 'abrogé' || article.is_active === false) && (
                    <div className="article-abrogation-banner" role="note">
                        <span className="lab-icon" aria-hidden="true">⛔</span>
                        <span>{article.notes || 'Cet article a été abrogé.'}</span>
                    </div>
                )}

                {/* HEADER */}
                <header className="article-header">
                    {/* Contexte hiérarchique enrichi (badges de niveau, premium + imprimable).
                        On n'utilise PAS part_title (incohérent) : Titre > Chapitre > Section. */}
                    {(() => {
                        const levels = ([
                            article.title_name ? { kind: 'titre', raw: article.title_name } : null,
                            article.chapter_name ? { kind: 'chapitre', raw: article.chapter_name } : null,
                            article.section_name ? { kind: 'section', raw: article.section_name } : null,
                        ].filter(Boolean) as { kind: string; raw: string }[]);
                        if (!levels.length) return null;
                        const KIND: Record<string, string> = { titre: 'Titre', chapitre: 'Chapitre', section: 'Section', 'sous-section': 'Sous-section', paragraphe: 'Paragraphe', livre: 'Livre', partie: 'Partie' };
                        // sépare « numéro — intitulé » (tiret cadratin — , demi-cadratin – ou simple -)
                        const split = (raw: string) => {
                            const m = raw.match(/^\s*(.*?)\s+[—–-]\s+(.*)$/);
                            if (m) return { num: m[1].trim(), label: m[2].trim() };
                            const r = raw.trim();
                            // pas de tiret : un ordinal seul (PRELIMINAIRE, PREMIER, II, BIS…) est le numéro ; sinon un intitulé
                            return /^(PREMIER|PREMIÈRE|PREMIERE|PRELIMINAIRE|PRÉLIMINAIRE|BIS|[IVXLC]+|\d+)$/i.test(r)
                                ? { num: r, label: '' }
                                : { num: '', label: r };
                        };
                        return (
                            <div className="article-hierarchy" aria-label="Emplacement dans le code">
                                {levels.map((lvl, i) => {
                                    const { num, label } = split(lvl.raw);
                                    const badge = `${KIND[lvl.kind] || lvl.kind}${num ? ' ' + num : ''}`;
                                    return (
                                        <Link
                                            key={i}
                                            className={`ah-row ah-row--${lvl.kind}`}
                                            to={`/code/${codeSlug}?node=${encodeURIComponent(lvl.raw)}`}
                                        >
                                            <span className={`ah-badge ah-badge--${lvl.kind}`}>{badge}</span>
                                            <span className="ah-label">{label}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })()}
                    <h1>Article {article.article_number}
                        {article.notes && article.status !== 'abrogé' && article.is_active !== false && (
                            <span className="article-nota" tabIndex={0} role="note" aria-label={`Note : ${article.notes}`}>
                                <span className="article-nota__mark">!</span>
                                <span className="article-nota__tip">{article.notes}</span>
                            </span>
                        )}
                    </h1>

                    {/* VERSION INFO */}
                    <div className="version-info-wrapper" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginTop: '16px' }}>
                        <div className="version-info" style={{ margin: 0 }}>
                            <Clock size={14} />
                            En vigueur depuis le {new Date(currentVersion.effective_date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                            {currentVersion.version_note && (
                                <span className="version-note"> · {currentVersion.version_note}</span>
                            )}
                        </div>

                        {/* MODIFICATIONS INFO (Légifrance Style) */}
                        {article.modifications && article.modifications.length > 0 && (
                            <div className="article-modifications" style={{ textAlign: 'right', fontSize: '0.85rem', color: '#2563EB' }}>
                                <a href="#" style={{ textDecoration: 'underline', color: 'inherit' }}>
                                    {article.modifications[article.modifications.length - 1]}
                                </a>
                            </div>
                        )}
                    </div>
                </header>

                {/* ACTIONS */}
                <div className="article-actions">
                    <button
                        className={`btn-compare ${showComparison ? 'active' : ''}`}
                        onClick={handleCompareClick}
                    >
                        <GitCompare size={16} />
                        Comparer les versions
                        {!isPro && <Lock size={12} className="pro-lock" />}
                    </button>
                    <button
                        className="inline-report-btn"
                        onClick={() => setIsReportModalOpen(true)}
                    >
                        <AlertCircle size={16} />
                        Signaler une erreur
                    </button>
                </div>

                {/* COMPARISON MODE */}
                <AnimatePresence>
                    {showComparison && isPro && (
                        <motion.div
                            className="comparison-panel"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                        >
                            <div className="version-selector">
                                <label>Comparer avec :</label>
                                <select
                                    value={compareVersion?.id || ''}
                                    onChange={(e) => {
                                        const v = versions.find(v => v.id === e.target.value);
                                        setCompareVersion(v || null);
                                    }}
                                >
                                    <option value="">Sélectionner une version...</option>
                                    {versions.filter(v => !v.is_current).map(v => (
                                        <option key={v.id} value={v.id}>
                                            Version du {new Date(v.effective_date).toLocaleDateString('fr-FR')}
                                            {v.version_note ? ` (${v.version_note})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* CONTENT */}
                <div
                    className={`article-content-wrapper ${showComparison && compareVersion ? 'side-by-side' : ''} ${(article.status === 'abrogé' || article.is_active === false) ? 'is-abroge' : ''}`}
                    data-art-slug={articleSlug}
                    data-art-num={`Article ${article.article_number}`}
                >
                    {showComparison && compareVersion && isPro ? (
                        <>
                            {/* OLD VERSION */}
                            <div className="version-column version-old">
                                <div className="version-column-header">
                                    <FileText size={14} />
                                    Version du {new Date(compareVersion.effective_date).toLocaleDateString('fr-FR')}
                                </div>
                                <div
                                    className="article-text"
                                    dangerouslySetInnerHTML={{ __html: diff ? diff.oldHtml : compareVersion.content }}
                                />
                            </div>

                            {/* CURRENT VERSION */}
                            <div className="version-column version-current">
                                <div className="version-column-header current">
                                    <FileText size={14} />
                                    Version actuelle
                                </div>
                                <div
                                    className="article-text"
                                    dangerouslySetInnerHTML={{ __html: diff ? diff.newHtml : currentVersion.content }}
                                />
                            </div>
                        </>
                    ) : (
                        <div
                            className="article-text"
                            dangerouslySetInnerHTML={{ __html: currentVersion.content }}
                        />
                    )}

                    {/* ANNOTATIONS (Pastilles grises du CGI) */}
                    {annotations.length > 0 && !showComparison && (
                        <div className="article-annotations-container">
                            {annotations.map(anno => (
                                <div key={anno.id} className="article-annotation">
                                    {anno.title && <h4>{anno.title}</h4>}
                                    {/data-article-id=/.test(anno.content_raw) ? (
                                        <div className="annotation-content">
                                            <AnnotationContent html={anno.content_raw} />
                                        </div>
                                    ) : (
                                        <div
                                            className="annotation-content"
                                            dangerouslySetInnerHTML={{ __html: anno.content_raw }}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* DOCTRINE FISCALE */}
                {doctrineLinks.length > 0 && (
                    <section className="citing-decisions doctrine-section">
                        <h2 onClick={() => setDoctrineOpen(o => !o)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <BookOpen size={20} />
                            Doctrine Fiscale liée
                            <span style={{ fontSize: '0.8rem', fontWeight: 400, color: '#6B7280' }}>({doctrineLinks.length})</span>
                            <ChevronRight size={18} style={{ marginLeft: 'auto', transition: 'transform 0.2s', transform: doctrineOpen ? 'rotate(90deg)' : 'none' }} />
                        </h2>
                        {doctrineOpen && (
                        <div className="citing-list">
                            {doctrineLinks.map(link => (
                                <button
                                    key={link.doctrine_id}
                                    onClick={() => handleDoctrineClick(link.doctrine)}
                                    className="citing-card doctrine-card"
                                >
                                    <div className="citing-card__icon">
                                        <FileText size={16} />
                                    </div>
                                    <div className="citing-card__content text-left">
                                        <h3>{link.doctrine.reference_complete || 'Lettre de la DGID'}</h3>
                                        {link.doctrine.objet && (
                                            <p className="citing-card__meta">
                                                Objet : {link.doctrine.objet}
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className="citing-card__arrow" />
                                </button>
                            ))}
                        </div>
                        )}
                    </section>
                )}

                {/* CITING DECISIONS */}
                <section className="citing-decisions">
                    <h2>
                        <Gavel size={20} />
                        Décisions citant cet article
                    </h2>
                    {loadingDecisions ? (
                        <p className="citing-loading">Chargement...</p>
                    ) : citingDecisions.length === 0 ? (
                        <p className="citing-empty">
                            Aucune décision ne cite cet article pour le moment.
                        </p>
                    ) : (
                        <div className="citing-list">
                            {citingDecisions.map(decision => (
                                <Link
                                    key={decision.id}
                                    to={`/decision/${decision.slug}`}
                                    className="citing-card"
                                >
                                    <div className="citing-card__icon">
                                        <Scale size={16} />
                                    </div>
                                    <div className="citing-card__content">
                                        <h3>{decision.titre}</h3>
                                        <p className="citing-card__meta">
                                            {decision.chambre} · {new Date(decision.date_decision).toLocaleDateString('fr-FR')}
                                        </p>
                                        {decision.citation_text && (
                                            <p className="citing-card__excerpt">
                                                "...{decision.citation_text}..."
                                            </p>
                                        )}
                                    </div>
                                    <ChevronRight size={16} className="citing-card__arrow" />
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* NAVIGATION */}
                <div className="article-nav">
                    <button
                        className={`btn-nav ${!prevArticle ? 'disabled' : ''}`}
                        onClick={() => prevArticle && navigate(`/code/${codeSlug}/${prevArticle.slug}`)}
                        disabled={!prevArticle}
                    >
                        <ChevronLeft size={16} />
                        {prevArticle ? `Article ${prevArticle.number}` : 'Premier article'}
                    </button>
                    <button className="btn-nav btn-nav-center" onClick={() => goBack(`/code/${codeSlug}`)}>
                        Retour
                    </button>
                    <button
                        className={`btn-nav ${!nextArticle ? 'disabled' : ''}`}
                        onClick={() => nextArticle && navigate(`/code/${codeSlug}/${nextArticle.slug}`)}
                        disabled={!nextArticle}
                    >
                        {nextArticle ? `Article ${nextArticle.number}` : 'Dernier article'}
                        <ChevronRight size={16} />
                    </button>
                </div>

                {/* SIGNATURE */}
                <div className="article-signature">
                    LEXENEGAL n'est pas un outil. C'est la mémoire juridique organisée du Sénégal.
                </div>
                </div>
            </div>

            {/* CONVERSION MODAL */}
            <ConversionModal
                isOpen={showConversionModal}
                onClose={() => setShowConversionModal(false)}
                onRequestAccess={() => {
                    setShowConversionModal(false);
                    navigate('/espace-professionnel#contact');
                }}
            />

            {/* REPORT ERROR MODAL */}
            <ReportErrorModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                entityType="article"
                entityId={article?.id}
                url={window.location.href}
            />

            {/* DOCTRINE SIDEBAR */}
            <AnimatePresence>
                {selectedDoctrine && (
                    <>
                        <motion.div 
                            className="doctrine-sidebar-overlay"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setSelectedDoctrine(null)}
                        />
                        <motion.div
                            className="doctrine-sidebar"
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                        >
                            <div className="doctrine-sidebar-header">
                                <h3>Doctrine Fiscale</h3>
                                <div className="doctrine-sidebar-actions">
                                    <button 
                                        className="doctrine-sidebar-btn" 
                                        title="Ouvrir dans un nouvel onglet"
                                        onClick={() => window.open('/doctrine-fiscale', '_blank')}
                                    >
                                        <ExternalLink size={18} />
                                    </button>
                                    <button className="doctrine-sidebar-btn close" onClick={() => setSelectedDoctrine(null)}>
                                        <X size={20} />
                                    </button>
                                </div>
                            </div>
                            <div className="doctrine-sidebar-content">
                                <h2 className="doctrine-title">{selectedDoctrine.reference_complete || 'Lettre de la DGID'}</h2>
                                {selectedDoctrine.objet && (
                                    <div className="doctrine-meta">
                                        <strong>Objet :</strong> {selectedDoctrine.objet}
                                    </div>
                                )}
                                <div 
                                    className="doctrine-text" 
                                    dangerouslySetInnerHTML={{ 
                                        __html: selectedDoctrine.content_raw.replace(/\n/g, '<br />') 
                                    }} 
                                />
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>

            {/* AUTH REQUIRED MODAL */}
            <AnimatePresence>
                {showAuthModal && (
                    <div className="modal-overlay auth-modal-overlay">
                        <motion.div 
                            className="modal-content auth-modal"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                        >
                            <button className="modal-close" onClick={() => setShowAuthModal(false)}>
                                <X size={20} />
                            </button>
                            <div className="auth-modal-icon">
                                <Lock size={32} />
                            </div>
                            <h2>Connexion Requise</h2>
                            <p>
                                La consultation de la Doctrine Fiscale intégrale est réservée aux utilisateurs Lexenegal.
                                Créez un compte gratuitement ou connectez-vous pour y accéder.
                            </p>
                            <div className="auth-modal-actions">
                                <button className="btn-primary" onClick={() => navigate('/login')}>
                                    Se connecter / S'inscrire
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default ArticlePage;
