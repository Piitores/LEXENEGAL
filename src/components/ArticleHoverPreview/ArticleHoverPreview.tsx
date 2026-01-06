import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { createClient } from '@supabase/supabase-js';
import { Scale, ExternalLink } from 'lucide-react';
import './ArticleHoverPreview.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ArticleHoverPreviewProps {
    articleId: string;
    articleNumber: string;
    codeName: string;
    codeSlug: string;
    articleSlug: string;
    children: React.ReactNode;
}

const ArticleHoverPreview: React.FC<ArticleHoverPreviewProps> = ({
    articleId,
    articleNumber,
    codeName,
    codeSlug,
    articleSlug,
    children
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (isHovered && !content) {
            fetchArticleContent();
        }
    }, [isHovered]);

    const fetchArticleContent = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('article_versions')
                .select('content')
                .eq('article_id', articleId)
                .eq('is_current', true)
                .single();

            if (data) {
                // Truncate to first 300 characters
                const truncated = data.content.length > 300
                    ? data.content.substring(0, 300) + '...'
                    : data.content;
                setContent(truncated);
            }
        } catch (error) {
            console.error('Error fetching article:', error);
            setContent('Contenu non disponible');
        } finally {
            setLoading(false);
        }
    };

    const handleMouseEnter = () => {
        if (triggerRef.current) {
            const rect = triggerRef.current.getBoundingClientRect();
            setPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX
            });
        }
        setIsHovered(true);
    };

    const handleMouseLeave = () => {
        setIsHovered(false);
    };

    return (
        <>
            <span
                ref={triggerRef}
                className="article-link-trigger"
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {children}
            </span>

            {createPortal(
                <AnimatePresence>
                    {isHovered && (
                        <motion.div
                            className="article-hover-preview"
                            style={{ top: position.top, left: position.left }}
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.2 }}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            {/* Header */}
                            <div className="preview-header">
                                <Scale size={14} />
                                <span>Article {articleNumber}</span>
                                <span className="preview-code">{codeName}</span>
                            </div>

                            {/* Content */}
                            <div className="preview-content">
                                {loading ? (
                                    <div className="preview-loading">Chargement...</div>
                                ) : (
                                    <p>{content}</p>
                                )}
                            </div>

                            {/* Footer */}
                            <a
                                href={`/code/${codeSlug}/${articleSlug}`}
                                className="preview-link"
                            >
                                Voir l'article complet <ExternalLink size={12} />
                            </a>
                        </motion.div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </>
    );
};

export default ArticleHoverPreview;
