import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, ExternalLink } from 'lucide-react';
import { articleLabel } from '../../lib/articleLabel';
import { urlArticle } from '../../lib/urls';
import { apercuArticle } from '../../lib/intituleArticle';
import { lireVersionAffichee, resoudreAdresseArticle } from '../../lib/articlesDuCode';
import { numeroAncienAffiche, requeteVersion } from '../../lib/versionsArticle';
import './ArticleHoverPreview.css';


interface ArticleHoverPreviewProps {
    articleId?: string;        // optionnel : les renvois COCC n'ont qu'un slug
    articleNumber: string;
    codeName: string;
    codeSlug: string;
    articleSlug: string;
    /** Version demandée (fusion des codes 2026) : la version en vigueur à la date de la citation. */
    date?: string | null;
    /** Ancien numéro normalisé (?ancien=L56) dont la version reprend le texte. */
    ancien?: string | null;
    children: React.ReactNode;
}

const ArticleHoverPreview: React.FC<ArticleHoverPreviewProps> = ({
    articleId,
    articleNumber,
    codeName,
    codeSlug,
    articleSlug,
    date,
    ancien,
    children
}) => {
    const [isHovered, setIsHovered] = useState(false);
    const [content, setContent] = useState<string | null>(null);
    const [intitule, setIntitule] = useState<string | null>(null);
    // « ancien art. L.56 » quand l'aperçu montre la rédaction d'un ancien article.
    const [mentionAncien, setMentionAncien] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [position, setPosition] = useState({ top: 0, left: 0 });
    const triggerRef = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        if (isHovered && content === null) {
            fetchArticleContent();
        }
    }, [isHovered]);

    const fetchArticleContent = async () => {
        setLoading(true);
        try {
            // Résolution de l'id : direct si fourni, sinon via le couple (code, slug)
            // - les renvois COCC ne portent qu'un slug dans leur href. Fusion des codes 2026 : un
            // ancien slug (article-l56) mène à l'article qui l'a repris, avec son ancien numéro.
            let resolvedId = articleId;
            let numero: string | null = articleNumber;
            let ancienEffectif = ancien ?? null;
            if (!resolvedId && articleSlug && codeSlug) {
                const cible = await resoudreAdresseArticle(codeSlug, articleSlug);
                resolvedId = cible?.id;
                numero = cible?.article_number ?? articleNumber;
                ancienEffectif = ancienEffectif ?? cible?.ancien ?? null;
            }
            if (!resolvedId) { setContent('Contenu non disponible'); return; }

            // Version robuste : courante (ou la plus récente) sans paramètre ; sinon la version en
            // vigueur à la date demandée (choisirVersions). Plus de `.eq('is_current', true).single()`.
            const data = await lireVersionAffichee(resolvedId, { date: date ?? null, ancien: ancienEffectif }, numero);
            setMentionAncien(data && !data.is_current && data.ancien_numero ? numeroAncienAffiche(data.ancien_numero) : null);

            if (data) {
                // Le contenu est du HTML : on en extrait le texte lisible (sinon les
                // balises s'afficheraient telles quelles), l'INTITULÉ à part (il se collait à
                // la première phrase), puis on tronque proprement.
                const apercu = apercuArticle(data.content, (fragment) => {
                    const tmp = document.createElement('div');
                    tmp.innerHTML = fragment;
                    return tmp.textContent || '';
                });
                setIntitule(apercu.intitule);
                setContent(apercu.texte);
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
                                <span>{articleLabel({ article_number: articleNumber })}{mentionAncien ? ` (ancien art. ${mentionAncien})` : ''}</span>
                                <span className="preview-code">{codeName}</span>
                            </div>

                            {/* Content */}
                            <div className="preview-content">
                                {loading ? (
                                    <div className="preview-loading">Chargement...</div>
                                ) : (
                                    <>
                                        {intitule && <p className="preview-intitule">{intitule}</p>}
                                        {content && <p>{content}</p>}
                                    </>
                                )}
                            </div>

                            {/* Footer */}
                            <a
                                href={`${urlArticle(codeSlug, articleSlug)}${requeteVersion({ date, ancien })}`}
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
