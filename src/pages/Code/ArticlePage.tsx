import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, ChevronLeft, ChevronRight,
    GitCompare, Clock, Scale, Lock, FileText
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import SEO from '../../components/SEO/SEO';
import ConversionModal from '../../components/ConversionModal/ConversionModal';
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
    article_number: string;
    slug: string;
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
}

const ArticlePage: React.FC = () => {
    const { codeSlug, articleSlug } = useParams();
    const navigate = useNavigate();

    const [article, setArticle] = useState<Article | null>(null);
    const [law, setLaw] = useState<Law | null>(null);
    const [versions, setVersions] = useState<ArticleVersion[]>([]);
    const [currentVersion, setCurrentVersion] = useState<ArticleVersion | null>(null);
    const [loading, setLoading] = useState(true);

    // Comparison mode
    const [showComparison, setShowComparison] = useState(false);
    const [compareVersion, setCompareVersion] = useState<ArticleVersion | null>(null);
    const [isPro, setIsPro] = useState(false);
    const [showConversionModal, setShowConversionModal] = useState(false);

    useEffect(() => {
        if (codeSlug && articleSlug) {
            fetchArticleData();
            checkProAccess();
        }
    }, [codeSlug, articleSlug]);

    const checkProAccess = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('subscription_tier')
                    .eq('id', session.user.id)
                    .single();
                setIsPro(profile?.subscription_tier === 'pro');
            }
        } catch (error) {
            console.error('Error checking PRO access:', error);
        }
    };

    const fetchArticleData = async () => {
        setLoading(true);
        try {
            // Get law info
            const { data: lawData } = await supabase
                .from('laws_and_codes')
                .select('id, title, slug')
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

                    // Get versions
                    const { data: versionsData } = await supabase
                        .from('article_versions')
                        .select('*')
                        .eq('article_id', articleData.id)
                        .order('effective_date', { ascending: false });

                    if (versionsData) {
                        setVersions(versionsData);
                        const current = versionsData.find(v => v.is_current);
                        setCurrentVersion(current || versionsData[0]);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching article:', error);
        } finally {
            setLoading(false);
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
                <button onClick={() => navigate(`/code/${codeSlug}`)}>Retour au code</button>
            </div>
        );
    }

    return (
        <div className="article-page">
            <SEO
                title={`Article ${article.article_number} - ${law?.title} | LEXENEGAL`}
                description={`Texte intégral de l'article ${article.article_number} du ${law?.title}`}
            />

            <div className="article-container">
                {/* BREADCRUMB */}
                <nav className="article-breadcrumb">
                    <Link to="/codes">Codes</Link>
                    <ChevronRight size={14} />
                    <Link to={`/code/${codeSlug}`}>{law?.title}</Link>
                    <ChevronRight size={14} />
                    <span>Art. {article.article_number}</span>
                </nav>

                {/* HEADER */}
                <header className="article-header">
                    <div className="article-meta">
                        {article.chapter_name && (
                            <span className="article-chapter">{article.chapter_name}</span>
                        )}
                    </div>
                    <h1>Article {article.article_number}</h1>

                    {/* VERSION INFO */}
                    <div className="version-info">
                        <Clock size={14} />
                        En vigueur depuis le {new Date(currentVersion.effective_date).toLocaleDateString('fr-FR', { dateStyle: 'long' })}
                        {currentVersion.version_note && (
                            <span className="version-note"> · {currentVersion.version_note}</span>
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
                <div className={`article-content-wrapper ${showComparison && compareVersion ? 'side-by-side' : ''}`}>
                    {showComparison && compareVersion && isPro ? (
                        <>
                            {/* OLD VERSION */}
                            <div className="version-column version-old">
                                <div className="version-column-header">
                                    <FileText size={14} />
                                    Version du {new Date(compareVersion.effective_date).toLocaleDateString('fr-FR')}
                                </div>
                                <div className="article-text">
                                    {compareVersion.content.split('\n').map((p, i) => (
                                        <p key={i} className={!currentVersion.content.includes(p) ? 'diff-removed' : ''}>
                                            {p || '\u00A0'}
                                        </p>
                                    ))}
                                </div>
                            </div>

                            {/* CURRENT VERSION */}
                            <div className="version-column version-current">
                                <div className="version-column-header current">
                                    <FileText size={14} />
                                    Version actuelle
                                </div>
                                <div className="article-text">
                                    {currentVersion.content.split('\n').map((p, i) => (
                                        <p key={i} className={!compareVersion.content.includes(p) ? 'diff-added' : ''}>
                                            {p || '\u00A0'}
                                        </p>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="article-text">
                            {currentVersion.content.split('\n').map((paragraph, i) => (
                                <p key={i}>{paragraph || '\u00A0'}</p>
                            ))}
                        </div>
                    )}
                </div>

                {/* NAVIGATION */}
                <div className="article-nav">
                    <button className="btn-nav" onClick={() => navigate(-1)}>
                        <ChevronLeft size={16} /> Article précédent
                    </button>
                    <button className="btn-nav" onClick={() => navigate(`/code/${codeSlug}`)}>
                        Retour au sommaire
                    </button>
                    <button className="btn-nav">
                        Article suivant <ChevronRight size={16} />
                    </button>
                </div>

                {/* SIGNATURE */}
                <div className="article-signature">
                    LEXENEGAL n'est pas un outil. C'est la mémoire juridique organisée du Sénégal.
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
        </div>
    );
};

export default ArticlePage;
