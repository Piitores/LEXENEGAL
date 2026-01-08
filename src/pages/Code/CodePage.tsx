import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, ChevronDown, BookOpen, Search, FileText } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import SEO from '../../components/SEO/SEO';
import './CodePage.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface Law {
    id: string;
    title: string;
    short_title: string;
    category: string;
    reference: string;
    slug: string;
    description: string;
}

interface Article {
    id: string;
    part_title: string;
    title_name: string;
    chapter_name: string;
    section_name: string;
    article_number: string;
    slug: string;
    display_order: number;
}

interface HierarchyNode {
    name: string;
    type: 'part' | 'title' | 'chapter' | 'section';
    articles: Article[];
    children: HierarchyNode[];
}

const CodePage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();

    const [law, setLaw] = useState<Law | null>(null);
    const [articles, setArticles] = useState<Article[]>([]);
    const [hierarchy, setHierarchy] = useState<HierarchyNode[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        if (slug) fetchCodeData();
    }, [slug]);

    const fetchCodeData = async () => {
        setLoading(true);
        try {
            // Fetch law info
            const { data: lawData } = await supabase
                .from('laws_and_codes')
                .select('*')
                .eq('slug', slug)
                .single();

            if (lawData) {
                setLaw(lawData);

                // Fetch all articles
                const { data: articlesData } = await supabase
                    .from('articles')
                    .select('*')
                    .eq('code_id', lawData.id)
                    .order('display_order');

                if (articlesData) {
                    setArticles(articlesData);
                    buildHierarchy(articlesData);
                }
            }
        } catch (error) {
            console.error('Error fetching code:', error);
        } finally {
            setLoading(false);
        }
    };

    const buildHierarchy = (articlesData: Article[]) => {
        const root: HierarchyNode[] = [];

        articlesData.forEach(article => {
            // Find or create part node
            let partNode = root.find(n => n.name === (article.part_title || 'Dispositions'));
            if (!partNode) {
                partNode = {
                    name: article.part_title || 'Dispositions',
                    type: 'part',
                    articles: [],
                    children: []
                };
                root.push(partNode);
            }

            // Find or create title node
            if (article.title_name) {
                let titleNode = partNode.children.find(n => n.name === article.title_name);
                if (!titleNode) {
                    titleNode = {
                        name: article.title_name,
                        type: 'title',
                        articles: [],
                        children: []
                    };
                    partNode.children.push(titleNode);
                }

                // Find or create chapter node
                if (article.chapter_name) {
                    let chapterNode = titleNode.children.find(n => n.name === article.chapter_name);
                    if (!chapterNode) {
                        chapterNode = {
                            name: article.chapter_name,
                            type: 'chapter',
                            articles: [],
                            children: []
                        };
                        titleNode.children.push(chapterNode);
                    }
                    chapterNode.articles.push(article);
                } else {
                    titleNode.articles.push(article);
                }
            } else {
                partNode.articles.push(article);
            }
        });

        setHierarchy(root);
        // Auto-expand first level
        if (root.length > 0) {
            setExpandedNodes(new Set([root[0].name]));
        }
    };

    const toggleNode = (nodeName: string) => {
        setExpandedNodes(prev => {
            const next = new Set(prev);
            if (next.has(nodeName)) {
                next.delete(nodeName);
            } else {
                next.add(nodeName);
            }
            return next;
        });
    };

    const countArticles = (node: HierarchyNode): number => {
        let count = node.articles.length;
        node.children.forEach(child => {
            count += countArticles(child);
        });
        return count;
    };

    // Filter articles by search
    const filteredArticles = searchQuery.length >= 2
        ? articles.filter(a =>
            a.article_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.chapter_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            a.title_name?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : null;

    const renderNode = (node: HierarchyNode, depth: number = 0): React.ReactNode => {
        const isExpanded = expandedNodes.has(node.name);
        const hasChildren = node.children.length > 0 || node.articles.length > 0;
        const articleCount = countArticles(node);

        return (
            <div key={node.name} className={`hierarchy-node hierarchy-node--${node.type}`}>
                <button
                    className={`hierarchy-header ${isExpanded ? 'is-expanded' : ''}`}
                    onClick={() => toggleNode(node.name)}
                >
                    <motion.span
                        className="hierarchy-chevron"
                        animate={{ rotate: isExpanded ? 90 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronRight size={16} />
                    </motion.span>
                    <span className="hierarchy-name">{node.name}</span>
                    <span className="hierarchy-count">{articleCount} art.</span>
                </button>

                <AnimatePresence>
                    {isExpanded && hasChildren && (
                        <motion.div
                            className="hierarchy-content"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        >
                            {/* Render children first */}
                            {node.children.map(child => renderNode(child, depth + 1))}

                            {/* Then render direct articles */}
                            {node.articles.length > 0 && (
                                <div className="hierarchy-articles">
                                    {node.articles.map(article => (
                                        <Link
                                            key={article.id}
                                            to={`/code/${slug}/${article.slug}`}
                                            className="article-link"
                                        >
                                            <FileText size={14} />
                                            <span>Art. {article.article_number}</span>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="code-page code-loading">
                <div className="loading-spinner" />
                <p>Chargement du code...</p>
            </div>
        );
    }

    if (!law) {
        return (
            <div className="code-page code-not-found">
                <h2>Code non trouvé</h2>
                <button onClick={() => navigate('/codes')}>Retour aux codes</button>
            </div>
        );
    }

    return (
        <div className="code-page">
            <SEO
                title={`${law.title} | LEXENEGAL`}
                description={law.description || `${law.title} - Texte intégral et historique des versions`}
            />

            <div className="code-layout">
                {/* SIDEBAR - Navigation rapide */}
                <aside className="code-sidebar">
                    <div className="sidebar-sticky">
                        <button className="btn-back" onClick={() => navigate('/codes')}>
                            <ArrowLeft size={16} /> Tous les codes
                        </button>

                        <div className="sidebar-search">
                            <Search size={16} />
                            <input
                                type="text"
                                placeholder="Rechercher un article..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="toc-header">
                            <BookOpen size={18} />
                            <span>Structure</span>
                        </div>

                        <nav className="toc-nav">
                            {hierarchy.map((part, i) => (
                                <button
                                    key={i}
                                    className={`toc-part ${expandedNodes.has(part.name) ? 'active' : ''}`}
                                    onClick={() => toggleNode(part.name)}
                                >
                                    {part.name}
                                    <span className="toc-count">{countArticles(part)}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="code-main">
                    {/* HEADER */}
                    <header className="code-header">
                        <span className="code-category">{law.category || 'CODE'}</span>
                        <h1>{law.title}</h1>
                        {law.reference && (
                            <p className="code-reference">{law.reference}</p>
                        )}
                        <p className="code-stats">
                            {articles.length} articles · Version en vigueur
                        </p>
                    </header>

                    {/* SEARCH RESULTS or HIERARCHY */}
                    {filteredArticles ? (
                        <div className="search-results">
                            <h2>{filteredArticles.length} résultat{filteredArticles.length > 1 ? 's' : ''} pour "{searchQuery}"</h2>
                            <div className="search-results-list">
                                {filteredArticles.slice(0, 50).map(article => (
                                    <Link
                                        key={article.id}
                                        to={`/code/${slug}/${article.slug}`}
                                        className="search-result-item"
                                    >
                                        <strong>Art. {article.article_number}</strong>
                                        <span>{article.chapter_name || article.title_name || ''}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="code-hierarchy">
                            {hierarchy.map(part => renderNode(part))}
                        </div>
                    )}
                </main>
            </div>

            {/* SIGNATURE */}
            <div className="code-signature">
                LEXENEGAL n'est pas un outil. C'est la mémoire juridique organisée du Sénégal.
            </div>
        </div>
    );
};

export default CodePage;
