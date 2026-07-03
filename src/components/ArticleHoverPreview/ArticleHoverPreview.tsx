import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';
import { Scale, ExternalLink } from 'lucide-react';
import { articleLabel } from '../../lib/articleLabel';
import './ArticleHoverPreview.css';


interface ArticleHoverPreviewProps {
    articleId?: string;        // optionnel : les renvois COCC n'ont qu'un slug
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
            // Résolution de l'id : direct si fourni, sinon via le couple (code, slug)
            // — les renvois COCC ne portent qu'un slug dans leur href.
            let resolvedId = articleId;
            if (!resolvedId && articleSlug && codeSlug) {
                const { data: code } = await supabase
                    .from('laws_and_codes').select('id').eq('slug', codeSlug).maybeSingle();
                if (code) {
                    const { data: art } = await supabase
                        .from('articles').select('id').eq('slug', articleSlug).eq('code_id', code.id).maybeSingle();
                    resolvedId = art?.id;
                }
            }
            if (!resolvedId) { setContent('Contenu non disponible'); return; }

            const { data } = await supabase
                .from('article_versions')
                .select('content')
                .eq('article_id', resolvedId)
                .eq('is_current', true)
                .single();

            if (data) {
                // Le contenu est du HTML : on en extrait le texte lisible (sinon les
                // balises s'afficheraient telles quelles), puis on tronque proprement.
                const tmp = document.createElement('div');
                tmp.innerHTML = data.content || '';
                const plain = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
                const truncated = plain.length > 300 ? plain.substring(0, 300) + '…' : plain;
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
                className="article-preview-trigger"
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
                                <span>{articleLabel({ article_number: articleNumber })}</span>
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
