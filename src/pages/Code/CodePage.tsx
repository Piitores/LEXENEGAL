import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronRight, ChevronDown, BookOpen, Scale, FileText } from 'lucide-react';
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
}

interface TOCItem {
    level: 'part' | 'title' | 'chapter' | 'section' | 'article';
    name: string;
    slug?: string;
    children?: TOCItem[];
    isOpen?: boolean;
}

const CodePage: React.FC = () => {
    const { slug } = useParams();
    const navigate = useNavigate();

    const [law, setLaw] = useState<Law | null>(null);
    const [articles, setArticles] = useState<Article[]>([]);
    const [toc, setToc] = useState<TOCItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [openSections, setOpenSections] = useState<Set<string>>(new Set());

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

                // Fetch articles
                const { data: articlesData } = await supabase
                    .from('articles')
                    .select('*')
                    .eq('code_id', lawData.id)
                    .order('display_order');

                if (articlesData) {
                    setArticles(articlesData);
                    buildTOC(articlesData);
                }
            }
        } catch (error) {
            console.error('Error fetching code:', error);
        } finally {
            setLoading(false);
        }
    };

    const buildTOC = (articlesData: Article[]) => {
        // Build hierarchical TOC from flat articles list
        const tocMap = new Map<string, TOCItem>();

        articlesData.forEach(article => {
            // Create hierarchy: Part > Title > Chapter > Section > Article
            const partKey = article.part_title || 'Dispositions';
            if (!tocMap.has(partKey)) {
                tocMap.set(partKey, { level: 'part', name: partKey, children: [] });
            }

            const part = tocMap.get(partKey)!;

            // Find or create title
            let titleItem = part.children?.find(c => c.name === article.title_name);
            if (!titleItem && article.title_name) {
                titleItem = { level: 'title', name: article.title_name, children: [] };
                part.children?.push(titleItem);
            }

            // Find or create chapter
            const targetParent = titleItem || part;
            let chapterItem = targetParent.children?.find(c => c.name === article.chapter_name);
            if (!chapterItem && article.chapter_name) {
                chapterItem = { level: 'chapter', name: article.chapter_name, children: [] };
                targetParent.children?.push(chapterItem);
            }

            // Add article
            const articleParent = chapterItem || titleItem || part;
            articleParent.children?.push({
                level: 'article',
                name: `Art. ${article.article_number}`,
                slug: article.slug
            });
        });

        setToc(Array.from(tocMap.values()));
    };

    const toggleSection = (sectionName: string) => {
        setOpenSections(prev => {
            const next = new Set(prev);
            if (next.has(sectionName)) {
                next.delete(sectionName);
            } else {
                next.add(sectionName);
            }
            return next;
        });
    };

    const renderTOCItem = (item: TOCItem, depth: number = 0): React.ReactNode => {
        const hasChildren = item.children && item.children.length > 0;
        const isOpen = openSections.has(item.name);

        return (
            <div key={item.name} className={`toc-item toc-item--${item.level}`}>
                {item.level === 'article' ? (
                    <Link
                        to={`/code/${slug}/${item.slug}`}
                        className="toc-link toc-article"
                    >
                        {item.name}
                    </Link>
                ) : (
                    <>
                        <button
                            className={`toc-toggle ${isOpen ? 'open' : ''}`}
                            onClick={() => toggleSection(item.name)}
                        >
                            {hasChildren && (
                                <motion.span
                                    animate={{ rotate: isOpen ? 90 : 0 }}
                                    transition={{ duration: 0.2 }}
                                >
                                    <ChevronRight size={14} />
                                </motion.span>
                            )}
                            <span className="toc-name">{item.name}</span>
                        </button>

                        <AnimatePresence>
                            {isOpen && hasChildren && (
                                <motion.div
                                    className="toc-children"
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                >
                                    {item.children?.map(child => renderTOCItem(child, depth + 1))}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </>
                )}
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
                {/* SIDEBAR - Table of Contents */}
                <aside className="code-sidebar">
                    <div className="sidebar-sticky">
                        <button className="btn-back" onClick={() => navigate('/codes')}>
                            <ArrowLeft size={16} /> Tous les codes
                        </button>

                        <div className="toc-header">
                            <BookOpen size={18} />
                            <span>Sommaire</span>
                        </div>

                        <nav className="toc-nav">
                            {toc.map(item => renderTOCItem(item))}
                        </nav>
                    </div>
                </aside>

                {/* MAIN CONTENT */}
                <main className="code-main">
                    {/* HEADER */}
                    <header className="code-header">
                        <span className="code-category">{law.category}</span>
                        <h1>{law.title}</h1>
                        {law.reference && (
                            <p className="code-reference">{law.reference}</p>
                        )}
                    </header>

                    {/* ARTICLES LIST */}
                    <div className="articles-grid">
                        {articles.slice(0, 20).map(article => (
                            <Link
                                key={article.id}
                                to={`/code/${slug}/${article.slug}`}
                                className="article-card"
                            >
                                <div className="article-card__number">
                                    Art. {article.article_number}
                                </div>
                                <div className="article-card__meta">
                                    {article.chapter_name || article.title_name || 'Dispositions générales'}
                                </div>
                                <ChevronRight size={16} className="article-card__arrow" />
                            </Link>
                        ))}
                    </div>

                    {articles.length > 20 && (
                        <p className="articles-more">
                            Et {articles.length - 20} autres articles...
                        </p>
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
